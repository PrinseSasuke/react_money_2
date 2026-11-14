#!/usr/bin/env python3
"""Small matched-endpoint control, with timestamped raw telemetry.

Two synthetic traffic profiles use exactly the same endpoint and credentials.
Profiles are not claimed to represent confirmed attacks or legitimate users.
Run only on the authorised isolated k3s lab. Never target arbitrary URLs.
"""
import argparse
import base64
import datetime as dt
import hashlib
import hmac
import json
import time
import uuid
from pathlib import Path

import labctl
import series

NS = 'redlab'
ENDPOINT = 'http://traefik.kube-system.svc.cluster.local/api/auth/me'
IMAGE = 'grafana/k6:latest'
MAX_RATE = 180
NOMINAL_RATE = 120
DURATION = 300
USE_TOKEN = True
EXPERIMENT_VERSION = 'matched-ramp30s-v2'
RECOVERY_WAIT = 0
OUT = Path(__file__).resolve().parent / 'evidence' / 'matched-control'

SCRIPT = r'''
import http from 'k6/http';
import { check } from 'k6';
const varying = __ENV.PROFILE === 'burst';
const scenario = varying ? {
  executor: 'ramping-arrival-rate', startRate: 180, timeUnit: '1s',
  stages: [
    {duration:'30s',target:60}, {duration:'30s',target:180},
    {duration:'30s',target:60}, {duration:'30s',target:180},
    {duration:'30s',target:60}, {duration:'30s',target:180},
    {duration:'30s',target:60}, {duration:'30s',target:180},
    {duration:'30s',target:60}, {duration:'30s',target:180}],
  preAllocatedVUs: 50, maxVUs: 350
} : {
  executor: 'constant-arrival-rate', rate:120, timeUnit:'1s', duration:'300s',
  preAllocatedVUs:50, maxVUs:350
};
export const options = {scenarios:{load:scenario}, thresholds:{
  http_req_failed:['rate<0.10'], checks:['rate>0.99'], dropped_iterations:['count<1000']}};
export function setup() { console.log('K6_SETUP_UNIX_MS='+Date.now()); }
export default function() {
  const r = http.get('http://traefik.kube-system.svc.cluster.local/api/auth/me',
      {headers:{Authorization:`Bearer ${__ENV.TOKEN}`}, timeout:'10s'});
  check(r, {'status 200': (x) => x.status === 200});
}
'''


def manifest(name, profile):
    if profile not in ('flat', 'burst'):
        raise ValueError('unknown profile')
    labels = {'app.kubernetes.io/part-of': 'ids-matched-control', 'ids-run': name}
    cm = {'apiVersion':'v1', 'kind':'ConfigMap', 'metadata':{'name':name, 'namespace':NS,
           'labels':labels}, 'data':{'script.js':SCRIPT}}
    job = {'apiVersion':'batch/v1', 'kind':'Job', 'metadata':{'name':name, 'namespace':NS,
           'labels':labels}, 'spec':{'backoffLimit':0, 'activeDeadlineSeconds':390,
           'ttlSecondsAfterFinished':3600, 'template':{'metadata':{'labels':labels}, 'spec':{
             'restartPolicy':'Never', 'automountServiceAccountToken':False,
             'containers':[{'name':'k6', 'image':IMAGE, 'args':['run','--quiet','/scripts/script.js'],
               'env':[{'name':'PROFILE','value':profile},
                      {'name':'TOKEN','valueFrom':{'secretKeyRef':{'name':name+'-token','key':'TOKEN'}}}],
               'resources':{'requests':{'cpu':'100m','memory':'128Mi'},
                            'limits':{'cpu':'500m','memory':'512Mi'}},
               'volumeMounts':[{'name':'script','mountPath':'/scripts','readOnly':True}]}],
             'volumes':[{'name':'script','configMap':{'name':name}}]}}}}
    if not USE_TOKEN:
        job['spec']['template']['spec']['containers'][0]['env'] = [{'name':'PROFILE','value':profile}]
    return cm, job


def write_json(path, data):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)


