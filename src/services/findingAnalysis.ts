import { createHash } from 'node:crypto';
import { AppDataSource } from '../data-source.js';
import { env } from '../config/env.js';
import { AiAnalysis } from '../entities/AiAnalysis.js';
import { Finding } from '../entities/Finding.js';
import { FindingAiMedia } from '../entities/FindingAiMedia.js';
import { FindingAttachment } from '../entities/FindingAttachment.js';
import { MediaAsset } from '../entities/MediaAsset.js';
import { User } from '../entities/User.js';
import {
  AiAnalysisStatus,
  AiAnalysisType,
  CommentVisibility,
  MediaType,
} from '../entities/enums.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { assertFindingAccess, getMediaFile, isMediaExpired } from './findingMedia.js';
import { isBackofficeRole } from './access.js';
import type { AuthUser } from '../types/index.js';

export const MEDIA_EVIDENCE_PROMPT_VERSION = 'media-evidence-v1';
export const DOCUMENT_EVIDENCE_PROMPT_VERSION = 'doc-python-summary-v1';
export const FINDING_ANALYSIS_PROMPT_VERSION = 'finding-analysis-v1';

const AI_ELIGIBLE_MEDIA = new Set<MediaType>([
  MediaType.IMAGE,
  MediaType.VIDEO,
  MediaType.AUDIO,
  MediaType.DOCUMENT,
]);

const DOCUMENT_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.xls', '.xlsx'];

function isSummarizableDocument(asset: MediaAsset): boolean {
  if (asset.mediaType !== MediaType.DOCUMENT) return false;
  const name = (asset.originalFilename || '').toLowerCase();
  const mime = (asset.mimeType || '').toLowerCase();
  if (DOCUMENT_EXTS.some((ext) => name.endsWith(ext))) return true;
  return (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('text/plain') ||
    mime.includes('msword') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  );
}

function isAiEligibleAsset(asset: MediaAsset): boolean {
  if (!AI_ELIGIBLE_MEDIA.has(asset.mediaType)) return false;
  if (asset.mediaType === MediaType.DOCUMENT) return isSummarizableDocument(asset);
  return true;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertBackoffice(actor: AuthUser) {
  if (!isBackofficeRole(actor.role)) {
    throw new ForbiddenError('Only Backoffice can manage AI analysis');
  }
}

async function loadFinding(id: string) {
  const finding = await AppDataSource.getRepository(Finding).findOne({
    where: { id },
    relations: {
      createdBy: true,
      updates: { createdBy: true },
      comments: { user: true },
      project: { vessel: true },
    },
  });
  if (!finding) throw new NotFoundError('Finding not found');
  return finding;
}

function assembleSourceText(finding: Finding): string {
  const lines: string[] = [];
  if (finding.title?.trim()) lines.push(`Title: ${finding.title.trim()}`);
  if (finding.description?.trim()) lines.push(`Description: ${finding.description.trim()}`);
  const equipment = [
    finding.equipmentName && `name=${finding.equipmentName}`,
    finding.equipmentModel && `model=${finding.equipmentModel}`,
    finding.equipmentLocation && `location=${finding.equipmentLocation}`,
  ].filter(Boolean);
  if (equipment.length) lines.push(`Equipment: ${equipment.join(', ')}`);
  lines.push(`Severity: ${finding.severity}`);
  lines.push(`Status: ${finding.status}`);

  const updates = (finding.updates ?? [])
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const update of updates) {
    if (!update.note?.trim()) continue;
    const who = update.createdBy?.fullName || 'Technician';
    lines.push(
      `[update ${update.createdAt.toISOString()}] ${who}: ${update.note.trim()}`,
    );
  }

  const comments = (finding.comments ?? [])
    .filter((c) => c.visibility === CommentVisibility.TECHNICIAN_VISIBLE)
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const comment of comments) {
    if (!comment.comment?.trim()) continue;
    const who = comment.user?.fullName || 'User';
    lines.push(
      `[comment ${comment.createdAt.toISOString()}] ${who}: ${comment.comment.trim()}`,
    );
  }

  return lines.join('\n');
}

function hashInput(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n---\n')).digest('hex');
}

function uiState(status: AiAnalysisStatus | null | undefined): string {
  if (!status) return 'NONE';
  if (status === AiAnalysisStatus.COMPLETED) return 'UP_TO_DATE';
  if (status === AiAnalysisStatus.OUTDATED) return 'OUTDATED';
  if (status === AiAnalysisStatus.PROCESSING || status === AiAnalysisStatus.PENDING) {
    return 'PROCESSING';
  }
  if (status === AiAnalysisStatus.FAILED) return 'FAILED';
  return status;
}

