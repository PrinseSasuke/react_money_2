import json
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class PairResultsTest(unittest.TestCase):
    def test_external_windows_and_models(self):
        folder=ROOT/'paired_flood_results';config=json.loads((folder/'config.json').read_text())
        pred=pd.read_csv(folder/'predictions.csv.gz');windows=pd.read_csv(folder/'windows.csv')
        self.assertEqual(len(windows),24)
        self.assertEqual(windows.groupby('condition').run_id.nunique().to_dict(),
                         {'flash_crowd':2,'simulated_flood':2})
        self.assertEqual(len(config['times_and_splits']),5*3*3)
        for info in config['times_and_splits']:
            self.assertFalse(set(info['train_runs'])&set(info['validation_runs']))
            self.assertFalse(set(windows.run_id)&(set(info['train_runs'])|set(info['validation_runs'])))
            if info['model']=='mlp':
                c=info['validation_candidates'];best=max(x['validation_macro_f1'] for x in c)
                self.assertEqual(info['epochs'],next(x['max_iter'] for x in c if x['validation_macro_f1']==best))
        for _,g in pred.groupby(['split','seed']):
            self.assertEqual(set(g.model),{'rf','mlp','transformer'})
            self.assertTrue(all(set(x.window_id)==set(windows.window_id) for _,x in g.groupby('model')))

    def test_idle_observed_before_each_run_and_after_last(self):
        source=ROOT.parent/'evidence'/'paired-flood'
        runs=sorted((json.loads(f.read_text(encoding='utf8')) for f in source.glob('ids-control-*.json')),
                    key=lambda r:r['created_at_epoch'])
        checks=[json.loads(line) for line in (source/'idle_observations.jsonl').read_text().splitlines()]
        passed=[x['observed_at_epoch'] for x in checks if x['sufficient_for_next_run']]
        self.assertEqual(len(runs),4);self.assertEqual(len(passed),5)
        self.assertEqual([r['assigned_condition'] for r in runs],
                         ['flash_crowd','simulated_flood','simulated_flood','flash_crowd'])
        for i,run in enumerate(runs):
            self.assertLessEqual(passed[i],run['created_at_epoch'])
            self.assertLess(run['recorded_at_epoch'],passed[i+1])


if __name__=='__main__':unittest.main()
