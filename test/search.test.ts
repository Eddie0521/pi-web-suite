/** Search 测试 */

import { test, expect, mock } from "bun:test";

// Mock 掉 config，避免测试读取本机 ~/.pi/config/web-search.json 里的真实 key
// （有 key 时 searchExa 会走 REST 分支，绕过下面 mock 的 MCP 端点）
mock.module("../config.ts", () => ({
	resolveKeys: () => ({ exa: null, anySearch: null, tavily: null }),
}));

const { search } = await import("../search.ts");

// Mock 全局 fetch
const originalFetch = globalThis.fetch;

test("search returns results from Exa MCP (zero config)", async () => {
  globalThis.fetch = mock(async (url: string, _opts?: Record<string, unknown>) => {
    if (url === "https://mcp.exa.ai/mcp") {
      return new Response("data: " + JSON.stringify({
        result: {
          content: [{ text: "Title: Test Result\nURL: https://example.com\nText: This is a test snippet" }],
        },
      }) + "\n");
    }
    return new Response(null, { status: 404 });
  });

  const result = await search("test query", { numResults: 3 });
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.provider).toBe("exa");
  expect(result.results[0].title).toBe("Test Result");
  expect(result.results[0].url).toBe("https://example.com");

  globalThis.fetch = originalFetch;
});

test("search throws when all providers fail", async () => {
  globalThis.fetch = mock(async () => new Response(null, { status: 500 }));
  await expect(search("test")).rejects.toThrow("所有搜索 provider 均不可用");
  globalThis.fetch = originalFetch;
});
