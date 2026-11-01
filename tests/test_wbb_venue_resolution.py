"""Exact ID binding and safety for independently documented women's neutral venues."""
import importlib.util
import pathlib
import unittest

p=pathlib.Path(__file__).resolve().parents[1]/"scripts/wbb-verified-neutral-sites.py"
spec=importlib.util.spec_from_file_location("verified_wbb_neutral",p)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    ids=["2","275"]+[str(i) for i in range(3000,3361)]
    ids=ids[:363]
    teams={i:{"games":[]} for i in ids}
    teams["2"]["games"]=[{
        "id":"401999771","date":"2026-11-26T00:30:00Z",
        "opponent_id":"275","home_id":"2","away_id":"275",
        "site":"neutral","venue":"Coliseo Guillermo Angulo"
    }]
    record={
        "date":"2026-11-25","team_id":"2","opponent_id":"275",
        "opponent":"Wisconsin Badgers","site":"neutral",
        "venue":"Coliseo Guillermo Angulo, Puerto Rico",
        "primary_source":"https://auburntigers.com/sports/womens-basketball/schedule",
        "corroborating_source":"https://www.sanjuanshootout.com/"
    }
    return {"season":"2026-27","gender":"women","teams":teams},{
        "season":"2026-27","gender":"women","records":[record]}


class NeutralSourceTests(unittest.TestCase):
 def test_eastern_date_and_exact_opponent_not_utc_day(self):
  cal,evidence=fixture()
  result=module.resolve(cal,evidence)
  self.assertEqual(result["verified_unique_games"],1)
  self.assertEqual(result["games"][0]["game_id"],"401999771")
  self.assertEqual(result["games"][0]["verified_site"],"neutral")

 def test_wrong_season_sport_or_school_rejected(self):
  cal,evidence=fixture()
  with self.assertRaises(RuntimeError):
   module.resolve({**cal,"gender":"men"},evidence)
  with self.assertRaises(RuntimeError):
   module.resolve(cal,{**evidence,"season":"2025-26"})
  evidence["records"][0]["opponent_id"]="87"
  with self.assertRaises(RuntimeError):
   module.resolve(cal,evidence)

 def test_duplicate_or_insecure_university_source_rejected(self):
  cal,evidence=fixture()
  evidence["records"].append(dict(evidence["records"][0]))
  with self.assertRaises(RuntimeError):
   module.resolve(cal,evidence)
  evidence["records"]=evidence["records"][:1]
  evidence["records"][0]["corroborating_source"]="http://uncorroborated.invalid"
  with self.assertRaises(RuntimeError):
   module.resolve(cal,evidence)

 def test_espn_home_away_identity_never_rewritten(self):
  cal,evidence=fixture()
  cal["teams"]["2"]["games"][0]["site"]="home"
  result=module.resolve(cal,evidence)
  self.assertEqual(result["games"][0]["published_site"],"home")
  self.assertEqual(result["games"][0]["verified_site"],"neutral")
  self.assertEqual(cal["teams"]["2"]["games"][0]["site"],"home")


if __name__=="__main__":
 unittest.main()
