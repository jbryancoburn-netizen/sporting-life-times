"""Offline 2026-27 MEC: both schools corroborate actual league games."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import d2_mec_men_official as mec

def page(owner,rows,year="2026-27",gender="Men's"):
    title=f"{year} {gender} Basketball Schedule - {mec.ALIASES[owner][-1]} Athletics"
    head='<tr>'+''.join('<th>'+x+'</th>' for x in
        ('Date','Time','At','Opponent','Location','TV','Radio','Tournament','Result'))+'</tr>'
    body=''
    for date,opponent,role,time in rows:
        city="West Liberty, WV / Academic Sports and Recreation Complex" if owner=="west-liberty" else "City, WV / University Arena"
        cols=[date.strftime('%B %d, %Y (%A)'),time,role,mec.ALIASES[opponent][0],city,'','','','']
        body+='<tr>'+''.join('<td>'+str(x)+'</td>' for x in cols)+'</tr>'
    return '<html><head><title>'+title+'</title></head><body><header>'+title+'</header><table>'+head+body+'</table></body></html>'

def source_pages():
    keys=list(mec.SOURCES)
    by={k:[] for k in keys};pairs=[]
    # Round robin: 11 rounds each, followed by reversed fixtures.
    slots=list(keys)
    for rnd in range(22):
        when=dt.date(2026,12,1)+dt.timedelta(days=rnd*3)
        for j in range(6):
            a,b=slots[j],slots[-j-1]
            if rnd>=11:a,b=b,a
            by[a].append((when,b,'Home','7:30 PM'))
            by[b].append((when,a,'Away','7:30 PM'))
            pairs.append((when.isoformat(),a,b))
        slots=[slots[0],slots[-1]]+slots[1:-1]
    return {mec.SOURCES[k]:page(k,by[k]) for k in keys},pairs

class MEC(unittest.TestCase):
    def setUp(self):
        self.teams={k:{"id":k,"name":mec.ALIASES[k][0],"conference":"MEC"} for k in mec.SOURCES}
        self.today=dt.date(2026,11,1)
    def call(self,pages,games=None,teams=None):
        if games is None:games={}
        out=mec.enrich_mec_men(games,teams if teams is not None else self.teams,self.today,fetcher=lambda url:pages[url])
        return out,games
    def test_two_independent_sources_132_games(self):
        pages,pairs=source_pages()
        self.assertEqual(len(pairs),132)
        q,g=self.call(pages)
        self.assertEqual(q["schools_read"],12)
        self.assertEqual(q["reciprocal"],132)
        self.assertEqual(q["added"],132)
        self.assertEqual(len(g),132)
        self.assertEqual(q["official_tipoffs_added"],132)
        self.assertTrue(all(len(x["official_schedule_sources"])==2 for x in g.values()))
        self.assertTrue(all(x["status"]=="scheduled" and x["away_score"] is None for x in g.values()))
    def test_wrong_gender_year_school_or_url_rejected(self):
        pages,_=source_pages()
        owner="west-liberty";url=mec.SOURCES[owner];html=pages[url]
        for wrong in [html.replace("Men's Basketball","Women's Basketball"),
                      html.replace("2026-27","2025-26"),
                      html.replace("West Liberty University","Point Park University")]:
            with self.assertRaises(ValueError):mec.parse(wrong,owner,url)
        with self.assertRaises(ValueError):mec.parse(html,owner,mec.SOURCES["point-park"])
    def test_source_failure_never_promotes_one_sided(self):
        pages,_=source_pages()
        pages.pop(mec.SOURCES["west-liberty"])
        q,g=self.call(pages)
        self.assertEqual(q["schools_read"],11)
        self.assertEqual(q["added"],110)
        self.assertEqual(q["one_sided"],22)
    def test_preserve_ncaa_final_id_score_broadcast_and_arena(self):
        pages,pairs=source_pages();date,home,away=pairs[0]
        # sources encode (date, host, visitor)
        games={"ncaa-final-42":{"id":"ncaa-final-42","date":date,"away":away,
              "home":home,"status":"final","away_score":77,"home_score":80,
              "venue":"Verified NCAA Arena","network":"Verified School Stream",
              "elo_change_home":4.1}}
        q,g=self.call(pages,games)
        self.assertEqual(q["added"],131)
        self.assertEqual(q["enriched"],1)
        self.assertEqual(g["ncaa-final-42"]["venue"],"Verified NCAA Arena")
        self.assertEqual(g["ncaa-final-42"]["network"],"Verified School Stream")
        self.assertEqual(g["ncaa-final-42"]["home_score"],80)
        self.assertEqual(g["ncaa-final-42"]["elo_change_home"],4.1)
        second,_=self.call(pages,g)
        self.assertEqual(second["added"],0)
        self.assertEqual(second["enriched"],0)
    def test_ineligible_identity_and_ambiguous_roster_hold(self):
        pages,_=source_pages()
        teams={k:dict(v) for k,v in self.teams.items()}
        teams["point-park"]["not_eligible_for_dii_elo"]=True
        q,g=self.call(pages,teams=teams)
        self.assertEqual(q["added"],0)
        self.assertIn("held",q["status"])
        teams={k:dict(v) for k,v in self.teams.items()}
        teams["point-park-duplicate"]={"id":"point-park-duplicate","name":"Point Park","conference":"MEC"}
        q,g=self.call(pages,teams=teams)
        self.assertEqual(q["added"],0)
        self.assertIn("held",q["status"])
    def test_conflicting_home_roles_and_timestamps_quarantined(self):
        pages,pairs=source_pages();date,host,guest=pairs[0]
        url=mec.SOURCES[guest]
        # The visitor changes its listing to home for this one fixture.
        dateobj=dt.date.fromisoformat(date)
        original=page(guest,[(dateobj,host,"Away","7:30 PM")])
        altered=page(guest,[(dateobj,host,"Home","7:30 PM")])
        pages[url]=pages[url].replace(original.split('</tr>')[1].split('</table>')[0],
                                     altered.split('</tr>')[1].split('</table>')[0])
        q,g=self.call(pages)
        self.assertEqual(q["added"],131)
        self.assertGreater(q["one_sided"],0)
    def test_time_disagreement_remains_unpublished(self):
        pages,pairs=source_pages();date,host,guest=pairs[0]
        url=mec.SOURCES[guest]
        pages[url]=pages[url].replace('<td>7:30 PM</td>','<td>8:30 PM</td>',1)
        q,g=self.call(pages)
        self.assertGreaterEqual(q["time_conflicts"],1)
        self.assertEqual(q["added"],132)
        match=[x for x in g.values() if x["date"]==date and x["home"]==host and x["away"]==guest][0]
        self.assertNotIn("start_time",match)

if __name__=="__main__":unittest.main()
