import json
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class HoldoutMLPTest(unittest.TestCase):
    def test_same_test_windows_and_group_selection(self):
        records=json.loads((ROOT/'holdout_mlp_validation'/'metrics.json').read_text())
        self.assertEqual(len(records),5*8*3)
        for row in records:
            candidates=row['validation_candidates'];best=max(c['validation_macro_f1'] for c in candidates)
            self.assertEqual(row['selected_max_iter'],next(c['max_iter'] for c in candidates
                             if c['validation_macro_f1']==best))
        old=pd.read_csv(ROOT/'holdout_results'/'predictions.csv.gz')
        new=pd.read_csv(ROOT/'holdout_mlp_validation'/'predictions.csv.gz')
        old=old[old.model=='mlp']
        keys=['split','holdout','seed','window_id','run_id','truth']
        self.assertEqual(set(map(tuple,old[keys].to_numpy())),set(map(tuple,new[keys].to_numpy())))


if __name__=='__main__':unittest.main()
