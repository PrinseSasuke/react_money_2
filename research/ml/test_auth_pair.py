import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import auth_pair
import matched_control as control


class AuthPairTest(unittest.TestCase):
    def test_same_endpoint_fixed_rate_and_no_secrets(self):
        with patch.object(control,'SCRIPT',auth_pair.SCRIPT), patch.object(control,'USE_TOKEN',False):
            cm_a,job_a=control.manifest('ids-control-flat-aaaa','flat')
            cm_b,job_b=control.manifest('ids-control-burst-bbbb','burst')
        self.assertEqual(cm_a['data']['script.js'],cm_b['data']['script.js'])
        script=cm_a['data']['script.js']
        self.assertEqual(script.count(auth_pair.LOGIN),1)
        self.assertIn('expectedStatuses(401)',script)
        self.assertIn('rate:10',script)
        self.assertIn('@example.invalid',script)
        for job in (job_a,job_b):
            env=job['spec']['template']['spec']['containers'][0]['env']
            self.assertEqual([v['name'] for v in env],['PROFILE'])
            self.assertEqual(job['metadata']['namespace'],'redlab')


if __name__=='__main__': unittest.main()
