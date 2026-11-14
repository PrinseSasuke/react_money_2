import json
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class ProportionalTest(unittest.TestCase):
    def check_output(self,folder,meta_path):
        path=ROOT/folder;config=json.loads((path/'config.json').read_text())
        self.assertEqual((config['subset_mode'],config['mlp_selection']),('proportional','grouped'))
        subsets=json.loads((path/'train_subsets.json').read_text())
        splits=json.loads((path/'splits.json').read_text())
        metadata=pd.read_csv(meta_path)
        for split in splits:
            selected=sorted([x for x in subsets if x['split']==split['split']],key=lambda x:x['fraction'])
            n=len(split['train']);scenarios=set(metadata[metadata.run_id.isin(split['train'])].scenario)
            for row in selected:
                runs=set(row['train_runs'])
                self.assertEqual(len(runs),max(len(scenarios),int(n*row['fraction']+.5)))
                self.assertTrue(runs<=set(split['train']))
                self.assertEqual(set(metadata[metadata.run_id.isin(runs)].scenario),scenarios)
            self.assertTrue(set(selected[0]['train_runs'])<=set(selected[1]['train_runs'])<=set(selected[2]['train_runs']))
        metrics=json.loads((path/'metrics.json').read_text())
        self.assertEqual(len(metrics),6*3*3*4)
        for m in (r for r in metrics if r['model']=='mlp'):
            candidates=m['validation_candidates'];best=max(c['validation_macro_f1'] for c in candidates)
            self.assertEqual(m['epochs'],next(c['max_iter'] for c in candidates if c['validation_macro_f1']==best))
        preds=pd.read_csv(path/'predictions.csv.gz')
        for _,g in preds.groupby(['split','fraction','seed']):
            self.assertEqual(set(g.model),{'rf','mlp','transformer','rules'})
            sets=[set(zip(x.window_id,x.truth)) for _,x in g.groupby('model')]
            self.assertTrue(all(x==sets[0] for x in sets[1:]))

    def test_verified(self):
        self.check_output('verified_proportional',ROOT.parent/'evidence'/'verified'/'windows.csv')

    def test_historical(self):
        self.check_output('historical_proportional',ROOT.parent/'evidence'/'prepared'/'windows.csv')


if __name__=='__main__':unittest.main()
