import { z } from 'zod';

const text = z.string().max(12000);
const section = z.object({ heading: z.string().max(200), paragraphs: z.array(text).max(40) });
const table = z.object({
  title: z.string().max(200),
  columns: z.array(z.string().max(100)).min(1).max(10),
  rows: z.array(z.array(z.string().max(500)).max(10)).max(200),
  notes: text.default(''),
}).refine(value => value.rows.every(row => row.length === value.columns.length), 'Table rows must match the columns');

// Optional extension to existing saved AI results. Never substitute invented readings.
export const reportContentSchema = z.object({
  manufacturer: z.string().max(200).default(''),
  serialNumber: z.string().max(200).default(''),
  runningHours: z.string().max(100).default(''),
  remarks: z.array(section).max(40).default([]),
  measurements: z.array(table).max(30).default([]),
  trials: z.array(table).max(10).default([]),
  graphs: z.array(z.object({
    title: z.string().max(200), unit: z.string().max(40),
    labels: z.array(z.string().max(40)).min(2).max(16),
    series: z.array(z.object({ name: z.string().max(100), values: z.array(z.number().finite()).min(2).max(16) })).min(1).max(4),
  }).refine(value => value.series.every(series => series.values.length === value.labels.length), 'Graph series must match labels')).max(10).default([]),
  recommendations: z.array(text).max(40).default([]),
});
export type ReportContent = z.infer<typeof reportContentSchema>;
export type ReportTable = ReportContent['measurements'][number];
export type ReportData = {
  company: { name: string; address: string; contact: string; logo?: Buffer };
  vessel: string; workNumber: string; datePlace: string; machinery: string;
  equipmentType: string; title: string; preparedBy: string; client: string;
  analysisDate: string; analysisId: string; sample?: boolean;
  content: ReportContent;
  evidence: Array<{ label: string; name: string; type: string; summary: string; image?: Buffer; notice?: string }>;
};

export function contentFromAnalysis(result: Record<string, unknown>): ReportContent {
  if (result.report !== undefined) return reportContentSchema.parse(result.report);
  const lines = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  const summary = typeof result.summary === 'string' ? result.summary : '';
  return reportContentSchema.parse({
    remarks: [
      { heading: 'Finding analysis', paragraphs: summary ? [summary] : [] },
      { heading: 'Key observations', paragraphs: lines(result.observations) },
      { heading: 'Combined media overview', paragraphs: typeof result.mediaSummary === 'string' ? [result.mediaSummary] : [] },
    ].filter(item => item.paragraphs.length),
    recommendations: [...lines(result.inspectAreas), ...lines(result.additionalInfo)],
  });
}
