"""Record SHA-256 of all four archived negative-control runs and their logs."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'evidence'/'paired-flood'


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    runs=sorted(SOURCE.glob('ids-control-*.json'))
    if len(runs)!=4:raise ValueError('Exactly four raw runs required')
    raw=[json.loads(p.read_text(encoding='utf8')) for p in runs]
    if any(r.get('status')!='success' for r in raw):raise ValueError('An archived run failed')
    files=runs+[SOURCE/'idle_observations.jsonl',SOURCE/'paired-flood.log']
    if not all(p.is_file() for p in files):raise ValueError('Missing control log or idle observations')
    result={'collection':'paired-flood','description':'Controlled identical-request negative control; no real DoS established.',
      'remote':'~/react-money/research/paired-run/evidence/paired-flood/',
      'run_log_remote':'~/react-money/research/paired-run/paired-flood.log',
      'code_sha256':{name:digest(ROOT/name) for name in ('paired_flood.py','matched_control.py','labctl.py','series.py')},
      'files':[{'file':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in files]}
    (ROOT/'ml'/'paired_flood_manifest.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
