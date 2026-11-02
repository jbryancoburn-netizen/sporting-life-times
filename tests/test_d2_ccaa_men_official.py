#!/usr/bin/env python3
"""Offline evidence, reciprocity and NCAA preservation tests: CCAA 2026-27 men."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import d2_ccaa_men_official as c

def make_pages(flip=None,duplicate=None):
    names={k:v[0] for k,v in c.ALIASES.items()}
    allids=list(c.SOURCES.values())+['merced']
    rows={k:[] for k in allids}
    pairs=[];n=0
    for i,a in enumerate(allids):
        for b in allids[i+1:]:
            day=dt.date(2026,11,25)+dt.timedelta(days=n)
            n+=1
            pairs.append((day.isoformat(),a,b))
            rows[a].append((day,b,'Home'))
            rows[b].append((day,a,'Away'))
    htmls={}
    for sid,owner in c.SOURCES.items():
        title=f"2026-2027 {names[owner]} Men's Basketball Schedule - CCAA"
        out=[]
        for day,opp,role in rows[owner]:
            value=names[opp] if role=='Home' else 'at '+names[opp]
            if flip==(owner,day.isoformat(),opp):
                value='at '+names[opp] if role=='Home' else names[opp]
            cells=[day.strftime('%-m/%-d/%Y'),'*',value,'Arena City','7:30 p.m.']
            row='<tr>'+''.join(f'<td>{v}</td>' for v in cells)+'</tr>'
            out.append(row)
            if duplicate==(owner,day.isoformat(),opp):out.append(row)
        htmls[c.BASE+str(sid)]='<html><head><title>'+title+'</title></head><body><table><tr>'+''.join(
            f'<th>{h}</th>' for h in ('Date','*','Opponent','Location','Time/Result'))+'</tr>'+''.join(out)+'</table></body></html>'
    rows_out=[]
    for day,opp,role in rows['merced']:
        cells=[day.strftime('%B %d, %Y (%A)'),'7:30 PM',role,names[opp],'Merced CA']
        rows_out.append('<tr>'+''.join(f'<td>{v}</td>' for v in cells)+'</tr>')
    title="2026-27 Men's Basketball Schedule - University of California Merced"
    htmls[c.MERCED]='<html><head><title>'+title+'</title></head><body><table><tr>'+''.join(
        f'<th>{h}</th>' for h in ('Date','Time','At','Opponent','Location'))+'</tr>'+''.join(rows_out)+'</table></body></html>'
    return htmls,pairs

class TestCCAA(unittest.TestCase):
    def setUp(self):
        self.teams={k:{'name':v[0],'conference':'CCAA'} for k,v in c.ALIASES.items()}
        self.today=dt.date(2026,11,1)
    def call(self,pages,games=None,teams=None):
        if games is None:games={}
        report=c.enrich_ccaa_men(games,teams or self.teams,self.today,
                                  fetcher=lambda url:pages[url])
        return report,games
    def test_14_source_titles_91_reciprocal_school_pairs(self):
        pages,pairs=make_pages()
        self.assertEqual(len(pages),14)
        for sid in c.SOURCES:
            owner,rows,_=c.parse_league(pages[c.BASE+str(sid)],sid)
            self.assertEqual(len(rows),13)
        self.assertEqual(len(c.parse_merced(pages[c.MERCED])[1]),13)
        report,games=self.call(pages)
        self.assertEqual(report['schools_read'],14)
        self.assertEqual(report['reciprocal_games'],91)
        self.assertEqual(report['added'],91)
        self.assertEqual(report['mutually_verified_et_tipoffs'],91)
        self.assertEqual(len(games),91)
        self.assertTrue(all(g['status']=='scheduled' and g['start_time'].endswith(' ET')
                            and len(g['official_schedule_sources'])==2 for g in games.values()))
    def test_wrong_gender_season_owner_and_conf_are_rejected(self):
        pages,_=make_pages()
        sid=5197;html=pages[c.BASE+str(sid)]
        for altered in [html.replace("Men's Basketball","Women's Basketball"),
                        html.replace('2026-2027','2025-2026'),
                        html.replace('Cal Poly Humboldt','Cal Poly Pomona'),
                        html.replace('CCAA','Different League')]:
            with self.assertRaises(ValueError):c.parse_league(altered,sid)
        with self.assertRaises(ValueError):c.parse_merced(
            pages[c.MERCED].replace("Men's Basketball","Women's Basketball"))
    def test_missing_school_calendar_never_generates_unilateral_fixtures(self):
        pages,_=make_pages()
        pages.pop(c.BASE+'5209')
        report,games=self.call(pages)
        self.assertEqual(report['schools_read'],13)
        self.assertEqual(report['added'],78)
        self.assertEqual(report['one_sided'],13)
        self.assertEqual(len(games),78)
    def test_home_away_conflict_and_duplicate_withheld(self):
        _,pairs=make_pages()
        day,a,b=pairs[0]
        pages,_=make_pages(flip=(a,day,b),duplicate=(b,day,a))
        report,games=self.call(pages)
        self.assertEqual(report['added'],90)
        self.assertGreater(report['quarantined'],0)
    def test_preserve_existing_ncaa_id_final_score_and_idempotence(self):
        pages,pairs=make_pages()
        day,a,b=pairs[0]
        games={'ncaa-verified-11':{'id':'ncaa-verified-11','date':day,'away':b,'home':a,
            'status':'final','away_score':82,'home_score':86,'venue':'Verified University Arena',
            'network':'Official Sports Stream','elo_change_home':6.1}}
        report,updated=self.call(pages,games)
        self.assertEqual(report['added'],90)
        self.assertEqual(report['enriched'],1)
        self.assertEqual(updated['ncaa-verified-11']['away_score'],82)
        self.assertEqual(updated['ncaa-verified-11']['venue'],'Verified University Arena')
        self.assertEqual(updated['ncaa-verified-11']['network'],'Official Sports Stream')
        second,_=self.call(pages,games)
        self.assertEqual(second['added'],0)
        self.assertEqual(second['enriched'],0)
    def test_pending_elo_or_duplicate_institutional_identity_is_held(self):
        pages,_=make_pages()
        pending=dict(self.teams)
        pending['merced']=dict(pending['merced'],not_eligible_for_dii_elo=True)
        rep,actual=self.call(pages,teams=pending)
        self.assertEqual(rep['added'],78)  # Only the 13 eligible schools may be published.
        self.assertTrue(all(g['away']!='merced' and g['home']!='merced' for g in actual.values()))
        ambiguous=dict(self.teams)
        ambiguous['second-humboldt']={'name':'Humboldt State','conference':'CCAA'}
        rep,_=self.call(pages,teams=ambiguous)
        self.assertEqual(rep['added'],0)
    def test_missing_fresno_star_can_be_second_witness_but_never_sole_conference_claim(self):
        pages,pairs=make_pages()
        fresno_url=c.BASE+'5206'
        # Official Fresno 2026-27 grid omits stars on many actual league games.
        # The other university must mark the conference game explicitly.
        pages[fresno_url]=pages[fresno_url].replace('<td>*</td>','<td></td>')
        report,games=self.call(pages)
        self.assertEqual(report['added'],90)
        self.assertEqual(report['unmarked_both_held'],1)  # Merced has no conference marker.
        # Take one specific Fresno/other-school matchup, remove its other
        # school's marker too; two unmarked pages cannot certify conference status.
        date,a,b=next((d,x,y) for d,x,y in pairs if 'fresno' in (x,y))
        other=b if a=='fresno' else a
        other_url=c.BASE+str(next(i for i,name in c.SOURCES.items() if name==other))
        day_text=dt.date.fromisoformat(date).strftime('%-m/%-d/%Y')
        original=pages[other_url]
        marker=f'<tr><td>{day_text}</td><td>*</td>'
        self.assertIn(marker,original)
        pages[other_url]=original.replace(marker,f'<tr><td>{day_text}</td><td></td>',1)
        second,after=self.call(pages)
        self.assertEqual(second['added'],89)
        self.assertGreaterEqual(second['unmarked_both_held'],2)
        self.assertFalse(any(g['date']==date and 'fresno' in (g['away'],g['home'])
                             for g in after.values()))
    def test_conflicting_pacific_clocks_not_assigned(self):
        pages,pairs=make_pages()
        day,a,b=pairs[0]
        url=c.BASE+str(next(sid for sid,key in c.SOURCES.items() if key==a))
        pages[url]=pages[url].replace('7:30 p.m.','8:30 p.m.',1)
        report,games=self.call(pages)
        self.assertEqual(report['time_disagreements'],1)
        one=[g for g in games.values() if g['date']==day][0]
        self.assertNotIn('start_time',one)

if __name__=='__main__':
    unittest.main()
