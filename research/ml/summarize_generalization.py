"""Run-level summaries for historical scenario/family holdout and ablations."""
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score

OUT=Path(__file__).resolve().parent/'audited_results'


def main():
    p=pd.read_csv(OUT/'generalization_predictions.csv.gz')
    rows=[]; rng=np.random.RandomState(3301)
    for name,g in p[p.kind=='holdout'].groupby('group'):
        per_run=g.assign(detected=g.prediction==2).groupby('run_id').detected.mean().to_numpy()
        boot=rng.choice(per_run,size=(2000,len(per_run)),replace=True).mean(axis=1)
        rows.append({'group':name,'distinct_test_runs':len(per_run),
          'mean_run_recall':float(per_run.mean()),'bootstrap_p025':float(np.quantile(boot,.025)),
          'bootstrap_p975':float(np.quantile(boot,.975)),
          'caveat':'Conditional on repeatedly tested historical runs and model/split protocol.'})
    pd.DataFrame(rows).to_csv(OUT/'holdout_run_bootstrap.csv',index=False)
    rows=[]
    for (group,split),g in p[p.kind=='ablation'].groupby(['group','split']):
        rows.append({'ablation':group,'split':split,
          'macro_f1':f1_score(g.truth,g.prediction,labels=[0,1,2],average='macro',zero_division=0),
          'test_runs':g.run_id.nunique()})
    pd.DataFrame(rows).to_csv(OUT/'ablation_by_split.csv',index=False)
    print('run-level holdout and ablation summaries written')


if __name__=='__main__':main()
