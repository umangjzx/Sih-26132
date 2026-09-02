"""
AgriLink Project Report — PDF generator
Produces AgriLink_Project_Report.pdf in the repo root.

Run from anywhere:
    python scripts/generate_report.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

# ── palette ────────────────────────────────────────────────────────────────
GREEN_DARK   = colors.HexColor("#1a4d2e")
GREEN_MID    = colors.HexColor("#2d6a4f")
GREEN_LIGHT  = colors.HexColor("#d8f3dc")
GREEN_ACCENT = colors.HexColor("#52b788")
AMBER        = colors.HexColor("#f4a261")
INK          = colors.HexColor("#1c2128")
INK_SOFT     = colors.HexColor("#57606a")
LINE         = colors.HexColor("#d0d7de")
PAPER        = colors.HexColor("#f6f8fa")
WHITE        = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm


# ── document ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "AgriLink_Project_Report.pdf"

doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=2.5 * cm, bottomMargin=2 * cm,
    title="AgriLink — SIH 2026 Project Report",
    author="Team SIH-26132",
    subject="Market-linkage & price-discovery platform for smallholder farmers",
)

# ── styles ──────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def _s(name, **kw) -> ParagraphStyle:
    p = ParagraphStyle(name, **kw)
    return p

COVER_TITLE = _s("CoverTitle",
    fontSize=32, leading=40, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=6)
COVER_SUB = _s("CoverSub",
    fontSize=14, leading=20, textColor=GREEN_LIGHT,
    fontName="Helvetica", alignment=TA_CENTER, spaceAfter=4)
COVER_META = _s("CoverMeta",
    fontSize=10, leading=14, textColor=GREEN_LIGHT,
    fontName="Helvetica", alignment=TA_CENTER)

H1 = _s("H1",
    fontSize=18, leading=24, textColor=GREEN_DARK,
    fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6,
    keepWithNext=1)
H2 = _s("H2",
    fontSize=13, leading=18, textColor=GREEN_MID,
    fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4,
    keepWithNext=1)
H3 = _s("H3",
    fontSize=11, leading=15, textColor=INK,
    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=3,
    keepWithNext=1)
BODY = _s("Body",
    fontSize=10, leading=15, textColor=INK,
    fontName="Helvetica", alignment=TA_JUSTIFY, spaceAfter=6)
BODY_L = _s("BodyL",
    fontSize=10, leading=15, textColor=INK,
    fontName="Helvetica", alignment=TA_LEFT, spaceAfter=4)
BULLET = _s("Bullet",
    fontSize=10, leading=14, textColor=INK,
    fontName="Helvetica", leftIndent=14, firstLineIndent=-10,
    spaceBefore=1, spaceAfter=2)
CODE = _s("Code",
    fontSize=8.5, leading=12, textColor=INK,
    fontName="Courier", backColor=PAPER,
    leftIndent=10, rightIndent=10, spaceBefore=4, spaceAfter=4)
CAPTION = _s("Caption",
    fontSize=8, leading=11, textColor=INK_SOFT,
    fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=6)
BADGE = _s("Badge",
    fontSize=9, leading=12, textColor=GREEN_DARK,
    fontName="Helvetica-Bold", alignment=TA_CENTER)
TOC_H1 = _s("TOCH1",
    fontSize=11, leading=14, textColor=INK,
    fontName="Helvetica-Bold", spaceBefore=4)
TOC_H2 = _s("TOCH2",
    fontSize=10, leading=13, textColor=INK_SOFT,
    fontName="Helvetica", leftIndent=16, spaceBefore=1)


def hr(color=LINE, thickness=0.5) -> HRFlowable:
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceAfter=4, spaceBefore=4)


def sp(h=6) -> Spacer:
    return Spacer(1, h)


def h1(text: str) -> list:
    return [sp(4), Paragraph(text, H1), hr(GREEN_ACCENT, 1.2)]


def h2(text: str) -> list:
    return [Paragraph(text, H2)]


def h3(text: str) -> list:
    return [Paragraph(text, H3)]


def p(text: str) -> Paragraph:
    return Paragraph(text, BODY)


def pl(text: str) -> Paragraph:
    return Paragraph(text, BODY_L)


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", BULLET)


def code(text: str) -> Paragraph:
    return Paragraph(text.replace(" ", "&nbsp;"), CODE)


# ── table helpers ────────────────────────────────────────────────────────────
def std_table(data, col_widths=None, header=True) -> Table:
    col_w = col_widths or [PAGE_W - 2 * MARGIN]
    t = Table(data, colWidths=col_w, repeatRows=1 if header else 0)
    style = [
        ("BACKGROUND",  (0, 0), (-1, 0),  GREEN_DARK),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  9),
        ("ALIGN",       (0, 0), (-1, 0),  "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("TOPPADDING",    (0, 0), (-1, 0), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 1), (-1, -1), 9),
        ("ALIGN",       (0, 1), (-1, -1), "LEFT"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID",        (0, 0), (-1, -1), 0.4, LINE),
        ("BOX",         (0, 0), (-1, -1), 0.8, GREEN_MID),
    ]
    if not header:
        style = [s for s in style if s[0] not in ("BACKGROUND", "TEXTCOLOR")
                 or s[1] != (0, 0)]
    t.setStyle(TableStyle(style))
    return t


def status_table(rows) -> Table:
    """Phase status table with coloured STATUS column."""
    header = [Paragraph("<b>Phase / Release</b>", BADGE),
              Paragraph("<b>Scope</b>", BADGE),
              Paragraph("<b>Status</b>", BADGE)]
    data = [header]
    for phase, scope, status in rows:
        c = GREEN_MID if "✅" in status else (AMBER if "⏳" in status else LINE)
        data.append([
            Paragraph(phase, BODY_L),
            Paragraph(scope, BODY_L),
            Paragraph(status, _s(f"st_{phase[:4]}",
                                  fontSize=9, leading=12, textColor=c,
                                  fontName="Helvetica-Bold")),
        ])
    col_w = [5.5 * cm, 9 * cm, 2.5 * cm]
    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0),  GREEN_DARK),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("GRID",         (0, 0), (-1, -1), 0.4, LINE),
        ("BOX",          (0, 0), (-1, -1), 0.8, GREEN_MID),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    return t


# ── cover page ───────────────────────────────────────────────────────────────
def cover_page(story):
    # Full-page green gradient via a background table trick
    cover_data = [[""]]
    cover_bg = Table(cover_data,
                     colWidths=[PAGE_W - 2 * MARGIN],
                     rowHeights=[PAGE_H - 4 * cm])
    cover_bg.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_DARK),
        ("BOX",        (0, 0), (-1, -1), 0, GREEN_DARK),
    ]))
    story.append(cover_bg)

    # Overlay content as a nested table
    inner = [
        [Paragraph("AgriLink", COVER_TITLE)],
        [Paragraph("SIH 2026 · Problem Statement PS-26132", COVER_SUB)],
        [sp(8)],
        [Paragraph(
            "Market-linkage &amp; price-discovery platform for<br/>"
            "smallholder farmers and FPOs",
            _s("cs2", fontSize=16, leading=22, textColor=WHITE,
               fontName="Helvetica", alignment=TA_CENTER))],
        [sp(16)],
        [Paragraph("Govt. of Maharashtra / MSInS", COVER_META)],
        [Paragraph("Maharashtra-first · Location-aware across India", COVER_META)],
        [sp(8)],
        [hr(GREEN_ACCENT, 1.5)],
        [sp(8)],
        [Paragraph("v1.6 · September 2026", COVER_META)],
        [Paragraph("Phases 1–3 complete + v1.1 – v1.6", COVER_META)],
        [sp(16)],
        [Paragraph(
            "Stack: Python 3.13 · FastAPI · PostgreSQL 16 · Next.js 16 · React 19",
            COVER_META)],
    ]
    ct = Table(inner, colWidths=[PAGE_W - 2 * MARGIN])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_DARK),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    story.clear()  # replace the placeholder
    story.append(ct)
    story.append(PageBreak())


# ── build story ──────────────────────────────────────────────────────────────
def build() -> list:
    story = []

    # ── COVER ────────────────────────────────────────────────────────────────
    cover_inner = [
        [Paragraph("AgriLink", COVER_TITLE)],
        [sp(4)],
        [Paragraph("SIH 2026 · Problem Statement PS-26132", COVER_SUB)],
        [sp(6)],
        [Paragraph(
            "Market-linkage &amp; price-discovery platform for<br/>"
            "smallholder farmers and FPOs",
            _s("cs2", fontSize=15, leading=21, textColor=WHITE,
               fontName="Helvetica", alignment=TA_CENTER))],
        [sp(20)],
        [Paragraph("Govt. of Maharashtra / MSInS", COVER_META)],
        [Paragraph("Maharashtra-first · Location-aware across India", COVER_META)],
        [sp(10)],
        [hr(GREEN_ACCENT, 1.5)],
        [sp(10)],
        [Paragraph("v1.6 · September 2026", COVER_META)],
        [Paragraph("Phases 1–3 complete + v1.1 – v1.6", COVER_META)],
        [sp(20)],
        [Paragraph(
            "Python 3.13 · FastAPI 0.115 · PostgreSQL 16 · "
            "Next.js 16.3 · React 19 · Docker Compose + Caddy",
            _s("cstack", fontSize=9, leading=13, textColor=GREEN_LIGHT,
               fontName="Courier", alignment=TA_CENTER))],
        [sp(6)],
        [Paragraph(
            "Team SIH-26132",
            _s("cteam", fontSize=11, leading=16, textColor=GREEN_ACCENT,
               fontName="Helvetica-Bold", alignment=TA_CENTER))],
    ]
    cover_t = Table(cover_inner,
                    colWidths=[PAGE_W - 2 * MARGIN],
                    rowHeights=None)
    cover_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GREEN_DARK),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BOX",           (0, 0), (-1, -1), 3, GREEN_ACCENT),
    ]))
    story.append(cover_t)
    story.append(PageBreak())

    # ── 1. EXECUTIVE SUMMARY ─────────────────────────────────────────────────
    story += h1("1. Executive Summary")
    story.append(p(
        "AgriLink is a full-stack web platform (Maharashtra-first, India-wide location support) "
        "built for SIH 2026 Problem Statement PS-26132 (Govt. of Maharashtra / MSInS). "
        "It aggregates official AGMARKNET mandi prices from data.gov.in and turns them into "
        "decisions a smallholder farmer can act on — in English, Hindi, or Marathi — without "
        "requiring internet connectivity for core functionality."
    ))
    story.append(p(
        "The platform covers the full agricultural trade lifecycle: price transparency and "
        "trend analysis, an explainable sell/wait/hold recommendation, weather and MSP overlays, "
        "a transport-adjusted best-market finder, cold-storage and FPO discovery, phone-based "
        "accounts, scored farmer–buyer matching, an offer negotiation thread, a deal pipeline, "
        "logistics planning, disputes, and an admin dashboard. "
        "v1.3–v1.4 added FPO-style pooled lots for collective bargaining, a discovery board for "
        "browsing nearby trade opportunities, an interpretable price forecast, user verification, "
        "structured deal logistics, instalment payments with an append-only audit ledger, a "
        "transporter directory, a plain-language LLM advisor and chat assistant, and mandi-slip OCR."
    ))
    story.append(p(
        "v1.5 fused every signal into one orchestrated <b>Decision Brief</b> (a ranked action "
        "plan), replaced the flat transport constant with a <b>diesel-indexed, explainable "
        "freight rate</b>, and gave the assistant a <b>grounded knowledge base</b> (offline "
        "keyword + fuzzy retrieval over curated policy notes). v1.6 focused on market linkage: "
        "a <b>price-realisation tracker</b> (did an AgriLink deal beat the mandi?), "
        "<b>price-referenced counter-offers</b>, and <b>forward contracts</b> — a buyer's "
        "pre-harvest bid that a farmer commits to at a locked price, which materialises straight "
        "into the deal pipeline on acceptance. The whole stack ships as a one-command Docker "
        "Compose deployment behind a single-origin Caddy reverse proxy."
    ))

    # ── 2. RELEASE STATUS ────────────────────────────────────────────────────
    story += h1("2. Release Status")
    story.append(sp(4))
    story.append(status_table([
        ("1 · Price Discovery & i18n", "Prices, trends, nearby markets, sell/wait signal, en/hi/mr", "✅ Complete"),
        ("2 · Auth & Matching",        "Phone login, lots, demands, scored matches, offers",          "✅ Complete"),
        ("3 · Deal Tracking & Admin",  "Deal pipeline, disputes, admin dashboard",                    "✅ Complete"),
        ("v1.1 · Intelligence",        "Weather, MSP, calendar, best-market, storage/FPO, alerts",    "✅ Complete"),
        ("v1.2 · Location",            "Geo/place picker, state-scoped prices, all-India directory",  "✅ Complete"),
        ("v1.3 · LLM, OCR & Pools",   "Plain-language advisor, Ask AgriLink, OCR, pooled lots",      "✅ Complete"),
        ("v1.4 · Identity & Logistics","Discovery board, profiles, verification, logistics, forecast","✅ Complete"),
        ("v1.4 · Payments & Audit",    "Instalment payments, transporter directory, append-only transaction ledger, structured grading", "✅ Complete"),
        ("v1.5 · Intelligence Orch.", "Diesel-indexed freight, Decision Brief (/api/brief), grounded knowledge retrieval (RAG)", "✅ Complete"),
        ("v1.6 · Market Linkage",     "Price-realisation tracker, price-referenced counter-offers, forward contracts (pre-harvest)", "✅ Complete"),
        ("Deployment",                "Docker Compose stack + Caddy one-origin reverse proxy, DEPLOYMENT.md", "✅ Complete"),
        ("Phase 4 · Cordova Android",  "Mobile APK wrap (every route is already a client component)", "⏳ Planned"),
    ]))
    story.append(sp(6))

    # ── 3. PROBLEM & SOLUTION ────────────────────────────────────────────────
    story += h1("3. Problem Statement & Solution")
    story += h2("3.1 Problem")
    story.append(p(
        "Smallholder farmers in Maharashtra lack real-time access to wholesale mandi prices, "
        "sell at suboptimal times due to information asymmetry, and have no direct channel to "
        "large institutional buyers. FPOs struggle to aggregate produce for collective "
        "bargaining. Cold storage and government procurement (MSP) points are poorly "
        "discoverable."
    ))
    story += h2("3.2 Solution")
    for item in [
        "<b>Price transparency</b> — live AGMARKNET data, 7/30/90-day trends, nearest-market comparison, transport-adjusted best-market ranking.",
        "<b>Explainable recommendation</b> — a rule-based sell/wait/hold signal whose every factor (price momentum, weather, MSP gap, crop calendar) is shown on screen. An optional LLM layer rephrases it in plain language.",
        "<b>Interpretable price forecast</b> — a trend + weekly-seasonality model (no ML library) that projects prices 30 days forward with a visible prediction band.",
        "<b>Direct trade</b> — scored farmer–buyer matching, offer threads, and a structured deal pipeline with logistics planning.",
        "<b>FPO collective bargaining</b> — pooled lots aggregate multiple farmers into a single negotiating unit scored against real buyer demands.",
        "<b>Discovery board</b> — buyers browse nearby open lots; farmers browse open demands. Radius filter, verified-seller badge, one-tap express interest.",
        "<b>Identity & trust</b> — user profile with GPS-linked trading location, admin-driven verification workflow (unverified → pending → verified), verified badge on all listings, and an append-only transaction ledger behind every deal.",
        "<b>Decision Brief</b> — one endpoint fuses the sell/wait signal, forecast, diesel-costed best market, MSP gap, weather, crop calendar, mandi holidays and nearby verified buyers into a single list of actions ranked by urgency.",
        "<b>Diesel-indexed freight</b> — the transport cost that feeds the best-market ranking and deal logistics is computed from a per-state diesel reference, not a flat constant, and its working is shown.",
        "<b>Grounded assistant</b> — Ask AgriLink answers how-it-works / policy questions (MSP procurement, eNAM, FPOs, warehouse receipts, schemes) from a curated corpus with offline keyword + fuzzy retrieval; it cites its sources.",
        "<b>Price realisation</b> — after each deal a farmer sees the price they got versus the AGMARKNET mandi average and MSP, with a volume-weighted uplift figure.",
        "<b>Forward contracts</b> — a buyer posts a pre-harvest bid; a farmer commits part of a growing crop at a locked price; on acceptance it becomes a normal deal, so pre-harvest price certainty runs through the same pipeline.",
        "<b>Offline-safe</b> — every external call has a fallback; the app runs fully air-gapped on fixture data.",
        "<b>Accessible</b> — English, Hindi, and Marathi with full i18n parity enforcement; Noto Sans Devanagari for correct rendering.",
        "<b>Deployable in one command</b> — `docker compose -f docker-compose.prod.yml up -d --build` brings up Postgres + backend + frontend + a Caddy reverse proxy that serves the whole app on one origin with automatic HTTPS.",
    ]:
        story.append(bullet(item))
    story.append(sp(4))

    # ── 4. ARCHITECTURE ──────────────────────────────────────────────────────
    story += h1("4. Architecture")
    story.append(p(
        "AgriLink is a three-tier application: a client-rendered Next.js SPA, a FastAPI "
        "REST backend, and a PostgreSQL 16 database. Every route is a "
        "<i>use client</i> component — no server-side rendering — so the frontend can be "
        "wrapped in Apache Cordova unchanged for Phase 4."
    ))

    arch_data = [
        [Paragraph("<b>Layer</b>", BADGE), Paragraph("<b>Responsibility</b>", BADGE)],
        ["Frontend (Next.js 16)", "Client-rendered SPA. Routes call REST API. LocaleProvider, AuthProvider, LocationProvider."],
        ["Backend (FastAPI)",     "18 routers, 24 services, APScheduler (6-hourly ingestion + alert eval, in-process — one Uvicorn worker)."],
        ["Database (PostgreSQL)", "19 tables, Alembic-only schema management, 11 migrations (head e5b3c8a2f1d0)."],
        ["Reverse proxy (Caddy)", "One origin: /api·/health·/docs → backend, everything else → frontend. Automatic HTTPS."],
        ["External sources",      "data.gov.in AGMARKNET, Open-Meteo, NASA POWER, OSRM, Nager.Date, OpenRouter (optional), OpenWeatherMap (optional). All wrapped with an offline fallback."],
    ]
    story.append(std_table(arch_data, col_widths=[5.5 * cm, 11.5 * cm]))
    story.append(sp(6))

    story += h2("4.1 Backend services")
    svc_data = [
        [Paragraph("<b>Service</b>", BADGE), Paragraph("<b>What it does</b>", BADGE)],
        ["ingestion",    "Live → snapshot → fixture price resolution, upsert on (market, crop, variety, date)."],
        ["signal",       "Rule-based sell/wait/hold: price momentum (×2), volume trend (×1), weather (×1), forecast (×1), MSP advisory."],
        ["forecast",     "Least-squares trend + day-of-week seasonality; 30-day projection with ~80% prediction band. No ML library."],
        ["brief",        "Decision Brief — assembles signal + forecast + best market + MSP + weather + calendar + holidays + nearby buyers into one urgency-ranked action list."],
        ["matching",     "Pure-function score_pair (quantity 0-30, price 0-40, distance 0-30). matching_health re-derives live matches on demand."],
        ["discovery",    "Radius-filtered browse_lots / browse_demands sorted by distance, with verified badge."],
        ["pools",        "Aggregate pool members into one virtual lot (qty-weighted price, floored). Rank buyer demand candidates with score_pair."],
        ["realization",  "Per closed deal, realised ₹/qtl vs the AGMARKNET mandi average and MSP; volume-weighted uplift summary."],
        ["weather",      "Open-Meteo 7-day forecast + optional OpenWeatherMap current conditions + NASA POWER rainfall anomaly."],
        ["best_market",  "Diesel-indexed net-price-after-transport ranking across nearby mandis (OSRM road distance, haversine fallback)."],
        ["freight",      "Diesel-indexed ₹/qtl/km rate = handling_base + diesel ₹/L ÷ (truck_kmpl × qtl_per_truck), from a per-state diesel reference."],
        ["geo / geocode","District + state centroids, haversine, nearest_state, forward/reverse geocoding cached in geo_cache."],
        ["locations",    "resolve_location, ensure_state_ingested (rate-limited, 1/hour/state)."],
        ["reference",    "Curated MSP (CACP 2024-25/25-26), crop calendar (MH-tuned), cold-storage/FPO directory."],
        ["knowledge",    "Ask AgriLink corpus (MSP procurement, eNAM, FPOs, grading, warehouse receipts, schemes) + TF-IDF/fuzzy retrieval. No embeddings, no network."],
        ["grading",      "Shared A/B/FAQ/C quality-grade rubric; normalize_grade maps free text to a canonical code."],
        ["holidays",     "Nager.Date mandi holidays + built-in 2026 fallback."],
        ["audit",        "log_event writes an append-only transaction_events row per action; get_deal_timeline unions deal + payment + logistics + match + offer events."],
        ["transporters", "Curated transporter directory (name, base, vehicles, service states), seeded on boot; nearest-N lookup for the logistics card."],
        ["alerts",       "Evaluate price_alerts → write notifications (20-hour debounce)."],
        ["llm",          "Thin OpenRouter client: chat (advisor summary, Decision-Brief phrasing, Ask AgriLink), vision (OCR), translate. All degrade to None."],
    ]
    story.append(std_table(svc_data, col_widths=[3.2 * cm, 13.8 * cm]))
    story.append(sp(6))

    # ── 5. TECH STACK ────────────────────────────────────────────────────────
    story += h1("5. Tech Stack")
    stack_data = [
        [Paragraph("<b>Layer</b>", BADGE), Paragraph("<b>Technology</b>", BADGE)],
        ["Backend",    "Python 3.13 · FastAPI 0.115 · SQLAlchemy 2.0 (typed Mapped[]) · Alembic 1.19 · APScheduler 3.11 · httpx 0.28 · python-jose HS256 JWT · Pydantic 2 / pydantic-settings · python-multipart"],
        ["Database",   "PostgreSQL 16 (Docker, host port 5433)"],
        ["Frontend",   "Next.js 16.3 (App Router, Turbopack) · React 19 · TypeScript · next-intl 4 · recharts 3 · Tailwind CSS v4"],
        ["LLM",        "OpenRouter API (optional), default model openai/gpt-4o-mini — any vision-capable model; used for the advisor summary, Decision-Brief phrasing, Ask AgriLink chat, OCR, live-string translation"],
        ["Deployment", "Docker + Docker Compose · Caddy 2 reverse proxy (one origin, auto-HTTPS) · Next.js standalone output image · single Uvicorn worker"],
        ["Tests",      "pytest 9 (SQLite in-memory), 37 files / 295 tests · Vitest 4 + Testing Library 16, 43 tests"],
        ["Fonts",      "Space Grotesk (headings) · DM Sans (body) · Noto Sans Devanagari (Hindi/Marathi)"],
    ]
    story.append(std_table(stack_data, col_widths=[3 * cm, 14 * cm]))
    story.append(sp(6))

    # ── 6. FEATURES ──────────────────────────────────────────────────────────
    story += h1("6. Feature Reference")

    story += h2("6.1 Public routes (no login)")
    pub_data = [
        [Paragraph("<b>Route</b>", BADGE), Paragraph("<b>Feature</b>", BADGE)],
        ["/",          "Hero, crop/market picker, latest modal price, sell/wait gauge, statewide price snapshot."],
        ["/prices",    "7/30/90-day trend chart with dashed 30-day forecast line and prediction band; min/modal/max; nearest-market bar comparison; diesel-costed best-market panel with the freight working."],
        ["/advisor",   "Decision Brief (one urgency-ranked action plan) + the full sell/wait/hold reasoning: price momentum, weather, MSP gap, crop calendar, next holiday. Optional LLM plain-language summary (en/hi/mr)."],
        ["Ask AgriLink", "Floating LLM chat (optional). Answers from live crop/market data AND a curated retrieval-backed knowledge base (MSP procurement, eNAM, FPOs, grading, schemes); cites source chips. Without a key it still returns the grounded reference text."],
        ["/directory", "Cold storage / FPO facilities near a district or state, with distance and capacity."],
        ["/explore",   "Price transparency: top gainers/fallers (7-day), 30-day avg trend, all-crops table, activity counters. State-scoped."],
        ["/alerts",    "Create price alert rules (crop × market × direction × threshold). In-app notification bell polls unread count."],
    ]
    story.append(std_table(pub_data, col_widths=[2.8 * cm, 14.2 * cm]))
    story.append(sp(6))

    story += h2("6.2 Authenticated routes")
    auth_data = [
        [Paragraph("<b>Route</b>", BADGE), Paragraph("<b>Role</b>", BADGE), Paragraph("<b>Feature</b>", BADGE)],
        ["/login",       "any",         "Sign in (phone + password) or create account (phone + name + role + district + state). Returns JWT pair."],
        ["/farmer",      "farmer",      "List produce lots. OCR assist: photograph a mandi slip to auto-fill the form. Offline-safe draft queue."],
        ["/buyer",       "buyer",       "Post demands with crop, quantity, price band, delivery window, and delivery district."],
        ["/matches/[id]","farmer/buyer","Scored lot×demand breakdown; offer thread (propose, counter, accept, decline). A 'Counter' action pre-fills from the other side's offer next to a price-references strip (mandi modal, MSP, band, spread, one-tap midpoint). Accept → creates deal."],
        ["/browse",      "farmer/buyer","Discovery board. Buyers browse nearby lots; farmers browse nearby demands. Radius filter, verified badge, one-tap express interest."],
        ["/pools",       "farmer",      "List/create FPO-style pooled lots. Filterable by crop, status, mine."],
        ["/pools/[id]",  "farmer",      "Pool detail: aggregate stats (fill %, effective price), member list, demand candidates (organizer)."],
        ["/forward",     "farmer/buyer","Forward contracts. Buyers post pre-harvest bids (crop, quantity, price band, delivery window) and review/accept farmer commitments with a fill bar; farmers browse open bids (distance, harvest window) and commit inline at a locked price. A crop-calendar check flags an off-season ready date."],
        ["/profile",     "any",         "Set trading location (GPS / header chip / manual). Request admin verification with optional PM-Kisan / Aadhaar reference."],
        ["/history",     "farmer/buyer","All lots, demands, and deals. Farmers also get a price-realisation scorecard: realised ₹/qtl vs the mandi average and MSP per completed deal, with a volume-weighted uplift headline and a per-deal bar chart."],
        ["/deals/[id]",  "farmer/buyer/admin","Advance the pipeline; view/update the logistics plan (transporter from the directory, diesel-indexed cost); record instalment payments; see the append-only transaction timeline; open a printable receipt; raise/view disputes."],
        ["/admin",       "admin",       "Dashboard (price trend, per-crop district gaps, anomalies), analytics (GMV, funnel, pipeline, deal-success rate, payment split, avg hours to deal, price-vs-MSP per crop, supply/demand), an activity ledger (transaction_events + CSV export), user management (verify, activate)."],
    ]
    story.append(std_table(auth_data, col_widths=[2.7 * cm, 2.7 * cm, 11.6 * cm]))
    story.append(sp(6))

    # ── 7. KEY SUBSYSTEMS ────────────────────────────────────────────────────
    story += h1("7. Key Subsystems")

    story += h2("7.1 Sell / Wait / Hold Signal")
    signal_data = [
        [Paragraph("<b>Factor</b>", BADGE), Paragraph("<b>Weight</b>", BADGE), Paragraph("<b>Logic</b>", BADGE)],
        ["Price momentum", "×2", "+1 if modal ≥ 5% above 30-day avg and 7-day avg not lagging; −1 if ≥ 5% below; 0 otherwise."],
        ["Arrival volume",  "×1", "+1 if this week's arrivals ≥ 15% above last week's (glut); −1 if ≥ 15% below. Skipped when feed has no volume (live data)."],
        ["Weather pressure","×1", "+1 when ≥ 20 mm rain expected in 3 days or ≥ 3 wet days in 5 (move produce now). 0 if source unavailable."],
        ["MSP overlay",    "advisory", "If modal < MSP: flags that a govt. procurement centre may pay more. Not scored."],
    ]
    story.append(std_table(signal_data, col_widths=[3.5 * cm, 2.5 * cm, 11 * cm]))
    story.append(p("Decision: total = 2×price + volume + weather. total ≥ 2 → sell_now; total ≤ −2 → wait; otherwise hold."))

    story += h2("7.2 Interpretable Price Forecast (v1.4)")
    story.append(p(
        "app/services/forecast.py — no ML library. Requires ≥ 14 days of history. Method:"
    ))
    for item in [
        "Fit a <b>least-squares straight-line trend</b> to the most recent 45 days.",
        "Learn the <b>day-of-week offset</b> from de-trended residuals (centred, capturing weekly market rhythms).",
        "Project both forward with an <b>~80% prediction band</b> (based on residual σ, widens with horizon).",
        "Never project below 40% of the last known price (implausibility guard).",
        "Returns <i>trend_per_day</i>, <i>weekly_pattern</i>, <i>change_pct_7d</i>, <i>change_pct_30d</i>, <i>note</i>, and per-day <i>{yhat, lo, hi}</i> points.",
        "Frontend renders the forecast as a <b>dashed line with a shaded prediction band</b> overlaid on the trend chart.",
    ]:
        story.append(bullet(item))
    story.append(sp(4))

    story += h2("7.3 Match Scoring")
    match_data = [
        [Paragraph("<b>Component</b>", BADGE), Paragraph("<b>Max</b>", BADGE), Paragraph("<b>Formula</b>", BADGE)],
        ["Quantity fit",  "30", "min(lot, demand) / max(lot, demand) × 30"],
        ["Price overlap", "40", "40 if lot price inside demand band; partial credit max(0, 1 − gap/band_width) × 40; 0 if no overlap."],
        ["Distance",      "30", "≤ 50 km → 30 · ≤ 150 km → 20 · ≤ 300 km → 10 · > 300 km → 0 · unknown → 15 (neutral)"],
    ]
    story.append(std_table(match_data, col_widths=[3.5 * cm, 2 * cm, 11.5 * cm]))
    story.append(p("score_pair is a pure function (no ORM), fully unit-tested. Matches scoring ≥ 30 are upserted. score_detail JSON is shown as a breakdown on the match page."))

    story += h2("7.4 FPO Pools — Collective Bargaining (v1.3)")
    story.append(p(
        "A farmer creates a Pool for one crop with a target quantity and a floor price. "
        "Other farmers join by committing quantity + asking price. "
        "The pool aggregates: total_qty = Σ committed_qty; effective_price = max(qty-weighted mean, floor_price). "
        "The organizer sees ranked buyer demand candidates scored by the same score_pair function. "
        "Pool statuses: open → locked → matched → closed."
    ))

    story += h2("7.5 Discovery Board (v1.4)")
    story.append(p(
        "app/services/discovery.py — radius-filtered browse. "
        "Buyers see open lots sorted by distance from their profile location (GPS coords, district centroid fallback). "
        "Farmers see open demands the same way. "
        "One-tap 'Express interest' runs score_pair and either opens a match or explains the gap. "
        "Verified badge shown when verification_status == 'verified'."
    ))

    story += h2("7.6 User Verification (v1.4)")
    story.append(p(
        "Every user can set their trading location (GPS, header chip, or manual) via PATCH /api/auth/me. "
        "Verification workflow: user submits a reference (PM-Kisan ID / Aadhaar) → status = pending → "
        "admin reviews at GET /api/admin/users → PATCH /api/admin/users/{id}/verify → "
        "status = verified, verified_at/verified_by set, legacy kyc_status badge synced. "
        "Verified users display a ✓ badge on lots, demands, pools, and the discovery board."
    ))

    story += h2("7.7 Deal Logistics (v1.4)")
    story.append(p(
        "One DealLogistics row per deal. Either party fills in: mode (self_pickup / hired_transport / buyer_arranged), "
        "transporter contact, vehicle type, pickup/drop points, pickup date, distance and estimated cost "
        "(auto-derived from OSRM routing between lot and demand locations). "
        "Status tracked independently of the deal pipeline: planned → in_transit → delivered."
    ))

    story += h2("7.8 LLM Readability Layer (v1.3)")
    story.append(p(
        "app/services/llm.py — thin OpenRouter client. Three capabilities, all optional:"
    ))
    llm_data = [
        [Paragraph("<b>Feature</b>", BADGE), Paragraph("<b>Endpoint</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["Plain-language advisor", "GET /api/advisor/summary",  "2-3 sentences restating sell/wait reasoning in en/hi/mr. Cached 6 h."],
        ["Ask AgriLink chat",      "POST /api/assistant/ask",   "Grounded Q&A. Context = live price/signal/weather/MSP/calendar. Never invents numbers."],
        ["Mandi-slip OCR",         "POST /api/ocr/lot-slip",    "Vision call. Returns draft {crop, qty, grade, price, date}. Farmer reviews before posting."],
        ["Live-string translation","llm.translate()",           "Translates short UI strings (weather conditions) to hi/mr server-side."],
    ]
    story.append(std_table(llm_data, col_widths=[4 * cm, 5 * cm, 8 * cm]))
    story.append(p("All LLM calls degrade to {'available': false} / original text when OPENROUTER_API_KEY is absent."))
    story.append(sp(6))

    story += h2("7.9 Decision Brief (v1.5)")
    story.append(p(
        "app/services/brief.py + GET /api/brief — one endpoint that assembles every signal the "
        "platform computes in isolation into a single prioritised action list. It fuses the "
        "sell/wait signal, the price forecast, the diesel-costed best market, the MSP gap, the "
        "3-day weather outlook, the crop-calendar phase, the next mandi holiday, and open demands "
        "from verified buyers within radius. Each action carries {rank, kind, urgency, title, "
        "detail} where urgency is now / soon / watch; the list is sorted by urgency. A headline "
        "gives the recommendation, a weighted score, and a confidence band. Strictly rule-based — "
        "the LLM (when configured) only phrases the two-line summary; a deterministic sentence is "
        "used otherwise. Rendered by DecisionBrief.tsx at the top of /advisor."
    ))

    story += h2("7.10 Diesel-Indexed Freight (v1.5)")
    story.append(p(
        "app/services/freight.py replaces the flat TRANSPORT_COST_PER_QTL_KM constant with an "
        "explainable figure: rate ₹/qtl/km = handling_base (0.15) + diesel ₹/L ÷ (truck_kmpl 4.0 "
        "× quintals_per_truck 90). The diesel price is a curated per-state reference (retail "
        "rack, indicative — state VAT makes it vary ~87–98 ₹/L); everything else is a fixed "
        "9-tonne-truck assumption. The number lands near the old 0.40, so it refines rather than "
        "disrupts the best-market ranking and the deal-logistics cost. GET /api/markets/best "
        "returns a freight block with the working; GET /api/logistics/freight-rate gives the "
        "rate + total for a state or a district pair."
    ))

    story += h2("7.11 Price-Referenced Counter-Offers (v1.6)")
    story.append(p(
        "GET /api/matches/{id}/negotiation returns each side's last offer, the current spread "
        "(₹/qtl apart), a suggested midpoint, and a references block: the lot's expected price, "
        "the demand's asking band, the latest mandi modal for the crop (district → state → "
        "all-India fallback), and the MSP. On /matches/[id] a 'Counter' button on the other "
        "party's pending offer pre-fills the form from that offer; a price-references strip shows "
        "the numbers and offers a one-tap 'use midpoint'. Every offer and counter is written to "
        "the transaction_events ledger."
    ))

    story += h2("7.12 Payments & Audit Ledger (v1.4)")
    story.append(p(
        "The buyer records instalment payments against a deal (POST /api/deals/{id}/payments); "
        "when they cover agreed_price × agreed_quantity, payment_status flips to paid and the "
        "pipeline can advance (a payment_reference is required to reach 'paid'). "
        "transaction_events is append-only — log_event() writes, never updates, a row for every "
        "meaningful action across deals, payments, logistics, matches, offers, pools and forward "
        "bids. get_deal_timeline() unions them into one ordered timeline shown on /deals/[id] and "
        "exported by admins (GET /api/admin/events + events.csv). GET /api/deals/{id}/receipt "
        "renders a printable receipt with the confirmed payment reference; every user field is "
        "HTML-escaped."
    ))

    story += h2("7.13 Price-Realisation Tracker (v1.6)")
    story.append(p(
        "app/services/realization.py + GET /api/history/realization. For every deal a farmer "
        "struck, it compares the locked ₹/qtl against two benchmarks around the deal date: the "
        "AGMARKNET mandi modal for that crop (same state where known, widening the date window "
        "before dropping the state filter) and the crop's MSP. It returns per-deal rows plus a "
        "volume-weighted summary — uplift_vs_mandi_pct, below_msp_deals, best deal. Pure "
        "derivation from closed deals + price_cache + the MSP table; no new model. "
        "PriceRealizationCard.tsx on /history (farmers) shows the headline uplift, a per-deal "
        "realised-vs-mandi-vs-MSP bar chart, and a table."
    ))

    story += h2("7.14 Forward Contracts (v1.6)")
    story.append(p(
        "app/models/forward.py + app/api/forward.py + /forward. A buyer posts a ForwardBid "
        "(crop, total quantity, price band, future delivery window). A farmer growing that crop "
        "posts a ForwardCommitment against it — quantity, a price within the band, and an "
        "expected_ready date. Guards: one active commitment per farmer per bid; accepted total "
        "can't exceed the bid quantity; a crop-calendar check returns a calendar_warning when "
        "the ready date is outside the crop's harvest months or the delivery window. When the "
        "buyer accepts, the commitment materialises into the normal deal pipeline — a Lot, a "
        "Demand, an accepted Match + Offer, and a Deal at pipeline_status = matched — so "
        "logistics, payments, disputes and the audit ledger all work unchanged. A forward deal "
        "legitimately sits at 'matched' until harvest. The bid auto-flips to 'filled' when covered."
    ))

    story += h2("7.15 Grounded Knowledge Retrieval — RAG (v1.5)")
    story.append(p(
        "app/services/knowledge.py — a curated, offline corpus so Ask AgriLink can answer "
        "how-it-works and policy questions from real text. ~13 hand-written notes (MSP "
        "procurement, APMC/eNAM, FPOs, grading/FAQ, warehouse receipts & pledge finance, direct "
        "selling, PMFBY, PM-KISAN, how the signal and freight are computed) plus documents "
        "generated from the MSP table, crop calendar, grading rubric and mandi-holiday list. "
        "search(query, k) scores each chunk by TF-IDF token overlap + a difflib fuzzy fallback + "
        "title similarity — no embeddings, no network. POST /api/assistant/ask injects the top "
        "chunks as a REFERENCE block and returns sources[]; without a key it returns the "
        "reference text itself. GET /api/assistant/search exposes the raw retrieval with scores."
    ))
    story.append(sp(6))

    # ── 8. DATABASE SCHEMA ───────────────────────────────────────────────────
    story += h1("8. Database Schema")
    story.append(p(
        "PostgreSQL 16, managed exclusively by Alembic (no create_all). "
        "19 tables across 11 migrations (head e5b3c8a2f1d0)."
    ))
    db_data = [
        [Paragraph("<b>Table</b>", BADGE), Paragraph("<b>Key columns</b>", BADGE), Paragraph("<b>Status / enum values</b>", BADGE)],
        ["price_cache",    "crop, variety, market, district, state, date, min/max/modal_price, arrival_volume?. Unique: (market, crop, variety, date).", "—"],
        ["users",          "role, name, phone (unique), district, taluka, state, latitude?, longitude?, kyc_status, verification_status, verification_note?, verification_ref?, verified_at?, verified_by?, password_hash?, is_active, created_at.", "role: farmer|buyer|admin. verification: unverified|pending|verified|rejected"],
        ["lots",           "farmer_id→users, crop, quantity_kg, quality_grade, photo_url?, expected_price, available_from, location, latitude?, longitude?.", "status: open|matched|closed"],
        ["demands",        "buyer_id→users, crop, quantity_kg, quality_spec, price_band_min/max, delivery_window, delivery_district, latitude?, longitude?.", "status: open|matched|closed"],
        ["matches",        "lot_id→lots, demand_id→demands, score, score_detail (JSON).", "status: proposed|offered|accepted|rejected"],
        ["offers",         "match_id→matches, from_user_id→users, price, quantity, message?, created_at.", "status: pending|countered|accepted|declined"],
        ["deals",          "match_id→matches, agreed_price, agreed_quantity, logistics_mode, payment_status, payment_method?, payment_reference?, pipeline_status, created_at.", "pipeline: matched→offer_accepted→logistics_arranged→delivered→paid→closed"],
        ["deal_logistics", "deal_id→deals (unique), mode, transporter_name?, transporter_phone?, vehicle_type?, pickup_date?, pickup_point?, drop_point?, distance_km?, est_cost_inr?, pod_*, status, notes?, updated_at.", "mode: self_pickup|hired_transport|buyer_arranged. status: planned|in_transit|delivered"],
        ["deal_payments",  "deal_id→deals, amount_inr, method, reference?, paid_at, recorded_by→users.", "method: upi|bank|cash|cheque|other"],
        ["transaction_events", "entity_type, entity_id, actor_id→users?, action, detail (JSON), created_at. APPEND-ONLY.", "entity_type: deal|payment|logistics|match|offer|pool|forward_bid"],
        ["transporters",   "name, phone?, base_district, latitude?, longitude?, vehicle_types, service_states, notes?. Curated, seeded on boot.", "—"],
        ["disputes",       "deal_id→deals, raised_by→users, reason, created_at.", "status: open|closed"],
        ["pools",          "organizer_id→users, crop, title, target_quantity_kg, floor_price, grade, delivery_window, location, latitude?, longitude?, status, matched_deal_id?, created_at.", "status: open|locked|matched|closed"],
        ["pool_members",   "pool_id→pools, farmer_id→users, lot_id→lots?, quantity_kg, expected_price, status, created_at.", "status: committed|withdrawn"],
        ["forward_bids",   "buyer_id→users, crop, quantity_kg, price_min, price_max, delivery_from, delivery_to, delivery_district, latitude?, longitude?, quality_grade_min?, notes?, status, created_at.", "status: open|closed|filled|cancelled"],
        ["forward_commitments", "bid_id→forward_bids, farmer_id→users, quantity_kg, price_per_qtl, expected_ready, note?, status, deal_id→deals?, created_at.", "status: pending|accepted|declined|withdrawn"],
        ["geo_cache",      "query (unique), latitude, longitude, display_name, admin1/2/3, created_at.", "reverse-geocode key = @rev:{lat},{lon}"],
        ["price_alerts",   "user_id→users, crop, market, direction, threshold, active, last_triggered_at?.", "direction: above|below"],
        ["notifications",  "user_id→users, kind, title, body, link?, read, created_at.", "kind: price_alert|deal|dispute|digest|system"],
    ]
    story.append(std_table(db_data, col_widths=[3.2 * cm, 8.5 * cm, 5.3 * cm]))
    story.append(sp(4))

    story += h2("8.1 Migrations (in order)")
    mig_data = [
        [Paragraph("<b>Revision</b>", BADGE), Paragraph("<b>Scope</b>", BADGE)],
        ["0001_initial_schema",               "price_cache, users, lots, demands, matches, offers, deals, disputes"],
        ["94f518efb70d_auth_columns",          "users: otp_code?, otp_expires_at? (dormant), is_active, created_at"],
        ["566ce44b97a1_v1_1_weather_geo_alerts","geo_cache, price_alerts, notifications; lots.lat/lon; price_cache.state"],
        ["7c1e9a4b2d10_v1_3_pools",            "pools, pool_members"],
        ["8d2f6b3a1c40_v1_3_user_password",    "users.password_hash"],
        ["9a3f1c05e7b2_v1_4_identity",         "users.state/lat/lon/verification_*; demands.delivery_district/lat/lon; deals.payment_method/reference"],
        ["a1b7c9d3e5f0_v1_4_deal_logistics",   "deal_logistics table"],
        ["b2e4f7a8c1d0_v2_payment_audit_transporter", "deal_payments, transaction_events, transporters; deal_logistics.pod_*"],
        ["c3f8a1d6b204_v1_4_pool_deal_link",   "pools.matched_deal_id"],
        ["d4a2e9c17b30_v1_4_demand_grade_min", "demands.quality_grade_min"],
        ["e5b3c8a2f1d0_v1_6_forward_contracts","forward_bids, forward_commitments  (head)"],
    ]
    story.append(std_table(mig_data, col_widths=[6.8 * cm, 10.2 * cm]))
    story.append(sp(6))

    # ── 9. API REFERENCE ─────────────────────────────────────────────────────
    story += h1("9. API Reference")
    story.append(p("Base URL: http://localhost:8000. All paths prefixed /api. Auth = Bearer token required."))
    story.append(sp(4))

    story += h2("9.1 Prices & Forecast (public)")
    api_price = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Query</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["GET /options",         "state?",                    "Distinct crops, markets, districts, states."],
        ["GET /prices/trend",    "crop, market, days",        "Time series min/modal/max (+ volume when present)."],
        ["GET /prices/nearby",   "crop, district",            "Latest modal price at nearest markets with distance."],
        ["GET /prices/signal",   "crop, market",              "Sell/wait/hold recommendation + all reasons."],
        ["GET /prices/forecast", "crop, market, horizon?",    "Trend+seasonality forecast with prediction band. horizon default 30 days."],
        ["POST /ingest/run",     "header X-Ingest-Secret",    "Manual re-ingest. 403 unless secret is set."],
    ]
    story.append(std_table(api_price, col_widths=[4.5 * cm, 4 * cm, 8.5 * cm]))
    story.append(sp(4))

    story += h2("9.2 Intelligence — v1.1 (public)")
    api_intel = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Query</b>", BADGE)],
        ["GET /weather/forecast",  "market? | district? | lat?+lon?, include_anomaly?"],
        ["GET /msp",               "crop, market?"],
        ["GET /calendar",          "crop"],
        ["GET /storage/nearby",    "district? | lat?+lon?, state?, max_km?, limit?"],
        ["GET /fpo/nearby",        "district? | lat?+lon?, crop?, state?, limit?"],
        ["GET /markets/best",      "crop, market? | district? | lat?+lon?, state?, fast?, limit?  — response includes a diesel-indexed freight block"],
        ["GET /logistics/freight-rate", "from_state? | from_district?, to_district?, distance_km?, quantity_kg?  — diesel-indexed ₹/qtl/km + total"],
        ["GET /brief",             "crop, market? | district? | lat?+lon?, radius_km?, lang?  — the Decision Brief: urgency-ranked action list + phrased summary"],
        ["GET /grades",            "—  the standard A / B / FAQ / C quality-grade rubric"],
        ["GET /holidays/upcoming", "days? (1–120)"],
    ]
    story.append(std_table(api_intel, col_widths=[5.5 * cm, 11.5 * cm]))
    story.append(sp(4))

    story += h2("9.3 LLM & OCR — v1.3")
    api_llm = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Body / Query</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["GET /advisor/summary",  "crop, market, lang?",                  "2-3 sentence plain-language summary. {'available':false} without key."],
        ["POST /assistant/ask",   "{question, crop?, market?, lang?}",    "Grounded Q&A — live data + retrieved knowledge chunks; returns sources[]. Without a key returns reference[] text."],
        ["GET /assistant/search", "q, k? (1–10)",                        "Transparency into retrieval — which knowledge-base chunks a question matches, with scores. Works keyless."],
        ["POST /ocr/lot-slip",    "multipart file (JPEG/PNG/WebP ≤ 6 MB)","Farmer auth. Returns draft lot fields."],
    ]
    story.append(std_table(api_llm, col_widths=[4 * cm, 5.3 * cm, 7.7 * cm]))
    story.append(sp(4))

    story += h2("9.4 Auth")
    api_auth = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Body</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["POST /auth/register",               "{phone, name, role, password, district?, state?, lat?, lon?}", "409 if phone taken."],
        ["POST /auth/login",                  "{phone, password}",              "401 wrong creds, 403 inactive."],
        ["POST /auth/refresh",                "{refresh_token}",                "New token pair."],
        ["GET /auth/me",                      "—",                              "Current user."],
        ["PATCH /auth/me",                    "{name?, district?, state?, lat?, lon?}", "Update trading location / name."],
        ["POST /auth/me/request-verification","{note?, reference?}",            "Set verification_status = pending."],
    ]
    story.append(std_table(api_auth, col_widths=[5 * cm, 5.5 * cm, 6.5 * cm]))
    story.append(sp(4))

    story += h2("9.5 Discovery — v1.4 (Auth)")
    api_disc = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Query</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["GET /browse/lots",                   "crop?, lat?, lon?, radius_km?, limit?", "Open lots near caller, sorted by distance."],
        ["GET /browse/demands",                "crop?, lat?, lon?, radius_km?, limit?", "Open demands near caller."],
        ["POST /browse/lots/{id}/interest",    "—",  "Express interest → {matched, score, match_id, reason}."],
        ["POST /browse/demands/{id}/interest", "—",  "Express interest in a demand."],
    ]
    story.append(std_table(api_disc, col_widths=[5 * cm, 5 * cm, 7 * cm]))
    story.append(sp(4))

    story += h2("9.6 Pools — v1.3 (Auth, farmer)")
    api_pools = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Body / Query</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["POST /pools",              "{crop, title, target_qty, floor_price, …}", "Create pool; organizer geocoded."],
        ["GET /pools",               "crop?, status?, mine?",                     "List open/locked pools."],
        ["GET /pools/{id}",          "—",                                         "Detail: aggregate, members, candidates (organizer)."],
        ["POST /pools/{id}/join",    "{quantity_kg, expected_price, lot_id?}",    "Commit or update commitment."],
        ["POST /pools/{id}/withdraw","—",                                          "Withdraw from pool."],
        ["POST /pools/{id}/status",  "{status}",                                  "Organizer advances pool status."],
    ]
    story.append(std_table(api_pools, col_widths=[4.5 * cm, 5.5 * cm, 7 * cm]))
    story.append(sp(4))

    story += h2("9.7 Forward Contracts — v1.6 (Auth)")
    api_fwd = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Body / Query</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["POST /forward/bids",             "{crop, quantity_kg, price_min, price_max, delivery_from, delivery_to, …}", "Buyer posts a pre-harvest bid (delivery window must be future)."],
        ["GET /forward/bids",              "crop?, mine?, status?, lat?+lon?, radius_km?", "Farmers see open bids near them (with their own commitment + fill); buyers pass mine=true."],
        ["GET /forward/bids/{id}",         "—",                                            "Detail; buyer-owner/admin see all commitments, farmers see only their own."],
        ["PATCH /forward/bids/{id}",       "?status=open|closed|cancelled",                "Buyer-owner only; a filled bid can't be reopened."],
        ["POST /forward/bids/{id}/commitments", "{quantity_kg, price_per_qtl, expected_ready, note?}", "Farmer commits (price in band; one active per farmer; ≤ remaining). Response carries a calendar_warning."],
        ["POST /forward/commitments/{id}/accept",  "—",                                    "Buyer-owner accepts → materialises Lot+Demand+Match+Offer+Deal at matched; bid auto-filled when covered."],
        ["POST /forward/commitments/{id}/decline · /withdraw", "—",                        "Buyer declines a pending commitment / farmer withdraws their own."],
    ]
    story.append(std_table(api_fwd, col_widths=[4.6 * cm, 6 * cm, 6.4 * cm]))
    story.append(sp(4))

    story += h2("9.8 Trade (Auth)")
    api_trade = [
        [Paragraph("<b>Endpoints</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["POST/GET /lots/ · /lots/mine · /lots/{id}",          "Farmer lots; create_lot geocodes location and runs matching."],
        ["POST/GET /demands/ · /demands/mine",                  "Buyer demands; posting runs matching."],
        ["GET /matches/mine · /matches/{id}",                   "Scored matches with score_detail breakdown."],
        ["POST/GET /matches/{id}/offers",                       "Offer thread."],
        ["GET /matches/{id}/negotiation",                       "Counter-offer context: each side's last offer, spread, suggested midpoint, mandi-modal / MSP / band references."],
        ["POST /offers/{id}/accept · /offers/{id}/decline",     "Accept → creates Deal, marks lot+demand matched."],
        ["GET/PATCH /deals/mine · /deals/{id} · /deals/{id}/advance", "Pipeline advance (role-gated per stage; payment_reference required to reach paid)."],
        ["GET/PUT /deals/{id}/logistics",                       "Get or upsert the logistics plan with a diesel-indexed auto cost estimate."],
        ["GET/POST /deals/{id}/payments",                       "List / record instalment payments (buyer); auto-flips payment_status to paid when covered."],
        ["GET /deals/{id}/events · /deals/{id}/receipt",        "Append-only transaction timeline; printable HTML receipt."],
        ["GET /transporters/nearby",                            "Curated transporter directory near a point."],
        ["POST/GET /deals/{id}/disputes · PATCH /disputes/{id}/close", "Raise/view/close disputes."],
        ["GET /history · /history/realization",                 "Caller's lots + demands + deals; and (farmer) realised price vs mandi & MSP with a volume-weighted uplift."],
    ]
    story.append(std_table(api_trade, col_widths=[7.5 * cm, 9.5 * cm]))
    story.append(sp(4))

    story += h2("9.9 Admin (Auth, role admin)")
    api_admin = [
        [Paragraph("<b>Method Path</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["GET /admin/dashboard",              "30-day price trend, dispute queue, per-crop district price gaps, anomalies (>20% off 7-day avg)."],
        ["GET /admin/analytics",              "GMV, avg deal size, marketplace funnel, deal-pipeline breakdown, deal-success rate, payment-status split, avg hours to deal, price-vs-MSP per crop, supply vs demand, user activity, price index."],
        ["GET /admin/events · /admin/events.csv", "The append-only transaction_events feed — paged JSON or a streamed CSV export."],
        ["GET /admin/matching-health",        "Re-derives live matches; reports match quality."],
        ["GET /admin/users",                  "List users — filter by role, verification, or name/phone search."],
        ["PATCH /admin/users/{id}/verify",    "Set verification_status + note."],
        ["PATCH /admin/users/{id}/active",    "Activate or deactivate account."],
    ]
    story.append(std_table(api_admin, col_widths=[6 * cm, 11 * cm]))
    story.append(sp(6))

    # ── 10. CONFIGURATION ────────────────────────────────────────────────────
    story += h1("10. Configuration")
    story += h2("10.1 backend/.env")
    env_data = [
        [Paragraph("<b>Variable</b>", BADGE), Paragraph("<b>Default</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["DATABASE_URL",             "…@localhost:5433/agrilink", "Local dev on :5433; in prod compose points at the internal db:5432."],
        ["JWT_SECRET_KEY",           "(blank)",    "Required for auth — openssl rand -hex 32. Blank ⇒ every login fails."],
        ["DATA_GOV_IN_API_KEY",      "(blank)",    "Blank → snapshot / fixtures fallback. App is fully functional without it."],
        ["INGEST_STATES",            "ALL",        "ALL (whole national feed) or comma-separated states."],
        ["INGEST_TRIGGER_SECRET",    "(blank)",    "Blank → POST /api/ingest/run is disabled (403)."],
        ["WEATHER_API_KEY",          "(blank)",    "Optional OpenWeatherMap key — adds current conditions to the forecast."],
        ["OPENROUTER_API_KEY",       "(blank)",    "Optional. Enables advisor summary, Decision-Brief phrasing, Ask AgriLink, OCR, translation."],
        ["OPENROUTER_MODEL",         "openai/gpt-4o-mini", "Any vision-capable OpenRouter model."],
        ["TRANSPORT_COST_PER_QTL_KM","0.4",       "Legacy flat fallback. Since v1.5 markets/best and deal logistics use the diesel-indexed rate in freight.py."],
        ["CORS_ORIGINS",             "http://localhost:3000", "Comma-separated allowed origins (set to the deployed origin in prod)."],
    ]
    story.append(std_table(env_data, col_widths=[5 * cm, 3.5 * cm, 8.5 * cm]))
    story.append(sp(4))
    story += h2("10.2 Deployment .env (docker-compose.prod.yml)")
    denv_data = [
        [Paragraph("<b>Variable</b>", BADGE), Paragraph("<b>Notes</b>", BADGE)],
        ["JWT_SECRET_KEY",     "Required (openssl rand -hex 32)."],
        ["POSTGRES_PASSWORD",  "Required — DB password (container not published to the host)."],
        ["SITE_ADDRESS",       "Hostname for automatic HTTPS, or ':80' for an IP-only box."],
        ["SITE_URL",           "Full public origin — becomes CORS_ORIGINS."],
        ["DATA_GOV_IN_API_KEY / OPENROUTER_API_KEY / WEATHER_API_KEY", "Optional, passed through to the backend."],
    ]
    story.append(std_table(denv_data, col_widths=[6 * cm, 11 * cm]))
    story.append(sp(6))

    # ── 11. DATA SOURCES ─────────────────────────────────────────────────────
    story += h1("11. Data Sources")
    ds_data = [
        [Paragraph("<b>Source</b>", BADGE), Paragraph("<b>Used for</b>", BADGE), Paragraph("<b>Fallback</b>", BADGE)],
        ["data.gov.in AGMARKNET (current)",  "Today's mandi prices, national feed (~10k rows/25 states).",             "maharashtra_snapshot.csv → synthetic fixtures (seed 26132)"],
        ["data.gov.in AGMARKNET (archive)",  "Per-series daily history for trend charts + signal (~81M rows).",         "Synthetic random walk anchored to latest real price."],
        ["Open-Meteo /v1/forecast",          "7-day precipitation / temp / wind / rain-probability.",                   "Neutral 'unavailable' (signal weather factor → weight 0)."],
        ["Open-Meteo geocoding",             "Place name → lat/lon.",                                                   "MARKET_COORDS + district/state centroid tables."],
        ["OpenWeatherMap (key needed)",      "Current conditions overlay (temp, feels-like, humidity).",                "Omitted; Open-Meteo forecast still shown."],
        ["OSM Nominatim /reverse",           "lat/lon → state + district (accurate, district-level).",                  "BigDataCloud → geo.nearest_place (60-city table) → nearest_state."],
        ["NASA POWER daily point",           "Last-30-day rainfall vs 10-year normal.",                                 "Anomaly card hidden."],
        ["OSRM /route/v1/driving",           "Road distance + drive time for best-market and logistics cost estimate.", "Straight-line haversine."],
        ["Nager.Date /PublicHolidays",       "Upcoming mandi holidays.",                                                "Built-in 2026 holiday list."],
        ["Curated reference.py",             "MSP (CACP 2024-25/25-26), crop calendar (MH-tuned), cold-storage/FPO directory.", "— (static)"],
        ["Curated freight.py",               "Per-state retail diesel reference (₹/L, indicative, with an as_of date) → the diesel-indexed freight rate.", "_DIESEL_DEFAULT (₹92.0/L)."],
        ["Curated knowledge.py",             "Ask AgriLink corpus — ~13 policy/how-it-works notes + docs generated from the MSP / calendar / grading / holiday data.", "— (static, offline retrieval)."],
        ["OpenRouter (key needed)",          "Advisor summary, Decision-Brief phrasing, Ask AgriLink chat, OCR, live-string translation.", "Features hidden; rule output / grounded reference text / English shown."],
    ]
    story.append(std_table(ds_data, col_widths=[3.8 * cm, 7.2 * cm, 6 * cm]))
    story.append(sp(6))

    # ── 12. SIGNAL + FORECAST LOGIC ──────────────────────────────────────────
    story += h1("12. Sell/Wait Signal & Forecast Detail")
    story.append(p(
        "The sell/wait/hold signal is intentionally rule-based and transparent. "
        "Every factor, weight, and intermediate value is returned in the API response "
        "and displayed on screen, so a farmer can follow the logic without trusting a black box."
    ))
    story.append(p(
        "The price forecast is equally transparent: slope (₹/day), weekly pattern (₹ offset per weekday), "
        "residual σ, and a per-day {yhat, lo, hi} array are all returned in the API. "
        "The frontend renders this as a dashed line with a shaded band on the trend chart, "
        "and the 7-day and 30-day projected change percentages are shown numerically."
    ))

    # ── 13. TESTING ──────────────────────────────────────────────────────────
    story += h1("13. Testing")
    story.append(p(
        "Backend: 37 pytest test files, 295 tests, SQLite in-memory (no container required). "
        "Frontend: Vitest 4 + Testing Library 16, 43 tests. Both suites run fully offline."
    ))
    story += h2("13.1 Backend test coverage")
    be_tests = [
        ["Signal (sell/wait/hold cases, MSP/weather/forecast factors, short-history degradation)"],
        ["Price forecast (trend+seasonality, prediction band, min-points guard)"],
        ["Decision Brief: assembly, urgency ordering, reference-market inference, thin-history 404"],
        ["Diesel freight: breakdown sums to rate, rate range, district-pair distance, endpoint shape"],
        ["Knowledge base: top-hit relevance per query, generated docs, key-less reference fallback"],
        ["Geo distance, haversine, nearest_state"],
        ["Ingestion: normalise, live→snapshot→fixture fallback, state override, upsert dedup"],
        ["OpenWeather enrichment; location resolve, state-filtered /options and /public/overview"],
        ["Intelligence endpoints (weather, MSP, calendar, storage, FPO, markets/best, holidays)"],
        ["Auth: register, login, token refresh, profile update, verification request"],
        ["Lots / demands / matching / offers / deals / disputes / history"],
        ["Negotiation context: spread, midpoint, mandi fallback, access control"],
        ["Deal payments + append-only audit timeline; deal logistics upsert + cost estimate"],
        ["Price realisation: uplift math, volume-weighting, below-MSP flag, pending-deal exclusion"],
        ["Forward contracts: bid + commitment lifecycle, band/quantity guards, calendar warning, materialise-to-deal, role gates"],
        ["Alerts: create, toggle, evaluate, notifications unread-count"],
        ["Admin: dashboard, analytics, events feed, matching-health, user list, verify, activate"],
        ["Pools: create, join, withdraw, aggregate, demand candidates, status advance, accept-demand"],
        ["Discovery: browse lots/demands, express interest (match opened / reason returned)"],
        ["OCR: happy path, missing fields, key-less degradation"],
        ["LLM assistant: grounded Q&A + retrieved reference, key-less fallback"],
        ["Backfill history (archive pull + random-walk synthesis); input validation pass"],
    ]
    for row in be_tests:
        story.append(bullet(row[0]))
    story.append(sp(4))

    story += h2("13.2 Frontend test coverage")
    fe_tests = [
        "i18n key parity (hi.json and mr.json must cover all en.json keys).",
        "PriceDetail: skeleton → data, error → Retry.",
        "SellWaitSignalCard: all three recommendations + reasons.",
        "LanguageSwitcher: locale switch persisted.",
        "Smoke test per authenticated page (farmer, buyer, matches, browse, pools, forward, profile, history, deals, admin).",
        "Chart-rendering tests mock recharts.",
    ]
    for item in fe_tests:
        story.append(bullet(item))
    story.append(sp(4))

    story.append(p("Run commands:"))
    story.append(code("cd backend && venv/Scripts/python.exe -m pytest -q"))
    story.append(code("cd frontend && npm run test"))
    story.append(sp(6))

    # ── 14. KNOWN LIMITATIONS ────────────────────────────────────────────────
    story += h1("14. Known Limitations")
    limitations = [
        "<b>No arrival volume (PRICE-07)</b> — The OGD price resource has no arrivals/volume field. arrival_volume is null on live and snapshot rows; the signal's volume factor only fires on synthetic fixture data.",
        "<b>KYC / verification is admin-manual</b> — No automated e-KYC integration (PM-Kisan API, Aadhaar UIDAI). The admin reviews offline documents and sets the status manually.",
        "<b>Login is phone + password only</b> — No SMS OTP, no second factor, no password-reset flow. PBKDF2-HMAC-SHA256 hashing is real; everything else is out of scope for the demo.",
        "<b>Curated reference data</b> — MSP, crop calendar, and the storage/FPO directory are curated samples with real geography, not live registries.",
        "<b>Crop calendar is Maharashtra-tuned</b> — Sowing/harvest/peak windows outside Maharashtra will be approximate.",
        "<b>Price forecast is statistical</b> — Trend+seasonality won't capture sudden policy shocks or weather events. It is transparent, not predictive.",
        "<b>Diesel prices are a curated reference, not a live feed</b> — freight.py holds an indicative per-state table with an as_of date; no daily retail-diesel API is wired in.",
        "<b>Ask AgriLink retrieval is keyword + fuzzy, not semantic</b> — The knowledge base is deliberately embedding-free (offline-safe); a paraphrase with no shared vocabulary can miss.",
        "<b>Forward contracts have no settlement enforcement</b> — An accepted commitment becomes a normal 'matched' deal; honouring it at harvest runs through the ordinary pipeline (disputes included). No escrow or penalty mechanism.",
        "<b>FPO pool → deal is still manual</b> — The organizer converts a ranked demand candidate into a deal by hand (accept-demand); pools don't auto-negotiate. (Forward contracts, by contrast, do materialise a deal on acceptance.)",
        "<b>Satellite crop-health (GEE) is deferred</b> — Credentials may be in .env but nothing reads them.",
        "<b>Cordova wrap (Phase 4) not built</b> — The frontend is structured for it (all-client routes) but there's no cordova/ project yet.",
    ]
    for item in limitations:
        story.append(bullet(item))
    story.append(sp(6))

    # ── 15. REPOSITORY LAYOUT ────────────────────────────────────────────────
    story += h1("15. Repository Layout")
    story.append(code("agrilink/"))
    story.append(code("├── docker-compose.yml        local dev: Postgres 16 → host :5433"))
    story.append(code("├── docker-compose.prod.yml   production: db + backend + frontend + Caddy"))
    story.append(code("├── Caddyfile                 reverse proxy — one origin"))
    story.append(code("├── DEPLOYMENT.md · README.md · AgriLink_Project_Report.pdf"))
    story.append(code("├── backend/"))
    story.append(code("│   ├── Dockerfile · .dockerignore"))
    story.append(code("│   ├── app/"))
    story.append(code("│   │   ├── main.py           FastAPI app, lifespan, CORS, 18 routers"))
    story.append(code("│   │   ├── core/             config, database, security (JWT + PBKDF2)"))
    story.append(code("│   │   ├── models/           19 SQLAlchemy models"))
    story.append(code("│   │   ├── schemas/          Pydantic request/response models"))
    story.append(code("│   │   ├── api/              18 routers (one per domain)"))
    story.append(code("│   │   └── services/         24 services (see §4.1)"))
    story.append(code("│   ├── alembic/versions/     11 migrations (head e5b3c8a2f1d0)"))
    story.append(code("│   ├── scripts/              seed_demo_users.py, generate_report.py"))
    story.append(code("│   ├── tests/                37 pytest files / 295 tests"))
    story.append(code("│   └── .env.example"))
    story.append(code("├── frontend/"))
    story.append(code("│   ├── Dockerfile · .dockerignore   (Next standalone image)"))
    story.append(code("│   └── src/"))
    story.append(code("│       ├── app/              18 App Router routes"))
    story.append(code("│       ├── components/       DecisionBrief, PriceRealizationCard, DealTransactionPanel, …"))
    story.append(code("│       ├── i18n/             en/hi/mr messages + parity test"))
    story.append(code("│       └── lib/              api.ts, auth.ts, useCropMarket.ts, useLocation.tsx"))
    story.append(code("└── .planning/                roadmap, phase plans & summaries"))
    story.append(sp(6))

    # ── 16. QUICKSTART ───────────────────────────────────────────────────────
    story += h1("16. Quickstart")
    story.append(p("The app runs fully offline — ingestion falls back to snapshot then synthetic fixtures."))
    steps = [
        "docker compose up -d db",
        "cd backend && venv/Scripts/python.exe -m alembic upgrade head",
        "cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
        "cd frontend && node node_modules/next/dist/bin/next dev -p 3000",
        "Open http://localhost:3000",
    ]
    for i, step in enumerate(steps, 1):
        story.append(Paragraph(f"<b>{i}.</b>  {step}", BODY_L))
        story.append(sp(2))
    story.append(p("API docs available at http://localhost:8000/docs"))
    story.append(sp(6))

    # ── 17. DEPLOYMENT ───────────────────────────────────────────────────────
    story += h1("17. Deployment")
    story.append(p(
        "For a real deployment (containerised, one domain, HTTPS), skip the local quickstart and "
        "use the production stack. One VM (1–2 vCPU, 2–4 GB RAM), Docker, and — optionally — a "
        "DNS A-record pointed at the box for automatic HTTPS."
    ))
    story.append(p(
        "docker-compose.prod.yml brings up four services: Postgres (internal only), the FastAPI "
        "backend (one Uvicorn worker — the ingestion/alert scheduler runs in-process; it waits "
        "for the DB to be healthy, then runs 'alembic upgrade head' on startup), the Next.js "
        "frontend (standalone image), and a Caddy reverse proxy. Caddy serves the whole app on "
        "one origin — /api, /health and /docs go to the backend, everything else to the frontend "
        "— so there is no CORS to configure and TLS is issued automatically from SITE_ADDRESS."
    ))
    story.append(sp(2))
    for i, step in enumerate([
        "git clone the repo, cd in, and create .env (JWT_SECRET_KEY, POSTGRES_PASSWORD, SITE_ADDRESS, SITE_URL — full checklist in DEPLOYMENT.md).",
        "docker compose -f docker-compose.prod.yml up -d --build",
        "docker compose -f docker-compose.prod.yml --profile seed run --rm seed   (once — runs migrations + seeds demo accounts).",
        "Open https://your-domain (or http://<VM-IP> with SITE_ADDRESS=:80).",
    ], 1):
        story.append(Paragraph(f"<b>{i}.</b>  {step}", BODY_L))
        story.append(sp(2))
    story.append(p(
        "Operational notes are in DEPLOYMENT.md: logs, restart, redeploy (git pull + up --build, "
        "migrations auto-apply), pg_dump / restore, and the gotchas — never scale the backend "
        "past one worker, NEXT_PUBLIC_API_URL is baked at build time, and the first HTTPS request "
        "waits while Caddy provisions the certificate."
    ))
    story.append(sp(6))

    # ── FOOTER NOTE ──────────────────────────────────────────────────────────
    story += h1("Notes")
    story.append(p(
        "This document is auto-generated from the project source by "
        "scripts/generate_report.py. Re-run after any README or code update."
    ))
    story.append(p(
        "AgriLink · SIH 2026 · Problem Statement PS-26132 · "
        "Govt. of Maharashtra / MSInS · Team SIH-26132"
    ))

    return story


# ── page template ────────────────────────────────────────────────────────────
def _header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    if doc.page > 1:
        # header bar
        canvas.setFillColor(GREEN_DARK)
        canvas.rect(0, h - 1.4 * cm, w, 1.4 * cm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(MARGIN, h - 0.9 * cm, "AgriLink · SIH 2026 · PS-26132")
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(w - MARGIN, h - 0.9 * cm, "v1.6 · September 2026")

        # footer
        canvas.setFillColor(LINE)
        canvas.rect(0, 0, w, 1.2 * cm, fill=1, stroke=0)
        canvas.setFillColor(INK_SOFT)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(MARGIN, 0.45 * cm,
                          "Market-linkage & price-discovery for smallholder farmers and FPOs")
        canvas.drawRightString(w - MARGIN, 0.45 * cm, f"Page {doc.page}")
    canvas.restoreState()


if __name__ == "__main__":
    print(f"Building {OUT} …")
    story = build()
    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    size_kb = OUT.stat().st_size // 1024
    print(f"Done — {OUT.name}  ({size_kb} KB)")
