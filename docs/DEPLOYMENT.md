# Production: CI, security headers and the Cloudflare Pages deploy

"Production grade" for a free, browser-only app means three things: every
change is tested before it lands, the served pages carry strict security
headers, and the deploy is automatic, free and reversible. Nothing here adds a
server or a paid service.

## 1. Continuous integration (`.github/workflows/ci.yml`)

Runs on every push to `main`, every pull request, and by hand (`workflow_dispatch`).

| Job | What it does | Fails when |
|---|---|---|
| `test` | `npm ci`, typecheck, unit and contract tests, installs Chromium, Playwright end-to-end tests, production build, checks `_headers` made it into the build | Any step fails. Playwright's report, screenshots, videos and traces are kept as the `playwright-report` artifact for 7 days |
| `audit` | `npm audit --omit=dev --audit-level=high` | A production dependency has a high or critical advisory. Dev-only advisories (test runners, bundler) don't block |
| `deploy` | On `main` only, after `test` and `audit` pass: deploys the exact build that was tested to Cloudflare Pages | Only runs when the two Cloudflare secrets exist (see section 3B); otherwise it logs a note and skips |

Details worth knowing:
- The workflow has `permissions: contents: read`; the deploy job adds `deployments: write` for the GitHub environment `production`, which records the live URL.
- `concurrency` cancels an older run of the same branch or PR when a new push arrives; on `main` runs queue instead, so a deploy is never cut off halfway.
- Node comes from `.node-version` (22, the current LTS), which Cloudflare Pages reads too, so CI and the Pages build use the same version.
- Playwright sees `CI=true` on GitHub, so `playwright.config.ts` retries twice, forbids `test.only`, and writes the HTML report.
- `.github/dependabot.yml` opens weekly update PRs for npm (minor and patch grouped into one) and for the actions themselves. CI tests them like any other PR.

Locally, `npm run check` runs the same sequence (typecheck, all tests, build, audit).

## 2. Security headers (`apps/web/public/_headers`)

Cloudflare Pages reads a `_headers` file from the root of the build output.
Vite copies everything in `apps/web/public/` to `apps/web/dist/`, so the file
ships with every build. `npm run preview` serves the production build with the
same headers (see `apps/web/vite.config.ts`), and
`apps/web/src/lib/security-headers.test.ts` fails if the policy is weakened or
if `index.html` gains something the policy would block.

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` | Only scripts from this origin run, none inline, so an injected `<script>` does nothing. Styles and fonts may also come from Google Fonts. `frame-ancestors 'none'` stops click-jacking |
| `X-Content-Type-Options` | `nosniff` | The browser trusts the declared MIME types |
| `X-Frame-Options` | `DENY` | Older browsers' version of `frame-ancestors` |
| `Referrer-Policy` | `no-referrer` | The app's URL (with `?demo=1`, `#/settings`) never leaks to Google Fonts or anywhere else |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` | The app needs none of these; `Notification` isn't governed by this header |
| `Cross-Origin-Opener-Policy` | `same-origin` | Other windows can't hold a reference to this one |
| `Cross-Origin-Resource-Policy` | `same-origin` | Our files can't be embedded by other sites |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Browsers that have seen the site once only ever use HTTPS |
| `Cache-Control` (`/assets/*` only) | `public, max-age=31536000, immutable` | Vite names bundled files by content hash, so they can be cached for a year. `index.html` keeps Pages' default (revalidate every time) so a deploy shows up at once |

What the CSP forced in the app:
- The theme-before-first-paint script moved from an inline `<script>` in `index.html` to `apps/web/public/theme-init.js`, loaded blocking from `<head>`. Any future start-up code goes the same way.
- React sets `style={{ … }}` through the CSSOM, which the policy allows, so component styles are unaffected. A `<style>` tag or `dangerouslySetInnerHTML` would be blocked: don't add them.
- The dev server (`npm run dev`) sends no CSP because React Fast Refresh injects inline scripts. Check header behaviour with `npm run preview`.
- `npm run preview` applies the `/*` block only; the `/assets/*` cache rule is path-specific and applied by Pages.

