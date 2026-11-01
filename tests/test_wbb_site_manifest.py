"""Source site manifest must match the CURRENT women's games after a main update."""
import importlib.util
import pathlib
import unittest

src=pathlib.Path(__file__).resolve().parents[1]/"scripts/wbb-assert-site-manifest.py"
spec=importlib.util.spec_from_file_location("wbb_site_manifest",src)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def data():
 teams={str(i):{"games":[]} for i in range(363)}
 game={"id":"401000555","date":"2026-11-26T00:30:00Z",
       "site":"neutral","home_id":"2","away_id":"275","opponent_id":"275"}
 teams["2"]["games"]=[game]
 doc={"season":"2026-27","gender":"women","status":"unresolved_university_site_claims",
      "school_game_claims":1,"unique_game_ids":1,"ambiguous_vs_at_neutral":1,
      "explicit_university_site_disagreements":0,
      "games":[{"game_id":"401000555","team_id":"2","opponent_id":"275",
                "date":"2026-11-25","published_site":"neutral",
                "university_listed_site":"home",
                "review_classification":"ambiguous_vs_at_neutral_site",
                "source_url":"https://auburntigers.com/sports/womens-basketball/schedule"}]}
 return doc,{"season":"2026-27","gender":"women","teams":teams}


class ManifestCurrentCalendar(unittest.TestCase):
 def test_matching_exact_source_identity_and_eastern_day(self):
  doc,cal=data()
  self.assertEqual(mod.validate(doc,cal),(1,1))

 def test_reject_changed_game_site_date_or_opponent(self):
  doc,cal=data()
  cal["teams"]["2"]["games"][0]["site"]="home"
  with self.assertRaises(ValueError):mod.validate(doc,cal)
  doc,cal=data()
  cal["teams"]["2"]["games"][0]["opponent_id"]="183"
  with self.assertRaises(ValueError):mod.validate(doc,cal)
  doc,cal=data()
  cal["teams"]["2"]["games"][0]["date"]="2026-11-27T00:30:00Z"
  with self.assertRaises(ValueError):mod.validate(doc,cal)

 def test_reject_wrong_gender_or_counted_duplicates(self):
  doc,cal=data()
  with self.assertRaises(ValueError):mod.validate(doc,{**cal,"gender":"men"})
  doc,cal=data()
  doc["games"].append(doc["games"][0])
  with self.assertRaises(ValueError):mod.validate(doc,cal)

 def test_reject_missing_university_citation_or_incorrect_review_label(self):
  doc,cal=data()
  doc["games"][0]["source_url"]="http://not-official"
  with self.assertRaises(ValueError):mod.validate(doc,cal)
  doc,cal=data()
  doc["ambiguous_vs_at_neutral"]=0
  with self.assertRaises(ValueError):mod.validate(doc,cal)


if __name__=="__main__":
 unittest.main()
