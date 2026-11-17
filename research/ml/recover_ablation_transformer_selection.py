"""Replay Transformer ablations to recover validation-selected epochs.

Predictions are checked against the originally published outputs before recording
the recovered metadata. The saved original experiment is never overwritten.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from ablate_models import GROUPS
from experiment_audited import LABELS, transformer_predict


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data',type=Path,required=True)
    ap.add_argument('--base',type=Path,required=True)
    ap.add_argument('--ablation',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    meta=pd.read_csv(args.data/'windows.csv');raw=np.load(args.data/'sequences.npz')
    X=raw['X'];names=list(raw['features']);y=pd.Categorical(meta['class'],categories=LABELS).codes
    splits=[s for s in json.loads((args.base/'splits.json').read_text()) if not s['temporal']]
    saved=pd.read_csv(args.ablation/'predictions.csv.gz')
    saved=saved[saved.model=='transformer']
    previous=json.loads((args.ablation/'metrics.json').read_text())
    previous={(r['split'],r['ablation'],r['seed']):r for r in previous if r['model']=='transformer'}
    records=[]
    for s in splits:
        tr=np.flatnonzero(meta.run_id.isin(s['train']));va=np.flatnonzero(meta.run_id.isin(s['valid']))
        te=np.flatnonzero(meta.run_id.isin(s['test']))
        for group,drop in GROUPS.items():
            seq=X[:,:,[i for i,n in enumerate(names) if n not in drop]]
            for seed in range(3):
                pred,epochs,train_s,infer_s,details=transformer_predict(seq,y,tr,va,te,seed,25,return_details=True)
                subset=saved[(saved.split==s['split'])&(saved.ablation==group)&(saved.seed==seed)]
                expected={row.window_id:row.prediction for row in subset.itertuples()}
                actual={meta.window_id.iloc[ix]:LABELS[int(p)] for ix,p in zip(te,pred)}
                old=previous[(s['split'],group,seed)]
                if expected!=actual or epochs!=old['selected_epoch_or_limit']:
                    raise ValueError(f'Replay mismatch split={s["split"]}, group={group}, seed={seed}')
                records.append({'split':s['split'],'ablation':group,'seed':seed,
                    'completed_epochs':epochs,'best_epoch':details['best_epoch'],
                    'best_validation_macro_f1':details['best_validation_macro_f1'],
                    'prediction_windows_verified':len(actual),
                    'train_seconds_replay':train_s,'inference_seconds_replay':infer_s})
                print(f'split={s["split"]} group={group} seed={seed} best={details["best_epoch"]}',flush=True)
            args.out.parent.mkdir(parents=True,exist_ok=True)
            args.out.write_text(json.dumps({'status':'in_progress','records':records},indent=2),encoding='utf8')
    if len(records)!=5*len(GROUPS)*3:raise ValueError('Incomplete replay')
    args.out.write_text(json.dumps({'status':'complete','records':records,
       'scope':'Replay on Aspire; exact test predictions and completed epochs match saved ablation.'},indent=2),encoding='utf8')


if __name__=='__main__':main()