export async function markFindingAnalysisOutdated(findingId: string) {
  const repo = AppDataSource.getRepository(AiAnalysis);
  const row = await repo.findOne({
    where: {
      analysisType: AiAnalysisType.FINDING_ANALYSIS,
      finding: { id: findingId },
    },
  });
  if (row && row.status === AiAnalysisStatus.COMPLETED) {
    row.status = AiAnalysisStatus.OUTDATED;
    await repo.save(row);
  }
}

export async function getFindingAiState(findingId: string, actor: AuthUser) {
  await assertFindingAccess(findingId, actor);
  await loadFinding(findingId);

  const attachments = await AppDataSource.getRepository(FindingAttachment).find({
    where: { finding: { id: findingId } },
    relations: { mediaAsset: true },
    order: { sortOrder: 'ASC', createdAt: 'ASC' },
  });

  const selections = await AppDataSource.getRepository(FindingAiMedia).find({
    where: { finding: { id: findingId } },
    relations: { findingAttachment: true },
  });
  const selectedByAttachment = new Map(
    selections.map((row) => [row.findingAttachment.id, row]),
  );

  const mediaIds = attachments.map((a) => a.mediaAsset.id);
  const mediaEvidence =
    mediaIds.length === 0
      ? []
      : await AppDataSource.getRepository(AiAnalysis)
          .createQueryBuilder('a')
          .leftJoinAndSelect('a.mediaAsset', 'mediaAsset')
          .where('a.analysis_type = :type', { type: AiAnalysisType.MEDIA_EVIDENCE })
          .andWhere('mediaAsset.id IN (:...mediaIds)', { mediaIds })
          .getMany();

  const evidenceByMedia = new Map(
    mediaEvidence
      .filter((row) => row.mediaAsset)
      .map((row) => [row.mediaAsset!.id, row]),
  );

  const findingAnalysis = await AppDataSource.getRepository(AiAnalysis).findOne({
    where: {
      analysisType: AiAnalysisType.FINDING_ANALYSIS,
      finding: { id: findingId },
    },
  });

  const media = attachments
    .filter((link) => !isMediaExpired(link.mediaAsset.expiresAt))
    .filter((link) => isAiEligibleAsset(link.mediaAsset))
    .map((link) => {
      const selection = selectedByAttachment.get(link.id);
      const evidence = evidenceByMedia.get(link.mediaAsset.id);
      const summary = evidence?.evidenceText?.trim() || '';
      return {
        attachmentId: link.id,
        mediaId: link.mediaAsset.id,
        name: link.mediaAsset.originalFilename ?? 'media',
        type: link.mediaAsset.mediaType,
        mimeType: link.mediaAsset.mimeType ?? 'application/octet-stream',
        selected: selection?.selected === true,
        evidenceStatus: evidence?.status ?? null,
        hasEvidence:
          evidence?.status === AiAnalysisStatus.COMPLETED && Boolean(summary),
        analysed:
          evidence?.status === AiAnalysisStatus.COMPLETED && Boolean(summary),
        evidenceSummary: summary
          ? summary.length > 600
            ? `${summary.slice(0, 600)}…`
            : summary
          : null,
        analyzedAt: evidence?.analyzedAt ?? null,
      };
    });

  const result = findingAnalysis?.result as
    | {
        observations?: string[];
        inspectAreas?: string[];
        additionalInfo?: string[];
        summary?: string;
        mediaSummary?: string;
      }
    | null
    | undefined;

  return {
    uiState: uiState(findingAnalysis?.status),
    analysis: findingAnalysis
      ? {
          id: findingAnalysis.id,
          status: findingAnalysis.status,
          result: findingAnalysis.result,
          observations: result?.observations ?? [],
          inspectAreas: result?.inspectAreas ?? [],
          additionalInfo: result?.additionalInfo ?? [],
          summary: result?.summary ?? '',
          mediaSummary: result?.mediaSummary ?? '',
          analyzedAt: findingAnalysis.analyzedAt,
          errorMessage: findingAnalysis.errorMessage,
          inputHash: findingAnalysis.inputHash,
        }
      : null,
    media,
  };
}

