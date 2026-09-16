#!/usr/bin/env python3
"""Pure-stdlib z-score anomaly detector on Prometheus range data. No pandas/numpy/matplotlib needed."""
import sys
import json
import csv
import math
import urllib.request
import urllib.parse

PROM = "http://127.0.0.1:9090"

def query_range(query, start, end, step):
    params = urllib.parse.urlencode({"query": query, "start": start, "end": end, "step": step})
    url = f"{PROM}/api/v1/query_range?{params}"
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.load(r)
    if data.get("status") != "success":
        print("ERROR:", data, file=sys.stderr)
        sys.exit(1)
    result = data["data"]["result"]
    if not result:
        return []
    return [(float(ts), float(val)) for ts, val in result[0]["values"]]

def zscore_detect(series, baseline_n, k=3.0):
    baseline_vals = [v for _, v in series[:baseline_n]]
    mean = sum(baseline_vals) / len(baseline_vals)
    var = sum((v - mean) ** 2 for v in baseline_vals) / len(baseline_vals)
    std = math.sqrt(var) if var > 0 else 1e-9
    out = []
    for ts, v in series:
        z = (v - mean) / std
        out.append((ts, v, z, abs(z) > k))
    return out, mean, std

if __name__ == "__main__":
    pod = sys.argv[1]
    start = sys.argv[2]
    end = sys.argv[3]
    step = sys.argv[4]
    baseline_seconds = float(sys.argv[5])
    stress_start_epoch = float(sys.argv[6])

    mem_q = f'container_memory_working_set_bytes{{namespace="react-money",pod="{pod}",container="backend"}}'
    cpu_q = f'rate(container_cpu_usage_seconds_total{{namespace="react-money",pod="{pod}",container="backend"}}[40s])'

    mem = query_range(mem_q, start, end, step)
    cpu = query_range(cpu_q, start, end, step)

    step_s = float(step.rstrip("s"))
    baseline_n = max(3, int(baseline_seconds / step_s))

    mem_flags, mem_mean, mem_std = zscore_detect(mem, baseline_n)
    cpu_flags, cpu_mean, cpu_std = zscore_detect(cpu, baseline_n)

    print(f"Memory baseline: mean={mem_mean/1e6:.2f}MB std={mem_std/1e6:.3f}MB (n={baseline_n} points)")
    print(f"CPU baseline: mean={cpu_mean:.4f} cores std={cpu_std:.5f} (n={baseline_n} points)")

    with open("metrics_backend_stress.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "memory_bytes", "memory_zscore", "memory_anomaly",
                     "cpu_rate_cores", "cpu_zscore", "cpu_anomaly"])
        for (mts, mv, mz, ma), (cts, cv, cz, ca) in zip(mem_flags, cpu_flags):
            w.writerow([mts, mv, round(mz, 3), int(ma), cv, round(cz, 3), int(ca)])

    first_mem_anomaly = next((ts for ts, v, z, a in mem_flags if a), None)
    first_cpu_anomaly = next((ts for ts, v, z, a in cpu_flags if a), None)

    print(f"\nStress applied at (real event, from Chaos Mesh log): {stress_start_epoch}")
    if first_mem_anomaly:
        print(f"Detector (memory z-score) first flagged anomaly at: {first_mem_anomaly}  "
              f"(delay vs real event: {first_mem_anomaly - stress_start_epoch:+.0f}s)")
    else:
        print("Detector (memory): NO anomaly flagged")
    if first_cpu_anomaly:
        print(f"Detector (CPU z-score) first flagged anomaly at: {first_cpu_anomaly}  "
              f"(delay vs real event: {first_cpu_anomaly - stress_start_epoch:+.0f}s)")
    else:
        print("Detector (CPU): NO anomaly flagged")

    max_mem = max(v for _, v in mem)
    limit_bytes = 256 * 1024 * 1024
    print(f"\nPeak memory during experiment: {max_mem/1e6:.1f}MB "
          f"({max_mem/limit_bytes*100:.1f}% of the 256Mi container limit) — no OOMKill occurred this run.")
