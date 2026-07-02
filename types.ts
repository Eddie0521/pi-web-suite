/** Pi Web Suite — 公共类型 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  answer?: string;
  provider: string;
}

export interface SearchOptions {
  numResults?: number;
  recencyFilter?: "day" | "week" | "month" | "year";
  domainFilter?: string[];
  signal?: AbortSignal;
}

export interface FetchResult {
  url: string;
  title?: string;
  content: string;
  error?: string;
}

export interface WebSearchConfig {
  exaApiKey?: string;
  anySearchApiKey?: string;
  tavilyApiKey?: string;
}
