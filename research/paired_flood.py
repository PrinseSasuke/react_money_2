#!/usr/bin/env python3
"""Bounded same-endpoint negative control for flash-crowd versus simulated flood.

Both conditions deliberately send identical requests from the same lab source.
Condition is an experimental assignment, not evidence of actual DoS or intent.
"""
import argparse
import json
import time
from pathlib import Path
import matched_control as control

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'evidence'/'paired-flood'


def configure():
    old="rate:120, timeUnit:'1s', duration:'300s'"
    new="rate:150, timeUnit:'1s', duration:'300s'"
    if control.SCRIPT.count(old)!=1:
        raise RuntimeError('Unexpected control script; refuse to modify workload')
    control.SCRIPT=control.SCRIPT.replace(old,new)
    control.NOMINAL_RATE=150
    control.MAX_RATE=150  # Only the constant profile is allowed by this runner.
    control.EXPERIMENT_VERSION='same-request-flash-flood-v1'
    control.RECOVERY_WAIT=60
    control.OUT=OUT


def await_idle(logfile, timeout=600):
    """Wait for two ready backend replicas and idle signals; fail closed."""
    deadline=time.monotonic()+timeout
    prom=control.labctl.Prom()
    while True:
        snap=control.recovery_snapshot(prom,2)
        snap['target_hpa_replicas']=2
        snap['sufficient_for_next_run']=(snap['limited_idle_readiness_check_passed'] and
            snap['values']['ready_backend']==2 and snap['values']['hpa_replicas']==2)
        with logfile.open('a',encoding='utf8') as stream:
            stream.write(json.dumps(snap,ensure_ascii=False)+'\n')
        if snap['sufficient_for_next_run']:
            return
        if time.monotonic()>=deadline:
            raise TimeoutError('Idle/readiness/HPA target not observed before next run')
        time.sleep(30)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--repeat',type=int,choices=[1,2],default=2)
    args=parser.parse_args()
    configure()
    order=[(i,label) for i in range(args.repeat) for label in
           (('flash_crowd','simulated_flood') if i%2==0 else ('simulated_flood','flash_crowd'))]
    print(json.dumps({'endpoint':control.ENDPOINT,'nominal_rps':150,'duration_s':300,
        'sequence':order,'request_identity':'identical','real_dos_claimed':False},indent=2),flush=True)
    if not args.execute:return
    control.labctl.kubectl('-n',control.NS,'get','networkpolicy',control.labctl.NETPOL)
    control.labctl.kubectl('-n','loadtest','get','secret','loadtest-token','-o','name')
    control.labctl.kubectl('-n','react-money','get','secret','react-money-secrets','-o','name')
    if not control.labctl._egress_test() or not control.labctl.Prom().up():
        raise RuntimeError('Preflight failed')
    OUT.mkdir(parents=True,exist_ok=True)
    for repeat,condition in order:
        await_idle(OUT/'idle_observations.jsonl')
        control.run_one('flat',repeat,condition=condition)
    await_idle(OUT/'idle_observations.jsonl')
    print('paired-flood collection complete',flush=True)


if __name__=='__main__':main()
