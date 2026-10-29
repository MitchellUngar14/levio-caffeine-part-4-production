# Caffeine Tracker

A free, browser-only app that logs your caffeine and reminds you when you've gone
too long without it during work hours. Terminal theme, light and dark.

This repo holds Parts 2–4 of a Claude Code demo. Part 1 (architecture) is in the
sibling folder `../Part 1 - Architecture`, frozen at tag `part-1-architecture`.

| Part | Tag |
|---|---|
| 2 · application development | `part-2-app` |
| 3 · testing | `part-3-tests` |
| 4 · production grade (CI, security headers, Cloudflare Pages) | `part-4-prod` |

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. Add `?demo=1` to get a reminder within a minute.

```bash
npm test              # unit and contract tests (Vitest)
npm run test:e2e      # end-to-end tests (Playwright, Chromium)
npm run test:all      # both
npm run typecheck
npm run build         # static files in apps/web/dist
```

First time only: `npx playwright install chromium`. See `docs/TESTING.md`.

```bash
npm run preview       # the production build with the real security headers, on :4173
npm run check         # what CI runs: typecheck, all tests, build, dependency audit
```

## Production

- CI (`.github/workflows/ci.yml`) runs typecheck, unit, contract and end-to-end
  tests, the build and a dependency audit on every push and pull request.
- The site ships with a strict Content Security Policy and the other usual
  security headers (`apps/web/public/_headers`), guarded by a unit test.
- It deploys for free to Cloudflare Pages: build `npm run build`, output
  `apps/web/dist`. Both the dashboard route and the CI-gated route are in
  `docs/DEPLOYMENT.md`, with rollback.

## Layout

```
apps/web        React + Vite app: Today, Calendar and Settings screens, reminder timer,
                LocalStorageStore and the StoreProvider / useStore hook
packages/core   Pure rules (shouldRemind, nextReminderAt, dailyTotals), drink search,
                drinks.json, the CaffeineStore interface, InMemoryStore, contract tests
e2e             Playwright tests, one file per screen, plus reminders
docs            Living copy of the architecture (see "Changes since Part 1"), TESTING.md, DEPLOYMENT.md
.github         CI workflow (test, audit, deploy) and Dependabot
```

## Caffeine figures

`packages/core/src/drinks.json` lists common drinks with a `source` for each
figure. They're widely published numbers (Mayo Clinic, USDA, manufacturers) and
should be re-checked against those sources before relying on them.
