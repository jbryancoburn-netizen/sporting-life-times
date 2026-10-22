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
if __name__=="__main__":unittest.main()
