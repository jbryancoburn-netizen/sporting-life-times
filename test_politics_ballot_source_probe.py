"""Official source health must never turn changed documents into candidate guesses."""
import copy
import datetime as dt
import hashlib
import json
import unittest
from scripts.politics_ballot_source_probe import collect
from scripts.politics_ballot_audit import ROOT

class SourceProbeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT / "politics-official-ballots.json").read_text())

    def fake(self, url):
        return {"http_status": 200, "sha256": hashlib.sha256(url.encode()).hexdigest(),
                "content_type":"text/html", "content_bytes": 50}

    def test_first_probe_keeps_candidates_unchanged_and_uncertified(self):
        d=copy.deepcopy(self.data)
        out=collect(d, fetch=self.fake, now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(out["sources_accessible"],6)
        self.assertFalse(out["forecast_eligible"])
        self.assertEqual(len(d["races"]),46)
        self.assertTrue(all(x["candidate_rows_automatically_updated"] is False for x in out["sources"]))

    def test_changed_document_requires_review_not_auto_rewrite(self):
        d=copy.deepcopy(self.data)
        previous={"sources":[{"id":"NCSBE_2026_GENERAL","last_good_sha256":"a"*64}]}
        out=collect(d, previous=previous, fetch=self.fake)
        self.assertTrue(out["sources"][0]["requires_candidate_review"])
        self.assertEqual(out["sources_changed_since_last_probe"],1)
        self.assertFalse(out["forecast_eligible"])

    def test_network_failure_preserves_prior_good_hash(self):
        def fail(url): raise OSError("site temporarily unavailable")
        prior={"sources":[{"id":"NCSBE_2026_GENERAL","last_good_sha256":"1"*64}]}
        out=collect(self.data, previous=prior, fetch=fail)
        self.assertEqual(out["sources_accessible"],0)
        self.assertEqual(out["sources"][0]["last_good_sha256"],"1"*64)
        self.assertTrue(out["sources"][0]["requires_candidate_review"])

    def test_unapproved_official_link_fails_before_network_call(self):
        d=copy.deepcopy(self.data)
        d["sources"][0]["url"]="https://untrusted.example/ballots"
        with self.assertRaises(ValueError):
            collect(d,fetch=self.fake)

if __name__=="__main__":unittest.main()
