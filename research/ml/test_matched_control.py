import sys
import base64
import json
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matched_control as control


class MatchedControlTests(unittest.TestCase):
    def test_profiles_share_endpoint_and_are_bounded(self):
        flat_cm, flat = control.manifest('ids-control-flat-test', 'flat')
        burst_cm, burst = control.manifest('ids-control-burst-test', 'burst')
        self.assertEqual(flat_cm['data']['script.js'], burst_cm['data']['script.js'])
        self.assertIn(control.ENDPOINT, control.SCRIPT)
        self.assertEqual(control.MAX_RATE, 180)
        self.assertEqual(control.SCRIPT.count("duration:'30s'"), 10)
        for job in (flat, burst):
            self.assertEqual(job['metadata']['namespace'], 'redlab')
            self.assertLessEqual(job['spec']['activeDeadlineSeconds'], 390)
            container = job['spec']['template']['spec']['containers'][0]
            self.assertIn('limits', container['resources'])
            self.assertIn('secretKeyRef', container['env'][1]['valueFrom'])
            self.assertFalse(job['spec']['template']['spec']['automountServiceAccountToken'])

    def test_unknown_profile_refused(self):
        with self.assertRaises(ValueError): control.manifest('ids-control-test', 'other')

    def test_recovery_check_fails_closed_on_missing_values(self):
        class Prom:
            def __init__(self, missing=False): self.missing=missing
            def instant(self, query):
                if self.missing: return None
                if query == control.series.SERIES['ready_backend']: return 2
                if query == control.series.SERIES['pg_up'] or query.startswith('min(up'): return 1
                return 0
        self.assertTrue(control.recovery_snapshot(Prom(),2)['limited_idle_readiness_check_passed'])
        self.assertFalse(control.recovery_snapshot(Prom(missing=True),2)['limited_idle_readiness_check_passed'])

    def test_ephemeral_token_uses_lab_user_and_expires(self):
        enc = lambda b: base64.b64encode(b).decode()
        payload = base64.urlsafe_b64encode(json.dumps({'userId':7}).encode()).rstrip(b'=').decode()
        source = {'data': {'TOKEN':enc(('x.'+payload+'.x').encode())}}
        signing = {'data': {'JWT_SECRET':enc(b'test-only-key')}}
        with patch.object(control.labctl, 'kubectl', side_effect=[json.dumps(source), json.dumps(signing)]), \
             patch.object(control.time, 'time', return_value=1000):
            secret = control.ephemeral_secret('ids-control-test')
        token = base64.b64decode(secret['data']['TOKEN']).decode()
        encoded = token.split('.')[1]
        data = json.loads(base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)))
        self.assertEqual(data, {'userId':7, 'iat':1000, 'exp':2800})
        self.assertEqual(secret['metadata']['namespace'], 'redlab')
        self.assertNotIn('test-only-key', json.dumps(secret))


if __name__ == '__main__': unittest.main()
