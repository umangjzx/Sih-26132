# AgriLink frontend

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, `next-intl` for i18n,
`recharts` for charts, Tailwind v4. Mobile-first, built to wrap unchanged in Apache
Cordova later — every route is a client component (`"use client"`) that calls the REST
API, with no Next.js server actions or server-only features.

## Routes

| Route | Purpose |
|---|---|
| `/` | Home — hero, crop/market picker, price + signal snapshot, statewide snapshot |
| `/prices` | Trend area chart, min/modal/max, nearby-market comparison bars |
| `/advisor` | Sell / wait / hold gauge with weather · MSP · calendar · holiday context |
| `/directory` | Cold storage / FPOs near a location |
| `/explore` | Public statewide transparency dashboard (movers, trend, activity) |
| `/alerts` | Price alerts + notifications |
| `/login` · `/farmer` · `/buyer` · `/history` · `/deals/[id]` · `/matches/[id]` · `/admin` | Auth + trade workflow |

A header **location chip** (`useLocation` / `LocationProvider`) detects or picks a place,
persists it to `localStorage['agrilink.location']`, and re-scopes prices to that state.

## Run

```bash
cd frontend && node node_modules/next/dist/bin/next dev -p 3000
```

Use this, **not** `npm run dev` — the wrapper exits code 1 when backgrounded in a non-TTY
shell on this setup (see `.planning/codebase/CONCERNS.md`). Interactively, `npm run dev`
is fine.

Production build:

```bash
cd frontend && npm run build
```

> `npm run build` needs network access the first time — `next/font/google` fetches the
> Space Grotesk / DM Sans / Noto Sans Devanagari files. The dev server works offline.

## Tests

```bash
cd frontend && npm run test        # vitest run (one pass)
cd frontend && npm run test:watch  # watch mode
```

> In a shell without `cmd.exe`, run `npx vitest run` directly (or
> `npm run test --script-shell=bash`).

Suites include `parity.test.ts` (locale key parity), `PriceDetail.test.tsx`
(skeleton→data, error→Retry), `SellWaitSignalCard.test.tsx` (each recommendation + its
reasons), `LanguageSwitcher.test.tsx` (locale change + `localStorage` persistence), and a
smoke test per authed page (`farmer`, `buyer`, `deals`, `history`, `login`, `alerts`,
`explore`). Component tests that render charts mock `recharts`.

## Internationalisation

- Locale is **client-only**: stored in `localStorage['agrilink.locale']`, no `/[locale]`
  routing and no `next-intl` middleware/plugin (keeps the app Cordova/static-export safe).
- `LocaleProvider` gates render behind a `ready` flag and shows `AppShellSkeleton` until the
  stored locale resolves — no flash of English on refresh.
- `src/i18n/messages/en.json` is the **source of truth** for keys. `hi.json` and `mr.json`
  must cover every key in `en.json`; `src/i18n/messages/parity.test.ts` (part of
  `npm run test`) fails the build otherwise.
- Header language switcher: English / हिंदी / मराठी.

## Configuration

`frontend/.env` (optional):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API. Defaults to `http://localhost:8000` when unset |
