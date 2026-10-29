/**
 * Reads public/_headers (Cloudflare Pages' format) so `vite preview` can serve
 * the same headers locally and a unit test can guard the policy.
 * Node-only: used by vite.config.ts and tests, never by the app itself.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HEADERS_FILE = fileURLToPath(new URL("./public/_headers", import.meta.url));
export const INDEX_HTML = fileURLToPath(new URL("./index.html", import.meta.url));

export type HeaderRules = Record<string, Record<string, string>>;

/** A path line (no indent) starts a rule; indented "Name: value" lines belong to it. */
export function parseHeadersFile(text: string): HeaderRules {
  const rules: HeaderRules = {};
  let current: Record<string, string> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      current = rules[trimmed] ?? {};
      rules[trimmed] = current;
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (!current || colon < 0) continue;
    current[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return rules;
}

export function readHeadersFile(): HeaderRules {
  return parseHeadersFile(readFileSync(HEADERS_FILE, "utf8"));
}

/** "default-src 'self'; img-src 'self' data:" → { "default-src": ["'self'"], "img-src": ["'self'", "data:"] } */
export function cspDirectives(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}
