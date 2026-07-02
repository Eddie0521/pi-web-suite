<p align="right">
  <a href="README-zh.md">🇨🇳 中文</a>
</p>

# Pi Web Suite

> Web search, URL fetching, PDF extraction, and content extraction tools for the Pi coding agent.

A Pi extension that brings `web_search`, `fetch_content`, and `get_search_content` tools with cascading search providers and smart content extraction. Based on [`@juicesharp/rpiv-web-tools`](https://github.com/juicesharp/rpiv-web-tools).

## Install

```bash
pi install npm:pi-web-suite
```

Once installed and pi restarted, you get:
- `web_search` — search the web via cascading providers
- `fetch_content` — fetch URLs, GitHub repos, PDFs, and extract content
- `get_search_content` — retrieve past search results by ID
- `/web-search-config` — configure API keys interactively

## Features

- **Zero-config search** — Exa MCP endpoint works without any API key
- **Smart cascading** — Exa → AnySearch → Tavily, automatic provider selection
- **Content extraction** — Readability + linkedom local extraction, Jina / defuddle proxy fallback
- **GitHub repos** — API-based file and directory access
- **PDF extraction** — Text extraction via unpdf
- **SSRF protection** — DNS resolution + IP range checks blocking private network requests

## Quick Start

```typescript
// Search the web
web_search({ query: "TypeScript best practices 2025" })

// Fetch a page
fetch_content({ url: "https://docs.example.com/guide" })

// Fetch a GitHub repo
fetch_content({ url: "https://github.com/owner/repo" })

// Fetch a PDF
fetch_content({ url: "https://example.com/doc.pdf" })

// Retrieve past search results
get_search_content({ searchId: "sr_..." })
```

## Tools

### `web_search`

Search the web. Automatically selects the first available provider (Exa → AnySearch → Tavily).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search query |
| `numResults` | number | no | Results per query (default 5, max 20) |
| `recencyFilter` | string | no | `day`, `week`, `month`, `year` |

Returns search results with titles, URLs, snippets, and an optional answer. Each call returns a `searchId` for later retrieval via `get_search_content`.

### `fetch_content`

Fetch a URL and return its content as readable Markdown. Auto-detects and handles GitHub repos, PDFs, and regular web pages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | yes | Supports http/https, GitHub links, PDF links |

**Fetch chain:**
- GitHub URL → GitHub API (file contents / directory tree)
- PDF → unpdf text extraction
- HTML → Readability + linkedom local extraction → Jina Reader proxy → defuddle proxy

### `get_search_content`

Retrieve stored content from a previous `web_search` call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchId` | string | yes | ID from `web_search` response details |

## Configuration

Run `/web-search-config` to configure API keys interactively, or edit `~/.pi/web-search.json` directly:

```json
{
  "exaApiKey": "exa-...",
  "anySearchApiKey": "...",
  "tavilyApiKey": "tvly-..."
}
```

Environment variables take precedence over config: `EXA_API_KEY`, `ANYSEARCH_API_KEY`, `TAVILY_API_KEY`.

**Provider notes:**
- **Exa**: Direct API with key, MCP endpoint (zero-config) without
- **AnySearch**: Bearer auth with key, anonymous without (1000 req/day)
- **Tavily**: Requires API key

## Project Structure

```
pi-web-suite/
├── index.ts      # Main entry (3 tools, 1 command)
├── types.ts      # Shared types
├── search.ts     # Search cascade (Exa / AnySearch / Tavily)
├── fetch.ts      # URL fetch router (GitHub / PDF / HTML)
├── extract.ts    # HTML content extraction (Readability → Jina → defuddle)
├── config.ts     # API key management
├── ssrf.ts       # SSRF protection
├── storage.ts    # Search result cache
├── test/         # Tests
├── README.md     # This file (English)
└── README-zh.md  # Chinese translation
```

## License

MIT — based on [`@juicesharp/rpiv-web-tools`](https://github.com/juicesharp/rpiv-web-tools) (MIT).
