// @vitest-environment node
// Reads files from disk, so it runs in Node rather than jsdom.
import { readFileSync } from "node:fs";
import { INDEX_HTML, cspDirectives, parseHeadersFile, readHeadersFile } from "../../security-headers";

describe("security headers (public/_headers)", () => {
  const rules = readHeadersFile();
  const site = rules["/*"] ?? {};
  const csp = cspDirectives(site["Content-Security-Policy"] ?? "");

  it("parses Cloudflare's format", () => {
    expect(parseHeadersFile("# c\n/*\n  A: 1\n  B: x: y\n\n/assets/*\n  C: 3\n")).toEqual({
      "/*": { A: "1", B: "x: y" },
      "/assets/*": { C: "3" },
    });
  });

  it("sets every header the deployment guide promises", () => {
    expect(site["X-Content-Type-Options"]).toBe("nosniff");
    expect(site["X-Frame-Options"]).toBe("DENY");
    expect(site["Referrer-Policy"]).toBe("no-referrer");
    expect(site["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(site["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(site["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(site["Content-Security-Policy"]).toBeTruthy();
  });

  it("allows no inline or remote scripts and no framing", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    for (const values of Object.values(csp)) {
      expect(values).not.toContain("'unsafe-inline'");
      expect(values).not.toContain("'unsafe-eval'");
      expect(values.some((v) => v === "*" || v.startsWith("http:"))).toBe(false);
    }
  });

  it("matches what index.html loads", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    // No inline <script> (one without src) and no inline style attributes: the CSP would block them.
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toBeNull();
    expect(html).not.toMatch(/\sstyle=/);
    // Every external origin the page references is allowed by the right directive.
    const origins = [...html.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of new Set(origins)) {
      const allowed = (csp["style-src"] ?? []).includes(origin) || (csp["font-src"] ?? []).includes(origin);
      expect(allowed, `${origin} must be in style-src or font-src`).toBe(true);
    }
    // The favicon is a data: URI.
    expect(csp["img-src"]).toContain("data:");
  });

  it("caches hashed assets for a year and nothing else", () => {
    expect(rules["/assets/*"]?.["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    expect(site["Cache-Control"]).toBeUndefined();
  });
});
