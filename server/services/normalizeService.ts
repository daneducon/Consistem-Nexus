import { createHash } from 'node:crypto';
import type { SpreadsheetData } from './googleApiService';
import type { QualityIssue } from '../../shared/quality';

export type KnowledgeItem = {
  id: string;
  name: string;
  summary: string | null;
  duration: string | null;
  unitNumber: string | null;
  unitTitle: string | null;
  learningObjective: string | null;
  oaNumber: string | null;
  oaType: string | null;
  observations: string | null;
  programs: string[];
  references: string | null;
  referenceUrls: string[];
  materialUrl: string | null;
  sourceUrl: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceSheetName: string;
  searchContent: string;
};

export type NormalizationResult = {
  items: KnowledgeItem[];
  issues: QualityIssue[];
};

type CanonicalField =
  | 'name'
  | 'summary'
  | 'duration'
  | 'unitNumber'
  | 'unitTitle'
  | 'learningObjective'
  | 'oaNumber'
  | 'oaType'
  | 'observations'
  | 'programs'
  | 'references'
  | 'materialUrl';

const aliases: Record<CanonicalField, string[]> = {
  name: ['titulo oa', 'nome oa', 'objeto de aprendizagem', 'titulo do curso', 'curso', 'nome', 'titulo', 'titulo da unidade'],
  summary: ['descricao do oa', 'resumo', 'descricao', 'topico', 'objetivo de aprendizagem', 'modulo', 'conteudo', 'ementa'],
  duration: ['duracao', 'carga horaria', 'tempo'],
  unitNumber: ['nº unid', 'no unid', 'numero da unidade'],
  unitTitle: ['titulo da unidade'],
  learningObjective: ['objetivo de aprendizagem'],
  oaNumber: ['nº oa', 'no oa', 'numero do oa'],
  oaType: ['tipo oa', 'tipo do oa'],
  observations: ['observacoes', 'observacao'],
  programs: ['programas', 'programa'],
  references: ['referencias', 'referencia'],
  materialUrl: ['link', 'url', 'material', 'acesso', 'link do material', 'referencias'],
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHttpsUrls(value: string | undefined): string[] {
  const matches = value?.match(/https:\/\/[^\s,;]+/gi) ?? [];
  return [...new Set(matches.flatMap((match) => {
    try {
      const url = new URL(match.replace(/[)\].]+$/, ''));
      return url.protocol === 'https:' ? [url.toString()] : [];
    } catch {
      return [];
    }
  }))];
}

function mapHeaders(headers: string[]): Map<CanonicalField, number> {
  const fields = new Map<CanonicalField, number>();
  const normalizedHeaders = headers.map(normalizeText);

  for (const [field, fieldAliases] of Object.entries(aliases) as Array<[CanonicalField, string[]]>) {
    for (const alias of fieldAliases) {
      const index = normalizedHeaders.indexOf(alias);
      if (index >= 0) {
        fields.set(field, index);
        break;
      }
    }
  }

  return fields;
}

export function normalizeSpreadsheetWithReport(spreadsheet: SpreadsheetData): NormalizationResult {
  const items: KnowledgeItem[] = [];
  const issues: QualityIssue[] = [];

  for (const sheet of spreadsheet.sheets) {
    const headerIndex = sheet.values.slice(0, 10).findIndex((row) => mapHeaders(row).has('name'));
    if (headerIndex < 0) {
      issues.push({
        id: createHash('sha256').update(`${spreadsheet.id}:${sheet.title}:missing_header`).digest('hex').slice(0, 16),
        type: 'missing_header',
        message: 'A aba não possui uma coluna reconhecida para Título OA.',
        sourceFileId: spreadsheet.id,
        sourceName: spreadsheet.name,
        sheetName: sheet.title,
        rowNumber: null,
      });
      continue;
    }

    const headers = mapHeaders(sheet.values[headerIndex]);
    const valueAt = (row: string[], field: CanonicalField) => {
      const index = headers.get(field);
      return index === undefined ? '' : (row[index] ?? '').trim();
    };

    for (const [relativeRowIndex, row] of sheet.values.slice(headerIndex + 1).entries()) {
      const rowNumber = headerIndex + relativeRowIndex + 2;
      const name = valueAt(row, 'name');
      if (!name) {
        if (row.some(Boolean)) {
          issues.push({
            id: createHash('sha256').update(`${spreadsheet.id}:${sheet.title}:${rowNumber}:missing_title`).digest('hex').slice(0, 16),
            type: 'missing_title',
            message: 'Linha preenchida sem Título OA.',
            sourceFileId: spreadsheet.id,
            sourceName: spreadsheet.name,
            sheetName: sheet.title,
            rowNumber,
          });
        }
        continue;
      }

      const references = valueAt(row, 'references');
      const referenceValue = references || valueAt(row, 'materialUrl');
      const referenceUrls = extractHttpsUrls(referenceValue);
      const materialUrl = referenceUrls[0] ?? null;
      if (!referenceValue || normalizeText(referenceValue) === 'n/a') {
        issues.push({
          id: createHash('sha256').update(`${spreadsheet.id}:${sheet.title}:${rowNumber}:missing_reference`).digest('hex').slice(0, 16),
          type: 'missing_reference',
          message: `O OA “${name}” não possui referência.`,
          sourceFileId: spreadsheet.id,
          sourceName: spreadsheet.name,
          sheetName: sheet.title,
          rowNumber,
        });
      } else if (referenceUrls.length === 0) {
        issues.push({
          id: createHash('sha256').update(`${spreadsheet.id}:${sheet.title}:${rowNumber}:invalid_reference`).digest('hex').slice(0, 16),
          type: 'invalid_reference',
          message: `O OA “${name}” não possui uma referência HTTPS válida.`,
          sourceFileId: spreadsheet.id,
          sourceName: spreadsheet.name,
          sheetName: sheet.title,
          rowNumber,
        });
      }
      const programs = valueAt(row, 'programs')
        .split(/[,;\n]+/)
        .map((program) => program.trim())
        .filter((program) => program && normalizeText(program) !== 'n/a');
      const identity = `${spreadsheet.id}:${sheet.title}:${rowNumber}:${name}`;
      const searchContent = sheet.values[headerIndex]
        .map((header, index) => row[index] ? `${header}: ${row[index]}` : '')
        .filter(Boolean)
        .join('\n');
      items.push({
        id: createHash('sha256').update(identity).digest('hex').slice(0, 16),
        name,
        summary: valueAt(row, 'summary') || null,
        duration: valueAt(row, 'duration') || null,
        unitNumber: valueAt(row, 'unitNumber') || null,
        unitTitle: valueAt(row, 'unitTitle') || null,
        learningObjective: valueAt(row, 'learningObjective') || null,
        oaNumber: valueAt(row, 'oaNumber') || null,
        oaType: valueAt(row, 'oaType') || null,
        observations: valueAt(row, 'observations') || null,
        programs,
        references: references || null,
        referenceUrls,
        materialUrl,
        sourceUrl: spreadsheet.sourceUrl,
        sourceFileId: spreadsheet.id,
        sourceFileName: spreadsheet.name,
        sourceSheetName: sheet.title,
        searchContent,
      });
    }
  }

  return { items, issues };
}

export function normalizeSpreadsheet(spreadsheet: SpreadsheetData): KnowledgeItem[] {
  return normalizeSpreadsheetWithReport(spreadsheet).items;
}
