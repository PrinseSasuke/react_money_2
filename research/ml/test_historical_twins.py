import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


class TwinReportTest(unittest.TestCase):
    def test_each_scenario_model_has_five_grouped_splits(self):
        data=pd.read_csv(ROOT/'historical_proportional'/'twin_run_summary.csv')
        self.assertEqual(len(data),6*3)
        self.assertEqual(set(data.model),{'rf','mlp','transformer'})
        self.assertTrue((data['count']==5).all())
        self.assertTrue(data['mean'].between(0,1).all())
        self.assertTrue((data.unique_test_runs>=4).all())


if __name__=='__main__':unittest.main()
