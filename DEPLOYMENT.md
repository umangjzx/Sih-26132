# Deploying AgriLink

A single-VM deployment with Docker Compose. One reverse proxy (Caddy) puts the
whole app on **one origin**: the browser loads the UI at `/` and calls the API
at `/api/...` on the same host, so there is no CORS to configure and TLS is
automatic when you point a domain at the box.

```
                         ┌──────────── VM ────────────┐
   browser ──HTTPS──▶  caddy  ─┬─▶ frontend (Next.js :3000)   /
                               └─▶ backend  (FastAPI :8000)   /api/*, /health, /docs
                                        │
                                   postgres :5432  (internal only)
```

Everything is offline-safe: with no external API keys the app still runs on a
committed price snapshot / synthetic fixtures, and every outbound call degrades
to a neutral result.

---

## 1 · Provision a VM

| | Minimum | Comfortable |
|---|---|---|
| vCPU | 1 | 2 |
| RAM | 2 GB | 4 GB |
| Disk | 15 GB | 25 GB |
| OS | Ubuntu 22.04 / 24.04 LTS (Debian works too) | |

Any of: Oracle Cloud Always-Free (`VM.Standard.A1.Flex`, 4 OCPU / 24 GB is free),
AWS Lightsail / EC2 `t3.small`, DigitalOcean / Hetzner / Linode 2 GB droplet, or
a college/hackathon server.

**Open ports** in the cloud firewall / security group: `22` (SSH), `80`, `443`.

**(Optional) domain** — add a DNS `A` record for e.g. `agrilink.example.com`
pointing at the VM's public IP. With a domain, Caddy fetches a Let's Encrypt
certificate on first boot. Without one, the app is reachable at
`http://<VM-IP>/` over plain HTTP (fine for a demo).

---

## 2 · Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && newgrp docker   # run docker without sudo
docker compose version                             # expect v2.x
```

---

## 3 · Get the code

```bash
git clone https://github.com/umangjzx/Sih-26132.git agrilink
cd agrilink
```

---

## 4 · Create the `.env` file

Compose reads a file named `.env` **next to `docker-compose.prod.yml`** for the
`${VAR}` substitutions. Create it:

```bash
cat > .env <<'EOF'
# ---- required ----
JWT_SECRET_KEY=CHANGE_ME
POSTGRES_PASSWORD=CHANGE_ME_TOO

# ---- reverse proxy ----
# A hostname => automatic HTTPS. Use ":80" for an IP-only box (plain HTTP).
SITE_ADDRESS=agrilink.example.com
# Public origin of the app, used for the backend CORS allow-list.
# Must match SITE_ADDRESS: https://agrilink.example.com  OR  http://<VM-IP>
SITE_URL=https://agrilink.example.com

# ---- optional external data (blank = offline fallback / feature hidden) ----
DATA_GOV_IN_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
WEATHER_API_KEY=
INGEST_TRIGGER_SECRET=
INGEST_STATES=ALL
EOF
```

Generate the two secrets:

```bash
sed -i "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$(openssl rand -hex 32)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
```

### Variable reference

| Variable | Required | Notes |
|---|:--:|---|
| `JWT_SECRET_KEY` | ✅ | Long random string. Blank ⇒ every login fails (`openssl rand -hex 32`). |
| `POSTGRES_PASSWORD` | ✅ | DB password. The container is not published to the host, but still don't ship the default. |
| `SITE_ADDRESS` | ✅ | `agrilink.example.com` for auto-HTTPS, or `:80` for HTTP on the IP. |
| `SITE_URL` | ✅ | Full public origin (`https://…` or `http://<IP>`). Becomes `CORS_ORIGINS`. |
| `INGEST_STATES` | | `ALL` (whole national AGMARKNET feed) or a comma list (`Maharashtra,Tamil Nadu`). |
| `DATA_GOV_IN_API_KEY` | | Enables live price ingestion. Blank ⇒ committed snapshot → synthetic fixtures. |
| `OPENROUTER_API_KEY` | | Enables the plain-language advisor, the Decision-Brief summary phrasing, Ask AgriLink, and mandi-slip OCR. Blank ⇒ rule output / grounded reference text / English. |
| `OPENROUTER_MODEL` | | Any vision-capable OpenRouter model. Default `openai/gpt-4o-mini`. |
| `WEATHER_API_KEY` | | OpenWeatherMap key — adds current conditions to the forecast. Blank ⇒ keyless Open-Meteo only. |
| `INGEST_TRIGGER_SECRET` | | Blank ⇒ `POST /api/ingest/run` is disabled (403). Set it, then send it as `X-Ingest-Secret`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | | Defaults 30 / 7. |

