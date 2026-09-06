"""One-off local performance benchmark against a running dev server.

Not a CI-gated load test — a single, honestly-labeled measurement run used to
replace "Not benchmarked" placeholders on the Judges page with real numbers.
Run against a live `uvicorn app.main:app` process backed by the real seeded
Postgres dataset (not the in-memory SQLite test DB).

Usage:
    venv/Scripts/python.exe scripts/perf_bench.py --base-url http://127.0.0.1:8010
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

ENDPOINTS = [
    ("GET /api/options", "GET", "/api/options", None),
    ("GET /api/prices/trend", "GET", "/api/prices/trend?crop=Onion&market=Pune&days=30", None),
    ("GET /api/prices/forecast", "GET", "/api/prices/forecast?crop=Onion&market=Pune&horizon=14", None),
    ("GET /api/prices/signal", "GET", "/api/prices/signal?crop=Onion&market=Pune", None),
    ("GET /api/prices/nearby", "GET", "/api/prices/nearby?crop=Onion&district=Pune", None),
]


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def run_one(client: httpx.Client, method: str, path: str) -> tuple[float, int]:
    t0 = time.perf_counter()
    resp = client.request(method, path)
    dt_ms = (time.perf_counter() - t0) * 1000
    return dt_ms, resp.status_code


def bench_endpoint(base_url: str, method: str, path: str, n: int, concurrency: int) -> dict:
    latencies: list[float] = []
    statuses: list[int] = []
    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        client.request(method, path)  # warm-up, excluded from measurement

        t_start = time.perf_counter()
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futs = [pool.submit(run_one, client, method, path) for _ in range(n)]
            for fut in as_completed(futs):
                dt_ms, status = fut.result()
                latencies.append(dt_ms)
                statuses.append(status)
        wall_s = time.perf_counter() - t_start

    ok = sum(1 for s in statuses if 200 <= s < 300)
    return {
        "requests": n,
        "concurrency": concurrency,
        "ok": ok,
        "errors": n - ok,
        "wall_s": round(wall_s, 3),
        "throughput_rps": round(n / wall_s, 1) if wall_s > 0 else None,
        "p50_ms": round(percentile(latencies, 0.50), 1),
        "p95_ms": round(percentile(latencies, 0.95), 1),
        "p99_ms": round(percentile(latencies, 0.99), 1),
        "max_ms": round(max(latencies), 1),
        "mean_ms": round(statistics.mean(latencies), 1),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8010")
    ap.add_argument("--requests", type=int, default=200)
    ap.add_argument("--concurrency", type=int, default=20)
    args = ap.parse_args()

    results = {}
    for name, method, path, _ in ENDPOINTS:
        results[name] = bench_endpoint(args.base_url, method, path, args.requests, args.concurrency)
        print(f"{name}: {results[name]}")

    print("\n--- JSON ---")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
