import json
import unittest
from pathlib import Path
import pandas as pd

HERE=Path(__file__).resolve().parent
OUT=HERE/'verified_results'
DATA=HERE.parent/'evidence'/'verified'


class VerifiedResultsTest(unittest.TestCase):
    def test_runs_classes_and_no_overlap(self):
        meta=pd.read_csv(DATA/'windows.csv')
        prep=json.loads((DATA/'preparation.json').read_text(encoding='utf8'))
        self.assertEqual(prep['runs_by_scenario'], {'auth-guessing':5,'auth-misconfiguration':5,
            'control-burst':5,'control-flat':5})
        self.assertEqual(meta['class'].value_counts().to_dict(), {'norm':60,'fault':30,'attack':30})
        for s in json.loads((OUT/'splits.json').read_text()):
            train,valid,test=map(set,(s['train'],s['valid'],s['test']))
            self.assertFalse(train&valid or train&test or valid&test)
            if s['temporal']:
                for scenario,part in meta.groupby('scenario'):
                    first=part.groupby('run_id').window_end.min()
                    a=[first[x] for x in train if x in first.index]
                    b=[first[x] for x in valid if x in first.index]
                    c=[first[x] for x in test if x in first.index]
                    self.assertLess(max(a),min(b),scenario)
                    self.assertLess(max(b),min(c),scenario)

    def test_all_models_share_test_samples(self):
        preds=pd.read_csv(OUT/'predictions.csv.gz')
        metrics=json.loads((OUT/'metrics.json').read_text())
        splits={s['split']:s for s in json.loads((OUT/'splits.json').read_text())}
        self.assertEqual(len(metrics),6*3*3*4)
        for (split,fraction,seed),g in preds.groupby(['split','fraction','seed']):
            self.assertEqual(set(g.model), {'rules','rf','mlp','transformer'})
            self.assertTrue(set(g.run_id)<=set(splits[split]['test']))
            tests=[set(zip(x.window_id,x.truth)) for _,x in g.groupby('model')]
            self.assertTrue(all(tests[0]==x for x in tests[1:]))

    def test_intensity_is_recorded_rate_not_duration(self):
        rows=pd.read_csv(OUT/'attack_intensity.csv')
        self.assertGreater(len(rows),0)
        self.assertTrue((rows.attack_rate_rps==10).all())
        self.assertTrue((rows.duration_s==300).all())

    def test_raw_job_outcomes_and_metric_timestamps(self):
        prep=json.loads((DATA/'preparation.json').read_text(encoding='utf8'))
        self.assertEqual(len(prep['runs']),20)
        for run in prep['runs'].values():
            raw=json.loads((HERE.parent/run['path']).read_text(encoding='utf8'))
            self.assertEqual(raw['status'],'success')
            self.assertEqual(raw['pod_phase'],'Succeeded')
            self.assertTrue(all(c['state']['terminated']['exitCode']==0 for c in raw['container_statuses']))
            self.assertIn('K6_SETUP_UNIX_MS=',raw['k6_log'])
            self.assertEqual(len(raw['raw_series']),21)


if __name__=='__main__':unittest.main()
