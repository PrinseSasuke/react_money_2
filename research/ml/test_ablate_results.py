import json
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class AblationTest(unittest.TestCase):
    def check_dataset(self,folder,base):
        path=ROOT/folder;config=json.loads((path/'config.json').read_text())
        self.assertEqual(set(config['groups']),{'none','network_io','database','http_network'})
        for group,drop in config['groups'].items():
            self.assertFalse(set(drop)&set(config['features_retained'][group]))
        metrics=json.loads((path/'metrics.json').read_text())
        self.assertEqual(len(metrics),5*4*3*3)
        for row in metrics:
            if row['model']=='mlp':
                c=row['validation_candidates'];best=max(x['validation_macro_f1'] for x in c)
                self.assertEqual(row['selected_epoch_or_limit'],next(x['max_iter'] for x in c if x['validation_macro_f1']==best))
        p=pd.read_csv(path/'predictions.csv.gz')
        for _,g in p.groupby(['split','seed']):
            self.assertEqual(set(g.ablation),set(config['groups']))
            self.assertEqual(set(g.model),{'rf','mlp','transformer'})
            samples=[set(zip(x.window_id,x.truth)) for _,x in g.groupby(['model','ablation'])]
            self.assertTrue(all(s==samples[0] for s in samples[1:]))
        old=pd.read_csv(ROOT/base/'predictions.csv.gz')
        old=old[(old.fraction==1)&(~old.temporal)&(old.model!='rules')]
        new=p[p.ablation=='none']
        keys=['split','seed','model','window_id','run_id','truth','prediction']
        self.assertEqual(set(map(tuple,old[keys].to_numpy())),set(map(tuple,new[keys].to_numpy())))
        replay=json.loads((path/'transformer_selection.json').read_text())
        self.assertEqual(replay['status'],'complete')
        self.assertEqual(len(replay['records']),5*4*3)
        original={(r['split'],r['ablation'],r['seed']):r for r in metrics if r['model']=='transformer'}
        for row in replay['records']:
            self.assertTrue(1<=row['best_epoch']<=row['completed_epochs']<=25)
            self.assertEqual(row['completed_epochs'],original[(row['split'],row['ablation'],row['seed'])]['selected_epoch_or_limit'])
            self.assertGreater(row['prediction_windows_verified'],0)

    def test_verified(self):self.check_dataset('ablation_verified','verified_proportional')
    def test_historical(self):self.check_dataset('ablation_historical','historical_proportional')


if __name__=='__main__':unittest.main()
