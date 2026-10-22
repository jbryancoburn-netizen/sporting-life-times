import unittest
from reconcile import reconcile,identity
def game(provider,score=None,state="pre"):
 return {"id":provider,"date":"2026-10-22T18:00:00Z","provider":provider,"state":state,"teams":[{"name":"Chicago Cubs","score":score},{"name":"Tampa Bay Rays","score":2 if score is not None else None}]}
def block(p,g):return {"league":"MLB","provider":p,"games":[g]}
class ReconcileTests(unittest.TestCase):
 def test_official_wins(self):
  l,c=reconcile([block("espn",game("espn"))],[block("mlb_stats",game("mlb_stats"))])
  self.assertEqual(l[0]["games"][0]["provider"],"mlb_stats")
 def test_finals_conflict_quarantined(self):
  l,c=reconcile([block("espn",game("espn",3,"post"))],[block("mlb_stats",game("mlb_stats",4,"post"))])
  self.assertEqual(len(l[0]["games"]),0);self.assertEqual(len(c),1)
 def test_identical_final_kept(self):
  l,c=reconcile([block("espn",game("espn",3,"post"))],[block("mlb_stats",game("mlb_stats",3,"post"))])
  self.assertEqual(len(l[0]["games"]),1);self.assertEqual(c,[])
 def test_fallback_without_official(self):
  l,c=reconcile([block("espn",game("espn"))],[])
  self.assertEqual(len(l[0]["games"]),1)
 def test_normalized_team_names(self):
  a=game("a");b=game("b");b["teams"][0]["name"]="Chicago-Cubs"
  self.assertEqual(identity(a,"MLB"),identity(b,"MLB"))
 def test_score_string_matches_integer(self):
  a=game("espn","3","post");b=game("mlb_stats",3,"post")
  l,c=reconcile([block("espn",a)],[block("mlb_stats",b)])
  self.assertEqual(len(c),0);self.assertEqual(l[0]["games"][0]["provider"],"mlb_stats")
 def test_same_day_doubleheader_quarantined(self):
  a=game("espn",3,"post");b=game("espn",5,"post");b["id"]="espn-second"
  l,c=reconcile([{"league":"MLB","provider":"espn","games":[a,b]}],[])
  self.assertEqual(l[0]["games"],[]);self.assertEqual(len(c),2)
 def test_explicit_doubleheader_ids_distinct(self):
  a=game("mlb_stats",3,"post");b=game("mlb_stats",5,"post")
  a["gameNumber"]=1;b["gameNumber"]=2;b["id"]="mlb-second"
  l,c=reconcile([],[{"league":"MLB","provider":"mlb_stats","games":[a,b]}])
  self.assertEqual(len(l[0]["games"]),2);self.assertFalse(c)
if __name__=="__main__":unittest.main()
