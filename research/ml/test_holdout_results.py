import json
import unittest
from pathlib import Path
import pandas as pd

OUT=Path(__file__).resolve().parent/'holdout_results'


class HoldoutTest(unittest.TestCase):
    def test_excluded_scenarios_absent_from_train_validation(self):
        config=json.loads((OUT/'config.json').read_text())
        splits=json.loads((OUT/'splits.json').read_text())
        self.assertEqual(len(splits),5*len(config['held_out']))
        for s in splits:
            held=set(config['held_out'][s['holdout']])
            for run in s['train_runs']+s['validation_runs']:
                self.assertNotIn(run.split('_',1)[1],held)
            self.assertFalse(set(s['train_runs'])&set(s['test_runs']))
            self.assertFalse(set(s['validation_runs'])&set(s['test_runs']))

    def test_models_evaluate_identical_heldout_windows(self):
        p=pd.read_csv(OUT/'predictions.csv.gz')
        self.assertEqual(set(p.model),{'rf','mlp','transformer'})
        for _,g in p.groupby(['split','holdout','seed']):
            self.assertEqual(set(g.model),{'rf','mlp','transformer'})
            sets=[set(zip(x.window_id,x.truth)) for _,x in g.groupby('model')]
            self.assertTrue(all(x==sets[0] for x in sets[1:]))


if __name__=='__main__':unittest.main()