---

## 5 · Bring the stack up

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run: images build (~2–4 min), Postgres starts, then the backend runs
`alembic upgrade head` automatically on boot and begins serving. Watch it:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
# look for:  INFO  Application startup complete.
```

Check health:

```bash
curl -sf http://localhost:8000/health          # {"status":"ok"}  (from the VM)
curl -sf https://agrilink.example.com/health    # via Caddy, once DNS + TLS are up
```

---

## 6 · Seed demo accounts (once)

So judges can log in immediately. Idempotent — safe to re-run.

```bash
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

| Phone | Password | Role | Where |
|---|---|---|---|
| `+919000000001` | `farmer123` | farmer | Pune, Maharashtra |
| `+919000000003` | `buyer123` | buyer | Pune, Maharashtra |
| `+919000000009` | `admin123` | admin | — |
| `+919000000011` | `farmer123` | farmer | Coimbatore, Tamil Nadu (verified) |
| `+919000000013` | `buyer123` | buyer | Coimbatore, Tamil Nadu (verified) |

(Full list and the trade data they carry are in `backend/scripts/seed_demo_users.py`.)

> **These credentials are public in the repo.** For anything beyond a throwaway
> demo, seed your own accounts instead and skip this step.

---

## 7 · Verify

Open `https://agrilink.example.com` (or `http://<VM-IP>`):

- `/` loads, prices show, the sell/wait gauge renders
- `/advisor` shows the Decision Brief
- Sign in with a demo account → `/farmer` or `/buyer` loads
- `/docs` serves the interactive API reference

---

## Operations

**Logs**
```bash
docker compose -f docker-compose.prod.yml logs -f            # all
docker compose -f docker-compose.prod.yml logs -f backend    # one service
```

**Restart / stop**
```bash
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml down               # stop (keeps the DB volume)
```

**Update to the latest code**
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
# new migrations run automatically on backend startup
```

**Back up the database**
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U agrilink agrilink | gzip > backup-$(date +%F).sql.gz
```

**Restore**
```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U agrilink -d agrilink
```

**Wipe and start fresh**
```bash
docker compose -f docker-compose.prod.yml down -v            # -v also drops the DB volume
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

---

## Gotchas (read before you debug)

- **Single backend worker on purpose.** The price-ingestion and alert-evaluation
  jobs run in-process via APScheduler. Don't add `--workers N` or scale the
  `backend` service past 1 replica — every scheduled job would run N times.
- **The DB must be reachable when the backend boots.** The startup routine runs
  `alembic upgrade head`; if Postgres isn't up yet it raises and the container
  exits (Compose then restarts it — it recovers, but you'll see one failed
  start). The `depends_on: condition: service_healthy` in the compose file
  handles the normal case.
- **`NEXT_PUBLIC_API_URL` is baked at build time.** It's empty here so the
  browser calls the API same-origin through Caddy. If you ever serve the API on
  a *different* host, set the build arg and rebuild the `frontend` image — a
  runtime env var won't take effect.
- **`next build` fetches Google Fonts.** The image build needs outbound network.
  Behind a strict proxy, pre-vendor the fonts or build the image elsewhere.
- **Live price ingestion needs a real User-Agent and a key.** `DATA_GOV_IN_API_KEY`
  blank ⇒ the app is fully functional on the committed snapshot + fixtures; the
  demo is unaffected.
- **First HTTPS request can take a few seconds** while Caddy provisions the
  certificate. If it never succeeds: DNS isn't pointing at the box yet, or ports
  80/443 are closed in the cloud firewall.

---

## Security checklist for a public demo

- [ ] `JWT_SECRET_KEY` and `POSTGRES_PASSWORD` set to random values (not the defaults)
- [ ] DB port **not** published to the host (it isn't, in `docker-compose.prod.yml`)
- [ ] `INGEST_TRIGGER_SECRET` set if `DATA_GOV_IN_API_KEY` is set (otherwise the manual re-ingest endpoint stays disabled anyway)
- [ ] Demo accounts seeded only if you accept that those passwords are public; otherwise seed your own
- [ ] `gee_service_account.json` / any `*service_account*.json` stays out of the repo and images (it's `.gitignore`d and `.dockerignore`d)
- [ ] SSH key-only login on the VM; firewall limited to 22/80/443

---

## Alternative: no domain, IP only

Set in `.env`:

```
SITE_ADDRESS=:80
SITE_URL=http://<VM-IP>
```

Then `up -d --build`. The app is served at `http://<VM-IP>/` over plain HTTP —
no certificate, no DNS. Fine for a time-boxed demo; don't collect real
credentials over it.
