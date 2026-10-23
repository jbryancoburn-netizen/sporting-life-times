"""Regression tests for NCAA release audit, including corrupted snapshots."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_ncaa_elo_release import audit

def fixtures():
    rows=[{"rank":i+1,"team_id":f"t{i}","elo":1800-i} for i in range(365)]
    shadow=[dict(r,base_elo=r["elo"],offseason_adjustment=0.0) for r in rows]
    base={"rankings":rows,"games_played":0}
    other={"rankings":shadow,"games_played":0,
           "evidence":{"roster_programs":365,"player_matches":{"exact_id_matches":365}}}
    test={"approved_for_primary":True,"test_baseline":{"log_loss":0.6,"brier":0.2},
          "test_candidate":{"log_loss":0.55,"brier":0.18,"games":100}}
    return base,other,test

class AuditTests(unittest.TestCase):
    def test_clean_snapshot(self):
        self.assertTrue(audit(*fixtures())["primary_approved"])
    def test_bad_arithmetic(self):
        b,s,t=fixtures()
        s["rankings"][0]["elo"]+=10
        self.assertFalse(audit(b,s,t)["integrity_pass"])
    def test_duplicate_team(self):
        b,s,t=fixtures()
        s["rankings"][1]["team_id"]=s["rankings"][0]["team_id"]
        self.assertFalse(audit(b,s,t)["integrity_pass"])
    def test_unverified_roster_cannot_promote(self):
        b,s,t=fixtures()
        s["evidence"]["roster_programs"]=364
        self.assertTrue(audit(b,s,t)["integrity_pass"])
        self.assertFalse(audit(b,s,t)["primary_approved"])
    def test_worse_holdout_rejected(self):
        b,s,t=fixtures()
        t["test_candidate"]["brier"]=0.25
        self.assertFalse(audit(b,s,t)["integrity_pass"])

if __name__=="__main__":
    unittest.main()
