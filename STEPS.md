# Part 4: Production grade — what was done

The goal: make the app safe to publish and keep publishing, for free. CI that
runs every test on every push, strict security headers on the served pages, a
security review of the change, and a Cloudflare Pages deploy. This folder is
a clone of Part 3 (history and tags carry over) with the production work on top.

## Steps

1. **Cloned the Part 3 repo into this folder**, installed dependencies and
   Chromium, and ran the baseline: typecheck clean, 70 unit tests green, no
   advisories in production dependencies (three dev-only ones in Vitest's
   worker pool).
2. **Wrote the CI pipeline** (`.github/workflows/ci.yml`): on every push to
   `main` and every pull request, `npm ci`, typecheck, unit and contract tests,
   Chromium install, Playwright end-to-end tests, production build, and a check
   that the headers file made it into the build. Failures keep Playwright's
   report, screenshots, videos and traces as an artifact. A second job audits
   production dependencies. A third deploys the exact build that was tested to
   Cloudflare Pages, on `main` only, and only when the two Cloudflare secrets
   exist; otherwise it logs a note and skips. Read-only token permissions,
   cancelled superseded runs, Node from `.node-version`, Dependabot weekly.
3. **Added security headers** (`apps/web/public/_headers`, which Vite copies
   into the build root where Cloudflare Pages reads it): a Content Security
   Policy that allows only same-origin scripts and no inline ones, plus
   `nosniff`, `DENY` framing, `no-referrer`, a restrictive Permissions-Policy,
   cross-origin opener and resource policies, HSTS, and a one-year immutable
   cache for Vite's hashed assets.
4. **Made the app CSP-clean:** the theme-before-first-paint script moved from
   an inline `<script>` in `index.html` to `public/theme-init.js`. `vite
   preview` now serves the same headers (`npm run preview`), and a unit test
   parses `_headers`, insists on every header and on no `unsafe-inline`, and
   checks `index.html` against the policy (no inline scripts, every external
   origin allowed).
5. **Hardened what comes from outside the app:** `sanitizeStoreData` in
   `packages/core` repairs settings field by field and drops malformed entries,
   for imported backups and for whatever an older version left in localStorage.
   Both stores use it; the contract suite got a test for it, plus eight unit
   tests. A React error boundary replaces a blank page with a message and a
   reload button, and store selection falls back to memory when the browser
   blocks site data.
6. **Upgraded Vitest to 4** (dev-only) to clear the audit: all tests still pass,
   `npm audit` reports zero vulnerabilities.
7. **Ran `/security-review`** on the change set: no exploitable findings. It
   confirmed the CSP matches Vite's output, the import sanitiser can't be used
   for prototype pollution, and fork PRs can't reach the deploy secrets. One
   operational note acted on: runs on `main` now queue instead of cancelling,
   so a deploy is never cut off. Summary in `docs/DEPLOYMENT.md` section 4.
8. **Verified:** `npm run check` (typecheck, 83 unit and contract tests, 28
   Playwright tests, build, audit) green; the production build opened in the
   browser pane with the real headers, no CSP violations in the console, fonts
   loaded, drinks logged, settings saved.
9. **Wrote `docs/DEPLOYMENT.md`:** the CI jobs, every header and why, the two
   ways to deploy to Cloudflare Pages (dashboard Git integration, or the
   CI-gated job with two secrets), rollback, custom domain, and what production
   doesn't change (data stays in the browser, cost stays $0). Updated README,
   CLAUDE.md and the living architecture doc.
10. **Committed and tagged** `part-4-prod`.

## Outputs

- `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.node-version`, `wrangler.toml`
- `apps/web/public/_headers`, `apps/web/public/theme-init.js`, `apps/web/security-headers.ts`
- `packages/core/src/validate.ts`, `apps/web/src/components/ErrorBoundary.tsx`
- `docs/DEPLOYMENT.md`; `npm run preview`, `npm run check`, `npm run audit`
- 111 tests (83 unit and contract, 28 end to end), all passing; zero audit findings
- Tag `part-4-prod`

## Left for the live session (needs accounts)

- Push the repo to GitHub (`gh repo create`, after `gh auth login`) and watch
  the first CI run go green.
- Create the Cloudflare Pages project from the dashboard (build `npm run build`,
  output `apps/web/dist`) and open the `pages.dev` URL; or add the two secrets
  and let the CI deploy job do it.

## Worth showing live

- Push a commit and watch the CI matrix: tests, audit, then deploy.
- `curl -sI https://<project>.pages.dev` showing the CSP, or securityheaders.com.
- Add an inline `<script>` to `index.html`: the headers test fails before the
  CSP would have blocked it in production.
- Import a hand-edited backup with a bad entry: it's dropped, not crashed on.
