"""NCAA soccer postseason integrity checks. Run with unittest; network-free."""
import json
import math
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'data'

def load(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8'))

class PostseasonTest(unittest.TestCase):
    def setUp(self):
        self.conf=load('college-soccer-conferences.json')
        self.table=load('college-soccer-miaa-standings.json')
        self.model=load('college-soccer-elo.json')
        self.rules=load('college-soccer-postseason-rules.json')

    def test_rule_provenance(self):
        self.assertEqual(self.rules['ncaa']['men-d1']['field'],48)
        self.assertEqual(self.rules['ncaa']['men-d1']['seeded_teams'],24)
        self.assertEqual(self.rules['ncaa']['men-d1']['first_round_byes'],16)
        self.assertEqual(self.rules['ncaa']['women-d1']['field'],64)
        self.assertEqual(self.rules['ncaa']['women-d1']['automatic_bids'],31)
        self.assertEqual(self.rules['ncaa']['men-d1']['automatic_bids'],23)
        for key,rule in self.rules['ncaa'].items():
            self.assertTrue(rule.get('sources') or rule.get('official_source'),key)
            if key.endswith('d2') or key.endswith('d3'):
                self.assertEqual(rule['status'],'rules_pending',key)

    def test_complete_miaa_membership(self):
        members=self.conf['conferences']['men-d3:miaa']['teams']
        actual=self.table['rows']
        self.assertEqual(len(members),8)
        self.assertEqual(len(set(members)),8)
        self.assertEqual(set(members),{x['team_id'] for x in actual})
        self.assertEqual(self.rules['conferences']['men-d3:miaa']['tournament']['field'],6)
        self.assertTrue(self.table.get('checked_at_utc') or self.table.get('checked_date'))
        # A conference-table source may not establish the date of the latest individual result.
        self.assertIn('last_verified_game_date',self.table)

    def test_experimental_probabilities_sum_to_one(self):
        table={x['team_id']:x for x in self.table['rows']}
        ratings={x['team_id']:x for x in self.model['cohorts']['men-d3']}
        ids=sorted(self.conf['conferences']['men-d3:miaa']['teams'],
                   key=lambda k:(-table[k]['conference_points'],-ratings[k]['elo']))[:6]
        def win(a,b):
            advantage=55 if ids.index(a)<ids.index(b) else -55
            return 1/(1+10**(-(ratings[a]['elo']-ratings[b]['elo']+advantage)/400))
        def first(a,b):
            p=win(a,b)
            return {a:p,b:1-p}
        def semi(automatic,possibilities):
            out={}
            for opponent,initial in possibilities.items():
                p=win(automatic,opponent)
                out[automatic]=out.get(automatic,0)+initial*p
                out[opponent]=out.get(opponent,0)+initial*(1-p)
            return out
        a=semi(ids[0],first(ids[3],ids[4]))
        b=semi(ids[1],first(ids[2],ids[5]))
        odds={x:0.0 for x in ids}
        for lhs,prob_a in a.items():
            for rhs,prob_b in b.items():
                p=win(lhs,rhs)
                odds[lhs]+=prob_a*prob_b*p
                odds[rhs]+=prob_a*prob_b*(1-p)
        self.assertEqual(len(odds),6)
        self.assertTrue(all(math.isfinite(p) and 0<=p<=1 for p in odds.values()))
        self.assertAlmostEqual(sum(odds.values()),1.0,places=12)
        print('MIAA experimental bracket title forecast:',{ratings[k]['team']:round(v,4) for k,v in odds.items()})

if __name__=='__main__':
    unittest.main()
