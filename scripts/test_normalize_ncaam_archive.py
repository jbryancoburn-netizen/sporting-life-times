#!/usr/bin/env python3
"""Offline tests for strict NCAA archive candidate conversion."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("norm",Path(__file__).with_name("normalize_ncaam_archive.py"))
norm=importlib.util.module_from_spec(spec);spec.loader.exec_module(norm)
def archive(neutral=False):
    return {"day":"2026-03-01","source_url":"https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/2026/03/01/all-conf",
            "canonical_url":"https://www.ncaa.com/scoreboard/basketball-men/d1/2026/03/01/all-conf",
            "raw_sha256":"a"*64,"payload":{"games":[{"game":{
                "gameID":"123","gameState":"final","neutralSite":neutral,
                "home":{"teamId":1,"names":{"full":"Indiana"},"score":"81"},
                "away":{"teamId":2,"names":{"full":"Purdue"},"score":"75"}
            }}]}}
class NormalizationTests(unittest.TestCase):
    def test_basic_final(self):
        rows,bad=norm.parse(archive())
        self.assertFalse(bad)
        self.assertEqual(rows[0][0]["game_id"],"ncaa:123")
        self.assertEqual(rows[0][0]["site"],"home")
    def test_neutral(self):
        rows,bad=norm.parse(archive(True))
        self.assertFalse(bad)
        self.assertEqual(rows[0][0]["site"],"neutral")
    def test_no_unverified_team_names_as_ids(self):
        a=archive()
        del a["payload"]["games"][0]["game"]["away"]["teamId"]
        rows,bad=norm.parse(a)
        self.assertFalse(rows)
        self.assertEqual(len(bad),1)
    def test_no_implicit_venue(self):
        a=archive()
        del a["payload"]["games"][0]["game"]["neutralSite"]
        rows,bad=norm.parse(a)
        self.assertFalse(rows)
        self.assertIn("venue",bad[0]["reason"] .replace("neutral-site status","venue"))
    def test_report_not_promoted_as_d1(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);p=root/"source"/"2026"/"03";p.mkdir(parents=True)
            (p/"01.json").write_text(json.dumps(archive()))
            result=norm.convert(root/"source",root/"games.csv",root/"teams.json",root/"audit.json")
            self.assertFalse(result["release_ready"])
            self.assertEqual(result["unique_finals"],1)
            self.assertEqual(json.loads((root/"teams.json").read_text())["teams"][0]["division"],"UNVERIFIED")
if __name__=="__main__":unittest.main()
