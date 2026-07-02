/**
 * Fetch — URL 抓取级联
 *
 * 路由：GitHub → PDF → HTML（Readability → 代理 fallback）
 */

import { extractText } from "unpdf";
import type { FetchResult } from "./types.ts";
import { checkSSRF } from "./ssrf.ts";
import { extractContent } from "./extract.ts";

// ─── GitHub API 轻量 ──────────────────────────────────────────────────

async function fetchGithub(url: string): Promise<FetchResult | null> {
  // 解析 path: /:owner/:repo 或 /:owner/:repo/blob/:branch/:path
  const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/blob\/([^/]+)\/(.*))?$/);
  if (!match) return null;

  const repo = match[1];
  const branch = match[2];
  const path = match[3];

  const apiBase = `https://api.github.com/repos/${repo}/contents`;
  const apiUrl = path ? `${apiBase}/${path}?ref=${branch}` : apiBase;

  const res = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "pi-web-suite" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const data = await res.json();

  // 文件 — 返回原始内容
  if (!Array.isArray(data) && data.type === "file" && data.download_url) {
    const content = await fetch(data.download_url, { signal: AbortSignal.timeout(10000) }).then((r) => r.text());
    return { url, title: data.name, content };
  }

  // 目录 — 返回目录树
  if (Array.isArray(data)) {
    const items = data.map((item: { name: string; type: string; path: string }) =>
      `${item.type === "dir" ? "📁" : "📄"} ${item.name} (${item.path})`
    ).join("\n");
    return { url, title: `GitHub: ${repo}`, content: `## ${repo}\n\n${items}\n\n---\nUse fetch_content 深入子目录获取文件。` };
  }

  return null;
}

// ─── PDF 提取 ─────────────────────────────────────────────────────────

async function fetchPdf(url: string): Promise<FetchResult | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("pdf")) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const { text } = await extractText(buffer);
  const content = text.join("\n\n").trim();
  return { url, title: "", content: content || "（PDF 无文本内容）" };
}

// ─── 通用 HTML 抓取 ──────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; pi-web-suite/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  // JSON/纯文本直接返回
  if (contentType.includes("json") || contentType.includes("text/plain")) {
    return { url, content: body };
  }

  // HTML → 抽取
  const extracted = await extractContent(url, body);
  return extracted;
}

// ─── Public API ───────────────────────────────────────────────────────

export async function fetchContent(url: string): Promise<FetchResult> {
  await checkSSRF(url);

  // GitHub
  const gh = await fetchGithub(url);
  if (gh) return gh;

  // PDF
  const pdf = await fetchPdf(url);
  if (pdf) return pdf;

  // HTML（或任何其他类型）
  return fetchHtml(url);
}
