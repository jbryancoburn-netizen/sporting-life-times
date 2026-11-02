#!/usr/bin/env python3
"""Offline safety checks for official 2026-27 MIAA two-school reconciliation."""
import datetime as dt
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import d2_miaa_official as m

def sample(gender='men',flip=None,duplicate=None):
    names={key:aliases[1] if len(aliases)>1 else aliases[0] for key,aliases in m.ALIASES.items()}
    ids=m.SOURCES[gender]
    keys=list(ids.values())
    rows={key:[] for key in keys}
    pair_map=[]
    n=0
    for i,a in enumerate(keys):
        for b in keys[i+1:]:
            day=(dt.date(2026,11,2)+dt.timedelta(days=n)).strftime('%m/%d/%Y')
            n+=1
            rows[a].append((day,names[b],a,b))
            rows[b].append((day,'at '+names[a],a,b))
            pair_map.append((day,a,b))
    pages={}
    for sid,owner in ids.items():
        label=names[owner]
        sport="Men's" if gender=='men' else "Women's"
        title=f"2026-2027 {label} {sport} Basketball - Schedule - Mid-America Intercollegiate Athletics Association"
        entries=[]
        for date,opp,a,b in rows[owner]:
            if flip==(owner,a,b):opp=opp[3:] if opp.startswith('at ') else 'at '+opp
            entries.append(f'<tr><td>{date}</td><td>{opp}</td><td>Joplin, Mo.</td><td>7:30 P.M.</td></tr>')
            if duplicate==(owner,a,b):entries.append(entries[-1])
        pages[sid]="<html><head><title>"+title+"</title></head><body><table><tr>"+''.join(
            f'<th>{h}</th>' for h in ('Date','Opponent','Location','Time/Result'))+"</tr>"+''.join(entries)+"</table></body></html>"
    return pages,pair_map

class TestMiaa(unittest.TestCase):
    def setUp(self):
        self.teams={key:{'name':aliases[0],'conference':'MIAA'} for key,aliases in m.ALIASES.items()}
        self.date=dt.date(2026,11,1)
    def run_reconciliation(self,gender='men',pages=None,games=None):
        pages=pages or sample(gender)[0]
        return m.enrich_miaa(gender,games if games is not None else {},self.teams,self.date,
            fetcher=lambda url:pages[int(url.split('=')[-1])])
    def test_28_calendar_titles_match_exact_gender_and_season(self):
        for gender in ('men','women'):
            pages,_=sample(gender)
            for sid in m.SOURCES[gender]:
                rows,bad=m.parse(pages[sid],gender,sid)
                self.assertEqual(len(rows),13)
            result=self.run_reconciliation(gender,pages)
            self.assertEqual(result['source_school_calendars'],14)
            self.assertEqual(result['added'],91)
            self.assertEqual(result['reciprocal_games'],91)
            self.assertEqual(result['one_sided'],0)
    def test_wrong_gender_school_or_year_is_rejected(self):
        pages,_=sample('men')
        sid=next(iter(pages))
        html=pages[sid]
        with self.assertRaises(ValueError):m.parse(html,'women',sid)
        with self.assertRaises(ValueError):m.parse(html.replace('2026-2027','2025-2026'),'men',sid)
        with self.assertRaises(ValueError):m.parse(html.replace("Men's Basketball","Men's Soccer"),'men',sid)
        with self.assertRaises(ValueError):m.parse(html.replace('Mid-America Intercollegiate Athletics Association','Example'),'men',sid)
    def test_no_unilateral_games_after_source_failure(self):
        pages,_=sample()
        pages.pop(next(iter(pages)))
        games={}
        report=m.enrich_miaa('men',games,self.teams,self.date,
                            fetcher=lambda url:pages[int(url.split('=')[-1])])
        self.assertEqual(report['source_school_calendars'],13)
        self.assertEqual(report['added'],78)
        self.assertEqual(report['one_sided'],13)
        self.assertEqual(len(games),78)
    def test_wrong_home_away_and_duplicate_claims_are_quarantined(self):
        _,pairs=sample()
        _,a,b=pairs[0]
        pages,_=sample(flip=(a,a,b),duplicate=(b,a,b))
        report=m.enrich_miaa('men',{},self.teams,self.date,
                            fetcher=lambda url:pages[int(url.split('=')[-1])])
        self.assertEqual(report['added'],90)
        self.assertGreater(report['quarantined'],0)
    def test_preserve_existing_verified_final_and_idempotence(self):
        pages,pairs=sample()
        date,a,b=pairs[0]
        iso=dt.datetime.strptime(date,'%m/%d/%Y').date().isoformat()
        existing={'ncaa-343':{'id':'ncaa-343','date':iso,'away':b,'home':a,'status':'final',
                              'away_score':67,'home_score':71,'venue':'Verified Arena',
                              'network':'Official Stream','elo_change_home':3.2}}
        report=m.enrich_miaa('men',existing,self.teams,self.date,
                             fetcher=lambda url:pages[int(url.split('=')[-1])])
        self.assertEqual(report['added'],90)
        self.assertEqual(report['enriched'],1)
        self.assertEqual(existing['ncaa-343']['away_score'],67)
        self.assertEqual(existing['ncaa-343']['venue'],'Verified Arena')
        self.assertEqual(len(existing['ncaa-343']['official_schedule_sources']),2)
        again=m.enrich_miaa('men',existing,self.teams,self.date,
                             fetcher=lambda url:pages[int(url.split('=')[-1])])
        self.assertEqual(again['added'],0)
        self.assertEqual(again['enriched'],0)
    def test_duplicate_member_identifiers_stop_release(self):
        teams=dict(self.teams)
        teams['alias']={'name':'Missouri Southern State University','conference':'MIAA'}
        report=m.enrich_miaa('women',{},teams,self.date,fetcher=lambda _: '')
        self.assertEqual(report['added'],0)
        self.assertEqual(report['status'],'MIAA identity validation incomplete; withheld')

if __name__=='__main__':unittest.main()