def recovery_snapshot(prom, before_ready):
    """Limited idle/readiness check, not proof of full application recovery."""
    measurements={k:prom.instant(series.SERIES[k]) for k in
                  ('rps_total','rps_5xx','ready_backend','pg_up','hpa_replicas')}
    measurements['traefik_up']=prom.instant('min(up{job="traefik"})')
    measurements['postgres_exporter_up']=prom.instant('min(up{job="postgres-exporter"})')
    measurements['kube_state_metrics_up']=prom.instant('min(up{job="kube-state-metrics"})')
    finite=all(measurements[k] is not None for k in ('rps_total','rps_5xx','ready_backend','pg_up'))
    ok=(finite and before_ready is not None and before_ready > 0 and
        all(measurements[x]==1 for x in ('traefik_up','postgres_exporter_up','kube_state_metrics_up')) and
        measurements['rps_total'] < 5 and
        measurements['rps_5xx'] < 0.1 and measurements['ready_backend'] >= before_ready and
        measurements['pg_up'] == 1)
    return {'observed_at_epoch':time.time(),'values':measurements,'baseline_ready_backend':before_ready,
            'limited_idle_readiness_check_passed':bool(ok),
            'caveat':'No complete recovery or HPA settling is implied by this limited check.'}


def ephemeral_secret(name):
    """Issue a short-lived token for the existing lab user without logging secrets."""
    source = json.loads(labctl.kubectl('-n','loadtest','get','secret','loadtest-token','-o','json'))
    old = base64.b64decode(source['data']['TOKEN']).decode('utf-8')
    payload = old.split('.')[1]
    previous = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    secret = json.loads(labctl.kubectl('-n','react-money','get','secret','react-money-secrets','-o','json'))
    key = base64.b64decode(secret['data']['JWT_SECRET'])
    def enc(value):
        return base64.urlsafe_b64encode(value).rstrip(b'=')
    now = int(time.time())
    header = enc(json.dumps({'alg':'HS256','typ':'JWT'}, separators=(',',':')).encode())
    body = enc(json.dumps({'userId':previous['userId'], 'iat':now, 'exp':now+1800},
                          separators=(',',':')).encode())
    signature = enc(hmac.new(key, header+b'.'+body, hashlib.sha256).digest())
    token = header+b'.'+body+b'.'+signature
    return {'apiVersion':'v1', 'kind':'Secret', 'metadata':{'name':name+'-token','namespace':NS,
            'labels':{'app.kubernetes.io/part-of':'ids-matched-control','ids-run':name}},
            'type':'Opaque', 'data':{'TOKEN':base64.b64encode(token).decode()}}


