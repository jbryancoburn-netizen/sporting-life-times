"""Regression checks: in-progress Loyola–Air Force must advance, not freeze."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh_mbb_live_scores import reconcile, update, eastern_day

def game(away=56,home=69,state='in',id='401911230'):
    return {'id':id,'date':'2026-11-11T20:00Z','state':state,
            'status':'12:54 - 2nd','teams':[
                {'id':'2350','name':'Loyola Chicago','score':str(away)},
                {'id':'2005','name':'Air Force','score':str(home)}]}

class FastMbbScores(unittest.TestCase):
    def test_eastern_day_not_utc_day(self):
        self.assertEqual(eastern_day('2026-11-12T02:00Z'),'2026-11-11')

    def test_loyola_air_force_live_advance(self):
        result=reconcile(game(),game(88,97))
        self.assertEqual([t['score'] for t in result['teams']],['88','97'])
        self.assertEqual(result['state'],'in')

    def test_old_in_game_response_cannot_regress_score(self):
        self.assertEqual(reconcile(game(88,97),game(56,69)),game(88,97))

    def test_final_cannot_return_to_pregame(self):
        self.assertEqual(reconcile(game(88,97,'post'),game(0,0,'pre')),game(88,97,'post'))

    def test_final_not_fabricated_from_live(self):
        self.assertEqual(reconcile(game(),game(88,97))['state'],'in')

    def test_wrong_teams_are_not_overlaid(self):
        invalid=game(88,97)
        invalid['teams'][0]['id']='999'
        self.assertEqual(reconcile(game(),invalid),game())

    def test_merge_preserves_rest_of_slate(self):
        old={'games':[game()]+[game(0,0,'pre',str(i)) for i in range(5)]}
        incoming=[game(88,97)]+[game(0,0,'pre',str(i)) for i in range(5)]
        result,ids=update(old,incoming,'2026-11-11T22:30:00+00:00','2026-11-11')
        self.assertEqual(len(result['games']),6)
        self.assertEqual(ids,['401911230'])
        self.assertEqual([x['state'] for x in result['games'] if x['id']=='401911230'],['in'])

    def test_incomplete_feed_cannot_replace_full_schedule(self):
        old={'games':[game()]+[game(0,0,'pre',str(i)) for i in range(10)]}
        with self.assertRaises(ValueError):
            update(old,[game()], '2026-11-11T22:30:00+00:00','2026-11-11')

if __name__=='__main__':
    unittest.main()
