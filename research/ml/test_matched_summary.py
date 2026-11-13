import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd
import summarize_matched


class MatchedSummaryTest(unittest.TestCase):
    def test_uses_only_successful_job_and_post_warmup_samples(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); source = root / 'source'; source.mkdir(); out = root / 'out'; data_dir=root/'data'; data_dir.mkdir()
            np.savez_compressed(data_dir/'sequences.npz', X=np.ones((3,18,2)), features=['rps_total','pg_tps'])
            pd.DataFrame({'class':['norm','fault','attack']}).to_csv(data_dir/'windows.csv',index=False)
            rps = {str(t): (120 if 1185 <= t <= 1295 else 999) for t in range(1000,1310,10)}
            pg = {str(t): (100 if 1185 <= t <= 1295 else 999) for t in range(1000,1310,10)}
            ok = {'status':'success','run_id':'x','profile':'flat','repeat':0,
                  'k6_log':'K6_SETUP_UNIX_MS=1000000',
                  'raw_series':{'rps_total':rps, 'pg_tps':pg}}
            (source/'ids-control-one.json').write_text(json.dumps(ok))
            (source/'ids-control-two.json').write_text(json.dumps({'status':'failed'}))
            with patch.object(summarize_matched,'SOURCE',source), patch.object(summarize_matched,'DEST',out), \
                 patch.object(summarize_matched,'DATA',data_dir):
                summarize_matched.main()
            rows = json.loads((out/'matched_control_summary.json').read_text(encoding='utf-8'))
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['features']['rps_total']['median'],120)
            self.assertEqual(rows[0]['features']['rps_total']['samples'],6)
            self.assertEqual(sum(rows[0]['historical_rf_predictions'].values()),6)
            self.assertTrue((out/'matched_control.png').exists())


if __name__ == '__main__': unittest.main()
