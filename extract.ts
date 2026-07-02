/**
 * Extract — HTML 内容抽取
 *
 * 1. Readability + linkedom（本地，进程内）
 * 2. r.jina.ai 代理（SPA / 微信等 fallback）
 * 3. defuddle.md 代理（兜底）
 */

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx" });

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
}

// ─── 本地提取（Readability） ────────────────────────────────────────────

function extractWithReadability(html: string, url: string): ExtractedContent | null {
  const { document } = parseHTML(html);

  // 移除无用元素
  for (const sel of ["script", "style", "nav", "footer", "header", "aside", ".sidebar", ".ad", ".cookie-banner"]) {
    for (const el of document.querySelectorAll(sel)) el.remove();
  }

  const reader = new Readability(document);
  const article = reader.parse();
  if (!article) return null;

  const content = article.textContent?.trim() || article.content?.trim() || "";
  if (content.length < 50) return null; // 太短说明抽取失败

  return {
    url,
    title: article.title?.trim() || "",
    content: turndown.turndown(content),
  };
}

// ─── 代理 fallback ─────────────────────────────────────────────────────

async function fetchViaProxy(url: string, proxyUrl: string): Promise<string | null> {
  try {
    const res = await fetch(proxyUrl.replace("{url}", encodeURIComponent(url)), {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 100) return null; // 太短说明代理返回了空页
    return text;
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────

export async function extractContent(url: string, html?: string): Promise<ExtractedContent> {
  // 如果有 HTML 内容（已 fetch），先用 Readability
  if (html) {
    const local = extractWithReadability(html, url);
    if (local) return local;
  }

  // 代理 fallback
  const jina = await fetchViaProxy(url, "https://r.jina.ai/{url}");
  if (jina) {
    // jina 返回 Markdown，提取标题和正文
    const title = jina.match(/^Title: (.+)/m)?.[1]?.trim() ?? "";
    const body = jina.replace(/^Title: .+\nURL Source: .+\n\n/m, "").trim();
    return { url, title, content: body };
  }

  const defuddle = await fetchViaProxy(url, "https://defuddle.md/{url}");
  if (defuddle) return { url, title: "", content: defuddle };

  throw new Error(`无法获取内容: ${url}`);
}
