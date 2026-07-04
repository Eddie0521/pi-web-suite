/**
 * Config — API key 管理
 *
 * 配置文件：~/.pi/config/web-search.json
 * 环境变量优先（EXA_API_KEY / ANYSEARCH_API_KEY / TAVILY_API_KEY）
 * 交互式配置：/web-search-config 命令
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { WebSearchConfig } from "./types.ts";

const CONFIG_PATH = join(homedir(), ".pi", "config", "web-search.json");
const LEGACY_CONFIG_PATH = join(homedir(), ".pi", "web-search.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function ensureMigrated(): void {
  if (existsSync(CONFIG_PATH)) return;
  if (!existsSync(LEGACY_CONFIG_PATH)) return;

  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  const raw = readFileSync(LEGACY_CONFIG_PATH, "utf-8");
  writeFileSync(CONFIG_PATH, raw, "utf-8");
  try { chmodSync(CONFIG_PATH, 0o600); } catch { /* best effort */ }
  try { unlinkSync(LEGACY_CONFIG_PATH); } catch { /* best effort */ }
}

function loadRaw(): WebSearchConfig {
  ensureMigrated();
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as WebSearchConfig;
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<WebSearchConfig>): void {
  const current = loadRaw();
  const merged = { ...current, ...updates };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  try { chmodSync(CONFIG_PATH, 0o600); } catch { /* best effort */ }
}

export interface ResolvedKeys {
  exa: string | null;
  anySearch: string | null;
  tavily: string | null;
}

/** 解析所有 API key（env > config） */
export function resolveKeys(): ResolvedKeys {
  const cfg = loadRaw();
  return {
    exa: process.env.EXA_API_KEY?.trim() || cfg.exaApiKey?.trim() || null,
    anySearch: process.env.ANYSEARCH_API_KEY?.trim() || cfg.anySearchApiKey?.trim() || null,
    tavily: process.env.TAVILY_API_KEY?.trim() || cfg.tavilyApiKey?.trim() || null,
  };
}
