#!/usr/bin/env python3
"""Matched 401 control: synthetic misconfiguration vs password guessing.

Both send 10 requests/s to the same own lab endpoint and use an intentionally
synthetic address in the .invalid domain. No account discovery is attempted.
"""
import argparse
import json
from pathlib import Path
import matched_control as control
import labctl

LOGIN = 'http://traefik.kube-system.svc.cluster.local/api/auth/login'
SCRIPT = r'''
import http from 'k6/http';
import { check } from 'k6';
http.setResponseCallback(http.expectedStatuses(401));
export const options = {scenarios:{load:{executor:'constant-arrival-rate',
  rate:10,timeUnit:'1s',duration:'300s',preAllocatedVUs:10,maxVUs:80}},
  thresholds:{http_req_failed:['rate<0.01'],checks:['rate>0.99'],dropped_iterations:['count<100']}};
export function setup() { console.log('K6_SETUP_UNIX_MS='+Date.now()); }
export default function() {
  const password = __ENV.PROFILE === 'flat' ? 'P0000000' :
      'P'+String((__ITER % 9999999)+1).padStart(7,'0');
  const body = JSON.stringify({email:'ids-8f4e9a7d6c5b4a3e2d1c0b9a@example.invalid',password});
  const r = http.post('http://traefik.kube-system.svc.cluster.local/api/auth/login',body,
    {headers:{'Content-Type':'application/json'},timeout:'10s'});
  check(r, {'expected 401':(x)=>x.status===401});
}
'''


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--execute', action='store_true')
    ap.add_argument('--repeat', type=int, choices=range(1,6), default=5)
    args=ap.parse_args()
    control.SCRIPT=SCRIPT
    control.ENDPOINT=LOGIN
    control.MAX_RATE=control.NOMINAL_RATE=10
    control.USE_TOKEN=False
    control.EXPERIMENT_VERSION='auth401-v1'
    control.OUT=Path(__file__).resolve().parent/'evidence'/'auth-pair'
    if not args.execute:
        print(json.dumps({'target':LOGIN,'profiles':{'flat':'synthetic_fault',
             'burst':'synthetic_guessing'},'rate_rps':10,'repeat':args.repeat},indent=2))
        return
    labctl.kubectl('-n',control.NS,'get','networkpolicy',labctl.NETPOL)
    if not labctl._egress_test(): raise RuntimeError('Egress verification failed')
    if not labctl.Prom().up(): raise RuntimeError('Prometheus is not healthy')
    for i in range(args.repeat):
        for profile in (('flat','burst') if i%2==0 else ('burst','flat')):
            control.run_one(profile,i)


if __name__=='__main__': main()
