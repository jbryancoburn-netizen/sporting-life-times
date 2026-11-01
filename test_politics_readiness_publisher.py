"""One ownership of source-readiness JSON; unchanged inputs cause no write."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import politics_sim_readiness as readiness

class PublisherTests(unittest.TestCase):
    def test_readiness_is_stable_if_only_timestamp_changes(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            with patch.object(readiness,"ROOT",root):
                readiness.main()
                filename=root/"politics-sim-readiness.json"
                first=json.loads(filename.read_text())
                self.assertEqual(first["certified_original_probability_count"],0)
                first["evaluated_at"]="1999-01-01T00:00:00+00:00"
                filename.write_text(json.dumps(first,indent=2)+"\n")
                readiness.main()
                second=json.loads(filename.read_text())
                self.assertEqual(second["evaluated_at"],"1999-01-01T00:00:00+00:00")
                self.assertEqual(second["counts"],first["counts"])
                (root/"politics-history.json").write_text(json.dumps({"winner_party_totals_reconciled":True}))
                readiness.main()
                third=json.loads(filename.read_text())
                self.assertNotEqual(third["evaluated_at"],"1999-01-01T00:00:00+00:00")
                self.assertEqual(third["counts"]["verified"],1)
                self.assertFalse(third["house_forecast_ready"])

if __name__=="__main__":
    unittest.main()
