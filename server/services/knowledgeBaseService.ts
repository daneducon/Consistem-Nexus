import { config } from '../config';
import {
  getDriveStartPageToken,
  isSpreadsheetInConfiguredFolder,
  listDriveChanges,
  listSpreadsheets,
  readSpreadsheet,
} from './googleApiService';
import { normalizeSpreadsheetWithReport, normalizeText, type KnowledgeItem } from './normalizeService';
import { loadPersistedSnapshot, persistSnapshot } from './snapshotPersistenceService';
import { buildQualityReport, emptyQualityReport } from './qualityService';
import type { QualityIssue, QualityReport } from '../../shared/quality';

type Snapshot = {
  items: KnowledgeItem[];
  fileCount: number;
  fileIds: string[];
  drivePageToken: string | null;
  qualityReport: QualityReport;
  updatedAt: Date | null;
  initialized: boolean;
};

const snapshot: Snapshot = {
  items: [],
  fileCount: 0,
  fileIds: [],
  drivePageToken: null,
  qualityReport: emptyQualityReport(),
  updatedAt: null,
  initialized: false,
};
let refreshPromise: Promise<void> | null = null;
let restorePromise: Promise<void> | null = null;

function deduplicate(items: KnowledgeItem[]): KnowledgeItem[] {
  const uniqueItems = new Map<string, KnowledgeItem>();

  for (const item of items) {
    if (!uniqueItems.has(item.id)) uniqueItems.set(item.id, item);
  }

  return [...uniqueItems.values()];
}