/** Persist Backoffice AI media selection. Does NOT trigger LLM calls. */
export async function setFindingAiMediaSelection(
  findingId: string,
  items: Array<{ attachmentId: string; selected: boolean }>,
  actor: AuthUser,
) {
  assertBackoffice(actor);
  await assertFindingAccess(findingId, actor);
  await loadFinding(findingId);

  const attachmentRepo = AppDataSource.getRepository(FindingAttachment);
  const selectionRepo = AppDataSource.getRepository(FindingAiMedia);
  let changed = false;

  for (const item of items) {
    const attachment = await attachmentRepo.findOne({
      where: { id: item.attachmentId, finding: { id: findingId } },
      relations: { mediaAsset: true },
    });
    if (!attachment) {
      throw new ValidationError('Attachment does not belong to this finding');
    }
    if (!isAiEligibleAsset(attachment.mediaAsset)) {
      throw new ValidationError(
        'Only IMAGE, VIDEO, AUDIO, and PDF/DOCX documents can be selected for AI',
      );
    }

    let row = await selectionRepo.findOne({
      where: {
        finding: { id: findingId },
        findingAttachment: { id: item.attachmentId },
      },
    });

    if (!row) {
      row = selectionRepo.create({
        finding: { id: findingId } as Finding,
        findingAttachment: { id: item.attachmentId } as FindingAttachment,
        selected: item.selected,
        selectedBy: item.selected ? ({ id: actor.id } as User) : null,
        selectedAt: item.selected ? new Date() : null,
        updatedBy: { id: actor.id } as User,
      });
      changed = true;
    } else if (row.selected !== item.selected) {
      row.selected = item.selected;
      row.updatedBy = { id: actor.id } as User;
      if (item.selected && !row.selectedAt) {
        row.selectedBy = { id: actor.id } as User;
        row.selectedAt = new Date();
      }
      changed = true;
    }
    await selectionRepo.save(row);
  }

  if (changed) {
    await markFindingAnalysisOutdated(findingId);
  }

  return getFindingAiState(findingId, actor);
}

async function ensureMediaEvidence(
  findingId: string,
  mediaAssetId: string,
  actor: AuthUser,
): Promise<AiAnalysis> {
  const repo = AppDataSource.getRepository(AiAnalysis);
  const existing = await repo.findOne({
    where: {
      analysisType: AiAnalysisType.MEDIA_EVIDENCE,
      mediaAsset: { id: mediaAssetId },
    },
    relations: { mediaAsset: true },
  });

  if (
    existing &&
    existing.status === AiAnalysisStatus.COMPLETED &&
    existing.evidenceText?.trim()
  ) {
    return existing;
  }

  const { asset, bytes } = await getMediaFile(findingId, mediaAssetId, actor);
  const contentHash = asset.contentHash || sha256Hex(bytes);
  if (!asset.contentHash) {
    await AppDataSource.getRepository(MediaAsset).update(asset.id, { contentHash });
  }

  const row =
    existing ??
    repo.create({
      analysisType: AiAnalysisType.MEDIA_EVIDENCE,
      mediaAsset: { id: mediaAssetId } as MediaAsset,
      finding: null,
      status: AiAnalysisStatus.PROCESSING,
      requestedBy: { id: actor.id } as User,
      promptVersion: MEDIA_EVIDENCE_PROMPT_VERSION,
      sourceHash: contentHash,
    });

  row.status = AiAnalysisStatus.PROCESSING;
  row.errorMessage = null;
  row.requestedBy = { id: actor.id } as User;
  row.promptVersion = MEDIA_EVIDENCE_PROMPT_VERSION;
  row.sourceHash = contentHash;
  await repo.save(row);

  try {
    let raw: Record<string, unknown> | null = null;
    let evidenceText = '';
    let transcript: string | null = null;
    let promptVersion = MEDIA_EVIDENCE_PROMPT_VERSION;
    let modelName = env.llmServiceUrl;

    if (asset.mediaType === MediaType.DOCUMENT) {
      if (!isSummarizableDocument(asset)) {
        throw new Error('Unsupported document type for AI summary');
      }
      promptVersion = DOCUMENT_EVIDENCE_PROMPT_VERSION;
      const form = new FormData();
      const filename = asset.originalFilename || 'document.pdf';
      form.append(
        'file',
        new File([new Uint8Array(bytes)], filename, {
          type: asset.mimeType || 'application/octet-stream',
        }),
      );
      form.append('summary_words', '400');

      const response = await fetch(`${env.llmServiceUrl}/documents/summarize`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
      raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(
          typeof raw?.error === 'string' ? raw.error : 'Document summarization failed',
        );
      }
      evidenceText =
        typeof raw?.summary === 'string'
          ? raw.summary
          : typeof raw?.Summary === 'string'
            ? String(raw.Summary)
            : '';
      if (!evidenceText.trim() && raw && typeof raw === 'object') {
        evidenceText = JSON.stringify(raw);
      }
      modelName = 'python-doc-summarizer';
    } else {
      const url = `${env.llmServiceUrl}/analyze/media-evidence`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: asset.originalFilename ?? 'media',
          type: asset.mediaType,
          mimeType: asset.mimeType ?? 'application/octet-stream',
          base64: bytes.toString('base64'),
        }),
        signal: AbortSignal.timeout(180_000),
      });
      raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(
          typeof raw?.error === 'string' ? raw.error : 'Media evidence extraction failed',
        );
      }
      evidenceText =
        typeof raw?.plainEvidenceText === 'string'
          ? raw.plainEvidenceText
          : typeof raw?.evidenceText === 'string'
            ? raw.evidenceText
            : '';
      transcript = typeof raw?.transcriptText === 'string' ? raw.transcriptText : null;
      modelName =
        typeof raw?.modelName === 'string' ? raw.modelName : env.llmServiceUrl;
    }

    row.status = AiAnalysisStatus.COMPLETED;
    row.result = raw;
    row.evidenceText = evidenceText.trim() || JSON.stringify(raw);
    row.transcriptText = transcript;
    row.promptVersion = promptVersion;
    row.modelName = modelName;
    row.analyzedAt = new Date();
    row.errorMessage = null;
    await repo.save(row);
    return row;
  } catch (error) {
    row.status = AiAnalysisStatus.FAILED;
    row.errorMessage = error instanceof Error ? error.message : 'Media evidence failed';
    await repo.save(row);
    throw new AppError(row.errorMessage, 502, 'MEDIA_EVIDENCE_FAILED');
  }
}

