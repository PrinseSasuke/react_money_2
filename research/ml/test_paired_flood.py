import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import matched_control as control
import paired_flood as pair


class PairTest(unittest.TestCase):
    def test_conditions_use_same_bounded_request(self):
        with patch.multiple(control,SCRIPT=control.SCRIPT,NOMINAL_RATE=control.NOMINAL_RATE,
                            MAX_RATE=control.MAX_RATE,EXPERIMENT_VERSION=control.EXPERIMENT_VERSION,
                            RECOVERY_WAIT=control.RECOVERY_WAIT,OUT=control.OUT):
            pair.configure()
            self.assertIn("rate:150, timeUnit:'1s', duration:'300s'",control.SCRIPT)
            self.assertEqual(control.MAX_RATE,150)
            self.assertEqual(control.RECOVERY_WAIT,60)
            self.assertNotIn('simulated_flood',control.SCRIPT)
            self.assertNotIn('flash_crowd',control.SCRIPT)
            cm,job=control.manifest('ids-control-flat-test','flat')
            self.assertEqual(cm['data']['script.js'],control.SCRIPT)
            self.assertEqual(job['spec']['template']['spec']['containers'][0]['env'][0]['value'],'flat')


if __name__=='__main__':unittest.main()
