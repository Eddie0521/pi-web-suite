# Pi Web Suite

Web search, URL fetching, PDF extraction, and content extraction tools for Pi coding agent。

基于 `@juicesharp/rpiv-web-tools` 整合改造，支持多种搜索 provider 级联和智能内容抽取。

## Install

```bash
pi install npm:pi-web-suite
```

安装后重启 pi，你会获得：
- `web_search` 工具搜索互联网
- `fetch_content` 工具抓取网页 / GitHub 仓库 / PDF
- `get_search_content` 工具检索历史搜索结果
- `/web-search-config` 命令配置 API keys

## 特性

- **零配置搜索** — Exa MCP 端点无需 API key 即可使用
- **智能级联** — Exa → AnySearch → Tavily，自动选择可用 provider
- **内容提取** — Readability + linkedom 本地抽取，Jina / defuddle 代理 fallback
- **GitHub 仓库** — API 方式获取文件内容和目录树
- **PDF 提取** — 基于 unpdf 的文本提取
- **SSRF 防护** — DNS 解析 + IP 范围检查，阻止内网请求

## Quick Start

```typescript
// 搜索
web_search({ query: "TypeScript best practices 2025" })

// 获取页面
fetch_content({ url: "https://docs.example.com/guide" })

// 获取 GitHub 仓库
fetch_content({ url: "https://github.com/owner/repo" })

// 获取 PDF
fetch_content({ url: "https://example.com/doc.pdf" })
```

## Tools

### `web_search`

搜索互联网，自动选择可用的搜索 provider（Exa → AnySearch → Tavily）。

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | 搜索查询 |
| `numResults` | number | no | 返回结果数（默认 5，最大 20） |
| `recencyFilter` | string | no | `day`, `week`, `month`, `year` |

### `fetch_content`

获取 URL 的内容。自动处理普通网页、GitHub 仓库、PDF 文件。

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | yes | 支持 http/https、GitHub 链接、PDF 链接 |

### `get_search_content`

通过 searchId 检索之前搜索的完整结果。

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchId` | string | yes | 来自 web_search 返回的 details.searchId |

## Configuration

通过 `/web-search-config` 命令交互式配置 API keys，或直接编辑 `~/.pi/web-search.json`：

```json
{
  "exaApiKey": "exa-...",
  "anySearchApiKey": "...",
  "tavilyApiKey": "tvly-..."
}
```

环境变量优先级高于配置文件：`EXA_API_KEY`、`ANYSEARCH_API_KEY`、`TAVILY_API_KEY`。

Provider 说明：
- **Exa**: 有 key 用 Direct API，无 key 用 MCP 端点（零配置）
- **AnySearch**: 有 key 用 Bearer，无 key 用匿名（1000次/天）
- **Tavily**: 必须有 key

## 文件

```
pi-web-suite/
├── index.ts      # 主逻辑（3 个工具 + 1 个命令）
├── types.ts      # 公共类型
├── search.ts     # 搜索级联（Exa / AnySearch / Tavily）
├── fetch.ts      # URL 抓取路由（GitHub / PDF / HTML）
├── extract.ts    # HTML 内容抽取（Readability → Jina → defuddle）
├── config.ts     # API key 管理
├── ssrf.ts       # SSRF 防护
├── storage.ts    # 搜索结果缓存
└── test/         # 测试
```
