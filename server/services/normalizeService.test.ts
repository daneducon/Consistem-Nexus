import { describe, expect, it } from 'vitest';
import { normalizeSpreadsheet, normalizeSpreadsheetWithReport, normalizeText } from './normalizeService';
import type { SpreadsheetData } from './googleApiService';

function spreadsheet(values: string[][]): SpreadsheetData {
  return {
    id: 'sheet-1',
    name: 'Base de cursos',
    sourceUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
    sheets: [{ title: 'Cursos', values }],
  };
}

describe('normalizeText', () => {
  it('normalizes accents, case and whitespace', () => {
    expect(normalizeText('  Módulo   FISCAL ')).toBe('modulo fiscal');
  });
});

describe('normalizeSpreadsheet', () => {
  it('maps known headers and ignores blank names', () => {
    const items = normalizeSpreadsheet(spreadsheet([
      ['Relatório atualizado em setembro'],
      ['Título', 'Descrição', 'Carga Horária', 'Link'],
      ['Integração Fiscal', 'Parametrização', '1h 30min', 'https://example.com/curso'],
      ['', 'Linha sem título', '30min', 'https://example.com/invalido'],
    ]));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Integração Fiscal',
      summary: 'Parametrização',
      duration: '1h 30min',
      materialUrl: 'https://example.com/curso',
      sourceFileName: 'Base de cursos',
    });
  });

  it('rejects unsafe material URLs and keeps the source URL', () => {
    const [item] = normalizeSpreadsheet(spreadsheet([
      ['Curso', 'URL'],
      ['Segurança', 'javascript:alert(1)'],
    ]));

    expect(item.materialUrl).toBeNull();
    expect(item.sourceUrl).toContain('docs.google.com');
  });

  it('preserves all columns and recognizes OA-specific headers', () => {
    const [item] = normalizeSpreadsheet(spreadsheet([
      ['Nº Unid', 'Título da Unidade', 'Título OA', 'Descrição do OA', 'Programas', 'Referências', 'Carga horária'],
      ['U04', 'Roteiros de Fabricação', 'Manutenção de Processos', 'Apresentar a tela CCPMEC160.', 'CCPMEC160', '1) Demo: https://example.com/demo', '45min'],
    ]));

    expect(item).toMatchObject({
      name: 'Manutenção de Processos',
      summary: 'Apresentar a tela CCPMEC160.',
      duration: '45min',
      unitNumber: 'U04',
      unitTitle: 'Roteiros de Fabricação',
      oaType: null,
      programs: ['CCPMEC160'],
      materialUrl: 'https://example.com/demo',
    });
    expect(item.searchContent).toContain('Programas: CCPMEC160');
  });

  it('extracts multiple references and reports invalid references', () => {
    const valid = normalizeSpreadsheet(spreadsheet([
      ['Título OA', 'Referências'],
      ['Material', '1) https://example.com/one 2) https://example.com/two'],
    ]));
    const invalid = normalizeSpreadsheetWithReport(spreadsheet([
      ['Título OA', 'Referências'],
      ['Material', 'Documento interno sem link'],
    ]));

    expect(valid[0].referenceUrls).toEqual(['https://example.com/one', 'https://example.com/two']);
    expect(invalid.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'invalid_reference', rowNumber: 2 }),
    ]));
  });
});
