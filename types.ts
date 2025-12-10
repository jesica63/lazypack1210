
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
  urls: string[];
}
