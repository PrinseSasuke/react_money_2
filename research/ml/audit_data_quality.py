"""Audit duplicates and nonfinite values without modifying preserved evidence."""
import csv
import hashlib
import json
import math
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'evidence'/'legacy'
VERIFIED=ROOT/'evidence'/'verified'
OUT=ROOT/'ml'/'data_quality_extended.json'
AGG_META={'window_start','window_end','run_id','scenario','class','technique','boundary'}
SEQ_META={'window_id','run_id','step_idx','class','technique','boundary'}


def multiplicity(keys):
    counts=Counter(keys)
    return {'groups_repeated':sum(n>1 for n in counts.values()),
            'extra_rows':sum(n-1 for n in counts.values() if n>1)}


def numeric_counter(row,names,out):
    for name in names:
        val=row[name].strip()
        if not val:out['missing'][name]+=1;continue
        try:x=float(val)
        except ValueError:out['invalid'][name]+=1;continue
        if math.isnan(x):out['nan'][name]+=1
        elif math.isinf(x):out['infinite'][name]+=1


def main():
    agg=[]; agg_nonfinite={k:Counter() for k in ('missing','invalid','nan','infinite')}
    with (OLD/'dataset.csv').open(encoding='utf8',newline='') as f:
        reader=csv.DictReader(f); names=[x for x in reader.fieldnames if x not in AGG_META]
        for row in reader:
            numeric_counter(row,names,agg_nonfinite);agg.append(row)
    seq_keys=[];seq_full=[]; seq_nonfinite={k:Counter() for k in ('missing','invalid','nan','infinite')}
    with (OLD/'windows.csv').open(encoding='utf8',newline='') as f:
        reader=csv.DictReader(f);seq_names=[x for x in reader.fieldnames if x not in SEQ_META]
        for row in reader:
            numeric_counter(row,seq_names,seq_nonfinite)
            seq_keys.append((row['window_id'],row['step_idx']))
            seq_full.append(tuple(row.values()))
    feature_groups=defaultdict(list)
    for row in agg:feature_groups[tuple(row[n] for n in names)].append((row['run_id'],row['class']))
    repeated=[g for g in feature_groups.values() if len(g)>1]
    metadata=pd.read_csv(VERIFIED/'windows.csv');X=np.load(VERIFIED/'sequences.npz')['X']
    if len(metadata)!=len(X):raise ValueError('Verified windows and arrays differ in length')
    # Canonicalise NaN representations before hashing, but retain missingness in the fingerprint.
    hashes=[]
    for window in X:
        values=np.asarray(window,dtype=np.float32)
        canonical=np.nan_to_num(values,nan=0,posinf=0,neginf=0)
        hashes.append(hashlib.sha256(canonical.tobytes()+np.isnan(values).tobytes()+
                                     np.isposinf(values).tobytes()+np.isneginf(values).tobytes()).hexdigest())
    verified_groups=defaultdict(list)
    for h,run,cls in zip(hashes,metadata.run_id,metadata['class']):verified_groups[h].append((run,cls))
    vg=[g for g in verified_groups.values() if len(g)>1]
    result={'historical':{'aggregate_rows':len(agg),
      'aggregate_key_duplicates':multiplicity((r['run_id'],r['window_start'],r['window_end']) for r in agg),
      'aggregate_full_row_duplicates':multiplicity(tuple(r.values()) for r in agg),
      'aggregate_feature_duplicate_groups':len(repeated),
      'aggregate_feature_groups_multiple_runs':sum(len({x[0] for x in g})>1 for g in repeated),
      'aggregate_feature_groups_multiple_classes':sum(len({x[1] for x in g})>1 for g in repeated),
      'aggregate_numeric':{k:dict(v) for k,v in agg_nonfinite.items()},
      'sequence_rows':len(seq_keys),'sequence_key_duplicates':multiplicity(seq_keys),
      'sequence_full_row_duplicates':multiplicity(seq_full),
      'sequence_numeric':{k:dict(v) for k,v in seq_nonfinite.items()}},
      'verified':{'windows':len(X),'metadata_window_id_duplicates':multiplicity(metadata.window_id),
        'metadata_run_time_duplicates':multiplicity(zip(metadata.run_id,metadata.window_end)),
        'nan_values':int(np.isnan(X).sum()),'infinite_values':int(np.isinf(X).sum()),
        'identical_sequence_groups':len(vg),'identical_groups_multiple_runs':sum(len({x[0] for x in g})>1 for g in vg),
        'identical_groups_multiple_classes':sum(len({x[1] for x in g})>1 for g in vg)},
      'caveats':['Exact repeated feature vectors can arise naturally and are not proof of leakage.',
        'Overlapping windows and near-duplicates are not measured by exact equality.',
        'Missing historical series cannot automatically be distinguished from real zeroes.']}
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf8')
    print(json.dumps(result,indent=2,ensure_ascii=False))


if __name__=='__main__':main()
