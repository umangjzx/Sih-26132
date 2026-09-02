"""Grounded knowledge base for "Ask AgriLink" (v1.5 #3).

A small, curated corpus of how-it-works / policy notes plus text generated from
the reference datasets (MSP, crop calendar, grading rubric, mandi holidays).
Retrieval is keyword + fuzzy overlap with TF-IDF-ish weighting — no embeddings,
no network — so the assistant can answer "how does MSP procurement work?" or
"when is tur sown?" from real text while staying offline-safe and inspectable.

The LLM answer layer is handed the top few chunks as REFERENCE context; the
retrieval itself is also exposed at GET /api/assistant/search for transparency.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date
from difflib import SequenceMatcher
from functools import lru_cache

from app.services import holidays as holidays_svc
from app.services.grading import GRADES
from app.services.reference import CALENDAR, MSP, _months_label

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = {
    "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "and", "or",
    "how", "what", "when", "where", "which", "do", "does", "did", "can", "i",
    "my", "me", "we", "you", "it", "this", "that", "with", "at", "by", "be",
    "as", "if", "from", "about", "get", "got", "will", "should", "would",
}


def _tokens(text: str) -> list[str]:
    return [w for w in _TOKEN_RE.findall(text.lower()) if w not in _STOP and len(w) > 1]


@dataclass
class Doc:
    id: str
    title: str
    topic: str
    text: str
    tags: list[str] = field(default_factory=list)
    _tf: dict[str, int] = field(default_factory=dict, repr=False)

    def build(self) -> "Doc":
        toks = _tokens(f"{self.title} {self.text} {' '.join(self.tags)}")
        tf: dict[str, int] = {}
        for tk in toks:
            tf[tk] = tf.get(tk, 0) + 1
        self._tf = tf
        return self


# --------------------------------------------------------------------------- #
# Curated how-it-works / policy notes (factual, generically sourced).
# --------------------------------------------------------------------------- #

_NOTES: list[Doc] = [
    Doc(
        id="msp-what",
        title="What Minimum Support Price (MSP) means",
        topic="msp",
        text=(
            "MSP is the floor price the Government of India announces for about 23 "
            "crops each season (kharif and rabi) on the recommendation of the "
            "Commission for Agricultural Costs and Prices. If the open-market mandi "
            "price falls below MSP, notified government agencies buy the crop at MSP "
            "so the farmer is not forced to sell lower. MSP is a price guarantee for "
            "the notified crops, not a subsidy and not a purchase promise for every "
            "quintal. Perishables such as onion, tomato and most vegetables have no "
            "MSP and are fully market-driven."
        ),
        tags=["support price", "floor price", "cacp", "government"],
    ),
    Doc(
        id="msp-procurement",
        title="How MSP procurement works for a farmer",
        topic="msp",
        text=(
            "To sell at MSP, take the produce to a designated government procurement "
            "centre or an APMC mandi where state agencies, FCI, NAFED or a state "
            "federation are procuring that crop that season. You usually need to "
            "register in advance (land record / 7-12 extract, Aadhaar, bank account) "
            "on the state procurement portal and book a token or slot. The crop must "
            "meet Fair Average Quality (FAQ) norms — limits on moisture, foreign "
            "matter, shrivelled or damaged grain. After weighing and quality check, "
            "payment is made directly to the registered bank account, typically "
            "within a few days to two-three weeks depending on the state."
        ),
        tags=["procurement", "nafed", "fci", "faq", "token", "registration", "sell at msp"],
    ),
    Doc(
        id="apmc-mandi",
        title="APMC mandis and how selling there works",
        topic="market",
        text=(
            "An APMC (Agricultural Produce Market Committee) mandi is a regulated "
            "market yard. Produce is sold by open auction or tender through a "
            "licensed commission agent (arhtiya) to licensed traders. The mandi "
            "deducts a market fee and commission. Prices, arrivals and the modal "
            "rate are recorded and reported to AGMARKNET, which is the data AgriLink "
            "aggregates. Many states now also allow sales outside the mandi yard and "
            "direct purchase from farmers under a unified or direct-marketing "
            "licence."
        ),
        tags=["apmc", "mandi", "auction", "commission agent", "arhtiya", "market fee", "agmarknet"],
    ),
    Doc(
        id="enam",
        title="eNAM — the National Agriculture Market",
        topic="market",
        text=(
            "eNAM is an online trading platform that links APMC mandis across states "
            "into one network. A farmer can get the lot assay-graded at the mandi, "
            "have it listed online, and receive bids from buyers in other mandis and "
            "states; payment is settled electronically. It aims to widen the buyer "
            "pool and improve price discovery beyond the local yard. Registration is "
            "done through the mandi or the eNAM portal with ID and bank details."
        ),
        tags=["enam", "national agriculture market", "online trading", "price discovery"],
    ),
    Doc(
        id="fpo",
        title="Farmer Producer Organisations (FPOs) and pooling",
        topic="fpo",
        text=(
            "An FPO is a registered body owned by farmers that aggregates their "
            "produce to sell in bulk, buy inputs cheaper, and access credit, storage "
            "and market linkages that an individual small farmer cannot. Selling a "
            "pooled lot gives more bargaining power and lower per-unit transport and "
            "grading cost. India's Central Sector Scheme targets forming and "
            "supporting 10,000 FPOs with equity grants and a credit guarantee. To "
            "join, approach an existing FPO or a promoting agency (NABARD, SFAC, "
            "state agencies) in your district. AgriLink's demand pools are a "
            "lightweight version of the same idea."
        ),
        tags=["fpo", "producer organisation", "pooling", "aggregation", "nabard", "sfac", "10000 fpo"],
    ),
    Doc(
        id="grading-faq",
        title="Quality grading and FAQ",
        topic="grading",
        text=(
            "Grading sorts produce by size uniformity, cleanliness, moisture and "
            "damage. A higher grade fetches a premium and is required for MSP "
            "procurement and for many bulk buyers. FAQ (Fair Average Quality) is the "
            "standard mandi-acceptance grade — reasonably clean and dry with mixed "
            "sizing. Drying to safe moisture, removing foreign matter and sorting out "
            "damaged pieces before you bring produce to market usually pays for "
            "itself in a better rate. AgriLink uses A / B / FAQ / C so a lot's grade "
            "and a buyer's minimum grade can be compared directly."
        ),
        tags=["grading", "quality", "faq", "fair average quality", "moisture", "premium", "sorting"],
    ),
    Doc(
        id="warehouse-receipt",
        title="Warehouse receipts and pledge finance",
        topic="storage",
        text=(
            "Storing a non-perishable crop in a WDRA-registered warehouse gets you a "
            "negotiable warehouse receipt (e-NWR). You can use that receipt as "
            "collateral for a post-harvest loan from a bank (pledge finance), so you "
            "can hold the crop for a better price instead of selling into the "
            "post-harvest glut. Weigh the expected price gain against storage rent, "
            "interest and quality loss over time. Cold storage is essential for "
            "perishables like onion; grains keep in ordinary godowns if dried."
        ),
        tags=["warehouse receipt", "e-nwr", "wdra", "pledge finance", "post harvest loan", "storage", "cold storage"],
    ),
    Doc(
        id="direct-buyer",
        title="Selling directly to a buyer instead of the mandi",
        topic="market",
        text=(
            "Many states allow a farmer to sell outside the APMC yard directly to a "
            "processor, exporter, retailer or FPO under a direct-marketing or "
            "unified licence, often saving the mandi fee and commission. Agree crop, "
            "quantity, quality grade, price, delivery point and payment terms in "
            "writing before dispatch, and confirm who bears transport. AgriLink's "
            "demand board and deal flow are built for exactly this: browse verified "
            "buyers seeking your crop nearby, express interest, and record the "
            "agreed terms and payment."
        ),
        tags=["direct marketing", "contract", "buyer", "processor", "exporter", "deal", "payment terms"],
    ),
    Doc(
        id="signal-explained",
        title="How AgriLink's sell / wait signal is calculated",
        topic="agrilink",
        text=(
            "The signal is rule-based, not a black box. It compares today's modal "
            "price to its 7-day and 30-day averages (price momentum, weighted 2x), "
            "the recent-week arrival trend where volume data exists (1x), the 7-day "
            "weather outlook (1x) and a short price forecast (1x). The weighted sum "
            "gives SELL NOW, WAIT or HOLD, and every number that drove it is shown. "
            "MSP is layered on as advice: never sell a notified crop below MSP to a "
            "private trader when a procurement centre is an option."
        ),
        tags=["signal", "sell or wait", "how it works", "momentum", "moving average", "forecast"],
    ),
    Doc(
        id="freight-explained",
        title="How AgriLink estimates transport cost",
        topic="agrilink",
        text=(
            "Freight is diesel-indexed: rate per quintal per km = a fixed handling "
            "base plus diesel price per litre divided by (truck mileage x quintals "
            "per truck). Diesel is a curated per-state reference because state VAT "
            "makes it vary. The 'best market after transport' ranking subtracts this "
            "cost x road distance from each mandi's price so you compare the price "
            "you would actually net, not the sticker price."
        ),
        tags=["freight", "transport cost", "diesel", "best market", "net price"],
    ),
    Doc(
        id="mandi-holidays",
        title="When mandis are closed",
        topic="market",
        text=(
            "APMC mandis close on major public holidays and often on the weekly "
            "market off-day. Arrivals bunch up just before and just after a long "
            "holiday, which can push the rate down on the reopening day. Plan a sale "
            "before the break or a few days after the reopening rush. AgriLink lists "
            "the next upcoming market holidays."
        ),
        tags=["holiday", "mandi closed", "market closed", "off day"],
    ),
    Doc(
        id="crop-insurance",
        title="PM Fasal Bima Yojana (crop insurance) in brief",
        topic="schemes",
        text=(
            "PMFBY is the subsidised crop insurance scheme covering yield loss from "
            "natural causes. The farmer premium is capped low (about 2% of sum "
            "insured for kharif food/oilseed crops, 1.5% for rabi, 5% for "
            "commercial/horticultural crops); the rest is shared by central and "
            "state governments. Enrol through your bank, a CSC or the national crop "
            "insurance portal within the cut-off date for the season, and report "
            "damage within 72 hours of the event."
        ),
        tags=["pmfby", "crop insurance", "fasal bima", "premium", "yield loss"],
    ),
    Doc(
        id="pm-kisan",
        title="PM-KISAN income support in brief",
        topic="schemes",
        text=(
            "PM-KISAN pays eligible landholding farmer families ₹6,000 a year in "
            "three equal instalments directly to the bank account. Register with "
            "land records, Aadhaar and bank details through the village revenue "
            "officer or the PM-KISAN portal; e-KYC must be completed for payments to "
            "continue."
        ),
        tags=["pm-kisan", "income support", "instalment", "ekyc", "6000"],
    ),
]


# --------------------------------------------------------------------------- #
# Generated docs from the reference datasets.
# --------------------------------------------------------------------------- #

def _generated_docs() -> list[Doc]:
    docs: list[Doc] = []

    for crop, entry in MSP.items():
        if entry is None:
            docs.append(Doc(
                id=f"msp-crop-{crop.lower().replace(' ', '-')}",
                title=f"MSP status: {crop}",
                topic="msp",
                text=(
                    f"{crop} has no Minimum Support Price — it is a market-driven "
                    f"crop. Sell on price momentum, quality and demand; there is no "
                    f"government floor price to fall back on."
                ),
                tags=["msp", crop.lower(), "no msp", "market driven"],
            ))
        else:
            docs.append(Doc(
                id=f"msp-crop-{crop.lower().replace(' ', '-')}",
                title=f"MSP for {crop}",
                topic="msp",
                text=(
                    f"The Minimum Support Price for {crop} is ₹{entry['price']} per "
                    f"quintal ({entry['season']}). If the mandi rate is below this, a "
                    f"government procurement centre should pay MSP for FAQ-grade "
                    f"produce."
                ),
                tags=["msp", crop.lower(), "support price", str(entry["price"])],
            ))

    for crop, c in CALENDAR.items():
        docs.append(Doc(
            id=f"cal-{crop.lower().replace(' ', '-')}",
            title=f"Crop calendar: {crop} (Maharashtra)",
            topic="calendar",
            text=(
                f"{crop}: sowing in {_months_label(c['sow'])}; harvest in "
                f"{_months_label(c['harvest'])}; peak mandi arrivals in "
                f"{_months_label(c['peak_arrival'])}. {c['note']} Prices are usually "
                f"weakest during the peak-arrival glut and firmer in the off-season."
            ),
            tags=["calendar", crop.lower(), "sowing", "harvest", "season", "arrivals"],
        ))

    grade_lines = "; ".join(f"{g['code']} = {g['desc']}" for g in GRADES)
    docs.append(Doc(
        id="grading-rubric",
        title="AgriLink quality-grade rubric",
        topic="grading",
        text=(
            f"AgriLink grades: {grade_lines}. FAQ (Fair Average Quality) sits at the "
            f"B level. A buyer sets a minimum grade on a demand; a lot at or above "
            f"that grade can match."
        ),
        tags=["grading", "rubric", "grade a", "grade b", "faq", "grade c"],
    ))

    hs = holidays_svc.upcoming_market_holidays(date.today(), days=90)
    if hs:
        listed = "; ".join(f"{h['name']} on {h['date']} (in {h['in_days']} days)" for h in hs[:8])
        docs.append(Doc(
            id="holidays-upcoming",
            title="Upcoming mandi holidays",
            topic="market",
            text=(
                f"Market holidays in the next 90 days when APMC mandis are likely "
                f"closed: {listed}. Plan sales before or a few days after each."
            ),
            tags=["holiday", "mandi closed", "calendar", "upcoming"],
        ))
    return docs


@lru_cache(maxsize=1)
def _corpus() -> list[Doc]:
    docs = [d.build() for d in _NOTES] + [d.build() for d in _generated_docs()]
    return docs


@lru_cache(maxsize=1)
def _idf() -> dict[str, float]:
    docs = _corpus()
    n = len(docs)
    df: dict[str, int] = {}
    for d in docs:
        for tk in d._tf:
            df[tk] = df.get(tk, 0) + 1
    return {tk: math.log((n + 1) / (c + 0.5)) + 1.0 for tk, c in df.items()}


def _fuzzy_token_hit(qt: str, doc_tokens: dict[str, int]) -> float:
    """Best near-match for a query token among the doc's tokens (handles typos
    and 'msp' vs 'm.s.p' style variants)."""
    best = 0.0
    for dt in doc_tokens:
        if abs(len(dt) - len(qt)) > 3:
            continue
        r = SequenceMatcher(None, qt, dt).ratio()
        if r > best:
            best = r
    return best


@dataclass
class Hit:
    doc: Doc
    score: float


def search(query: str, k: int = 4, min_score: float = 3.0) -> list[Hit]:
    """Top-``k`` corpus chunks for ``query`` by TF-IDF overlap plus a fuzzy
    fallback for near-miss tokens and a title-similarity bonus."""
    q_tokens = _tokens(query)
    if not q_tokens:
        return []
    idf = _idf()
    hits: list[Hit] = []
    for d in _corpus():
        score = 0.0
        for qt in set(q_tokens):
            w = idf.get(qt, 1.0)
            if qt in d._tf:
                score += w * (1.0 + 0.3 * min(d._tf[qt], 4))
            else:
                fz = _fuzzy_token_hit(qt, d._tf)
                if fz >= 0.86:
                    score += w * 0.6 * fz
        # title / phrase similarity bonus
        title_sim = SequenceMatcher(None, query.lower(), d.title.lower()).ratio()
        score += 1.8 * title_sim
        if score >= min_score:
            hits.append(Hit(doc=d, score=round(score, 3)))
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:k]


def context_block(query: str, k: int = 4) -> str:
    """Retrieved chunks formatted for the LLM's REFERENCE section (empty string
    when nothing is relevant)."""
    hits = search(query, k=k)
    if not hits:
        return ""
    return "\n\n".join(f"[{h.doc.title}]\n{h.doc.text}" for h in hits)
