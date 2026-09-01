# AgriLink frontend

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, `next-intl` for i18n,
`recharts` for the price chart, Tailwind v4. Mobile-first, built to wrap unchanged in
Apache Cordova later — so the price routes are a client-rendered SPA that calls the REST
API (no Next.js server actions / server-only features on those routes).

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
> Noto Sans / Noto Sans Devanagari files. The dev server works offline.

## Tests

```bash
cd frontend && npm run test        # vitest run (one pass)
cd frontend && npm run test:watch  # watch mode
```

> In a shell without `cmd.exe`, run `npx vitest run` directly (or
> `npm run test --script-shell=bash`).

Suites: `parity.test.ts` (locale key parity), `PriceDashboard.test.tsx` (skeleton→data,
error→Retry recovery), `SellWaitSignalCard.test.tsx` (each recommendation + its reasons),
`LanguageSwitcher.test.tsx` (locale change + `localStorage` persistence).

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
