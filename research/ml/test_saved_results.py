"""Checks generated experiment artifacts, including sample parity between models."""
import json
import unittest
from pathlib import Path
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE / 'audited_results'


class SavedResultsTests(unittest.TestCase):
    def test_group_splits_and_nested_subsets(self):
        splits = json.loads((OUT/'splits.json').read_text())
        subsets = json.loads((OUT/'train_subsets.json').read_text())
        self.assertEqual(len(splits),6)
        for s in splits:
            a,b,c=map(set,(s['train'],s['valid'],s['test']))
            self.assertFalse(a&b or a&c or b&c)
            rows = {r['fraction']:set(r['train_runs']) for r in subsets if r['split']==s['split']}
            self.assertTrue(rows[.5] <= rows[.75] <= rows[1.] <= a)

    def test_same_test_windows_and_no_training_runs_across_models(self):
        p=pd.read_csv(OUT/'predictions.csv.gz')
        splits = {s['split']:s for s in json.loads((OUT/'splits.json').read_text())}
        self.assertEqual(set(p.model), {'rules','rf','mlp','transformer'})
        for (split, fraction, seed),g in p.groupby(['split','fraction','seed']):
            target=set(splits[split]['test'])
            self.assertTrue(set(g.run_id) <= target)
            reference=None
            for _, each in g.groupby('model'):
                current=set(zip(each.window_id,each.truth))
                if reference is None: reference=current
                else: self.assertEqual(reference,current)

    def test_expected_configuration_count_and_timings(self):
        m=json.loads((OUT/'metrics.json').read_text())
        self.assertEqual(len(m),6*3*3*4)
        self.assertTrue(all(x['train_seconds']>=0 and x['inference_seconds']>=0 for x in m))


if __name__ == '__main__': unittest.main()
