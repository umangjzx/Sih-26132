# Conventions

**Analysis Date:** 2026-09-01

## Backend (Python)
- SQLAlchemy 2.0 style: `class X(Base)` with `Mapped[type]` + `mapped_column(...)`, `__tablename__`, `__table_args__` for constraints.
- Models are one-per-file under `app/models/` and all re-imported in `app/models/__init__.py` so `Base.metadata.create_all` sees them.
- Services are plain modules of functions (no classes) under `app/services/`; module docstrings explain intent and known limitations (see `ingestion.py`, `signal.py`).
- API: a single `APIRouter(prefix="/api", tags=[...])` per domain file; dependency-inject the session with `db: Session = Depends(get_db)`; return Pydantic response models via `response_model=`.
- Config through `app.core.config.settings` (a `pydantic_settings.BaseSettings`); never read `os.environ` directly.
- Query params validated with `fastapi.Query(...)` (e.g. `days: int = Query(30, ge=1, le=90)`).
- 404 via `HTTPException(status_code=404, detail=...)` when a series/crop has no rows.
- Type hints everywhere; `X | None` unions; `list[...]` lowercase generics (3.10+ style).

## Frontend (TypeScript / React)
- Client components only on the app route so far — `"use client"` at the top; no server actions, no server-only APIs (Cordova constraint).
- Components in `src/components/`, PascalCase files, named exports (`export function PriceDashboard()`).
- Data fetching via the typed helpers in `src/lib/api.ts` (never inline `fetch` in components); each response has an exported `type`.
- **All display copy goes through `useTranslations("<namespace>")`** from `next-intl`; keys are namespaced (`common`, `nav`, `dashboard`, `signal`, `nearby`). No hardcoded user-facing strings.
- Styling: Tailwind utility classes + CSS custom properties for theme (`var(--color-brand)` etc. defined in `globals.css`). Earthy palette tokens: `--color-brand` green, `--color-accent` ochre, `--color-sell/wait/hold`.
- Accessibility baked in: `min-height: 44px` on `button/select/input/a` globally; `*:focus-visible` outline; `role`/`aria-label` on chart and control groups.
- Locale state: `useAppLocale()` from `src/i18n/LocaleProvider`; persisted under `localStorage["agrilink.locale"]`; `document.documentElement.lang` kept in sync.

## Naming
- API JSON is snake_case (`modal_price`, `arrival_volume`); TS types mirror it exactly (no camelCase remap).
- Crops/markets are passed as human strings (e.g. `crop=Tomato&market=Pune`), matched exactly against `PriceCache`.

## Git
- Repo initialized 2026-09-01 on `main`. Remote: `https://github.com/umangjzx/Sih-26132.git`.
- GSD `.planning/` commits are expected (config `planning.commit_docs = true`).
