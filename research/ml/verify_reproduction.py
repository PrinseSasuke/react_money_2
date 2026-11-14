"""Compare two saved prediction sets, excluding variable timing measurements."""
import argparse
import json
from pathlib import Path
import pandas as pd

KEYS=['split','temporal','fraction','seed','model','window_id','run_id','scenario','truth']


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('reference',type=Path)
    ap.add_argument('rerun',type=Path)
    ap.add_argument('--out',type=Path)
    args=ap.parse_args()
    a=pd.read_csv(args.reference).sort_values(KEYS).reset_index(drop=True)
    b=pd.read_csv(args.rerun).sort_values(KEYS).reset_index(drop=True)
    if not a[KEYS].equals(b[KEYS]): raise ValueError('Prediction keys differ')
    if a.duplicated(KEYS).any() or b.duplicated(KEYS).any(): raise ValueError('Duplicate prediction keys')
    comparison=a.assign(different=a.prediction!=b.prediction).groupby('model').different.agg(['sum','count'])
    result={'same_keys':True,'total_rows':len(a),'different_by_model':comparison['sum'].to_dict(),
            'rows_by_model':comparison['count'].to_dict(),
            'scope':'Same machine, dependencies, split and seeds; timing excluded.'}
    if args.out: args.out.write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result,indent=2))
    if comparison['sum'].sum(): raise SystemExit(1)


if __name__=='__main__': main()
