"""Rule-based (not ML) sell-now-vs-wait signal.

Combines two independently explainable factors:
  1. Price momentum — today's modal price vs its 7-day and 30-day moving
     averages. Price well above its 30-day average, with the 7-day average
     not falling behind, favors selling now.
  2. Arrival-volume trend — this week's average arrivals vs the prior week's.
     Rising arrivals tend to push prices down soon (sell before the glut);
     falling arrivals suggest tightening supply (worth waiting).
     Volume is missing from the current data.gov.in feed for most rows, so
     this factor is skipped (weight 0) whenever it isn't available, and the
     explanation says so rather than pretending it's a factor.

Score: price factor is weighted 2x, volume factor 1x, summed to a single
recommendation. Every number that drove the decision is included in the
returned reason so the recommendation is auditable, not a black box.
"""

from dataclasses import dataclass
from statistics import mean

from app.models.price_cache import PriceCache

PRICE_STRONG_PCT = 5.0
VOLUME_STRONG_PCT = 15.0


@dataclass
class SellWaitSignal:
    recommendation: str  # "sell_now" | "wait" | "hold"
    reasons: list[str]
    current_price: float
    ma_7: float
    ma_30: float | None
    volume_trend_pct: float | None
    days_of_data: int
    weather_bias: int = 0          # -1 / 0 / +1 (from weather.get_forecast)
    weather_note: str | None = None
    msp: dict | None = None        # {"price", "gap", "below": bool, "season"}


def compute_signal(
    rows: list[PriceCache],
    *,
    weather: dict | None = None,
    msp: dict | None = None,
) -> SellWaitSignal | None:
    """`rows` must be PriceCache rows for a single crop+market, sorted
    ascending by date. Returns None when there isn't even a week of data.

    Optional context:
      weather — result of ``weather.get_forecast`` (adds a weight-1 factor).
      msp     — result of ``reference.msp_for`` (advisory overlay, not scored).
    """
    if len(rows) < 7:
        return None

    ordered = sorted(rows, key=lambda r: r.date)
    prices = [r.modal_price for r in ordered]
    current_price = prices[-1]

    last_7 = prices[-7:]
    ma_7 = mean(last_7)

    ma_30 = mean(prices[-30:]) if len(prices) >= 14 else None

    reasons: list[str] = []
    price_score = 0

    if ma_30 is not None:
        pct_vs_30 = (current_price - ma_30) / ma_30 * 100
        if pct_vs_30 >= PRICE_STRONG_PCT and ma_7 >= ma_30:
            price_score = 1
            reasons.append(
                f"Today's price (₹{current_price:.0f}) is {pct_vs_30:.1f}% above the "
                f"{len(prices[-30:])}-day average (₹{ma_30:.0f}), and the 7-day trend "
                f"(₹{ma_7:.0f}) is holding — favorable to sell now."
            )
        elif pct_vs_30 <= -PRICE_STRONG_PCT:
            price_score = -1
            reasons.append(
                f"Today's price (₹{current_price:.0f}) is {abs(pct_vs_30):.1f}% below the "
                f"{len(prices[-30:])}-day average (₹{ma_30:.0f}) — prices look depressed, "
                "may be worth waiting for a recovery."
            )
        else:
            reasons.append(
                f"Today's price (₹{current_price:.0f}) is close to the "
                f"{len(prices[-30:])}-day average (₹{ma_30:.0f}) — no strong price signal either way."
            )
    else:
        reasons.append(
            f"Only {len(prices)} days of price history available — not enough for a "
            "30-day comparison, so this recommendation relies on the 7-day trend only."
        )

    volume_trend_pct: float | None = None
    volume_score = 0
    volumes = [r.arrival_volume for r in ordered if r.arrival_volume is not None]
    if len(ordered) >= 14 and all(r.arrival_volume is not None for r in ordered[-14:]):
        recent_week = [r.arrival_volume for r in ordered[-7:]]
        prior_week = [r.arrival_volume for r in ordered[-14:-7]]
        recent_avg = mean(recent_week)
        prior_avg = mean(prior_week)
        if prior_avg > 0:
            volume_trend_pct = (recent_avg - prior_avg) / prior_avg * 100
            if volume_trend_pct >= VOLUME_STRONG_PCT:
                volume_score = 1
                reasons.append(
                    f"Arrivals are up {volume_trend_pct:.1f}% vs the prior week "
                    f"({recent_avg:.0f} vs {prior_avg:.0f} qtl/day) — more supply incoming "
                    "may soften prices, so selling sooner locks in today's price."
                )
            elif volume_trend_pct <= -VOLUME_STRONG_PCT:
                volume_score = -1
                reasons.append(
                    f"Arrivals are down {abs(volume_trend_pct):.1f}% vs the prior week "
                    f"({recent_avg:.0f} vs {prior_avg:.0f} qtl/day) — tightening supply could "
                    "push prices up if you can hold."
                )
            else:
                reasons.append(
                    f"Arrival volume is roughly flat vs the prior week "
                    f"({recent_avg:.0f} vs {prior_avg:.0f} qtl/day) — no strong volume signal."
                )
    else:
        reasons.append("Arrival-volume data isn't available for this market, so this factor was skipped.")

    # --- weather factor (weight 1) ---
    weather_bias = 0
    weather_note: str | None = None
    if weather and weather.get("source") not in (None, "unavailable"):
        weather_bias = int(weather.get("sell_bias", 0) or 0)
        weather_note = weather.get("note")
        if weather_note:
            reasons.append(weather_note)

    # --- MSP advisory overlay (not scored) ---
    msp_block: dict | None = None
    if msp and msp.get("price"):
        gap = round(current_price - msp["price"], 0)
        below = current_price < msp["price"]
        msp_block = {"price": msp["price"], "gap": gap, "below": below, "season": msp.get("season", "")}
        if below:
            reasons.append(
                f"Today's price (₹{current_price:.0f}) is ₹{abs(gap):.0f} below the "
                f"Minimum Support Price (₹{msp['price']:.0f}) — a government procurement "
                "centre may pay more; avoid selling to a private trader below MSP."
            )
        else:
            reasons.append(
                f"Today's price (₹{current_price:.0f}) is ₹{gap:.0f} above the Minimum "
                f"Support Price (₹{msp['price']:.0f}) — the open market is paying a premium."
            )

    total_score = 2 * price_score + volume_score + weather_bias
    if total_score >= 2:
        recommendation = "sell_now"
    elif total_score <= -2:
        recommendation = "wait"
    else:
        recommendation = "hold"

    return SellWaitSignal(
        recommendation=recommendation,
        reasons=reasons,
        current_price=current_price,
        ma_7=ma_7,
        ma_30=ma_30,
        volume_trend_pct=volume_trend_pct,
        days_of_data=len(prices),
        weather_bias=weather_bias,
        weather_note=weather_note,
        msp=msp_block,
    )