def run_one(profile, rep, condition=None):
    name = f'ids-control-{profile}-{uuid.uuid4().hex[:8]}'
    cm, job = manifest(name, profile)
    record = {'run_id':name, 'profile':profile, 'repeat':rep, 'endpoint':ENDPOINT,
              'duration_s':DURATION, 'nominal_rate_rps':NOMINAL_RATE, 'max_rate_rps':MAX_RATE,
              'experiment_version':EXPERIMENT_VERSION,
              'workload_script_sha256':hashlib.sha256(SCRIPT.encode('utf-8')).hexdigest(),
              'collector_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'status':'created', 'created_at_epoch':time.time(), 'queries':series.SERIES,
              'caveat':'Both profiles are synthetic controlled load; profile labels do not establish malicious intent.'}
    if condition is not None:
        record['assigned_condition'] = condition
        record['caveat'] = ('Assigned conditions describe the experimenter intent only; '
                            'identical requests do not establish a real malicious attack or denial of service.')
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f'{name}.json'
    write_json(target, record)
    try:
        if RECOVERY_WAIT:
            record['baseline_ready_backend']=labctl.Prom().instant(series.SERIES['ready_backend'])
        for obj in ((ephemeral_secret(name), cm, job) if USE_TOKEN else (cm, job)):
            labctl.kubectl('create','-f','-',input=json.dumps(obj))
        deadline = time.monotonic() + 420
        pod = None; status = None
        while time.monotonic() < deadline:
            status = json.loads(labctl.kubectl('-n',NS,'get','job',name,'-o','json'))
            pods = json.loads(labctl.kubectl('-n',NS,'get','pods','-l',f'job-name={name}','-o','json'))
            if pods['items']:
                pod = pods['items'][0]
            state = status.get('status') or {}
            if state.get('succeeded') or state.get('failed'):
                break
            time.sleep(5)
        else:
            raise TimeoutError('Job did not complete within 420 seconds')
        record['job_status'] = status.get('status')
        if pod:
            record['pod_phase'] = (pod.get('status') or {}).get('phase')
            record['container_statuses'] = (pod.get('status') or {}).get('containerStatuses')
            pod_name = pod['metadata']['name']
            record['k6_log'] = labctl.kubectl('-n',NS,'logs',pod_name,check=False)
        record['status'] = 'success' if (status.get('status') or {}).get('succeeded') else 'failed'
        if RECOVERY_WAIT:
            record['recovery_wait_s'] = RECOVERY_WAIT
            time.sleep(RECOVERY_WAIT)
            record['recovery'] = recovery_snapshot(labctl.Prom(),record.get('baseline_ready_backend'))
        # Save samples and query expressions immediately, with actual Prometheus timestamps.
        stop = time.time()
        start = record['created_at_epoch'] - 180
        prom = labctl.Prom()
        record['raw_series'] = {key: prom.range(query, start, stop, step=10)
                                for key, query in series.SERIES.items()}
        record['query_start_epoch'] = start; record['query_end_epoch'] = stop
    except BaseException as error:
        record['status'] = 'error'; record['error_type'] = type(error).__name__
        record['error'] = 'Run failed; inspect job events locally without exposing secrets.'
        raise
    finally:
        record['recorded_at_epoch'] = time.time()
        write_json(target, record)
        labctl.kubectl('-n',NS,'delete','job',name,'--ignore-not-found','--wait=false',check=False)
        labctl.kubectl('-n',NS,'delete','configmap',name,'--ignore-not-found','--wait=false',check=False)
        if USE_TOKEN:
            labctl.kubectl('-n',NS,'delete','secret',name+'-token','--ignore-not-found','--wait=false',check=False)
    if record['status'] != 'success':
        raise RuntimeError(f'{name} did not complete successfully; see {target}')
    print(f'{name}: {record["status"]}, saved {target}', flush=True)


def main():
    global RECOVERY_WAIT, OUT
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--execute', action='store_true', help='run controlled load on authorised lab')
    ap.add_argument('--repeat', type=int, default=2, choices=[1,2,3])
    ap.add_argument('--recovery-s',type=int,default=0,choices=[0,60],help='seconds to observe idle recovery')
    ap.add_argument('--out',type=Path,default=OUT)
    args = ap.parse_args()
    RECOVERY_WAIT=args.recovery_s; OUT=args.out
    if not args.execute:
        print(json.dumps({'target':ENDPOINT, 'profiles':['flat','burst'], 'repeat':args.repeat,
                          'max_rate_rps':MAX_RATE,'duration_s':DURATION,
                          'recovery_wait_s':RECOVERY_WAIT,'output':str(OUT)}, indent=2))
        return
    labctl.kubectl('-n', NS, 'get', 'networkpolicy', labctl.NETPOL)
    labctl.kubectl('-n', 'loadtest', 'get', 'secret', 'loadtest-token', '-o', 'name')
    labctl.kubectl('-n', 'react-money', 'get', 'secret', 'react-money-secrets', '-o', 'name')
    if not labctl._egress_test():
        raise RuntimeError('Egress verification failed; refusing to start')
    if not labctl.Prom().up():
        raise RuntimeError('Prometheus is not healthy')
    # Balanced order to avoid pairing all flat and then all burst trials.
    for i in range(args.repeat):
        for profile in (('flat','burst') if i % 2 == 0 else ('burst','flat')):
            run_one(profile, i)


if __name__ == '__main__': main()
