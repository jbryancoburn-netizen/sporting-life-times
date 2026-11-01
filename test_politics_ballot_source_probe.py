"""Official source health must never turn changed documents into candidate guesses."""
import copy
import datetime as dt
import hashlib
import json
import unittest
from scripts.politics_ballot_source_probe import collect, CALIFORNIA_PDF_LIMIT, LIMIT
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
        self.assertEqual(out["sources_accessible"],len(d["sources"]))
        self.assertFalse(out["forecast_eligible"])
        self.assertGreaterEqual(len(d["races"]),46)
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

    def test_review_flag_remains_after_second_identical_poll(self):
        # A one-day difference from the reviewed source MUST remain flagged
        # even when no additional change occurs on the next day.
        base = "0"*64
        d = copy.deepcopy(self.data)
        previous={"sources":[{"id":"NCSBE_2026_GENERAL",
                             "last_good_sha256":base,
                             "review_baseline_sha256":base}]}
        first=collect(d,previous=previous,fetch=self.fake)
        row1=next(x for x in first["sources"] if x["id"]=="NCSBE_2026_GENERAL")
        self.assertTrue(row1["requires_candidate_review"])
        self.assertTrue(row1["source_content_mismatch_against_review_baseline"])
        self.assertEqual(row1["review_baseline_sha256"],base)
        second=collect(d,previous=first,fetch=self.fake)
        row2=next(x for x in second["sources"] if x["id"]=="NCSBE_2026_GENERAL")
        self.assertFalse(row2["changed_since_previous_probe"])
        self.assertTrue(row2["requires_candidate_review"])
        self.assertEqual(row2["review_baseline_sha256"],base)

    def test_california_pinned_source_detects_mismatch_on_first_run(self):
        d=copy.deepcopy(self.data)
        ca=next(s for s in d["sources"] if s["id"]=="CA_SOS_2026_GENERAL")
        self.assertEqual(len(ca["source_sha256"]),64)
        res=collect(d,previous={},fetch=self.fake)
        row=next(x for x in res["sources"] if x["id"]=="CA_SOS_2026_GENERAL")
        self.assertEqual(row["review_baseline_sha256"],ca["source_sha256"])
        self.assertTrue(row["requires_candidate_review"])
        self.assertTrue(row["source_content_mismatch_against_review_baseline"])
        self.assertEqual(row["baseline_provenance"],"official_state_source_pinned_at_candidate_review")

    def test_fingerprint_matched_ca_not_flagged(self):
        d=copy.deepcopy(self.data)
        ca=next(s for s in d["sources"] if s["id"]=="CA_SOS_2026_GENERAL")
        def fetch(u):
            result=self.fake(u)
            if u==ca["url"]:
                result.update(sha256=ca["source_sha256"],content_type="application/pdf")
            return result
        out=collect(d,fetch=fetch)
        row=next(x for x in out["sources"] if x["id"]=="CA_SOS_2026_GENERAL")
        self.assertFalse(row["requires_candidate_review"])
        self.assertEqual(row["baseline_provenance"],"official_state_source_pinned_at_candidate_review")
        self.assertGreater(CALIFORNIA_PDF_LIMIT,14_833_345)
        self.assertLess(LIMIT,14_833_345)

    def test_temporary_outage_keeps_original_review_baseline(self):
        d=copy.deepcopy(self.data)
        first=collect(d,fetch=self.fake)
        def unavailable(u):raise OSError("temporary network issue")
        failed=collect(d,previous=first,fetch=unavailable)
        self.assertEqual(failed["sources_accessible"],0)
        for a,b in zip(first["sources"],failed["sources"]):
            self.assertEqual(b["review_baseline_sha256"],a["review_baseline_sha256"])
            self.assertTrue(b["requires_candidate_review"])

    def test_unapproved_official_link_fails_before_network_call(self):
        d=copy.deepcopy(self.data)
        d["sources"][0]["url"]="https://untrusted.example/ballots"
        with self.assertRaises(ValueError):
            collect(d,fetch=self.fake)

if __name__=="__main__":unittest.main()
