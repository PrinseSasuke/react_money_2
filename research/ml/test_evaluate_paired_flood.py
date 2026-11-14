import unittest
import evaluate_paired_flood as evaluation


class ExtractionTest(unittest.TestCase):
    def test_only_full_in_run_histories(self):
        values={str(t):150 for t in range(1000,1310,10)}
        data={'run_id':'x','status':'success','assigned_condition':'simulated_flood',
              'nominal_rate_rps':150,'profile':'flat','k6_log':'K6_SETUP_UNIX_MS=1000000',
              'pod_phase':'Succeeded','job_status':{'succeeded':1},
              'container_statuses':[{'state':{'terminated':{'exitCode':0}}}],
              'raw_series':{'rps_total':values}}
        rows,seq=evaluation.extract(data,['rps_total'])
        self.assertEqual(len(rows),6)
        self.assertTrue(all(1235<=row['window_end']<=1295 for row in rows))
        self.assertTrue(all(len(s)==18 for s in seq))
        data['status']='failed'
        with self.assertRaises(ValueError):evaluation.extract(data,['rps_total'])
        data['status']='success';data['container_statuses'][0]['state']['terminated']['exitCode']=1
        with self.assertRaises(ValueError):evaluation.extract(data,['rps_total'])


if __name__=='__main__':unittest.main()
