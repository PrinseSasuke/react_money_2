"""Summarise archived no-fallback query results and exporter-up coverage."""
import collections
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'evidence'
OUT=ROOT/'ml'/'verified_results'/'fallback_coverage.json'


def main():
    counts=collections.defaultdict(collections.Counter); jobs=collections.defaultdict(collections.Counter)
    manifest=[]
    for p in sorted((EVIDENCE/'fallback-audit').glob('*.json')):
        raw=p.read_bytes(); data=json.loads(raw)
        source=EVIDENCE/data['source_folder']/p.name
        if hashlib.sha256(source.read_bytes()).hexdigest()!=data['source_sha256']:
            raise ValueError('Source SHA mismatch: '+p.name)
        original=json.loads(source.read_text(encoding='utf-8'))
        match=re.search(r'K6_SETUP_UNIX_MS=(\d+)',original.get('k6_log',''))
        if not match: raise ValueError('Missing setup timestamp: '+p.name)
        start=int(match.group(1))/1000
        rows={k:{float(t):v for t,v in series.items()} for k,series in data['series'].items()}
        legacy={k:{float(t):v for t,v in series.items()} for k,series in original['raw_series'].items()}
        grid=[t for t in legacy.get('rps_total',{}) if 235 <= t-start <= 295]
        for key in data['queries']:
            for t in grid:
                if key.startswith('up_'):
                    v=rows[key].get(t)
                    jobs[key]['missing' if v is None else ('up' if float(v)==1 else 'down_or_other')] += 1
                else:
                    old=legacy.get(key,{}).get(t); new=rows[key].get(t)
                    if old is None: counts[key]['original_missing']+=1
                    elif float(old)==0 and new is None: counts[key]['zero_from_fallback_or_absent_code']+=1
                    elif float(old)==0: counts[key]['present_zero']+=1
                    else: counts[key]['present_nonzero']+=1
        manifest.append({'file':p.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                         'source_sha256':data['source_sha256'],'source_folder':data['source_folder']})
    if len(manifest)!=20: raise ValueError(f'Expected 20 audit files; got {len(manifest)}')
    report={'runs':len(manifest),'interval_s':[235,295], 'metric_counts':{k:dict(v) for k,v in counts.items()},
        'exporter_up':{k:dict(v) for k,v in jobs.items()}, 'files':manifest,
        'caveats':['Exporter up is not proof every metric exists.',
          'Absent status-code series may be a legitimate zero, not a failed scrape.',
          'These are query_range evaluation points, not raw underlying scrape samples.',
          'Recorded scores are unchanged; no data were re-imputed from this audit.']}
    OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2,ensure_ascii=False))


if __name__=='__main__':main()
