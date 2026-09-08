"""Ramping load test — finds this single-worker deployment's actual
saturation point, closing the "production-scale load test" gap the Judges
page disclosed rather than hid.

Not k6/Locust: those are new dependencies unjustified at this app's scale, so
this reuses perf_bench.py's own httpx + ThreadPoolExecutor approach. What's
new here is *ramping* concurrency until something actually breaks, instead of
one fixed load point, and mixing in endpoints a fixed spot-check doesn't
cover: an authenticated, DB-joined GET (real per-request auth + query cost)
and an authenticated write (the one path with real DB lock contention on a
single worker).

Run against a live `uvicorn app.main:app` process backed by the real seeded
Postgres dataset (not the in-memory SQLite test DB) — same precondition as
perf_bench.py.

Usage:
    venv/Scripts/python.exe scripts/load_test.py --base-url http://127.0.0.1:8010
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

# (name, farmer_phone, farmer_password) — round-robins across the demo
# farmers seeded by scripts/seed_demo_users.py so no single account's
# per-user rate limit (lot_write: 40 ops / 10 min) caps the write ramp.
DEMO_FARMERS = [
    ("+919000000001", "farmer123"),
    ("+919000000002", "farmer123"),
    ("+919000000011", "farmer123"),
    ("+919000000012", "farmer123"),
]

# Stop ramping a scenario once either threshold is crossed at a level —
# that level is reported as the practical ceiling, not a hard crash point.
P99_CEILING_MS = 3000.0
ERROR_RATE_CEILING = 0.02

RAMP_LEVELS = [5, 10, 20, 40, 80, 120, 160]
REQUESTS_PER_WORKER = 8


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def _login(client: httpx.Client, phone: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"phone": phone, "password": password})
    resp.raise_for_status()
    return resp.json()["access_token"]


def _one_open_lot(client: httpx.Client, token: str) -> tuple[int, float] | None:
    """Returns (lot_id, its current expected_price) for the first open lot
    found, so the write ramp can restore it afterward — this hits real demo
    accounts' real lots, not throwaway fixtures."""
    resp = client.get("/api/lots/mine", headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    for lot in resp.json():
        if lot["status"] == "open":
            return lot["id"], lot["expected_price"]
    return None


def _do_request(client: httpx.Client, method: str, path: str, headers: dict, json_body: dict | None) -> tuple[float, int]:
    t0 = time.perf_counter()
    resp = client.request(method, path, headers=headers, json=json_body)
    dt_ms = (time.perf_counter() - t0) * 1000
    return dt_ms, resp.status_code


def ramp(base_url: str, label: str, make_call, levels: list[int]) -> list[dict]:
    """`make_call(i)` returns (method, path, headers, json_body) for request i.
    Ramps concurrency through `levels`, stopping once a level crosses the
    p99/error-rate ceiling (that level's result is still recorded)."""
    results = []
    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        for concurrency in levels:
            n = concurrency * REQUESTS_PER_WORKER
            latencies: list[float] = []
            statuses: list[int] = []
            t_start = time.perf_counter()
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                futs = [pool.submit(lambda i=i: _do_request(client, *make_call(i))) for i in range(n)]
                for fut in as_completed(futs):
                    dt_ms, status = fut.result()
                    latencies.append(dt_ms)
                    statuses.append(status)
            wall_s = time.perf_counter() - t_start

            ok = sum(1 for s in statuses if 200 <= s < 300)
            error_rate = (n - ok) / n if n else 0.0
            p99 = percentile(latencies, 0.99)
            row = {
                "scenario": label,
                "concurrency": concurrency,
                "requests": n,
                "ok": ok,
                "errors": n - ok,
                "error_rate": round(error_rate, 4),
                "wall_s": round(wall_s, 3),
                "throughput_rps": round(n / wall_s, 1) if wall_s > 0 else None,
                "p50_ms": round(percentile(latencies, 0.50), 1),
                "p95_ms": round(percentile(latencies, 0.95), 1),
                "p99_ms": round(p99, 1),
                "max_ms": round(max(latencies), 1),
            }
            results.append(row)
            print(f"[{label}] concurrency={concurrency:4d}  {row}")

            if p99 > P99_CEILING_MS or error_rate > ERROR_RATE_CEILING:
                print(f"[{label}] ceiling crossed at concurrency={concurrency} "
                      f"(p99={p99:.0f}ms, error_rate={error_rate:.1%}) — stopping ramp")
                break
    return results


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8010")
    args = ap.parse_args()

    all_results: dict[str, list[dict]] = {}

    with httpx.Client(base_url=args.base_url, timeout=30.0) as setup:
        tokens = [_login(setup, phone, pw) for phone, pw in DEMO_FARMERS]
        primary_token = tokens[0]

        # One PATCH-able open lot per farmer, so the write ramp round-robins
        # across accounts instead of hammering one and tripping its own
        # per-user rate limit before the server itself is stressed. Keeps the
        # original price so it can be restored afterward — these are real
        # seeded demo lots the live app/demo reads from, not throwaway rows.
        found = [(tok, _one_open_lot(setup, tok)) for tok in tokens]
        writable = [(tok, lot_id, price) for tok, found_lot in found
                    if found_lot is not None for lot_id, price in [found_lot]]
    if not writable:
        raise SystemExit("No open lot found on any demo farmer account — run "
                          "scripts/seed_demo_users.py first.")

    # 1) Public, computation-heavy read — no auth, no per-user limit, so this
    #    is the closest thing to a true breaking point for this deployment.
    all_results["public_forecast"] = ramp(
        args.base_url, "GET /api/prices/forecast (public)",
        lambda i: ("GET", "/api/prices/forecast?crop=Onion&market=Pune&horizon=14", {}, None),
        RAMP_LEVELS,
    )

    # 2) Authenticated, DB-joined read — exercises the JWT-decode path plus
    #    the batched-count query from the v1.35 audit, under one real user.
    all_results["authenticated_matches"] = ramp(
        args.base_url, "GET /api/matches/mine (authenticated)",
        lambda i: ("GET", "/api/matches/mine", {"Authorization": f"Bearer {primary_token}"}, None),
        RAMP_LEVELS,
    )

    # 3) Authenticated write — the one path with real DB lock contention on a
    #    single worker. Deliberately NOT ramped to a breaking point: with only
    #    4 demo farmer accounts to round-robin across, the *app's own*
    #    lot_write rate limit (40 ops / 10 min / user) is reached almost
    #    immediately — e.g. concurrency 5 then 10 already spends 30 of each
    #    account's 40-op budget. A real breaking-point ramp here would need
    #    many more distinct accounts than the shared demo dataset has, and
    #    creating throwaway ones would pollute the same Postgres instance the
    #    live demo reads from — not worth it for this script. So this stays a
    #    single low-concurrency data point, safely under the limit, that
    #    characterizes write latency under real contention rather than
    #    claiming to find where writes actually break.
    def write_call(i: int):
        tok, lot_id, price = writable[i % len(writable)]
        return ("PATCH", f"/api/lots/{lot_id}",
                {"Authorization": f"Bearer {tok}"}, {"expected_price": price + (i % 10)})

    all_results["authenticated_write"] = ramp(
        args.base_url, "PATCH /api/lots/{id} (authenticated write, round-robin)",
        write_call, [10],
    )

    with httpx.Client(base_url=args.base_url, timeout=30.0) as cleanup:
        for tok, lot_id, price in writable:
            cleanup.patch(f"/api/lots/{lot_id}", headers={"Authorization": f"Bearer {tok}"},
                          json={"expected_price": price})
    print(f"\nRestored original expected_price on {len(writable)} demo lot(s) patched above.")

    print("\n--- JSON ---")
    print(json.dumps(all_results, indent=2))


if __name__ == "__main__":
    main()
