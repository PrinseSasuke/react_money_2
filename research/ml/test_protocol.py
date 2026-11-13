import unittest
import numpy as np
import pandas as pd

from experiment_audited import aggregated, nested_subset, split_groups


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

    def test_aggregates_ignore_missing_and_preserve_missingness(self):
        X = np.array([[[1.], [np.nan], [3.]]])
        actual = aggregated(X)[0]
        np.testing.assert_allclose(actual[[0, 1, 2, 4, 5]], [2, 1, 3, .1, 1/3])


if __name__ == '__main__':
    unittest.main()
