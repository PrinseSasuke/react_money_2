import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent


class SelectionTest(unittest.TestCase):
    def test_recovered_selections_match_completed_epochs(self):
        for folder in ('verified_proportional','historical_proportional','strict_proportional'):
            with self.subTest(dataset=folder):
                path=ROOT/folder
                data=json.loads((path/'transformer_selection.json').read_text())
                metrics=json.loads((path/'metrics.json').read_text())
                old={(r['split'],r['fraction'],r['seed']):r for r in metrics if r['model']=='transformer'}
                self.assertEqual(data['status'],'complete')
                self.assertEqual(len(data['records']),54)
                self.assertEqual({(r['split'],r['fraction'],r['seed']) for r in data['records']},set(old))
                for row in data['records']:
                    prior=old[(row['split'],row['fraction'],row['seed'])]
                    self.assertEqual(row['completed_epochs'],prior['epochs'])
                    self.assertTrue(1<=row['best_epoch']<=row['completed_epochs']<=25)
                    self.assertGreater(row['prediction_windows_verified'],0)
                    self.assertTrue(0<=row['best_validation_macro_f1']<=1)


if __name__=='__main__':unittest.main()
