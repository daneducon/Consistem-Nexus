export type SearchItem = {
  id: string;
  name: string;
  summary: string | null;
  duration: string | null;
  unitTitle: string | null;
  oaNumber: string | null;
  oaType: string | null;
  programs: string[];
  references: string[];
  matchExcerpt: string | null;
  url: string;
  sourceName: string;
};

export type SearchResponse = {
  answer: string;
  items: SearchItem[];
  snapshotUpdatedAt: string;
};

export type HealthResponse = {
  status: 'ready' | 'syncing' | 'unavailable';
  fileCount: number;
  itemCount: number;
  qualityIssueCount: number;
  suggestions: string[];
  snapshotUpdatedAt: string | null;
};
