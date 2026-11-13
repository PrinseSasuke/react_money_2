import argparse
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import labctl


class FakeProm:
    def range(self, query, start, end, step=10):
        return {float(t): float(t) for t in range(int(start), int(end) + 1, step)}


class ExportTest(unittest.TestCase):
    def test_raw_archive_and_sequence_timestamps(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            journal = root / 'journal.jsonl'
            journal.write_text(json.dumps({'run_id':'r1', 'scenario':'baseline', 'class':'norm',
                'technique':None, 'baseline_start':1000, 'start_ts':1000, 'end_ts':1240,
                'recovery_end':1240}), encoding='utf-8')
            args = argparse.Namespace(action='build', archive_raw=True, window=30, sample_step=10,
                                      step=10, seq_len=18, buffer=30)
            with patch.object(labctl, 'HERE', root), patch.object(labctl, 'JOURNAL', journal), \
                 patch.object(labctl, 'DATASET_CSV', root / 'dataset.csv'), \
                 patch.object(labctl, 'WINDOWS_CSV', root / 'windows.csv'), \
                 patch.object(labctl, 'Prom', FakeProm):
                self.assertEqual(labctl.cmd_dataset(args), 0)
            raw = json.loads((root / 'evidence/raw/r1.json').read_text(encoding='utf-8'))
            self.assertEqual(raw['step_s'], 10)
            self.assertTrue(raw['queries'] and raw['series'])
            with (root / 'windows.csv').open(encoding='utf-8', newline='') as f:
                rows = list(csv.DictReader(f))
            self.assertIn('sample_ts', rows[0])
            self.assertEqual(float(rows[1]['sample_ts']) - float(rows[0]['sample_ts']), 10)


if __name__ == '__main__': unittest.main()
