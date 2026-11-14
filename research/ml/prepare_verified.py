#!/usr/bin/env python3
"""Create a timestamp-verified supplementary dataset from successful controls.

These are synthetic scenarios; no intent or real-world prevalence can be inferred.
"""
import json
import re
import sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from series import FEATURE_ORDER
SOURCE=ROOT/'evidence'
DEST=SOURCE/'verified'
MAPPING={('matched-control','flat'):('control-flat','norm'),
         ('matched-control','burst'):('control-burst','norm'),
         ('auth-pair','flat'):('auth-misconfiguration','fault'),
         ('auth-pair','burst'):('auth-guessing','attack')}


def main():
    names=list(FEATURE_ORDER)
    records=[]; sequences=[]; excluded=[]; source_runs={}
    for collection in ('matched-control','auth-pair'):
        for path in sorted((SOURCE/collection).glob('ids-control-*.json')):
            data=json.loads(path.read_text(encoding='utf-8'))
            match=re.search(r'K6_SETUP_UNIX_MS=(\d+)',data.get('k6_log',''))
            scenario,cls=MAPPING[(collection,data['profile'])]
            if data.get('status')!='success' or not match or not data.get('raw_series'):
                excluded.append({'file':path.name,'reason':'job_failed_or_missing_setup_or_metrics'});continue
            start=int(match.group(1))/1000
            raw={k:{float(t):v for t,v in series.items()} for k,series in data['raw_series'].items()}
            grid=sorted(raw.get('rps_total',{})); n_before=len(records)
            for i,ts in enumerate(grid):
                if not 235<=ts-start<=295 or i<17: continue
                times=grid[i-17:i+1]
                if times[0]<start+60 or any(abs(b-a-10)>.01 for a,b in zip(times,times[1:])):continue
                seq=[[np.nan if raw.get(name,{}).get(t) is None else raw[name][t]
                      for name in names] for t in times]
                records.append({'window_id':data['run_id']+'#'+str(int(ts)),
                    'run_id':data['run_id'],'scenario':scenario,'class':cls,'window_end':ts})
                sequences.append(seq)
            source_runs[data['run_id']]={'scenario':scenario,'class':cls,'path':str(path.relative_to(ROOT)),
                                         'setup_epoch':start,'n_windows':len(records)-n_before,
                                         'experiment_version':data.get('experiment_version','legacy-v1'),
                                         'workload_script_sha256':data.get('workload_script_sha256')}
    if not records: raise ValueError('No verified timestamped windows found')
    DEST.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(DEST/'sequences.npz',X=np.asarray(sequences,dtype=np.float32),
                        features=np.asarray(names,dtype=str))
    meta=pd.DataFrame(records); meta.to_csv(DEST/'windows.csv',index=False)
    result={'runs':source_runs,'excluded':excluded,'windows_by_class':meta['class'].value_counts().to_dict(),
            'runs_by_scenario':meta.groupby('scenario').run_id.nunique().to_dict(),
            'limitations':['All traffic is synthetic; labels encode experimental scenario, not proven human intent.',
               'Two authentication profiles share endpoint/rate; normal controls use another endpoint.',
               'One source, one Kubernetes node, no independent environments.',
               'Runs execute sequentially without verified full HPA recovery.']}
    (DEST/'preparation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'windows_by_class':result['windows_by_class'],
                      'runs_by_scenario':result['runs_by_scenario'],'excluded':excluded},indent=2))


if __name__=='__main__': main()
