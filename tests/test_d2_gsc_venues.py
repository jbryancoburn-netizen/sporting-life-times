import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("dii_gsc_venue_test",ROOT/"scripts/d2_gsc_official.py")
MOD=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class GSCExactUniversityArenaEvidence(unittest.TestCase):
    def test_official_schedules_58_unique_matchups_both_genders(self):
        data=json.loads((ROOT/"data/d2-gsc-venue-evidence-2026-27.json").read_text())
        records=data["fixtures"]
        self.assertEqual(len(records),58)
        self.assertEqual(sum(x["gender"]=="men" for x in records),20)
        self.assertEqual(sum(x["gender"]=="women" for x in records),38)
        keys=[(x["gender"],x["date"],x["away"],x["home"]) for x in records]
        self.assertEqual(len(set(keys)),len(keys))
        for item in records:
            self.assertTrue(item["source_url"].startswith("https://"))
            self.assertIn(item["source_role"],("home","away"))
            self.assertEqual(item["source_school"],
                             item[item["source_role"]])

    def test_exact_match_updates_venue_without_changing_id_or_results(self):
        source=json.loads((ROOT/"data/d2-gsc-venue-evidence-2026-27.json").read_text())
        f=next(x for x in source["fixtures"] if x["gender"]=="women" and x["home"]=="university-of-alabama-in-huntsville")
        game={"id":"preserved-ncaa-id","date":f["date"],"away":f["away"],"home":f["home"],
              "conference_game":True,"neutral":False,"verified":True,
              "status":"scheduled","away_score":None,"home_score":None,"elo_eligible":True}
        games={game["id"]:game}
        status=MOD.enrich_gsc_venue_evidence(games,"women")
        self.assertEqual(status["matched"],1)
        self.assertEqual(game["venue"],f["venue"])
        self.assertEqual(game["venue_source_url"],f["source_url"])
        self.assertEqual(game["id"],"preserved-ncaa-id")
        self.assertIsNone(game["away_score"])

    def test_mismatched_or_neutral_site_does_not_receive_fake_arena(self):
        f=json.loads((ROOT/"data/d2-gsc-venue-evidence-2026-27.json").read_text())["fixtures"][0]
        blank={"id":"different-match","date":f["date"],"away":f["home"],"home":f["away"],
               "conference_game":True,"neutral":False}
        neutral={"id":"neutral-game","date":f["date"],"away":f["away"],"home":f["home"],
                 "conference_game":True,"neutral":True}
        status=MOD.enrich_gsc_venue_evidence({"a":blank,"b":neutral},"men")
        self.assertEqual(status["matched"],0)
        self.assertNotIn("venue",blank)
        self.assertNotIn("venue",neutral)

    def test_conflicting_existing_arena_is_quarantined(self):
        evidence=json.loads((ROOT/"data/d2-gsc-venue-evidence-2026-27.json").read_text())
        f=evidence["fixtures"][0]
        fixture={"id":"unmodified","date":f["date"],"away":f["away"],"home":f["home"],
                 "conference_game":True,"neutral":False,"venue":"Other Named Arena"}
        result=MOD.enrich_gsc_venue_evidence({"x":fixture},"men")
        self.assertEqual(result["conflicted"],1)
        self.assertEqual(fixture["venue"],"Other Named Arena")


if __name__=="__main__":
    unittest.main()
