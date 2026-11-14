#!/usr/bin/env python3
"""Archive no-fallback PromQL and exporter-up series for recent verified runs.

Only reads Prometheus and saved JSON, writing new audit files under evidence/.
The original files remain unchanged. Absence in a per-code series can represent
legitimate zero even if the exporter is up; do not automatically call it missing.
"""
import hashlib
import json
from pathlib import Path
import labctl

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'evidence'
DEST=SOURCE/'fallback-audit'
TOKEN=' or on() vector(0)'
JOBS=['traefik','kubelet-cadvisor','kube-state-metrics','postgres-exporter']


def no_fallback(query):
    return query.replace(TOKEN,'')


def main():
    prom=labctl.Prom()
    if not prom.up():raise RuntimeError('Prometheus unavailable')
    DEST.mkdir(parents=True,exist_ok=True)
    for folder in ('auth-pair','matched-control'):
        for path in sorted((SOURCE/folder).glob('ids-control-*.json')):
            raw=path.read_bytes(); record=json.loads(raw)
            if record.get('status')!='success':continue
            query_hash=hashlib.sha256(raw).hexdigest()
            target=DEST/(record['run_id']+'.json')
            if target.exists():
                previous=json.loads(target.read_text(encoding='utf-8'))
                if previous.get('source_sha256')!=query_hash: raise RuntimeError('Archive changed: '+path.name)
                continue
            start=record['query_start_epoch']; end=record['query_end_epoch']
            queries={k:no_fallback(v) for k,v in record['queries'].items() if TOKEN in v}
            queries.update({f'up_{j}':f'min(up{{job="{j}"}})' for j in JOBS})
            values={k:prom.range(q,start,end,step=10) for k,q in queries.items()}
            report={'run_id':record['run_id'],'source_sha256':query_hash,'source_folder':folder,
                    'start':start,'end':end,'step_s':10,'queries':queries,'series':values,
                    'caveat':'Prometheus range-query evaluation values; absent per-code series may mean zero.'}
            tmp=target.with_suffix('.tmp')
            tmp.write_text(json.dumps(report,ensure_ascii=False),encoding='utf8');tmp.replace(target)
            print('saved',target.name,flush=True)


if __name__=='__main__':main()
