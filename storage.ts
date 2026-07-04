/**
 * Storage — 搜索结果临时缓存
 *
 * 会话级，session 结束自动清空
 * 用于 get_search_content 工具检索
 */

import type { SearchResult } from "./types.ts";

interface StoredSearch {
  id: string;
  query: string;
  results: SearchResult[];
  answer?: string;
  provider: string;
  timestamp: number;
}

const store = new Map<string, StoredSearch>();
let counter = 0;

export function generateId(): string {
  counter++;
  return `sr_${Date.now()}_${counter}`;
}

export function storeSearch(query: string, results: SearchResult[], answer: string | undefined, provider: string): string {
  const id = generateId();
  store.set(id, { id, query, results, answer, provider, timestamp: Date.now() });
  return id;
}

export function getSearch(id: string): StoredSearch | undefined {
  if (!id || typeof id !== "string") return undefined;
  return store.get(id);
}

export function getAllSearches(): StoredSearch[] {
  return [...store.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function clearSearches(): void {
  store.clear();
}
