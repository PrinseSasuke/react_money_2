"""Inspect Prometheus TSDB block metadata without extracting or modifying an archive."""
import argparse
import datetime as dt
import hashlib
import json
import tarfile
from pathlib import Path


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    digest=hashlib.sha256()
    with args.archive.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
    blocks=[]; wal_members=0; head_members=0
    with tarfile.open(args.archive,'r|gz') as archive:
        for item in archive:
            name=item.name.removeprefix('./')
            if name.startswith('prometheus/wal/'):wal_members+=1
            if name.startswith('prometheus/chunks_head/'):head_members+=1
            if name.startswith('prometheus/') and name.endswith('/meta.json'):
                source=archive.extractfile(item)
                if source:
                    metadata=json.load(source)
                    blocks.append({'name':name,'min_ms':metadata['minTime'],'max_ms':metadata['maxTime']})
    if not blocks:raise ValueError('No Prometheus block metadata found')
    iso=lambda ms:dt.datetime.fromtimestamp(ms/1000,dt.timezone.utc).isoformat()
    result={'archive_name':args.archive.name,'archive_size':args.archive.stat().st_size,
      'sha256':digest.hexdigest(),'blocks':len(blocks),
      'earliest_block_utc':iso(min(x['min_ms'] for x in blocks)),
      'latest_block_exclusive_utc':iso(max(x['max_ms'] for x in blocks)),
      'wal_members':wal_members,'head_members':head_members,
      'caveat':'Only block metadata inspected. WAL/head timestamps and complete recoverability were not verified.',
      'block_metadata':blocks}
    if args.out:args.out.write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in result.items() if k!='block_metadata'},indent=2))


if __name__=='__main__':main()
