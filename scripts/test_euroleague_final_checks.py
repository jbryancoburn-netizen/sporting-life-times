"""Proof that independently verified EuroLeague finals reconcile safely with official feed."""
import unittest
import euroleague_final_checks as finals

def game(complete=False,score=(None,None)):
    return {"id":"70","date":"2026-10-23T18:15:00Z",
        "home":{"code":"OLY","score":score[0]},
        "away":{"code":"ULK","score":score[1]},
        "completed":complete}
def document(home=61,away=64):
    return {"season":"E2026","games":[{"id":"70","home":"OLY","away":"ULK",
        "score":[home,away],"source":"https://example.com/verified-club-boxscore"}]}

class FinalReconciliation(unittest.TestCase):
    def test_adding_final_once(self):
        played=[game()]
        self.assertEqual(finals.apply(played,document()),["70"])
        self.assertEqual(played[0]["home"]["score"],61)
        self.assertEqual(played[0]["away"]["score"],64)
        self.assertTrue(played[0]["completed"])
        self.assertEqual(finals.apply(played,document()),[])
    def test_conflicting_final_halts(self):
        with self.assertRaisesRegex(ValueError,"disagree"):
            finals.apply([game(True,(62,64))],document())
    def test_club_mismatch_halts(self):
        entry=document()
        entry["games"][0]["away"]="BAR"
        with self.assertRaisesRegex(ValueError,"club mismatch"):
            finals.apply([game()],entry)
    def test_unverified_duplicate_rejected(self):
        entry=document()
        entry["games"].append(dict(entry["games"][0]))
        with self.assertRaisesRegex(ValueError,"Invalid or duplicate"):
            finals.apply([game()],entry)
    def test_real_club_sources_included(self):
        doc=finals.load()
        self.assertEqual({x["id"] for x in finals.validated(doc)},{"69","70"})
        self.assertEqual({x["id"]:x["score"] for x in doc["games"]},
            {"69":[93,104],"70":[61,64]})
if __name__=="__main__":unittest.main()
