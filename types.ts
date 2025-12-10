export interface LinkSuggestion {
  originalSegment?: string;
  revisedSegment?: string;
  anchorText: string;
  targetUrl: string;
  reason: string;
}

export interface AnalysisResult {
  revisedArticle: string;
  suggestions: LinkSuggestion[];
}

export enum AppState {
  IDLE = 'IDLE',
  FETCHING_SITEMAP = 'FETCHING_SITEMAP',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

export type CurationStatus = 'idle' | 'scraping' | 'analyzing' | 'writing' | 'done';

export interface CurationRequest {
  topic: string;
  intro: string;
  outline: string[]; // 新增：結構化大綱
  urls: string[];
}

// 新增：爬蟲抓取的資料結構
export interface ScrapedContent {
  id: number;
  url: string;
  title: string;
  content: string;
}

// 新增：架構師產出的草稿結構
export interface ArchitectDraft {
  sectionTitle: string;
  contentDraft: string;
  sourceIds: number[];
}
