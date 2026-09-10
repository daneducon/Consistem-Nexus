import { createHash } from 'node:crypto';
import type { QualityIssue, QualityIssueType, QualityReport } from '../../shared/quality.js';
import { normalizeText, type KnowledgeItem } from './normalizeService.js';

const issueTypes: QualityIssueType[] = [
  'missing_header',
  'missing_title',
  'missing_reference',
  'invalid_reference',
  'duplicate',
];

export function buildQualityReport(items: KnowledgeItem[], normalizationIssues: QualityIssue[], generatedAt: Date): QualityReport {
  const issues = [...normalizationIssues];
  const fingerprints = new Map<string, KnowledgeItem>();

  for (const item of items) {
    const fingerprint = normalizeText(`${item.sourceFileId}:${item.name}:${item.programs.join(',')}`);
    const original = fingerprints.get(fingerprint);
    if (!original) {
      fingerprints.set(fingerprint, item);
      continue;
    }

    issues.push({
      id: createHash('sha256').update(`${item.id}:duplicate`).digest('hex').slice(0, 16),
      type: 'duplicate',
      message: `O OA “${item.name}” aparece mais de uma vez na mesma matriz.`,
      sourceFileId: item.sourceFileId,
      sourceName: item.sourceFileName,
      sheetName: item.sourceSheetName,
      rowNumber: null,
    });
  }

  const counts = Object.fromEntries(issueTypes.map((type) => [type, 0])) as Record<QualityIssueType, number>;
  for (const issue of issues) counts[issue.type] += 1;

  return {
    generatedAt: generatedAt.toISOString(),
    totalIssues: issues.length,
    counts,
    issues,
  };
}

export function emptyQualityReport(): QualityReport {
  return buildQualityReport([], [], new Date(0));
}
