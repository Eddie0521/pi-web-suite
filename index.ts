/**
 * Pi Web Suite Extension
 *
 * 工具：web_search, fetch_content, get_search_content
 * 命令：/web-search-config
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { search, getAvailableProviders } from "./search.ts";
import { fetchContent } from "./fetch.ts";
import { saveConfig, getConfigPath } from "./config.ts";
import { clearSearches, getSearch, storeSearch } from "./storage.ts";
import type { SearchResponse } from "./types.ts";

// ─── 辅助函数：格式化搜索结果 ─────────────────────────────────────────

function formatSearchResult(query: string, result: SearchResponse): { text: string; searchId: string } {
  const searchId = storeSearch(query, result.results, result.answer, result.provider);

  let text = result.answer ? `${result.answer}\n\n---\n\n` : "";
  const lines: string[] = [];
  for (let i = 0; i < result.results.length; i++) {
    const r = result.results[i];
    lines.push(`${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet || ""}`);
  }
  text += lines.join("\n\n");

  return { text: text.trimEnd(), searchId };
}

function formatStoredSearch(query: string, provider: string, results: Array<{ title: string; url: string; snippet: string }>): string {
  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet || ""}`);
  }
  return lines.join("\n\n");
}

function mask(value: string): string {
  if (!value || value === "(未设置)") return "(未设置)";
  return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "****";
}

// ─── 注册工具 ────────────────────────────────────────────────────────

function registerWebSearchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "搜索互联网。自动选择可用的搜索 provider（Exa → AnySearch → Tavily）。返回带来源链接的搜索结果。",
    promptSnippet: "搜索互联网获取最新信息",
    parameters: Type.Object({
      query: Type.String({ description: "搜索查询" }),
      numResults: Type.Optional(Type.Number({ description: "返回结果数（默认 5，最大 20）" })),
      recencyFilter: Type.Optional(
        Type.Union([
          Type.Literal("day"),
          Type.Literal("week"),
          Type.Literal("month"),
          Type.Literal("year"),
        ], { description: "按时间过滤" }),
      ),
    }),

    execute: async (_id, params, signal, _onUpdate, _ctx) => {
      const result = await search(params.query, {
        numResults: params.numResults,
        recencyFilter: params.recencyFilter,
        signal,
      });
      const { text, searchId } = formatSearchResult(params.query, result);

      return {
        content: [{ type: "text", text }],
        details: {
          query: params.query,
          provider: result.provider,
          resultCount: result.results.length,
          searchId,
        },
      };
    },
  });
}

function registerFetchContentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "fetch_content",
    label: "Fetch Content",
    description: "获取 URL 的内容。自动处理：普通网页、GitHub 仓库、PDF 文件。返回可读的 Markdown 文本。",
    promptSnippet: "访问指定 URL 获取内容",
    parameters: Type.Object({
      url: Type.String({ description: "要获取的 URL，支持 http/https、GitHub 链接、PDF 链接" }),
    }),

    execute: async (_id, params, _signal, _onUpdate, _ctx) => {
      const result = await fetchContent(params.url);
      return {
        content: [{ type: "text", text: result.content }],
        details: { url: result.url, title: result.title },
      };
    },
  });
}

function registerGetSearchContentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_search_content",
    label: "Get Search Content",
    description: "通过 searchId 检索之前搜索的完整结果。",
    parameters: Type.Object({
      searchId: Type.String({ description: "搜索 ID（来自 web_search 返回的 details.searchId）" }),
    }),

    execute: async (_id, params) => {
      const stored = getSearch(params.searchId);
      if (!stored) throw new Error(`找不到搜索结果: ${params.searchId}`);

      const text = formatStoredSearch(stored.query, stored.provider, stored.results);

      return {
        content: [{ type: "text", text }],
        details: { query: stored.query, provider: stored.provider, resultCount: stored.results.length },
      };
    },
  });
}

// ─── 注册命令 ────────────────────────────────────────────────────────

async function handleConfigCommand(args: string | undefined, ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui?.notify?.("/web-search-config 需要交互模式", "error");
    return;
  }

  if (args?.includes("--show")) {
    const keys = {
      exaApiKey: process.env.EXA_API_KEY || "(未设置)",
      anySearchApiKey: process.env.ANYSEARCH_API_KEY || "(未设置)",
      tavilyApiKey: process.env.TAVILY_API_KEY || "(未设置)",
    };
    ctx.ui.notify(
      `搜索 API 配置:\n  文件: ${getConfigPath()}\n  Exa: ${mask(keys.exaApiKey)}\n  AnySearch: ${mask(keys.anySearchApiKey)}\n  Tavily: ${mask(keys.tavilyApiKey)}`,
      "info",
    );
    return;
  }

  const providers = getAvailableProviders();
  const msg = `可用的 provider: ${providers.join(", ")}\n配置哪些 API key? 留空跳过。`;

  const exa = await ctx.ui.input("Exa API key（https://exa.ai 注册，可选）", "(留空跳过)");
  if (exa && exa !== "(留空跳过)") saveConfig({ exaApiKey: exa.trim() });

  const anySearch = await ctx.ui.input("AnySearch API key（https://anysearch.com 注册，可选）", "(留空跳过)");
  if (anySearch && anySearch !== "(留空跳过)") saveConfig({ anySearchApiKey: anySearch.trim() });

  const tavily = await ctx.ui.input("Tavily API key（https://tavily.com 注册，可选）", "(留空跳过)");
  if (tavily && tavily !== "(留空跳过)") saveConfig({ tavilyApiKey: tavily.trim() });

  ctx.ui.notify("配置已保存", "info");
}

function registerConfigCommand(pi: ExtensionAPI): void {
  pi.registerCommand("web-search-config", {
    description: "配置搜索 API keys（Exa, AnySearch, Tavily）",
    handler: async (args, ctx) => handleConfigCommand(args, ctx),
  });
}

// ─── 入口 ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  registerWebSearchTool(pi);
  registerFetchContentTool(pi);
  registerGetSearchContentTool(pi);
  registerConfigCommand(pi);

  pi.on("session_shutdown", () => clearSearches());
}
