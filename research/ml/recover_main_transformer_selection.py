"""Recover validation-selected Transformer epochs for saved grouped comparisons.

No original outputs are modified. Each replay must reproduce its saved test
predictions and the recorded number of completed epochs before metadata is saved.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from experiment_audited import LABELS,nested_subset,transformer_predict


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data',type=Path,required=True)
    ap.add_argument('--base',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    meta=pd.read_csv(args.data/'windows.csv');X=np.load(args.data/'sequences.npz')['X']
    y=pd.Categorical(meta['class'],categories=LABELS).codes
    splits=json.loads((args.base/'splits.json').read_text())
    config=json.loads((args.base/'config.json').read_text())
    if config.get('subset_mode')!='proportional':raise ValueError('Expected proportional protocol')
    saved=pd.read_csv(args.base/'predictions.csv.gz');saved=saved[saved.model=='transformer']
    old=json.loads((args.base/'metrics.json').read_text())
    old={(r['split'],r['fraction'],r['seed']):r for r in old if r['model']=='transformer'}
    records=[]
    for s in splits:
        va=np.flatnonzero(meta.run_id.isin(s['valid']));te=np.flatnonzero(meta.run_id.isin(s['test']))
        for fraction in (.5,.75,1.):
            selected=nested_subset(meta,s['train'],fraction,s['split'],'proportional')
            tr=np.flatnonzero(meta.run_id.isin(selected))
            for seed in range(3):
                pred,epochs,train_s,infer_s,details=transformer_predict(X,y,tr,va,te,seed,25,return_details=True)
                subset=saved[(saved.split==s['split'])&(saved.fraction==fraction)&(saved.seed==seed)]
                expected={row.window_id:row.prediction for row in subset.itertuples()}
                actual={meta.window_id.iloc[ix]:LABELS[int(p)] for ix,p in zip(te,pred)}
                if expected!=actual or epochs!=old[(s['split'],fraction,seed)]['epochs']:
                    raise ValueError(f'Replay mismatch split={s["split"]}, fraction={fraction}, seed={seed}')
                records.append({'split':s['split'],'temporal':s['temporal'],'fraction':fraction,'seed':seed,
                    'completed_epochs':epochs,'best_epoch':details['best_epoch'],
                    'best_validation_macro_f1':details['best_validation_macro_f1'],
                    'prediction_windows_verified':len(actual),
                    'train_seconds_replay':train_s,'inference_seconds_replay':infer_s})
                print(f'split={s["split"]} fraction={fraction} seed={seed} best={details["best_epoch"]}',flush=True)
            args.out.parent.mkdir(parents=True,exist_ok=True)
            args.out.write_text(json.dumps({'status':'in_progress','records':records},indent=2),encoding='utf8')
    if len(records)!=len(splits)*3*3:raise ValueError('Incomplete replay')
    args.out.write_text(json.dumps({'status':'complete','records':records,
      'scope':'Replay on Aspire; exact test predictions and completed epochs match saved comparison.'},indent=2),encoding='utf8')


if __name__=='__main__':main()
