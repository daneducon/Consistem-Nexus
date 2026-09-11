import { config } from '../config.js';
import { GoogleAuth } from 'google-auth-library';

const spreadsheetMimeType = 'application/vnd.google-apps.spreadsheet';
export const folderMimeType = 'application/vnd.google-apps.folder';

// Pastas conhecidas dentro da árvore configurada (raiz + subpastas descobertas
// na última sincronização completa). Usado pelo sync incremental para aceitar
// planilhas aninhadas e detectar mudanças estruturais (pasta criada/movida).
const knownFolderIds = new Set<string>([config.googleDriveFolderId]);

export function getKnownFolderIds(): Set<string> {
  return knownFolderIds;
}

export function setKnownFolderIds(folderIds: string[]): void {
  knownFolderIds.clear();
  knownFolderIds.add(config.googleDriveFolderId);
  for (const folderId of folderIds) knownFolderIds.add(folderId);
}
const auth = new GoogleAuth({
  ...(config.googleServiceAccount
    ? { credentials: config.googleServiceAccount }
    : { keyFile: config.googleCredentialsPath }),
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
});

export type DriveFile = {
  id: string;
  name: string;
  webViewLink?: string;
  mimeType?: string;
  parents?: string[];
  trashed?: boolean;
};

type DriveListResponse = {
  nextPageToken?: string;
  files?: DriveFile[];
};

type DriveStartPageTokenResponse = {
  startPageToken: string;
};

type DriveChangesResponse = {
  nextPageToken?: string;
  newStartPageToken?: string;
  changes?: DriveChange[];
};

export type DriveChange = {
  fileId: string;
  removed?: boolean;
  file?: DriveFile;
};

type SheetsMetadataResponse = {
  sheets?: Array<{ properties?: { title?: string } }>;
};

type SheetsValuesResponse = {
  valueRanges?: Array<{ range?: string; values?: unknown[][] }>;
};

export type SpreadsheetData = DriveFile & {
  sourceUrl: string;
  sheets: Array<{ title: string; values: string[][] }>;
};

async function googleFetch<T>(url: URL): Promise<T> {
  const accessToken = await auth.getAccessToken();
  if (!accessToken) throw new Error('Nao foi possivel autenticar a conta de servico Google');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google API respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}

async function listFilesInFolder(parentId: string, mimeType: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set(
      'q',
      `'${parentId}' in parents and trashed = false and mimeType = '${mimeType}'`,
    );
    url.searchParams.set('fields', 'nextPageToken,files(id,name,webViewLink)');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('orderBy', 'name');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (config.googleSharedDriveId) {
      url.searchParams.set('corpora', 'drive');
      url.searchParams.set('driveId', config.googleSharedDriveId);
    }
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const page = await googleFetch<DriveListResponse>(url);
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return files;
}

export async function listSpreadsheets(): Promise<DriveFile[]> {
  const files = await listFilesInFolder(config.googleDriveFolderId, spreadsheetMimeType);
  const discoveredFolders: string[] = [];
  const visited = new Set<string>([config.googleDriveFolderId]);
  const queue = [config.googleDriveFolderId];

  // Varredura em largura: inclui planilhas de todos os níveis de subpastas.
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const subfolders = await listFilesInFolder(parentId, folderMimeType);
    for (const folder of subfolders) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      discoveredFolders.push(folder.id);
      queue.push(folder.id);
      files.push(...await listFilesInFolder(folder.id, spreadsheetMimeType));
    }
  }

  setKnownFolderIds(discoveredFolders);
  files.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  return files;
}

export async function getDriveStartPageToken(): Promise<string> {
  const url = new URL('https://www.googleapis.com/drive/v3/changes/startPageToken');
  url.searchParams.set('supportsAllDrives', 'true');
  if (config.googleSharedDriveId) url.searchParams.set('driveId', config.googleSharedDriveId);
  const response = await googleFetch<DriveStartPageTokenResponse>(url);
  return response.startPageToken;
}

export async function listDriveChanges(pageToken: string): Promise<{ changes: DriveChange[]; newPageToken: string }> {
  const changes: DriveChange[] = [];
  let currentPageToken = pageToken;
  let newPageToken = pageToken;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/changes');
    url.searchParams.set('pageToken', currentPageToken);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('includeRemoved', 'true');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('fields', 'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,trashed,webViewLink))');
    if (config.googleSharedDriveId) url.searchParams.set('driveId', config.googleSharedDriveId);

    const page = await googleFetch<DriveChangesResponse>(url);
    changes.push(...(page.changes ?? []));
    if (page.newStartPageToken) newPageToken = page.newStartPageToken;
    if (!page.nextPageToken) break;
    currentPageToken = page.nextPageToken;
  } while (true);

  return { changes, newPageToken };
}

export function isSpreadsheetInConfiguredFolder(file: DriveFile | undefined): file is DriveFile {
  return Boolean(
    file
    && !file.trashed
    && file.mimeType === spreadsheetMimeType
    && file.parents?.some((parent) => knownFolderIds.has(parent)),
  );
}

export function isFolderTreeChange(file: DriveFile | undefined, fileId: string): boolean {
  if (file && !file.trashed && file.mimeType === folderMimeType) {
    if (file.id === config.googleDriveFolderId) return true;
    if (file.parents?.some((parent) => knownFolderIds.has(parent))) return true;
    if (knownFolderIds.has(file.id)) return true;
  }
  // Pasta conhecida removida/renomeada: o change vem sem metadados.
  if (knownFolderIds.has(fileId) && fileId !== config.googleDriveFolderId) return true;
  return false;
}

function asStringRows(values: unknown[][] | undefined): string[][] {
  return (values ?? []).map((row) => row.map((cell) => String(cell ?? '').trim()));
}

export async function readSpreadsheet(file: DriveFile): Promise<SpreadsheetData> {
  const metadataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}`);
  metadataUrl.searchParams.set('fields', 'sheets.properties.title');
  const metadata = await googleFetch<SheetsMetadataResponse>(metadataUrl);
  const titles = (metadata.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title))
    .filter((title) => title.trim().toLocaleLowerCase('pt-BR') === config.googleSheetName.trim().toLocaleLowerCase('pt-BR'));

  if (titles.length === 0) {
    return {
      ...file,
      sourceUrl: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}`,
      sheets: [],
    };
  }

  const valuesUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values:batchGet`);
  valuesUrl.searchParams.set('majorDimension', 'ROWS');
  valuesUrl.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');
  for (const title of titles) {
    valuesUrl.searchParams.append('ranges', `'${title.replaceAll("'", "''")}'`);
  }

  const data = await googleFetch<SheetsValuesResponse>(valuesUrl);
  const sheets = titles.map((title, index) => ({
    title,
    values: asStringRows(data.valueRanges?.[index]?.values),
  }));

  return {
    ...file,
    sourceUrl: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}`,
    sheets,
  };
}
