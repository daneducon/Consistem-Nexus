import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { KnowledgeItem } from './normalizeService.js';
import type { QualityReport } from '../../shared/quality.js';
import { emptyQualityReport } from './qualityService.js';

const nullableString = z.string().nullable();
const knowledgeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: nullableString,
  duration: nullableString,
  unitNumber: nullableString,
  unitTitle: nullableString,
  learningObjective: nullableString,
  oaNumber: nullableString,
  oaType: nullableString,
  observations: nullableString,
  programs: z.array(z.string()),
  references: nullableString,
  referenceUrls: z.array(z.string()).default([]),
  materialUrl: nullableString,
  sourceUrl: z.string(),
  sourceFileId: z.string(),
  sourceFileName: z.string(),
  sourceSheetName: z.string(),
  searchContent: z.string(),
});

const qualityIssueSchema = z.object({
  id: z.string(),
  type: z.enum(['missing_header', 'missing_title', 'missing_reference', 'invalid_reference', 'duplicate']),
  message: z.string(),
  sourceFileId: z.string(),
  sourceName: z.string(),
  sheetName: z.string(),
  rowNumber: z.number().int().positive().nullable(),
});

const qualityReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  totalIssues: z.number().int().nonnegative(),
  counts: z.object({
    missing_header: z.number().int().nonnegative(),
    missing_title: z.number().int().nonnegative(),
    missing_reference: z.number().int().nonnegative(),
    invalid_reference: z.number().int().nonnegative(),
    duplicate: z.number().int().nonnegative(),
  }),
  issues: z.array(qualityIssueSchema),
});

const legacySnapshotSchema = z.object({
  version: z.literal(1),
  fileCount: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  items: z.array(knowledgeItemSchema),
});

const currentSnapshotSchema = z.object({
  version: z.literal(2),
  fileCount: z.number().int().nonnegative(),
  fileIds: z.array(z.string()),
  drivePageToken: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  items: z.array(knowledgeItemSchema),
  qualityReport: qualityReportSchema,
});

const persistedSnapshotSchema = z.discriminatedUnion('version', [legacySnapshotSchema, currentSnapshotSchema]);

export type PersistedSnapshot = {
  fileCount: number;
  fileIds: string[];
  drivePageToken: string | null;
  updatedAt: Date;
  items: KnowledgeItem[];
  qualityReport: QualityReport;
};

export async function loadPersistedSnapshot(cachePath: string): Promise<PersistedSnapshot | null> {
  try {
    const contents = await readFile(resolve(cachePath), 'utf8');
    const parsed = persistedSnapshotSchema.parse(JSON.parse(contents));
    return {
      fileCount: parsed.fileCount,
      fileIds: parsed.version === 2
        ? parsed.fileIds
        : [...new Set(parsed.items.map((item) => item.sourceFileId))],
      drivePageToken: parsed.version === 2 ? parsed.drivePageToken : null,
      updatedAt: new Date(parsed.updatedAt),
      items: parsed.items,
      qualityReport: parsed.version === 2 ? parsed.qualityReport : emptyQualityReport(),
    };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : null;
    if (code !== 'ENOENT') {
      console.warn(JSON.stringify({
        event: 'knowledge_cache_load_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
    return null;
  }
}

export async function persistSnapshot(cachePath: string, snapshot: PersistedSnapshot): Promise<void> {
  const targetPath = resolve(cachePath);
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  const contents = JSON.stringify({
    version: 2,
    fileCount: snapshot.fileCount,
    fileIds: snapshot.fileIds,
    drivePageToken: snapshot.drivePageToken,
    updatedAt: snapshot.updatedAt.toISOString(),
    items: snapshot.items,
    qualityReport: snapshot.qualityReport,
  });

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, targetPath);
}
