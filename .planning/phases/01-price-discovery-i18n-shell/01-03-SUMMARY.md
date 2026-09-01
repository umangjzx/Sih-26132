---
phase: 01-price-discovery-i18n-shell
plan: 03
subsystem: ui
tags: [next-intl, vitest, testing-library, react-19, i18n, jsdom, recharts, a11y]

requires:
  - phase: 01-price-discovery-i18n-shell
    provides: existing LocaleProvider, PriceDashboard, LanguageSwitcher, en/hi/mr catalogs, lib/api helpers

provides:
  - No-flash `ready` gate in LocaleProvider rendering AppShellSkeleton until the stored locale resolves (hydration-safe, no English flash)
  - AppShellSkeleton locale-neutral placeholder component (no useTranslations)
  - Frontend vitest infrastructure — vitest.config.mts (jsdom + tsconfigPaths + react), vitest.setup.ts (jest-dom + recharts ResponsiveContainer stub), src/test/render.tsx (renderWithIntl)
  - `test` / `test:watch` npm scripts + vitest/testing-library devDependencies
  - hi/mr key-parity vitest test (recursive flatten vs en.json, both directions)
  - PriceDashboard: useCallback `load` + translated Retry affordance that re-runs the exact fetch (and recovers a failed initial options fetch); skeleton carries data-testid="skeleton" + role="status" + aria-label={tc("loading")}
  - PriceDashboard / SellWaitSignalCard / LanguageSwitcher component tests
  - next-intl AppConfig `Messages: typeof en` type augmentation (types.d.ts)
  - Documented Hindi/Marathi mandi-terminology plausibility pass (D-18)
affects: [phase-4-static-export, future-i18n-work, frontend-test-suite]

actuals:
  tokens: 4300
  tasks: 3
  commits: 4

tech-stack:
  added: [vitest@4.1.11, "@vitejs/plugin-react@6.1.1", jsdom@30.0.1, "@testing-library/react@16.3.3", "@testing-library/dom@10.4.1", "@testing-library/jest-dom@7.0.1", "@testing-library/user-event@14.6.6", vite-tsconfig-paths@6.1.1]
  patterns:
    - "next-intl client-only provider with a no-flash `ready` boolean gate (1-RESEARCH Pattern 4)"
    - "vitest + RTL 16 under jsdom with recharts ResponsiveContainer stubbed and @/lib/api vi.mock'd"
    - "renderWithIntl() test helper wrapping components in NextIntlClientProvider with the en catalog"
    - "recursive-flatten i18n key-parity test (no lodash)"

key-files:
  created:
    - frontend/src/components/AppShellSkeleton.tsx
    - frontend/vitest.config.mts
    - frontend/vitest.setup.ts
    - frontend/src/test/render.tsx
    - frontend/src/i18n/messages/parity.test.ts
    - frontend/src/components/PriceDashboard.test.tsx
    - frontend/src/components/SellWaitSignalCard.test.tsx
    - frontend/src/components/LanguageSwitcher.test.tsx
    - frontend/src/i18n/types.d.ts
  modified:
    - frontend/src/i18n/LocaleProvider.tsx
    - frontend/src/components/PriceDashboard.tsx
    - frontend/src/components/PriceTrendChart.tsx
    - frontend/package.json

key-decisions:
  - "Kept the client-only LocaleProvider (D-16) — added only the `ready` gate; no src/i18n/request.ts, no next-intl plugin, no middleware (would break the Phase 4 static export)"
  - "AppShellSkeleton is fixed locale-neutral markup with no useTranslations so server render and first client render are byte-identical (no hydration mismatch)"
  - "load() is a useCallback (deps crop/market/days/options); when options is empty it fetches options and seeds the selection, then a dep change re-runs it — so Retry also recovers a failed initial /api/options call"
  - "Terminology pass (D-18): every hi/mr value is plausible and mandi-domain-appropriate; no plainly-wrong term found; en/hi/mr left byte-identical to plan start so parity stays trivially green"
  - "Accepted modal price -> औसत भाव (hi) / सरासरी भाव (mr) ('average price') as the intended plain-language rendering, per 1-RESEARCH Open Question #4"

