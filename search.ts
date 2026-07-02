/**
 * Search — 搜索级联（Exa → AnySearch → Tavily）
 *
 * 按可用性自动选择第一个成功的 provider。
 * Exa: 有 key 用 Direct API，无 key 用 MCP 端点（零配置）
 * AnySearch: 有 key 用 Bearer，无 key 用匿名（1000次/天）
 * Tavily: 必须有 key
 */

import type { SearchOptions, SearchResponse } from "./types.ts";
import { resolveKeys } from "./config.ts";

// ─── Exa ──────────────────────────────────────────────────────────────

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

interface ExaResult {
  title?: string;
  url?: string;
  text?: string;
}

async function searchExa(query: string, key: string | null, options: SearchOptions): Promise<SearchResponse | null> {
  if (key) {
    const res = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ query, numResults: options.numResults ?? 5 }),
      signal: options.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ExaResult[] };
    if (!data.results?.length) return null;
    return {
      results: data.results.filter((r) => r.url).map((r) => ({ title: r.title ?? "", url: r.url!, snippet: r.text ?? "" })),
      provider: "exa",
    };
  }

  // MCP 零配置模式
  const res = await fetch(EXA_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "web_search_exa", arguments: { query, numResults: options.numResults ?? 5 } },
    }),
    signal: options.signal,
  });
  if (!res.ok) return null;
  const body = await res.text();
  // 解析 MCP 返回的文本块
  const lines = body.split("\n").filter((l) => l.startsWith("data:"));
  const last = lines[lines.length - 1]?.slice(5).trim();
  if (!last) return null;
  let mcpResult: { result?: { content?: Array<{ text?: string }> } };
  try { mcpResult = JSON.parse(last); } catch { return null; }
  const text = mcpResult.result?.content?.find((c) => c.text)?.text;
  if (!text) return null;
  const results = parseExaMcpBlock(text);
  return results.length > 0 ? { results, provider: "exa" } : null;
}

function parseExaMcpBlock(text: string) {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const blocks = text.split(/(?=^Title: )/m).filter((b) => b.trim());
  for (const block of blocks) {
    const title = block.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
    const url = block.match(/^URL: (.+)/m)?.[1]?.trim() ?? "";
    const contentMatch = block.match(/(?:Text: |Highlights:\s*\n)([\s\S]*)/);
    const snippet = contentMatch?.[1]?.replace(/\n---\s*$/, "").trim() ?? "";
    if (url) results.push({ title, url, snippet: snippet.slice(0, 500) });
  }
  return results;
}

// ─── AnySearch ────────────────────────────────────────────────────────

const ANYSEARCH_URL = "https://api.anysearch.com/v1/search";

interface AnySearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
}

interface AnySearchResponse {
  code: number;
  data?: {
    results?: AnySearchResult[];
    metadata?: { total_results?: number };
  };
}

async function searchAnySearch(query: string, key: string | null, options: SearchOptions): Promise<SearchResponse | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(ANYSEARCH_URL, {
    method: "POST", headers,
    body: JSON.stringify({ query, max_results: options.numResults ?? 10 }),
    signal: options.signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AnySearchResponse;
  if (data.code !== 0 || !data.data?.results?.length) return null;

  return {
    results: data.data.results
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.snippet ?? r.content ?? "").slice(0, 500) })),
    provider: "anysearch",
  };
}

// ─── Tavily ───────────────────────────────────────────────────────────

const TAVILY_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

async function searchTavily(query: string, key: string, options: SearchOptions): Promise<SearchResponse | null> {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: options.numResults ?? 5,
      include_answer: "basic",
      ...(options.recencyFilter ? { time_range: options.recencyFilter } : {}),
    }),
    signal: options.signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TavilyResponse;
  if (!data.results?.length) return null;
  return {
    results: data.results
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.content ?? "").slice(0, 500) })),
    answer: data.answer,
    provider: "tavily",
  };
}

// ─── Public API ───────────────────────────────────────────────────────

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const keys = resolveKeys();

  // 1. Exa（零配置或 key）
  const exaResult = await searchExa(query, keys.exa, options);
  if (exaResult) return exaResult;

  // 2. AnySearch（匿名或 key）
  const anyResult = await searchAnySearch(query, keys.anySearch, options);
  if (anyResult) return anyResult;

  // 3. Tavily（需要 key）
  if (keys.tavily) {
    const tavilyResult = await searchTavily(query, keys.tavily, options);
    if (tavilyResult) return tavilyResult;
  }

  throw new Error("所有搜索 provider 均不可用。请检查网络或配置 API key (Exa MCP 应始终可用)");
}

/** 检查可用的 provider 列表 */
export async function getAvailableProviders(): Promise<string[]> {
  const keys = resolveKeys();
  const available: string[] = [];

  // Exa: 始终可用（MCP 端点零配置）
  available.push("exa");

  // AnySearch: 有 key 或可匿名
  available.push("anysearch");

  // Tavily: 需要 key
  if (keys.tavily) available.push("tavily");

  return available;
}
