"""Verify archived source and fallback artefacts against their committed manifests."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def main():
    source=json.loads((ROOT/'ml'/'verified_source_manifest.json').read_text(encoding='utf8'))
    fallback=json.loads((ROOT/'ml'/'verified_results'/'fallback_coverage.json').read_text(encoding='utf8'))
    failures=[]; checked=0
    for entry in source['files']:
        path=ROOT/'evidence'/entry['collection']/entry['file']
        checked+=1
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
            failures.append(str(path))
    for entry in fallback['files']:
        path=ROOT/'evidence'/'fallback-audit'/entry['file']
        checked+=1
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
            failures.append(str(path))
    print(json.dumps({'checked':checked,'failures':failures},ensure_ascii=False))
    if failures: raise SystemExit(1)


if __name__=='__main__':main()