patterns-established:
  - "No-flash locale gate: `const [ready, setReady] = useState(false)` flipped at the end of the mount useEffect; render `{ready ? children : <AppShellSkeleton />}` inside NextIntlClientProvider"
  - "Frontend tests: `node_modules/.bin/vitest run` / `npx vitest run` (npm's default cmd.exe script shell is unavailable in this sandbox)"

requirements-completed: [I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, A11Y-01, A11Y-02, A11Y-03, PERF-01]

coverage:
  - id: D1
    description: "No-flash `ready` gate + AppShellSkeleton: locale resolves through a hydration-safe locale-neutral skeleton with no visible English frame"
    requirement: "I18N-05"
    verification:
      - kind: unit
        ref: "frontend/src/components/LanguageSwitcher.test.tsx#restores the persisted locale on a fresh mount"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json (clean) + identical-markup design"
        status: pass
    human_judgment: true
    rationale: "The 'no visible English flash and no hydration warning on first paint' guarantee is a visual/runtime property; `npm run build` could not run in this offline sandbox (Google Fonts fetch blocked), so a human must load the app once with localStorage['agrilink.locale']='hi' and confirm no English frame flashes and the console shows no hydration warning."
  - id: D2
    description: "Frontend vitest infrastructure — jsdom env, tsconfigPaths+react plugins, jest-dom, recharts ResponsiveContainer stub, renderWithIntl helper, test/test:watch scripts"
    requirement: "PERF-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/vitest run — 4 files / 11 tests pass under jsdom"
        status: pass
    human_judgment: false
  - id: D3
    description: "hi.json and mr.json contain every key in en.json and no strays (recursive-flatten parity test, runs in the suite)"
    requirement: "I18N-03"
    verification:
      - kind: unit
        ref: "frontend/src/i18n/messages/parity.test.ts (4 assertions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PriceDashboard translated Retry affordance re-runs the exact fetch; skeleton carries data-testid='skeleton', role='status', aria-label={tc('loading')}; no hardcoded user-facing string"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "frontend/src/components/PriceDashboard.test.tsx#shows skeletons first, then the fetched data | #recovers from an error via the Retry button"
        status: pass
      - kind: other
        ref: "literal-scan grep over PriceDashboard.tsx — no user-facing literals"
        status: pass
    human_judgment: false
  - id: D5
    description: "LanguageSwitcher changes UI language, persists to localStorage['agrilink.locale'], and updates document.documentElement.lang; a fresh mount restores the persisted locale"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "frontend/src/components/LanguageSwitcher.test.tsx (2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "next-intl AppConfig augmented with `Messages: typeof en` so tsc type-checks translation keys used in code against en.json (en is the source of truth)"
    requirement: "I18N-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json (clean, with types.d.ts in place)"
        status: pass
    human_judgment: false
  - id: D7
    description: "SellWaitSignalCard renders each of sell_now / wait / hold with its localized label and every reason string"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "frontend/src/components/SellWaitSignalCard.test.tsx (3 parametrized tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Hindi/Marathi mandi-terminology plausibility pass (D-18) — every hi/mr value reviewed against its en counterpart and the mandi domain"
    verification:
      - kind: manual_procedural
        ref: "SUMMARY 'Terminology pass (D-18)' section — full per-key review table"
        status: pass
    human_judgment: true
    rationale: "Translation quality is a human judgment; a bilingual reviewer should confirm the findings, especially the flagged hi.signal.hold / hi.signal.wait overlap."
  - id: D9
    description: "Earthy palette, Noto Sans + Noto Sans Devanagari, global 44px tap target and focus-visible outlines left untouched (D-20, A11Y-01/A11Y-03); Retry button inherits them from globals.css"
    requirement: "A11Y-01"
    verification:
      - kind: other
        ref: "git diff — no change to globals.css / layout.tsx / palette tokens; Skeleton visual classes unchanged"
        status: pass
    human_judgment: true
    rationale: "Contrast ratios and the visual earthy-not-startup-blue judgment (A11Y-03) need a human eye on the running app."