Checking the live site:

```bash
curl -sI https://caffeine-tracker.pages.dev | grep -iE "content-security|x-frame|strict-transport|referrer"
```

[securityheaders.com](https://securityheaders.com) gives the same policy an A+.

## 3. Deploying to Cloudflare Pages (free)

Build settings, the same in both options:

| Setting | Value |
|---|---|
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` (the workspace root, so `npm ci` installs both packages) |
| Node version | read from `.node-version` |

### A. From the Cloudflare dashboard (simplest, good for the demo)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git →
   pick the repo. Enter the build settings above. Save and deploy.
3. In a minute or two the site is live at `https://caffeine-tracker.pages.dev`
   (the project name becomes the subdomain; pick another if it's taken).
4. From then on every push to `main` deploys production, and every other branch
   or PR gets its own preview URL (`<hash>.caffeine-tracker.pages.dev`).

Pages' Git integration deploys whether or not CI passed. That's acceptable for
a personal tool; if you want deploys gated on tests, use option B.

### B. From GitHub Actions, gated on green tests

1. Create the Pages project once, without connecting Git:
   `npx wrangler login`, then `npx wrangler pages project create caffeine-tracker --production-branch main`.
   (`wrangler.toml` holds the project name and output directory for `npx wrangler pages deploy`.)
2. In Cloudflare: My Profile → API Tokens → Create Token → "Edit Cloudflare
   Workers" template, or a custom token with **Account › Cloudflare Pages › Edit**.
   Copy the token and your Account ID (dashboard → Workers & Pages, right-hand side).
3. In GitHub: repo → Settings → Secrets and variables → Actions → add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Push to `main`. The `deploy` job uploads the build that `test` just produced
   and prints the deployment URL on the `production` environment.

If both A and B are set up, every push deploys twice. Pick one; B's job skips
itself when the secrets are absent.

### Rollback

Pages keeps every deployment. Dashboard → the project → Deployments → "…" on
an earlier one → **Rollback to this deployment**: instant, no rebuild. Or
`git revert` the commit and push, which also re-runs the tests.

### Custom domain (optional)

Pages → the project → Custom domains → add one. Cloudflare issues the
certificate; HSTS from `_headers` applies to it as well. Still free.

## 4. Security review

`/security-review` ran over this change set (Claude Code's built-in review:
one pass to find candidate issues, then an adversarial pass to filter false
positives). It found no exploitable issue. What it checked and concluded:

- The CSP permits exactly what the built app needs: Vite 6 emits no inline
  script, React applies `style` props through the CSSOM (allowed without
  `unsafe-inline`), and the Google Fonts stylesheet and font files are covered
  by `style-src` and `font-src`.
- `sanitizeStoreData` builds every object fresh with named properties, so a
  crafted backup can't pollute prototypes or reach an unsafe sink; strings
  only ever become React text nodes or a notification body.
- Fork pull requests run on `pull_request` with a read-only token and no
  secrets; the deploy job only runs on a push to `main`, after the tests, and
  downloads the artifact of that same run, so a PR can't substitute the build.
- Observations left as they are: actions are pinned by major tag rather than
  commit SHA (Dependabot keeps them current; pin by SHA if the repo ever holds
  a more valuable token), and the `production` environment has no required
  reviewers (anyone who can push to `main` can deploy, which is the intent for
  a personal tool).

## 5. What production doesn't change

- Data still lives only in the user's browser. There is nothing to back up on
  the server, and nothing to leak from it.
- The only third party the page talks to is Google Fonts, for JetBrains Mono.
  To remove even that, download the font into `apps/web/public/fonts/`, reference
  it from `theme.css`, and drop the two Google origins from the CSP (the headers
  test will then insist they're gone).
- Cost: $0. Cloudflare Pages' free plan allows 500 builds a month and unlimited
  requests and bandwidth for static files; GitHub Actions is free for public
  repos and gives 2,000 minutes a month to private ones (one CI run takes about three).
