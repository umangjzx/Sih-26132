# Stack

**Analysis Date:** 2026-09-01

## Frontend
- **Next.js 16.3.3** (App Router, Turbopack), **React 19.2.8**, **TypeScript 5**
- **next-intl 4.14.1** for i18n (used client-side, no locale routing)
- **recharts 3.10.1** for charts
- **Tailwind CSS v4** via `@tailwindcss/postcss`; theme tokens in `src/app/globals.css`
- Fonts: `next/font/google` — `Noto_Sans` (Latin) + `Noto_Sans_Devanagari`
- Dev server: `next dev` on :3000. Run directly as `node node_modules/next/dist/bin/next dev -p 3000` (the `npm run dev` wrapper exits code 1 when backgrounded in this shell / non-TTY).

## Backend
- **FastAPI 0.115.6**, **uvicorn[standard] 0.34.0**
- **SQLAlchemy 2.0.36** (declarative `Mapped[...]` style), **psycopg2-binary 2.9.10**
- **pydantic 2.10.4** + **pydantic-settings 2.7.0** (`Settings` reads `.env`)
- **httpx 0.28.1** for the data.gov.in client
- **APScheduler 3.11.0** — `BackgroundScheduler`, 6-hour interval ingestion job
- Python **3.13**, venv at `backend/venv` (all deps installed)
- Run: `backend/venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`

## Database
- **PostgreSQL 16** via `docker-compose.yml` (service `db`)
- Host port **5433** → container 5432 (native PG18 on this machine holds 5432)
- Credentials: `agrilink` / `agrilink`, db `agrilink`
- Schema created at startup by `Base.metadata.create_all` — **no Alembic**

## Tooling / gaps
- ESLint 9 + `eslint-config-next` on the frontend; no linter/formatter configured for the backend
- **No test framework** on either side yet
- GSD Core v1.12.0 installed under `.claude/` (commands, agents, hooks, `gsd-core/bin/gsd-tools.cjs`)
