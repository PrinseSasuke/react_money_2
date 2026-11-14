import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import audit_fallback


class FallbackTest(unittest.TestCase):
    def test_only_removes_explicit_zero_fallback(self):
        q='100 * (sum(rate(errors[30s])) or on() vector(0)) / sum(rate(total[30s]))'
        self.assertEqual(audit_fallback.no_fallback(q),
                         '100 * (sum(rate(errors[30s]))) / sum(rate(total[30s]))')
        self.assertEqual(audit_fallback.no_fallback('sum(up)'),'sum(up)')


if __name__=='__main__':unittest.main()
