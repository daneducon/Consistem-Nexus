import { describe, expect, it } from 'vitest';
import { findExactProgramMatches, rankSearchCandidates } from './hybridSearchService.js';
import type { KnowledgeItem } from './normalizeService.js';

function item(id: string, name: string, programs: string[] = [], content = ''): KnowledgeItem {
  return {
    id,
    name,
    summary: null,
    duration: null,
    unitNumber: null,
    unitTitle: null,
    learningObjective: null,
    oaNumber: null,
    oaType: null,
    observations: null,
    programs,
    references: null,
    referenceUrls: [],
    materialUrl: null,
    sourceUrl: 'https://docs.google.com/spreadsheets/example',
    sourceFileId: 'source',
    sourceFileName: 'Matriz',
    sourceSheetName: 'MATRIZ',
    searchContent: content,
  };
}

describe('hybrid search', () => {
  const items = [
    item('fiscal', 'Integração fiscal', ['CCPESC100']),
    item('engineering', 'Manutenção de Processos', ['CCPMEC160']),
    item('payroll', 'Configuração da folha', ['CCRHR100']),
  ];

  it('finds exact program codes without semantic inference', () => {
    expect(findExactProgramMatches('Quero saber mais sobre ccpmec160', items)).toEqual([items[1]]);
  });

  it('ranks matching titles ahead of unrelated items', () => {
    expect(rankSearchCandidates('Como configurar a folha?', items)[0]).toBe(items[2]);
  });
});
