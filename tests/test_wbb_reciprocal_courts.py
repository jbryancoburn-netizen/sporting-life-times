"""Women's reciprocal venue corrections: preserve game IDs and both school records."""
import importlib.util
import pathlib
import unittest

P=pathlib.Path(__file__).resolve().parents[1]/"scripts/wbb-apply-reciprocal-courts.py"
sp=importlib.util.spec_from_file_location("wbb_site_apply",P)
m=importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)

def fixture():
 ids=["324","2572"]+[str(i) for i in range(10000,10361)]
 d={"season":"2026-27","gender":"women","teams":{i:{"games":[]} for i in ids}}
 for tid,opp in (("324","2572"),("2572","324")):
  d["teams"][tid]["games"]=[{
    "id":"401912104","date":"2027-01-09T18:00:00Z","home_id":"2572",
    "away_id":"324","opponent_id":opp,"site":"home" if tid=="2572" else "away",
    "venue":"Incorrect source arena","completed":False,"home_score":None,"away_score":None}]
 manifest={"gender":"women","season":"2026-27","status":"reciprocal_official_home_venue_verified","games":[{
   "game_id":"401912104","date":"2027-01-09","verified_home_id":"324",
   "verified_away_id":"2572","venue":"HTC Center","city":"Conway, South Carolina",
   "sources":["https://southernmiss.com/sports/womens-basketball/schedule/text",
    "https://goccusports.com/sports/womens-basketball/schedule/text",
    "https://sunbeltsports.org/schedule.aspx?schedule=2411"]
 }]}
 return d,manifest

class Courts(unittest.TestCase):
 def test_exact_home_is_flipped_on_both_schedules_with_ids_unchanged(self):
  d,p=fixture();result=m.apply(d,p)
  host=result["teams"]["324"]["games"][0]
  guest=result["teams"]["2572"]["games"][0]
  self.assertEqual(host["home_id"],"324")
  self.assertEqual(guest["away_id"],"2572")
  self.assertEqual(host["id"],"401912104")
  self.assertEqual(guest["id"],"401912104")
  self.assertEqual((host["site"],guest["site"]),("home","away"))
  self.assertEqual((host["venue"],guest["venue"]),("HTC Center","HTC Center"))
  self.assertTrue(host["official_venue_verified"])
  self.assertEqual(len(host["official_site_source_urls"]),3)
 def test_unmatched_school_or_date_causes_no_partial_mutation(self):
  d,p=fixture()
  d["teams"]["324"]["games"][0]["date"]="2027-01-10T18:00:00Z"
  original=d["teams"]["2572"]["games"][0].copy()
  with self.assertRaises(RuntimeError):m.apply(d,p)
  self.assertEqual(d["teams"]["2572"]["games"][0],original)
 def test_wrong_gender_missing_source_or_completed_game_blocks(self):
  d,p=fixture()
  with self.assertRaises(RuntimeError):m.apply({**d,"gender":"men"},p)
  d,p=fixture();p["games"][0]["sources"]=p["games"][0]["sources"][:2]
  with self.assertRaises(RuntimeError):m.apply(d,p)
  d,p=fixture();d["teams"]["324"]["games"][0]["completed"]=True
  with self.assertRaises(RuntimeError):m.apply(d,p)
 def test_off_campus_official_host_is_recorded_as_maine_home_not_fake_campus(self):
  d,p=fixture()
  d["teams"]["311"]={"games":[{
   "id":"401913770","date":"2026-12-09T23:00:00Z",
   "home_id":"2217","away_id":"311","opponent_id":"2217",
   "site":"neutral","venue":"TBA","completed":False,"home_score":None,"away_score":None}]}
  d["teams"]["2217"]={"games":[{
   "id":"401913770","date":"2026-12-09T23:00:00Z",
   "home_id":"2217","away_id":"311","opponent_id":"311",
   "site":"neutral","venue":"TBA","completed":False,"home_score":None,"away_score":None}]}
  p["games"]=[{
   "game_id":"401913770","date":"2026-12-09",
   "verified_home_id":"311","verified_away_id":"2217",
   "venue":"Portland Expo","city":"Portland, Maine",
   "sources":[
    "https://goblackbears.com/news/2026/10/21/womens-basketball-to-host-fairfield-in-portland-tickets-on-sale-now",
    "https://goblackbears.com/sports/womens-basketball/schedule",
    "https://themetro.org/schedule.aspx?schedule=4209"]}]
  result=m.apply(d,p)
  self.assertEqual(result["teams"]["311"]["games"][0]["site"],"home")
  self.assertEqual(result["teams"]["2217"]["games"][0]["site"],"away")
  self.assertEqual(result["teams"]["311"]["games"][0]["venue"],"Portland Expo")
  self.assertEqual(result["teams"]["311"]["games"][0]["city"],"Portland, Maine")
  self.assertTrue(result["teams"]["311"]["games"][0]["official_venue_verified"])

 def test_missing_reciprocal_school_record_blocks(self):
  d,p=fixture();d["teams"]["2572"]["games"]=[]
  with self.assertRaises(RuntimeError):m.apply(d,p)
if __name__=="__main__":unittest.main()