/** Explicit Backoffice action: extract missing MEDIA_EVIDENCE, then FINDING_ANALYSIS. */
export async function runFindingAiAnalysis(findingId: string, actor: AuthUser) {
  assertBackoffice(actor);
  await assertFindingAccess(findingId, actor);
  const finding = await loadFinding(findingId);

  const selections = await AppDataSource.getRepository(FindingAiMedia).find({
    where: { finding: { id: findingId }, selected: true },
    relations: { findingAttachment: { mediaAsset: true } },
  });

  const selected = selections.filter(
    (row) =>
      row.findingAttachment?.mediaAsset &&
      isAiEligibleAsset(row.findingAttachment.mediaAsset) &&
      !isMediaExpired(row.findingAttachment.mediaAsset.expiresAt),
  );

  const sourceText = assembleSourceText(finding);
  if (!selected.length && !sourceText.trim()) {
    throw new ValidationError(
      'Select at least one media file (image/video/audio/PDF/DOCX) or ensure finding chat has content',
    );
  }

  const evidenceRows: AiAnalysis[] = [];
  for (const row of selected) {
    const mediaId = row.findingAttachment.mediaAsset.id;
    evidenceRows.push(await ensureMediaEvidence(findingId, mediaId, actor));
  }

  if (!selected.length && !evidenceRows.length) {
    // Chat-only analysis still produces FINDING_ANALYSIS
  } else if (!evidenceRows.length) {
    throw new ValidationError('Select at least one IMAGE, VIDEO, AUDIO, or PDF/DOCX for AI analysis');
  }
  const evidenceTexts = evidenceRows.map((row) => row.evidenceText || '');
  const attachmentIds = selected.map((row) => row.findingAttachment.id);
  const mediaAssetIds = selected.map((row) => row.findingAttachment.mediaAsset.id);
  const evidenceIds = evidenceRows.map((row) => row.id);
  const inputHash = hashInput([sourceText, ...evidenceTexts, ...attachmentIds]);

  const repo = AppDataSource.getRepository(AiAnalysis);
  let analysis = await repo.findOne({
    where: {
      analysisType: AiAnalysisType.FINDING_ANALYSIS,
      finding: { id: findingId },
    },
  });
  if (!analysis) {
    analysis = repo.create({
      analysisType: AiAnalysisType.FINDING_ANALYSIS,
      finding: { id: findingId } as Finding,
      mediaAsset: null,
      status: AiAnalysisStatus.PROCESSING,
    });
  }

  analysis.status = AiAnalysisStatus.PROCESSING;
  analysis.errorMessage = null;
  analysis.requestedBy = { id: actor.id } as User;
  analysis.promptVersion = FINDING_ANALYSIS_PROMPT_VERSION;
  await repo.save(analysis);

  try {
    const url = `${env.llmServiceUrl}/analyze/finding`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        findingTitle: finding.title ?? `Finding #${finding.findingNumber}`,
        equipment: [
          finding.equipmentName,
          finding.equipmentModel,
          finding.equipmentLocation,
          `Severity: ${finding.severity}`,
        ]
          .filter(Boolean)
          .join(' | '),
        sourceText,
        evidenceTexts: evidenceRows.map((row, index) => ({
          label: `R${index + 1}`,
          mediaId: mediaAssetIds[index],
          text: row.evidenceText,
        })),
        chat: sourceText
          .split('\n')
          .filter(Boolean)
          .map((note) => ({ note })),
        // Always send assembled finding/activity text; combine with per-media summaries.
        includeChat: true,
        media: [],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new Error(
        typeof raw?.error === 'string' ? raw.error : 'Finding analysis failed',
      );
    }

    analysis.status = AiAnalysisStatus.COMPLETED;
    analysis.result = raw;
    analysis.evidenceText = null;
    analysis.inputHash = inputHash;
    analysis.inputSnapshot = {
      attachmentIds,
      mediaAssetIds,
      evidenceIds,
      evidencePromptVersion: MEDIA_EVIDENCE_PROMPT_VERSION,
      findingPromptVersion: FINDING_ANALYSIS_PROMPT_VERSION,
    };
    analysis.sourceTextSnapshot = sourceText;
    analysis.modelName =
      typeof raw?.modelName === 'string' ? raw.modelName : env.llmServiceUrl;
    analysis.analyzedAt = new Date();
    analysis.errorMessage = null;
    await repo.save(analysis);
  } catch (error) {
    analysis.status = AiAnalysisStatus.FAILED;
    analysis.errorMessage =
      error instanceof Error ? error.message : 'Finding analysis failed';
    await repo.save(analysis);
    throw new AppError(analysis.errorMessage, 502, 'FINDING_ANALYSIS_FAILED');
  }

  return getFindingAiState(findingId, actor);
}

