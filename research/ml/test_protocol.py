import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd

from experiment_audited import aggregated, nested_subset, split_groups
import train


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.meta = pd.DataFrame([{'scenario': f's{s}', 'run_id': f'{s}_{r:02}'}
                                  for s in range(3) for r in range(10)])

    def test_split_disjoint_and_scenario_coverage(self):
        for i in range(5):
            train, validation, test = map(set, split_groups(self.meta, i))
            self.assertFalse(train & validation or train & test or validation & test)
            for subset in (train, validation, test):
                self.assertEqual({r.split('_')[0] for r in subset}, {'0', '1', '2'})

    def test_subsets_nested_and_disjoint_from_test(self):
        train, validation, test = split_groups(self.meta, 0)
        a, b, c = [set(nested_subset(self.meta, train, x, 0)) for x in (.5, .75, 1.)]
        self.assertTrue(a <= b <= c)
        self.assertFalse(c.intersection(validation) or c.intersection(test))

    def test_temporal_split_uses_timestamp_not_run_id(self):
        meta = pd.DataFrame([{'scenario':'s','run_id':'z','window_end':1},
                             {'scenario':'s','run_id':'m','window_end':2},
                             {'scenario':'s','run_id':'a','window_end':3}])
        train, validation, test = split_groups(meta, 0, temporal=True)
        self.assertEqual(test, ['a'])
        self.assertEqual(validation, ['m'])
        self.assertEqual(train, ['z'])

    def test_aggregates_ignore_missing_and_preserve_missingness(self):
        X = np.array([[[1.], [np.nan], [3.]]])
        actual = aggregated(X)[0]
        np.testing.assert_allclose(actual[[0, 1, 2, 4, 5]], [2, 1, 3, .1, 1/3])

    def test_sample_timestamps_not_used_as_features(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'windows.csv'
            pd.DataFrame([{'window_id':'a','run_id':'r','step_idx':i,'class':'norm',
              'technique':'','boundary':0,'sample_ts':1000+i*10,'metric':i}
              for i in range(2)]).to_csv(p,index=False)
            with patch.object(train, 'WINDOWS', p):
                seq, features = train.load_sequences(T=2)
            self.assertEqual(features, ['metric'])
            np.testing.assert_array_equal(seq['a'][0].reshape(-1), [0,1])


if __name__ == '__main__':
    unittest.main()
