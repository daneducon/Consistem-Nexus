export type QualityIssueType = 'missing_header' | 'missing_title' | 'missing_reference' | 'invalid_reference' | 'duplicate';

export type QualityIssue = {
  id: string;
  type: QualityIssueType;
  message: string;
  sourceFileId: string;
  sourceName: string;
  sheetName: string;
  rowNumber: number | null;
};

export type QualityReport = {
  generatedAt: string;
  totalIssues: number;
  counts: Record<QualityIssueType, number>;
  issues: QualityIssue[];
};
