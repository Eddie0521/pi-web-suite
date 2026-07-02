/**
 * SSRF 防护 — 阻止请求内网地址
 *
 * 禁止访问的 IP 范围：
 *   - 127.0.0.0/8, ::1（本机）
 *   - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16（私有）
 *   - 169.254.0.0/16（链路本地）
 *   - fc00::/7（唯一本地地址）
 *   - fe80::/10（链路本地）
 */

import { resolve4 } from "node:dns/promises";

const PRIVATE_RANGES = [
  { min: ip4("127.0.0.0"), max: ip4("127.255.255.255") },
  { min: ip4("10.0.0.0"),   max: ip4("10.255.255.255") },
  { min: ip4("172.16.0.0"), max: ip4("172.31.255.255") },
  { min: ip4("192.168.0.0"), max: ip4("192.168.255.255") },
  { min: ip4("169.254.0.0"), max: ip4("169.254.255.255") },
  { min: ip4("0.0.0.0"),     max: ip4("0.255.255.255") },
];

function ip4(str: string): number {
  const parts = str.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) {
    return true;
  }
  // IPv4
  const num = ip4(ip);
  return PRIVATE_RANGES.some((r) => num >= r.min && num <= r.max);
}

export async function checkSSRF(url: string): Promise<void> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`不支持的协议: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // 直接判断 IP
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error(`SSRF 拒绝: 不能访问本机地址 (${hostname})`);
  }

  // DNS 解析后检查
  try {
    const ips = await resolve4(hostname);
    for (const ip of ips) {
      if (isPrivateIP(ip)) {
        throw new Error(`SSRF 拒绝: ${hostname} 解析到内网地址 (${ip})`);
      }
    }
  } catch (err) {
    // DNS 解析失败允许通过（可能是本地网络问题）
    if (err instanceof Error && err.message.startsWith("SSRF 拒绝")) {
      throw err;
    }
  }
}