duration: 48min
completed: 2026-09-01
status: complete
---

# Phase 1 Plan 03: i18n Shell Hardening & First Frontend Test Suite Summary

**No-flash `ready` gate + AppShellSkeleton, vitest 4 / RTL 16 infra under jsdom with recharts stubbed, hi/mr key-parity test, a translated Retry affordance with screen-reader-visible skeletons, and next-intl `Messages` typing — 11 passing tests across 4 modules.**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-09-01 (session)
- **Completed:** 2026-09-01
- **Tasks:** 3 (+ pre-authorized package checkpoint)
- **Files modified:** 13 (9 created, 4 modified)

## Checkpoint Resolution

**`checkpoint:human-verify` — vitest / testing-library batch legitimacy:** Pre-authorized by the user in the execution brief. The batch (`vitest@4.1.11`, `@vitejs/plugin-react@6.1.1`, `jsdom@30.0.1`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.1`, `@testing-library/jest-dom@7.0.1`, `@testing-library/user-event@14.6.6`, `vite-tsconfig-paths@6.1.1`) is all first-party, tens of millions of weekly downloads, `postinstall: null`, dev-only. Installed with the pinned versions via `npm i -D`; `frontend/package-lock.json` updated and committed in `54a8fe7`. `npm audit` reported 0 vulnerabilities.

## Accomplishments

- **No English flash on load:** `LocaleProvider` now holds `const [ready, setReady] = useState(false)`, flips it at the end of the mount `useEffect` after reading `localStorage['agrilink.locale']`, and renders `{ready ? children : <AppShellSkeleton />}` **inside** `NextIntlClientProvider`. Server render and first client render both compute `ready === false` and emit the identical locale-neutral `AppShellSkeleton` — no hydration mismatch, no English paint. No `src/i18n/request.ts`, no next-intl plugin, no middleware (Phase 4 static export stays viable).
- **First frontend test suite:** `vitest.config.mts` (jsdom, `tsconfigPaths()` + `react()`, `setupFiles`), `vitest.setup.ts` (`@testing-library/jest-dom/vitest` + `recharts` `ResponsiveContainer` passthrough stub), `src/test/render.tsx` (`renderWithIntl`). `test` / `test:watch` scripts added. **4 files / 11 tests, all green.**
- **Key-parity guard:** `parity.test.ts` recursively flattens `en/hi/mr` and asserts both directions (hi/mr cover every en key; no strays).
- **Dashboard recovers from errors:** the crop/market/days fetch is extracted into a `useCallback` `load` (deps `crop, market, days, options`); the effect just calls `load()`. When `options` is empty, `load()` first `await fetchOptions()` and seeds the selection, so a Retry after a failed initial `/api/options` also recovers. The static error `<p>` is replaced by a `role="alert"` panel keeping `tc("error")` plus a `<button type="button" onClick={() => load()}>` labelled `tc("retry")`.
- **Skeletons visible to tests + screen readers:** the inner `Skeleton` now carries `data-testid="skeleton"`, `role="status"`, and `aria-label={tc("loading")}`; visual classes untouched.
- **Key-safe translations:** `types.d.ts` augments `next-intl`'s `AppConfig` with `Messages: typeof en`.
- **Terminology pass (D-18):** documented below; no JSON changes were warranted.

## Task Commits

1. **Task 1: No-flash ready gate + vitest infra + key-parity test** — `54a8fe7` (feat)
2. **Task 2: Retry affordance + skeleton a11y/testability + component tests** — `47423b5` (feat)
3. **Task 3: AppConfig Messages typing + terminology pass + LanguageSwitcher test** — `a4b2272` (test)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP/REQUIREMENTS)_

_(Commit `4a7d2a4` between Task 1 and Task 2 is the parallel plan 01-01's Alembic work, not part of this plan.)_

## Files Created/Modified

**Created**
- `frontend/src/components/AppShellSkeleton.tsx` — locale-neutral placeholder (`role="status"`, `aria-hidden` blocks), no `useTranslations`, no user-facing words.
- `frontend/vitest.config.mts` — jsdom env, `globals: true`, `tsconfigPaths()` + `react()`, `setupFiles`, `css: false`.
- `frontend/vitest.setup.ts` — jest-dom matchers + `vi.mock("recharts", …)` replacing `ResponsiveContainer` with a passthrough.
- `frontend/src/test/render.tsx` — `renderWithIntl(ui)` wrapping in `NextIntlClientProvider` (locale `en`, `en.json`, `Asia/Kolkata`); re-exports `screen`.
- `frontend/src/i18n/messages/parity.test.ts` — recursive `flat()` + `describe.each` over hi/mr, both-direction key diff.
- `frontend/src/components/PriceDashboard.test.tsx` — `vi.mock("@/lib/api")`; skeleton-then-data; error → Retry → recovery via `user-event`.
- `frontend/src/components/SellWaitSignalCard.test.tsx` — parametrized over `sell_now` / `wait` / `hold`, asserts label + both reasons.
- `frontend/src/components/LanguageSwitcher.test.tsx` — select → localStorage + `documentElement.lang`; fresh mount restores persisted locale.
- `frontend/src/i18n/types.d.ts` — `declare module "next-intl" { interface AppConfig { Messages: typeof en } }`.

**Modified**
- `frontend/src/i18n/LocaleProvider.tsx` — `ready` state + gate; mount effect computes `next` locale, sets it, sets `documentElement.lang`, then `setReady(true)`.
- `frontend/src/components/PriceDashboard.tsx` — `useCallback` `load`, single effect, `role="alert"` error panel + translated Retry, skeleton `data-testid`/`role`/`aria-label`.
- `frontend/src/components/PriceTrendChart.tsx` — Tooltip `formatter` param widened to recharts' `ValueType` + `Number()` coercion (deviation, see below).
- `frontend/package.json` — `test` / `test:watch` scripts + 8 devDependencies.

## Decisions Made

- **Kept D-16 client-only i18n intact** — only the `ready` gate was added. No routing setup of any kind.
- **`load()` recovers a failed initial options fetch** — the empty-`options` branch fetches options, seeds crop/market, and returns; the resulting dep change re-runs `load()` for the trend/signal/nearby calls. This keeps `fetchTrend` called exactly once per attempt, which the error→retry test relies on.
- **Component tests query by role, not by the illustrative `findByText(/Onion/)`** — `Onion` also appears in the crop `<option>`, and after a locale switch the switcher's accessible label is localized (`भाषा`), so `getByRole("heading", { name: /Onion/i })` and `getByRole("combobox")` are used for stability.
- **No JSON edits in the terminology pass** — see below.

## Terminology pass (D-18)

Light plausibility review (NOT a professional translation). Every value in `hi.json` and `mr.json` was read against its `en.json` counterpart and the Maharashtra mandi domain. **Result: all values are plausible and domain-appropriate; no plainly-wrong term, wrong script, or typo was found, so `hi.json` / `mr.json` / `en.json` are byte-identical to plan start** (parity + key-drift checks stay trivially green).

| key | en | hi | mr | verdict |
|-----|----|----|----|---------|
| common.loading | Loading... | लोड हो रहा है... | लोड होत आहे... | OK — common colloquial form |
| common.error | Something went wrong | कुछ गड़बड़ हो गई | काहीतरी चूक झाली | OK — natural |
| common.retry | Retry | पुनः प्रयास करें | पुन्हा प्रयत्न करा | OK — "try again" |
| nav.prices | Mandi Prices | मंडी भाव | बाजार भाव | OK — मंडी is the Hindi APMC term; Marathi idiomatically uses बाजार भाव |
| nav.language / dashboard.selectCrop / selectMarket | — | भाषा / फसल चुनें / मंडी चुनें | भाषा / पीक निवडा / बाजार निवडा | OK |
| dashboard.title | Mandi Price Discovery | मंडी भाव जानकारी | बाजार भाव माहिती | OK — "Discovery" softened to "information", acceptable plain rendering |
| dashboard.modalPrice | Modal Price | औसत भाव | सरासरी भाव | **Intentional** — "average price" plain-language rendering, per 1-RESEARCH Open Q #4; NOT a bug |
| dashboard.minPrice / maxPrice | Min / Max Price | न्यूनतम भाव / अधिकतम भाव | किमान भाव / कमाल भाव | OK |
| dashboard.perQuintal | per quintal | प्रति क्विंटल | प्रति क्विंटल | OK — quintal is the standard mandi unit |
| dashboard.asOf | As of | दिनांक | दिनांक | Weak but acceptable — renders as "Date: <date>" in context; not wrong |
| signal.title / sell_now / wait | Sell Now or Wait? / Sell Now / Wait | अभी बेचें या रुकें? / अभी बेचें / रुकें | आत्ता विकावे की थांबावे? / आत्ता विका / थांबा | OK |
| signal.hold | Hold / Watch | प्रतीक्षा करें | वाट पाहा | **Flagged (not fixed):** hi "प्रतीक्षा करें" semantically overlaps with signal.wait "रुकें" (both ≈ "wait"). Marathi separates them cleanly (थांबा vs वाट पाहा). "प्रतीक्षा करें" is a valid rendering of hold/watch, so per the "only fix plainly-wrong" rule it was left unchanged; recommend a bilingual reviewer consider hi.signal.hold → "देखते रहें" in a future pass. |
| signal.why / notEnoughData | Why this recommendation? / Not enough price history… | यह सलाह क्यों? / …पर्याप्त भाव इतिहास उपलब्ध नहीं है | हा सल्ला का? / …पुरेसा भाव इतिहास उपलब्ध नाही | OK |
| nearby.* | Market / District / Distance / Price / km | मंडी / जिला / दूरी / भाव / किमी | बाजार / जिल्हा / अंतर / भाव / किमी | OK — भाव (rate) is apt for mandi price |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PriceTrendChart Tooltip formatter type error blocked the `tsc --noEmit` gate**
- **Found during:** Task 1 (verify #2 runs `npx tsc --noEmit`).
- **Issue:** `formatter={(value: number) => …}` is not assignable to recharts' `Formatter<ValueType, NameType>` (value can be `ValueType | undefined`). `tsc` exited 2. Confirmed **pre-existing** — the error reproduces with this plan's LocaleProvider/package.json changes stashed; `PriceTrendChart.tsx` was not otherwise in scope and recharts was not upgraded.
- **Fix:** Dropped the `: number` annotation and coerced: `formatter={(value) => [\`₹${Number(value).toFixed(0)}\`, t("modalPrice")]}`. One line, behavior-preserving for numeric input.
- **Files modified:** `frontend/src/components/PriceTrendChart.tsx`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean after the change (and at every subsequent task).
- **Committed in:** `54a8fe7` (Task 1 commit).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Minimal — a single-line type-safety fix to an out-of-scope file that was blocking this plan's own typecheck gate. No behavior change, no scope creep.

## Issues Encountered

- **`npm run build` cannot run in this offline sandbox.** `next/font/google` (Noto Sans + Noto Sans Devanagari, declared in `src/app/layout.tsx`) fails to fetch WOFF2 files from `fonts.gstatic.com` (no network), and Turbopack then emits 44 `Module not found: @vercel/turbopack-next/internal/font/google/font` errors — **every one originating from the `layout.tsx` font imports**, none from this plan's files. The already-running dev server on `:3000` returns **HTTP 200**, confirming the code compiles and renders. `layout.tsx` font config is out of scope (D-20 mandates keeping `next/font` Noto Sans + Devanagari), so no code change was made. `npx tsc --noEmit` is clean. The build gate should be re-run by a human on a networked machine (or with a warm font cache) to close the hydration/next-intl-locale check.
- **`npm test` (bare) exits 1 with no output in this sandbox.** npm's default script shell is `cmd.exe`, which is unavailable in the Bash-only environment, so the `vitest run` child never spawns. The `"test": "vitest run"` script itself is correct: `npx vitest run`, `node_modules/.bin/vitest run`, and `npm test --script-shell=bash` all produce **4 files / 11 tests passing, exit 0**. All test verifications in this SUMMARY were run via `node_modules/.bin/vitest run` / `npx vitest run`.
- **Pre-existing eslint errors (not introduced here, not a plan gate):** `react-hooks/set-state-in-effect` fires on `LocaleProvider.tsx` (`setLocaleState` in the mount effect — the sanctioned 1-RESEARCH Pattern 4) and on `PriceDashboard.tsx` (`load()` in the effect). The **same 2 errors exist on the pre-plan code** (verified by linting the checked-out originals); count is unchanged (2 before, 2 after). The rule conflicts with the deliberate "read localStorage on mount" pattern the research prescribes. Left as-is to match existing codebase style; flag for a project-wide lint policy decision.

## Verification Results

| Gate | Result |
|------|--------|
| `npx vitest run` (full suite) | **PASS** — 4 files, 11 tests, exit 0 |
| `npx vitest run -- parity` | PASS — 4 assertions |
| `npx vitest run PriceDashboard SellWaitSignalCard` | PASS — 5 tests |
| `npx vitest run LanguageSwitcher parity` | PASS — 6 tests |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** — clean |
| LocaleProvider `ready` gate + `AppShellSkeleton`, `grep -c request` = 0 | PASS |
| AppShellSkeleton — no `useTranslations`, no user-facing words | PASS |
| PriceDashboard — `data-testid="skeleton"` + `role="status"` + translated Retry `onClick={() => load()}` | PASS |
| Literal scan (PriceDashboard / AppShellSkeleton / LanguageSwitcher) | PASS — no hardcoded strings |
| hi/mr flattened key sets == en.json; `en.json` unchanged | PASS — `KEYS_MATCH`, zero diff |
| `npm run build` | **NOT RUN** — offline Google Fonts fetch (environment); dev server serves HTTP 200 |

## Known Stubs

None. `AppShellSkeleton` renders fixed decorative markup by design (locale-neutral, no data source) — this is the intended no-flash placeholder, not a stub.

## User Setup Required

None - no external service configuration required. (Dev-only test dependencies were installed and lockfile committed.)

## Next Phase Readiness

- Frontend now has a real vitest + RTL suite (`npm test` / `npx vitest run`) and a key-parity guard that fails CI if hi/mr drift from en.
- The no-flash gate and `AppShellSkeleton` are in place; a networked `npm run build` should be run once to formally close the hydration / next-intl-locale build check (blocked here only by offline Google Fonts).
- `Messages` typing is wired — future components get compile-time key checking against `en.json`.
- Open follow-up: bilingual review of `hi.signal.hold` vs `hi.signal.wait` overlap; project-wide decision on the `react-hooks/set-state-in-effect` lint rule.

## Self-Check: PASSED

All 9 created files verified present on disk; all 3 task commits (`54a8fe7`, `47423b5`, `a4b2272`) verified in git history.

---
*Phase: 01-price-discovery-i18n-shell*
*Completed: 2026-09-01*
