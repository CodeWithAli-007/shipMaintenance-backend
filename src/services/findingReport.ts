import { In } from 'typeorm';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { AppDataSource } from '../data-source.js';
import { env } from '../config/env.js';
import { AiAnalysis } from '../entities/AiAnalysis.js';
import { Finding } from '../entities/Finding.js';
import { FindingAttachment } from '../entities/FindingAttachment.js';
import { AiAnalysisStatus, AiAnalysisType } from '../entities/enums.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { assertFindingAccess, getMediaFile } from './findingMedia.js';
import { isBackofficeRole } from './access.js';
import { contentFromAnalysis, type ReportData } from '../reports/model.js';
import { renderReport } from '../reports/pdf.js';
import type { AuthUser } from '../types/index.js';

export function assertReportReady(analysis: Pick<AiAnalysis, 'status' | 'result'> | null) {
  if (!analysis || analysis.status !== AiAnalysisStatus.COMPLETED || !analysis.result) {
    throw new ConflictError('Generate or update the AI analysis before exporting the report.');
  }
}

export async function exportFindingReport(findingId: string, actor: AuthUser) {
  if (!isBackofficeRole(actor.role)) throw new ForbiddenError('Only Backoffice can export reports');
  await assertFindingAccess(findingId, actor);
  const finding = await AppDataSource.getRepository(Finding).findOne({
    where: { id: findingId }, relations: { project: { vessel: { client: true } } },
  });
  if (!finding) throw new NotFoundError('Finding not found');
  const analysis = await AppDataSource.getRepository(AiAnalysis).findOne({
    where: { finding: { id: findingId }, analysisType: AiAnalysisType.FINDING_ANALYSIS },
    relations: { requestedBy: true },
  });
  assertReportReady(analysis);
  const snapshot = analysis!.inputSnapshot;
  const ids = Array.isArray(snapshot?.mediaAssetIds)
    ? snapshot.mediaAssetIds.filter((id): id is string => typeof id === 'string') : [];
  // Use the analysed snapshot, never the user's unsaved/current selection.
  const attachments = ids.length ? await AppDataSource.getRepository(FindingAttachment).find({
    where: { finding: { id: findingId }, mediaAsset: { id: In(ids) } }, relations: { mediaAsset: true },
  }) : [];
  const savedEvidence = Array.isArray(snapshot?.evidence) ? snapshot.evidence as Array<{ mediaId: string; text: string; name: string; type: string }> : [];
  const evidenceIds = Array.isArray(snapshot?.evidenceIds) ? snapshot.evidenceIds.filter((id): id is string => typeof id === 'string') : [];
  const evidenceRows = !savedEvidence.length && evidenceIds.length ? await AppDataSource.getRepository(AiAnalysis).find({
    where: { id: In(evidenceIds), analysisType: AiAnalysisType.MEDIA_EVIDENCE }, relations: { mediaAsset: true },
  }) : [];
  const evidence: ReportData['evidence'] = [];
  for (const [index, id] of ids.entries()) {
    const attachment = attachments.find(item => item.mediaAsset.id === id);
    const saved = savedEvidence.find(item => item.mediaId === id);
    const asset = attachment?.mediaAsset;
    const item: ReportData['evidence'][number] = {
      label: `R${index + 1}`, name: asset?.originalFilename || saved?.name || id,
      type: asset?.mediaType || saved?.type || 'MEDIA',
      summary: saved?.text || evidenceRows.find(row => row.mediaAsset?.id === id)?.evidenceText || '',
    };
    if (!asset) item.notice = 'Original attachment is unavailable.';
    else if (asset.mediaType === 'IMAGE') {
      try {
        const { bytes } = await getMediaFile(findingId, id, actor);
        item.image = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
          .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      } catch { item.notice = 'Image could not be retrieved or decoded; saved analysis is included above.'; }
    }
    evidence.push(item);
  }
  const project = finding.project, vessel = project.vessel;
  const date = (value: Date | null) => value ? value.toISOString().slice(0, 10) : 'Not provided';
  const data: ReportData = {
    company: { name: env.report.companyName, address: env.report.address, contact: env.report.contact,
      ...(env.report.logoPath ? { logo: await readFile(env.report.logoPath) } : {}) },
    vessel: vessel.name, workNumber: project.projectCode,
    datePlace: [date(project.startedAt || finding.createdAt), project.closedAt ? date(project.closedAt) : '', project.vesselLocationSnapshot].filter(Boolean).join(' / '),
    machinery: finding.equipmentName || 'Not provided', equipmentType: finding.equipmentModel || '',
    title: finding.title || `Finding ${finding.findingNumber}`, preparedBy: analysis!.requestedBy?.fullName || 'Backoffice',
    client: vessel.client.name, analysisDate: date(analysis!.analyzedAt), analysisId: analysis!.id,
    content: contentFromAnalysis(analysis!.result!), evidence,
  };
  const bytes = await renderReport(data);
  const filename = `${project.projectCode}-finding-${finding.findingNumber}-report.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
  return { bytes, filename };
}
