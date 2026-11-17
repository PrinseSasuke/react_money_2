"""Recreate ignored paired-control window metadata from archived source runs."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from evaluate_paired_flood import DATA, OUT, SOURCE, extract


def main():
    names=list(np.load(DATA/'sequences.npz')['features'])
    rows=[]
    for path in sorted(SOURCE.glob('ids-control-*.json')):
        data=json.loads(path.read_text(encoding='utf8'))
        extracted,_=extract(data,names)
        rows.extend(extracted)
    frame=pd.DataFrame(rows)
    if len(frame)!=24 or frame.run_id.nunique()!=4:
        raise ValueError('Expected 24 complete windows across four control runs')
    predictions=pd.read_csv(OUT/'predictions.csv.gz')
    if set(frame.window_id)!=set(predictions.window_id):
        raise ValueError('Reconstructed window IDs do not match saved predictions')
    target=OUT/'windows.csv'
    if target.exists():
        raise FileExistsError(f'Refusing to overwrite {target}')
    frame.to_csv(target,index=False)
    print(f'Restored {len(frame)} windows in {target}')


if __name__=='__main__':main()
