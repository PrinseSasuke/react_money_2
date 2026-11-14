import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd
import prepare_verified


class VerifiedDataTest(unittest.TestCase):
    def test_only_success_and_only_in_run_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); source=root/'evidence'; (source/'prepared').mkdir(parents=True)
            np.savez_compressed(source/'prepared'/'sequences.npz', features=['rps_total','pg_tps'])
            for collection in ['matched-control','auth-pair']:
                folder=source/collection; folder.mkdir()
                for profile in ['flat','burst']:
                    values={str(t):1.0 for t in range(1000,1310,10)}
                    data={'run_id':collection+'-'+profile,'profile':profile,'status':'success',
                          'k6_log':'K6_SETUP_UNIX_MS=1000000',
                          'raw_series':{'rps_total':values,'pg_tps':values}}
                    (folder/('ids-control-'+profile+'.json')).write_text(json.dumps(data))
            destination=source/'verified'
            with patch.object(prepare_verified,'ROOT',root), patch.object(prepare_verified,'SOURCE',source), \
                 patch.object(prepare_verified,'DEST',destination), \
                 patch.object(prepare_verified,'FEATURE_ORDER',['rps_total','pg_tps']): prepare_verified.main()
            meta=pd.read_csv(destination/'windows.csv')
            self.assertEqual(meta['class'].value_counts().to_dict(),{'norm':12,'fault':6,'attack':6})
            self.assertEqual(len(meta),len(np.load(destination/'sequences.npz')['X']))
            self.assertTrue(meta.window_end.between(1235,1295).all())


if __name__=='__main__': unittest.main()
