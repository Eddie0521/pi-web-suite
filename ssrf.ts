/**
 * SSRF 防护 — 阻止请求内网地址
 *
 * 禁止访问的 IP 范围：
 *   - 127.0.0.0/8, ::1（本机）
 *   - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16（私有）
 *   - 169.254.0.0/16（链路本地）
 *   - fc00::/7（唯一本地地址）
 *   - fe80::/10（链路本地）
 *
 * 2026-07-03: 修复 IPv4-mapped IPv6（::ffff:...）误判为 0.0.0.0/8
 */

import { resolve4, resolve6 } from "node:dns/promises";

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
  if (parts.length !== 4 || parts.some(isNaN)) return NaN;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  // IPv6 loopback / unique-local / link-local
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x 或 ::ffff:xxxx:xxxx 或 ::ffff:0:xxxx:xxxx)
  // 提取最后 32 位作为 IPv4 再检查私有范围
  if (ip.startsWith("::ffff:")) {
    const embedded = ip.slice(7); // 去掉 "::ffff:"
    // 点分十进制: ::ffff:192.168.1.1
    if (embedded.includes(".")) {
      return isPrivateIP(embedded);
    }
    // 十六进制: ::ffff:c000:0280 或 ::ffff:0:c612:604
    // 最后两个 16-bit 组合编码了 IPv4 地址
    const groups = embedded.split(":");
    const lastTwo = groups.slice(-2);
    if (lastTwo.length === 2) {
      const hi = parseInt(lastTwo[0], 16);
      const lo = parseInt(lastTwo[1], 16);
      if (!isNaN(hi) && !isNaN(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIP(ipv4);
      }
    }
    // 无法解析则放行（宁放过勿误杀）
    return false;
  }

  // IPv4 — 检查私有范围
  const num = ip4(ip);
  if (Number.isNaN(num)) return false;
  return PRIVATE_RANGES.some((r) => num >= r.min && num <= r.max);
}

export async function checkSSRF(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`无效的 URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`不支持的协议: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // 直接判断 IP
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error(`SSRF 拒绝: 不能访问本机地址 (${hostname})`);
  }

  // DNS 解析后检查（IPv4 + IPv6）
  try {
    const v4ips = await resolve4(hostname);
    for (const ip of v4ips) {
      if (isPrivateIP(ip)) {
        throw new Error(`SSRF 拒绝: ${hostname} 解析到内网地址 (${ip})`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF 拒绝")) throw err;
  }
  try {
    const v6ips = await resolve6(hostname);
    for (const ip of v6ips) {
      if (isPrivateIP(ip)) {
        throw new Error(`SSRF 拒绝: ${hostname} 解析到内网地址 (${ip})`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF 拒绝")) throw err;
  }
}
