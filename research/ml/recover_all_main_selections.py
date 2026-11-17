"""Replay the three published Transformer comparisons sequentially on Aspire."""
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=Path.home()/'diploma'/'article-acer-reproduction'


def main():
    completed=[]
    for data,base in [('verified','verified_proportional'),('prepared','historical_proportional'),
                      ('prepared-strict','strict_proportional')]:
        subprocess.run([sys.executable,str(ROOT/'ml'/'recover_main_transformer_selection.py'),
          '--data',str(ROOT/'evidence'/data),'--base',str(ROOT/'ml'/base),
          '--out',str(OUT/(base+'-selection.json'))],check=True)
        completed.append(base)
        (OUT/'main-selection-status.json').write_text(json.dumps({'completed':completed},indent=2),encoding='utf8')
    print('All three comparison replays completed',flush=True)


if __name__=='__main__':main()