/** Legacy helper: map mediaIds → selection, then run analysis. */
export async function analyzeFindingWithLlm(
  findingId: string,
  mediaIds: string[],
  actor: AuthUser,
) {
  assertBackoffice(actor);
  await assertFindingAccess(findingId, actor);

  const attachments = await AppDataSource.getRepository(FindingAttachment).find({
    where: { finding: { id: findingId } },
    relations: { mediaAsset: true },
  });
  const byMedia = new Map(attachments.map((a) => [a.mediaAsset.id, a]));
  const items: Array<{ attachmentId: string; selected: boolean }> = [];

  for (const mediaId of mediaIds) {
    const attachment = byMedia.get(mediaId);
    if (!attachment) throw new ValidationError('Media does not belong to this finding');
    items.push({ attachmentId: attachment.id, selected: true });
  }

  for (const attachment of attachments) {
    if (
      !mediaIds.includes(attachment.mediaAsset.id) &&
      isAiEligibleAsset(attachment.mediaAsset)
    ) {
      items.push({ attachmentId: attachment.id, selected: false });
    }
  }

  await setFindingAiMediaSelection(findingId, items, actor);
  const state = await runFindingAiAnalysis(findingId, actor);
  const analysis = state.analysis;
  return {
    observations: analysis?.observations ?? [],
    inspectAreas: analysis?.inspectAreas ?? [],
    additionalInfo: analysis?.additionalInfo ?? [],
    summary: analysis?.summary ?? '',
    mediaSummary: analysis?.mediaSummary ?? '',
    runAt: analysis?.analyzedAt
      ? new Date(analysis.analyzedAt).toISOString()
      : new Date().toISOString(),
    imageCount: state.media.filter((m) => m.selected && m.type === 'IMAGE').length,
    videoCount: state.media.filter((m) => m.selected && m.type === 'VIDEO').length,
    audioCount: state.media.filter((m) => m.selected && m.type === 'AUDIO').length,
    fileCount: state.media.filter((m) => m.selected && m.type === 'DOCUMENT').length,
    uiState: state.uiState,
    status: analysis?.status ?? null,
  };
}
