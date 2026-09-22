#!/usr/bin/env python3
"""Run Chronos-Bolt on the staircase memory series and find first forecast-crossing of the limit."""
import sys
import json
import urllib.request
import urllib.parse
import torch
from chronos import BaseChronosPipeline

PROM = "http://127.0.0.1:9090"
LIMIT_BYTES = 256 * 1024 * 1024  # 268435456
FORECAST_HORIZON = 6  # steps ahead (10s step -> 60s horizon, matches predict_linear's 60s)

def query_range(query, start, end, step):
    params = urllib.parse.urlencode({"query": query, "start": start, "end": end, "step": step})
    url = f"{PROM}/api/v1/query_range?{params}"
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.load(r)
    result = data["data"]["result"]
    return [(float(ts), float(val)) for ts, val in result[0]["values"]]

print("Loading Chronos-Bolt (amazon/chronos-bolt-small)...")
pipeline = BaseChronosPipeline.from_pretrained(
    "amazon/chronos-bolt-small",
    device_map="cpu",
    torch_dtype=torch.float32,
)
print("Model loaded.")

# Prometheus retention (6h) expired before this run (deadsnakes/miniconda detour took overnight) —
# using the raw series already captured from Prometheus during the live experiment window.
series = [
    (1789997810, 27680768), (1789997820, 27762688), (1789997830, 71643136),
    (1789997840, 71643136), (1789997850, 71811072), (1789997860, 71897088),
    (1789997870, 113430528), (1789997880, 113430528), (1789997890, 113569792),
    (1789997900, 113655808), (1789997910, 113655808), (1789997920, 155889664),
    (1789997930, 155971584), (1789997940, 155971584), (1789997950, 156086272),
    (1789997960, 197705728), (1789997970, 197869568), (1789997980, 197869568),
    (1789997990, 197955584), (1789998000, 239968256), (1789998010, 239968256),
    (1789998020, 240136192), (1789998030, 240275456), (1789998040, 240275456),
    (1789998050, 27795456), (1789998060, 27795456), (1789998070, 27963392),
    (1789998080, 27963392), (1789998090, 28127232),
]
timestamps = [t for t, v in series]
values = [float(v) for t, v in series]
print(f"Loaded {len(values)} points.")

MIN_CONTEXT = 6  # need a few points before we can forecast anything meaningful
first_crossing_ts = None
first_crossing_forecast = None

for i in range(MIN_CONTEXT, len(values)):
    context = torch.tensor(values[:i], dtype=torch.float32).unsqueeze(0)
    quantiles, mean = pipeline.predict_quantiles(
        inputs=context, prediction_length=FORECAST_HORIZON, quantile_levels=[0.1, 0.5, 0.9]
    )
    # upper bound (0.9 quantile) at the end of the horizon -> conservative "will it breach" check
    upper_bound_at_horizon = quantiles[0, -1, 2].item()
    mean_at_horizon = mean[0, -1].item()
    if upper_bound_at_horizon > LIMIT_BYTES and first_crossing_ts is None:
        first_crossing_ts = timestamps[i]
        first_crossing_forecast = (mean_at_horizon, upper_bound_at_horizon)
        print(f"FIRST CROSSING at t={timestamps[i]} (real value now: {values[i]/1e6:.2f}MB) "
              f"forecast mean={mean_at_horizon/1e6:.2f}MB upper90={upper_bound_at_horizon/1e6:.2f}MB")
        break
    if i % 5 == 0:
        print(f"t={timestamps[i]} real={values[i]/1e6:.2f}MB forecast_mean={mean_at_horizon/1e6:.2f}MB upper90={upper_bound_at_horizon/1e6:.2f}MB")

if first_crossing_ts is None:
    print("Chronos-Bolt never forecasted a crossing of the limit in this window.")
else:
    print(f"\nRESULT: Chronos-Bolt first crossed at epoch {first_crossing_ts}")
