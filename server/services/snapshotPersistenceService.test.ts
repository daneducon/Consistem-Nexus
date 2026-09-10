import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPersistedSnapshot, persistSnapshot } from './snapshotPersistenceService.js';
import type { KnowledgeItem } from './normalizeService.js';
import { emptyQualityReport } from './qualityService.js';

const testDirectory = join(tmpdir(), `consistem-nexus-${randomUUID()}`);
const cachePath = join(testDirectory, 'knowledge-base.json');

const cachedItem: KnowledgeItem = {
  id: 'item-1',
  name: 'Manutenção de Processos',
  summary: 'Descrição',
  duration: null,
  unitNumber: 'U04',
  unitTitle: 'Engenharia',
  learningObjective: 'Aprender o processo',
  oaNumber: '4.3',
  oaType: 'DEMONSTRAÇÃO',
  observations: null,
  programs: ['CCPMEC160'],
  references: null,
  referenceUrls: [],
  materialUrl: null,
  sourceUrl: 'https://docs.google.com/spreadsheets/example',
  sourceFileId: 'source-1',
  sourceFileName: 'Matriz de engenharia',
  sourceSheetName: 'MATRIZ',
  searchContent: 'Programas: CCPMEC160',
};

afterEach(() => rm(testDirectory, { recursive: true, force: true }));

describe('snapshot persistence', () => {
  it('writes and restores a validated snapshot', async () => {
    const updatedAt = new Date('2026-09-10T12:00:00.000Z');
    const qualityReport = emptyQualityReport();
    await persistSnapshot(cachePath, {
      fileCount: 1,
      fileIds: ['source-1'],
      drivePageToken: 'page-token',
      updatedAt,
      items: [cachedItem],
      qualityReport,
    });

    const restored = await loadPersistedSnapshot(cachePath);
    expect(restored).toEqual({
      fileCount: 1,
      fileIds: ['source-1'],
      drivePageToken: 'page-token',
      updatedAt,
      items: [cachedItem],
      qualityReport,
    });
  });

  it('returns null when no cache exists', async () => {
    await expect(loadPersistedSnapshot(cachePath)).resolves.toBeNull();
  });
});
