# Structure

**Analysis Date:** 2026-09-01

```
agrilink/
├── docker-compose.yml          # postgres:16, host port 5433
├── .gitignore
├── backend/
│   ├── .env                    # DATABASE_URL (…:5433…), DATA_GOV_IN_API_KEY (real key), CORS_ORIGINS
│   ├── .env.example
│   ├── requirements.txt
│   ├── venv/                    # installed; gitignored
│   └── app/
│       ├── main.py             # FastAPI app, lifespan (create_all + initial ingest), APScheduler, CORS, /health
│       ├── core/
│       │   ├── config.py       # pydantic-settings Settings (env_file=.env)
│       │   └── database.py     # engine, SessionLocal, Base, get_db()
│       ├── api/
│       │   └── prices.py       # router prefix /api: /options, /prices/trend, /prices/nearby, /prices/signal, /ingest/run
│       ├── schemas/
│       │   └── price.py        # Pydantic response models
│       ├── models/
│       │   ├── price_cache.py  # PriceCache (unique market+crop+variety+date)
│       │   ├── user.py lot.py demand.py match.py offer.py deal.py dispute.py   # Pillar B/C — declared, no endpoints yet
│       │   └── __init__.py     # imports all models so create_all sees them
│       └── services/
│           ├── ingestion.py    # data.gov.in paginated fetch + normalize + upsert; fixture fallback
│           ├── fixtures.py     # generate_fixture_rows() — synthetic 90-day random walk, 5 markets × 5 crops
│           ├── signal.py       # compute_signal() — rule-based sell/wait/hold
│           └── geo.py          # DISTRICT_CENTROIDS + haversine_km + district_distance_km
└── frontend/
    ├── package.json  next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
    ├── AGENTS.md / CLAUDE.md    # Next.js-injected "read node_modules/next/dist/docs" notice
    └── src/
        ├── app/
        │   ├── layout.tsx      # fonts, LocaleProvider, header with LanguageSwitcher
        │   ├── page.tsx        # renders <PriceDashboard/>
        │   └── globals.css     # Tailwind v4 import + CSS custom-property theme tokens
        ├── components/
        │   ├── PriceDashboard.tsx      # "use client" — orchestrates fetch of options/trend/signal/nearby
        │   ├── PriceTrendChart.tsx     # recharts LineChart (modal price)
        │   ├── SellWaitSignalCard.tsx  # recommendation + reasons list
        │   ├── NearbyMarketsTable.tsx
        │   └── LanguageSwitcher.tsx
        ├── i18n/
        │   ├── config.ts       # locales ['en','hi','mr'], defaultLocale 'en', labels
        │   ├── LocaleProvider.tsx      # "use client" — context + localStorage + NextIntlClientProvider
        │   └── messages/{en,hi,mr}.json
        └── lib/
            └── api.ts          # typed fetch helpers; API_URL = NEXT_PUBLIC_API_URL ?? http://localhost:8000
```

## Entry points
- Frontend: `src/app/page.tsx` → `PriceDashboard`
- Backend: `app/main.py` → `app` (uvicorn), router in `app/api/prices.py`
- Ingestion: `app.services.ingestion.run_ingestion(db)` — from lifespan startup and the 6h scheduler job
