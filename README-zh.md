<p align="right">
  <a href="README.md">🇬🇧 English</a>
</p>

# Pi Web Suite

> Web 搜索、URL 抓取、PDF 提取和内容抽取工具集 —— 为 Pi coding agent 打造。

提供 `web_search`、`fetch_content`、`get_search_content` 三个工具，支持级联搜索 provider 和智能内容提取。基于 [`@juicesharp/rpiv-web-tools`](https://github.com/juicesharp/rpiv-web-tools) 整合改造。

## 安装

```bash
pi install npm:pi-web-suite
```

安装后重启 pi，你会获得：
- `web_search` — 通过级联 provider 搜索互联网
- `fetch_content` — 抓取网页、GitHub 仓库、PDF
- `get_search_content` — 按 ID 检索历史搜索结果
- `/web-search-config` — 交互式配置 API keys

## 特性

- **零配置搜索** — Exa MCP 端点无需 API key 即可使用
- **智能级联** — Exa → AnySearch → Tavily，自动选择可用 provider
- **内容提取** — Readability + linkedom 本地抽取，Jina / defuddle 代理 fallback
- **GitHub 仓库** — API 方式获取文件内容和目录树
- **PDF 提取** — 基于 unpdf 的文本提取
- **SSRF 防护** — DNS 解析 + IP 范围检查，阻止内网请求

## 快速开始

```typescript
// 搜索
web_search({ query: "TypeScript best practices 2025" })

// 获取页面
fetch_content({ url: "https://docs.example.com/guide" })

// 获取 GitHub 仓库
fetch_content({ url: "https://github.com/owner/repo" })

// 获取 PDF
fetch_content({ url: "https://example.com/doc.pdf" })

// 检索历史搜索结果
get_search_content({ searchId: "sr_..." })
```

## 工具

### `web_search`

搜索互联网，自动选择第一个可用的 provider（Exa → AnySearch → Tavily）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索查询 |
| `numResults` | number | 否 | 返回结果数（默认 5，最大 20） |
| `recencyFilter` | string | 否 | `day`, `week`, `month`, `year` |

返回搜索结果（标题、URL、摘要）和可选的智能摘要。每次调用返回 `searchId`，可后续通过 `get_search_content` 检索。

### `fetch_content`

获取 URL 内容并返回可读 Markdown。自动检测并处理 GitHub 仓库、PDF、普通网页。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 支持 http/https、GitHub 链接、PDF 链接 |

**抓取链路：**
- GitHub URL → GitHub API（文件内容 / 目录树）
- PDF → unpdf 文本提取
- HTML → Readability + linkedom 本地提取 → Jina Reader 代理 → defuddle 代理

### `get_search_content`

通过 searchId 检索之前搜索的完整结果。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `searchId` | string | 是 | 来自 web_search 返回的 details.searchId |

## 配置

运行 `/web-search-config` 交互式配置 API keys，或直接编辑 `~/.pi/web-search.json`：

```json
{
  "exaApiKey": "exa-...",
  "anySearchApiKey": "...",
  "tavilyApiKey": "tvly-..."
}
```

环境变量优先级高于配置文件：`EXA_API_KEY`、`ANYSEARCH_API_KEY`、`TAVILY_API_KEY`。

**Provider 说明：**
- **Exa**: 有 key 用 Direct API，无 key 用 MCP 端点（零配置）
- **AnySearch**: 有 key 用 Bearer，无 key 用匿名（1000次/天）
- **Tavily**: 必须有 key

## 项目结构

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
├── test/         # 测试
├── README.md     # 英文版
└── README-zh.md  # 本文件（中文版）
```

## License

MIT — 基于 [`@juicesharp/rpiv-web-tools`](https://github.com/juicesharp/rpiv-web-tools)（MIT）。
