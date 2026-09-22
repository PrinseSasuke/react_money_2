#!/usr/bin/env python3
"""Utility to query Prometheus (local port-forward on 127.0.0.1:9090) and dump results."""
import sys
import json
import urllib.request
import urllib.parse

PROM = "http://127.0.0.1:9090"

def query_range(query, start, end, step):
    params = urllib.parse.urlencode({
        "query": query, "start": start, "end": end, "step": step
    })
    url = f"{PROM}/api/v1/query_range?{params}"
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.load(r)
    if data.get("status") != "success":
        print("ERROR:", data, file=sys.stderr)
        sys.exit(1)
    return data["data"]["result"]

if __name__ == "__main__":
    query, start, end, step = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    result = query_range(query, start, end, step)
    if not result:
        print("EMPTY RESULT SET for query:", query)
        sys.exit(0)
    for series in result:
        print("### series:", {k: v for k, v in series["metric"].items() if k in ("pod", "container", "__name__")})
        for ts, val in series["values"]:
            print(f"  {ts}  {val}")
