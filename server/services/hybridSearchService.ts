import type { SearchItem, SearchResponse } from '../../shared/search';
import { normalizeText, type KnowledgeItem } from './normalizeService';

const ignoredTokens = new Set([
  'ainda', 'aprender', 'como', 'conhecer', 'mais', 'material', 'onde', 'programa',
  'quero', 'saber', 'sobre', 'treinamento',
]);

function extractProgramCodes(query: string): string[] {
  return query.toUpperCase().match(/\b[A-Z]{2,}[A-Z0-9]*\d{2,}\b/g) ?? [];
}

function searchableText(item: KnowledgeItem): string {
  return normalizeText([
    item.name,
    item.summary,
    item.unitTitle,
    item.learningObjective,
    item.observations,
    item.programs.join(' '),
    item.searchContent,
    item.sourceFileName,
  ].filter(Boolean).join(' '));
}

function createMatchExcerpt(query: string, item: KnowledgeItem): string | null {
  const codes = extractProgramCodes(query).map((code) => code.toLowerCase());
  const tokens = normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !ignoredTokens.has(token));
  const lines = item.searchContent.split('\n').map((line) => line.trim()).filter(Boolean);
  const rankedLines = lines.map((line, index) => {
    const normalizedLine = normalizeText(line);
    const score = codes.reduce((total, code) => total + (normalizedLine.includes(code) ? 100 : 0), 0)
      + tokens.reduce((total, token) => total + (normalizedLine.includes(token) ? 1 : 0), 0);
    return { line, score, index };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const excerpt = rankedLines[0]?.score ? rankedLines[0].line : item.summary;
  if (!excerpt) return null;
  return excerpt.length > 240 ? `${excerpt.slice(0, 237).trimEnd()}...` : excerpt;
}

export function createSearchItem(query: string, item: KnowledgeItem): SearchItem {
  return {
    id: item.id,
    name: item.name,
    summary: item.summary,
    duration: item.duration,
    unitTitle: item.unitTitle,
    oaNumber: item.oaNumber,
    oaType: item.oaType,
    programs: item.programs,
    references: item.referenceUrls,
    matchExcerpt: createMatchExcerpt(query, item),
    url: item.materialUrl ?? item.sourceUrl,
    sourceName: item.sourceFileName,
  };
}

export function findExactProgramMatches(query: string, items: KnowledgeItem[]): KnowledgeItem[] {
  const queryCodes = new Set(extractProgramCodes(query));
  if (queryCodes.size === 0) return [];

  return items
    .filter((item) => item.programs.some((program) => queryCodes.has(program.toUpperCase())))
    .slice(0, 5);
}

export function rankSearchCandidates(query: string, items: KnowledgeItem[], limit = 80): KnowledgeItem[] {
  const normalizedQuery = normalizeText(query);
  const queryCodes = extractProgramCodes(query);
  const tokens = normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !ignoredTokens.has(token));

  return items
    .map((item, index) => {
      const name = normalizeText(item.name);
      const unitTitle = normalizeText(item.unitTitle ?? '');
      const searchable = searchableText(item);
      let score = 0;

      if (normalizedQuery.includes(name) && name.length >= 5) score += 200;
      if (unitTitle && normalizedQuery.includes(unitTitle)) score += 120;
      for (const code of queryCodes) {
        if (item.programs.some((program) => program.toUpperCase() === code)) score += 1_000;
        else if (searchable.includes(code.toLowerCase())) score += 300;
      }
      for (const token of tokens) {
        if (name.includes(token)) score += 20;
        else if (unitTitle.includes(token)) score += 12;
        else if (searchable.includes(token)) score += 3;
      }

      return { item, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function createExactMatchResponse(
  query: string,
  items: KnowledgeItem[],
  snapshotUpdatedAt: Date,
): SearchResponse {
  const codes = extractProgramCodes(query);
  const codeLabel = codes.length === 1 ? codes[0] : codes.join(', ');
  const answer = items.length === 1
    ? `Encontrei um material relacionado ao programa ${codeLabel}: ${items[0].name}.`
    : `Encontrei ${items.length} materiais relacionados aos programas ${codeLabel}.`;

  return {
    answer,
    items: items.map((item) => createSearchItem(query, item)),
    snapshotUpdatedAt: snapshotUpdatedAt.toISOString(),
  };
}