export function refreshKnowledgeBase(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const startedAt = Date.now();
    const drivePageToken = await getDriveStartPageToken();
    const files = await listSpreadsheets();
    const spreadsheets = await Promise.all(files.map(readSpreadsheet));
    const normalized = spreadsheets.map(normalizeSpreadsheetWithReport);
    const items = deduplicate(normalized.flatMap((result) => result.items));
    const updatedAt = new Date();
    const qualityReport = buildQualityReport(
      items,
      normalized.flatMap((result) => result.issues),
      updatedAt,
    );

    await persistSnapshot(config.knowledgeCachePath, {
      items,
      fileCount: files.length,
      fileIds: files.map((file) => file.id),
      drivePageToken,
      updatedAt,
      qualityReport,
    });

    snapshot.items = items;
    snapshot.fileCount = files.length;
    snapshot.fileIds = files.map((file) => file.id);
    snapshot.drivePageToken = drivePageToken;
    snapshot.qualityReport = qualityReport;
    snapshot.updatedAt = updatedAt;
    snapshot.initialized = true;
    console.info(JSON.stringify({
      event: 'knowledge_base_refreshed',
      files: files.length,
      items: items.length,
      durationMs: Date.now() - startedAt,
    }));
  })()
    .catch((error: unknown) => {
      console.error(JSON.stringify({
        event: 'knowledge_base_refresh_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function synchronizeDriveChanges(): Promise<void> {
  await restoreKnowledgeBase();
  if (!snapshot.drivePageToken) return refreshKnowledgeBase();
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const startedAt = Date.now();
    const result = await listDriveChanges(snapshot.drivePageToken!);
    const existingFileIds = new Set(snapshot.fileIds);
    const relevantChanges = result.changes.filter(
      (change) => existingFileIds.has(change.fileId) || isSpreadsheetInConfiguredFolder(change.file),
    );
    const changedFiles = new Map(relevantChanges.map((change) => [change.fileId, change]));
    const affectedIds = new Set(changedFiles.keys());
    const retainedItems = snapshot.items.filter((item) => !affectedIds.has(item.sourceFileId));
    const retainedIssues = snapshot.qualityReport.issues.filter(
      (issue) => issue.type !== 'duplicate' && !affectedIds.has(issue.sourceFileId),
    );
    const fileIds = new Set(snapshot.fileIds);
    const changedItems: KnowledgeItem[] = [];
    const changedIssues: QualityIssue[] = [];

    for (const change of changedFiles.values()) {
      if (!isSpreadsheetInConfiguredFolder(change.file)) {
        fileIds.delete(change.fileId);
        continue;
      }

      const spreadsheet = await readSpreadsheet(change.file);
      const normalized = normalizeSpreadsheetWithReport(spreadsheet);
      changedItems.push(...normalized.items);
      changedIssues.push(...normalized.issues);
      fileIds.add(change.fileId);
    }

    const items = deduplicate([...retainedItems, ...changedItems]);
    const dataChanged = affectedIds.size > 0;
    const updatedAt = dataChanged ? new Date() : snapshot.updatedAt!;
    const qualityReport = dataChanged
      ? buildQualityReport(items, [...retainedIssues, ...changedIssues], updatedAt)
      : snapshot.qualityReport;

    await persistSnapshot(config.knowledgeCachePath, {
      items,
      fileCount: fileIds.size,
      fileIds: [...fileIds],
      drivePageToken: result.newPageToken,
      updatedAt,
      qualityReport,
    });

    snapshot.items = items;
    snapshot.fileCount = fileIds.size;
    snapshot.fileIds = [...fileIds];
    snapshot.drivePageToken = result.newPageToken;
    snapshot.qualityReport = qualityReport;
    snapshot.updatedAt = updatedAt;
    snapshot.initialized = true;
    console.info(JSON.stringify({
      event: 'drive_changes_synchronized',
      changes: result.changes.length,
      affectedFiles: affectedIds.size,
      items: items.length,
      durationMs: Date.now() - startedAt,
    }));
  })()
    .catch(async (error: unknown) => {
      if (error instanceof Error && error.message.includes('Google API respondeu 410')) {
        snapshot.drivePageToken = null;
        if (snapshot.updatedAt) {
          await persistSnapshot(config.knowledgeCachePath, {
            items: snapshot.items,
            fileCount: snapshot.fileCount,
            fileIds: snapshot.fileIds,
            drivePageToken: null,
            updatedAt: snapshot.updatedAt,
            qualityReport: snapshot.qualityReport,
          });
        }
      }
      console.error(JSON.stringify({
        event: 'drive_changes_sync_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function restoreKnowledgeBase(): Promise<void> {
  if (snapshot.initialized) return;
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    const persisted = await loadPersistedSnapshot(config.knowledgeCachePath);
    if (!persisted || snapshot.initialized) return;

    snapshot.items = persisted.items;
    snapshot.fileCount = persisted.fileCount;
    snapshot.fileIds = persisted.fileIds;
    snapshot.drivePageToken = persisted.drivePageToken;
    snapshot.qualityReport = persisted.qualityReport;
    snapshot.updatedAt = persisted.updatedAt;
    snapshot.initialized = true;
    console.info(JSON.stringify({
      event: 'knowledge_base_restored',
      files: persisted.fileCount,
      items: persisted.items.length,
      updatedAt: persisted.updatedAt.toISOString(),
    }));
  })().finally(() => {
    restorePromise = null;
  });

  return restorePromise;
}

export async function getKnowledgeBase(): Promise<Snapshot> {
  await restoreKnowledgeBase();
  if (!snapshot.initialized) await refreshKnowledgeBase();
  return snapshot;
}

export function getKnowledgeBaseStatus() {
  return {
    status: refreshPromise ? 'syncing' as const : snapshot.initialized ? 'ready' as const : 'unavailable' as const,
    fileCount: snapshot.fileCount,
    itemCount: snapshot.items.length,
    qualityIssueCount: snapshot.qualityReport.totalIssues,
    suggestions: buildSearchSuggestions(snapshot.items),
    snapshotUpdatedAt: snapshot.updatedAt?.toISOString() ?? null,
  };
}

export function getKnowledgeBaseQuality(): QualityReport {
  return snapshot.qualityReport;
}

function buildSearchSuggestions(items: KnowledgeItem[]): string[] {
  const suggestions: string[] = [];
  const usedTopics = new Set<string>();
  const usedSources = new Set<string>();
  const genericTopics = new Set(['apresentacao', 'introducao', 'inicio', 'boas vindas', 'visao geral']);

  const addSuggestion = (item: KnowledgeItem) => {
    const topic = item.unitTitle ?? item.name;
    const normalizedTopic = normalizeText(topic);
    if (usedTopics.has(normalizedTopic) || genericTopics.has(normalizedTopic)) return false;

    suggestions.push(`Quero aprender sobre ${topic}`);
    usedTopics.add(normalizedTopic);
    usedSources.add(item.sourceFileId);
    return suggestions.length === 3;
  };

  for (const item of items) {
    if (!usedSources.has(item.sourceFileId) && addSuggestion(item)) return suggestions;
  }

  for (const item of items) {
    if (addSuggestion(item)) break;
  }

  return suggestions;
}

export function startKnowledgeBaseRefresh() {
  void restoreKnowledgeBase()
    .then(() => synchronizeDriveChanges())
    .catch(() => undefined);
  const changesInterval = setInterval(
    () => void synchronizeDriveChanges().catch(() => undefined),
    config.changesPollIntervalMs,
  );
  const reconciliationInterval = setInterval(
    () => void refreshKnowledgeBase().catch(() => undefined),
    config.refreshIntervalMs,
  );
  return [changesInterval, reconciliationInterval];
}
