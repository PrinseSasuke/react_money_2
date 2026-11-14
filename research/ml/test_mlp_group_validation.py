import json
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class GroupValidationTest(unittest.TestCase):
    def check_collection(self,folder,base):
        records=json.loads((ROOT/folder/'metrics.json').read_text())
        self.assertEqual(len(records),6*3*3)
        for row in records:
            tr,va,te=map(set,(row['train_runs'],row['validation_runs'],row['test_runs']))
            self.assertFalse(tr&va or tr&te or va&te)
            candidates=row['validation_candidates']
            self.assertEqual([c['max_iter'] for c in candidates],[50,100,150])
            highest=max(c['validation_macro_f1'] for c in candidates)
            self.assertEqual(row['selected_max_iter'],next(c['max_iter'] for c in candidates
                             if c['validation_macro_f1']==highest))
        old=pd.read_csv(ROOT/base/'predictions.csv.gz')
        new=pd.read_csv(ROOT/folder/'predictions.csv.gz')
        old=old[old.model=='mlp']
        keys=['split','temporal','fraction','seed','window_id','run_id','truth']
        self.assertEqual(set(map(tuple,old[keys].to_numpy())),set(map(tuple,new[keys].to_numpy())))

    def test_verified_collection(self):
        self.check_collection('mlp_group_validation','verified_results')

    def test_historical_collection(self):
        self.check_collection('mlp_group_validation_historical','audited_results')


if __name__=='__main__':unittest.main()
