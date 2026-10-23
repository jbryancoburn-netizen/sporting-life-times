"""Offline ESPN scoreboard replay tests: no network or third-party ratings."""
import unittest
from datetime import date
from replay_ncaam_espn_2027 import collect, replay

def inputs():
    crosswalk=[{'id':f'ncaa:{i}','espn_id':str(100+i)} for i in range(364)]
    crosswalk.append({'id':'pending-ncaa-id:west-florida','espn_id':'2697'})
    baseline={'rankings':[{'team_id':x['id'],'team':x['id'],'conference':'Test','elo':1500.}
                          for x in crosswalk]}
    return baseline,{'teams':crosswalk}

def event(event_id='4019',completed=True,away_score='70',date_utc='2026-11-03T00:30Z'):
    return {'id':event_id,'date':date_utc,
        'status':{'type':{'completed':completed,
                          'name':'STATUS_FINAL' if completed else 'STATUS_SCHEDULED'}},
        'competitions':[{'neutralSite':True,
                         'competitors':[{'team':{'id':'100'},'homeAway':'home','score':'80'},
                                        {'team':{'id':'2697'},'homeAway':'away','score':away_score}]}]}

def day(*events):
    return [{'day':'2026-11-02','events':list(events)}]

class ESPNReplayTest(unittest.TestCase):
    def test_replay_reproducible_and_zero_sum(self):
        baseline,teams=inputs()
        collected=collect(date(2026,11,2),date(2026,11,2),
                          lambda d:{'day':d.isoformat(),'events':[event()]})
        first=replay(baseline,teams,collected,date(2026,11,2))
        second=replay(baseline,teams,collected,date(2026,11,2))
        self.assertEqual(first,second)
        self.assertEqual(first['games_played'],1)
        self.assertEqual(first['rankings'][0]['team_id'],'ncaa:0')
        self.assertEqual(first['events'][0]['away'],'pending-ncaa-id:west-florida')
        self.assertAlmostEqual(sum(x['elo'] for x in first['rankings']),365*1500,places=2)
    def test_future_schedule_does_not_change_ratings(self):
        base,crosswalk=inputs()
        self.assertEqual(replay(base,crosswalk,day(event(completed=False)),date(2026,11,2))['games_played'],0)
    def test_partial_feed_fails_not_silent(self):
        with self.assertRaises(ConnectionError):
            collect(date(2026,11,2),date(2026,11,3),
                    lambda d:(_ for _ in ()).throw(ConnectionError('feed down')))
    def test_deduplication_is_idempotent(self):
        base,crosswalk=inputs()
        self.assertEqual(replay(base,crosswalk,day(event(),event()),date(2026,11,2))['games_played'],1)
    def test_conflicting_scores_fail(self):
        base,crosswalk=inputs()
        with self.assertRaisesRegex(ValueError,'Conflicting duplicate'):
            replay(base,crosswalk,day(event(),event(away_score='66')),date(2026,11,2))
    def test_invalid_final_fails(self):
        base,crosswalk=inputs()
        with self.assertRaisesRegex(ValueError,'Invalid ESPN final'):
            replay(base,crosswalk,day(event(away_score='80')),date(2026,11,2))
    def test_incomplete_crosswalk_fails(self):
        base,crosswalk=inputs()
        crosswalk['teams'].pop()
        with self.assertRaisesRegex(ValueError,'team universe'):
            replay(base,crosswalk,[],date(2026,11,2))
    def test_mismatched_crosswalk_fails(self):
        base,crosswalk=inputs()
        crosswalk['teams'][0]['id']='ncaa:9999'
        with self.assertRaisesRegex(ValueError,'team universe'):
            replay(base,crosswalk,[],date(2026,11,2))
    def test_future_final_fails(self):
        base,crosswalk=inputs()
        with self.assertRaisesRegex(ValueError,'Future-dated'):
            replay(base,crosswalk,day(event()),date(2026,11,1))
    def test_non_d1_excluded(self):
        base,crosswalk=inputs()
        unusual=event()
        unusual['competitions'][0]['competitors'][1]['team']['id']='not-d1'
        result=replay(base,crosswalk,day(unusual),date(2026,11,2))
        self.assertEqual(result['games_played'],0)
        self.assertEqual(result['excluded']['non_d1_or_unmapped'],1)

if __name__=='__main__':unittest.main()
