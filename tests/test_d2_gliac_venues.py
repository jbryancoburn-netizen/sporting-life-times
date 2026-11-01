"""Exact game-specific university arenas, not inferred GLIAC home-court defaults."""
import datetime as dt
import unittest
from unittest.mock import patch

from scripts import d2_gliac_venues_official as venues
from scripts import d2_gliac_official as gliac


def school_html(gender="men",name="Grand Valley State",school="Grand Valley State University",when=None):
    dates=when or [dt.date(2027,1,7)+dt.timedelta(days=i*3) for i in range(10)]
    rows="".join(
        "<tr><td>"+d.strftime("%B %d, %Y")+
        " (Thursday)</td><td>7:30 PM</td><td>Home</td>"
        "<td>Ferris State University</td><td>Allendale, Mich. / GVSU Fieldhouse Arena</td>"
        "<td></td><td></td><td></td><td></td></tr>"
        for d in dates)
    return (
        f"<title>2026-27 {gender.title()}'s Basketball Schedule - {school} Athletics</title>"
        f"<h2>2026-27 {gender.title()}'s Basketball Schedule</h2>"
        "<table><tr><th>Date</th><th>Time</th><th>At</th><th>Opponent</th>"
        "<th>Location</th><th>TV</th><th>Radio</th>"
        "<th>Tournament</th><th>Result</th></tr>"+rows+"</table>")


class OfficialGLIACVenues(unittest.TestCase):
    def test_verified_2026_gender_specific_school_grid_venue(self):
        home="grand-valley-state"
        url=venues.SOURCES["men"][home]
        rows=venues.read_game_arenas(school_html(), "men", home,url)
        self.assertEqual(len(rows),10)
        key=("2027-01-07","ferris-state","grand-valley-state")
        self.assertEqual(rows[key],("GVSU Fieldhouse Arena","Allendale, Mich."))
        self.assertEqual(gliac.member_id("Ferris State University","men"),"ferris-state")
        self.assertEqual(gliac.member_id("Grand Valley State University","men"),"grand-valley-state")
        with self.assertRaises(ValueError):
            venues.read_game_arenas(school_html(gender="women"),"men",home,url)
        with self.assertRaises(ValueError):
            venues.read_game_arenas(school_html().replace("2026-27","2025-26"),"men",home,url)
        with self.assertRaises(ValueError):
            venues.read_game_arenas(school_html(),"women",
                                   "grand-valley-state-university",url)

    def test_exact_date_team_home_and_not_any_other_glIac_game(self):
        home="grand-valley-state"
        source=venues.SOURCES["men"][home]
        data=school_html()
        games={}
        for i in range(10):
            day=(dt.date(2027,1,7)+dt.timedelta(days=i*3)).isoformat()
            games[f"n{i}"]={"id":f"n{i}","date":day,"away":"ferris-state","home":home,
                            "conference_game":True,"neutral":False}
        games["unrelated"]={"id":"unrelated","date":"2027-01-07",
                          "away":"davenport","home":home,
                          "conference_game":True,"neutral":False}
        teams={name:{} for name in ("ferris-state",home,"davenport")}
        def fetch(url):
            if url==source:return data
            raise OSError("other sources temporarily unavailable")
        with patch.object(venues,"get_html",side_effect=fetch):
            r=venues.enrich_gliac_venues("men",games,teams)
        self.assertEqual(r["source_schedules"],1)
        self.assertEqual(r["enriched"],10)
        self.assertEqual(r["quarantined_conflicts"],0)
        self.assertEqual(games["n0"]["venue"],"GVSU Fieldhouse Arena · Allendale, Mich.")
        self.assertEqual(games["n0"]["venue_source_url"],source)
        self.assertNotIn("venue",games["unrelated"])
        self.assertEqual(len(r["source_errors"]),4)

    def test_named_away_venue_only_with_exact_canonical_visitor(self):
        away="lake-superior-state"
        url=venues.SOURCES["men"][away]
        markup=(
            "<title>2026-27 Men's Basketball Schedule - LSSU Athletics</title>"
            "<table><tr><th>Date</th><th>Time</th><th>At</th><th>Opponent</th>"
            "<th>Location</th></tr><tr>"
            "<td>December 5, 2026 (Saturday)</td><td>3:00 PM</td>"
            "<td>Away</td><td>Ferris State University</td>"
            "<td>Big Rapids, MI / Jim Wink Arena</td></tr></table>")
        data=venues.read_game_arenas(markup,"men",away,url)
        self.assertEqual(data[("2026-12-05",away,"ferris-state")],
                         ("Jim Wink Arena","Big Rapids, MI"))
        self.assertNotIn(("2026-12-05","ferris-state",away),data)

    def test_city_or_unannounced_not_arena_and_no_neutral_venue(self):
        home="grand-valley-state";url=venues.SOURCES["men"][home]
        html=school_html()
        html=html.replace("Allendale, Mich. / GVSU Fieldhouse Arena","Allendale, Mich.")
        self.assertEqual(venues.read_game_arenas(html,"men",home,url),{})
        html=school_html().replace("GVSU Fieldhouse Arena","TBA")
        self.assertEqual(venues.read_game_arenas(html,"men",home,url),{})
        html=school_html().replace("<td>Home</td>","<td>Neutral</td>")
        self.assertEqual(venues.read_game_arenas(html,"men",home,url),{})

    def test_conflicting_venue_is_preserved_not_overwritten(self):
        home="grand-valley-state"
        source=venues.SOURCES["men"][home]
        dates=[dt.date(2027,1,7)+dt.timedelta(days=i*3) for i in range(10)]
        games={}
        for i,day in enumerate(dates):
            games[str(i)]={"id":str(i),"date":day.isoformat(),
                            "away":"ferris-state","home":home,
                            "conference_game":True,"neutral":False}
        games["0"]["venue"]="Different Facility · Allendale, Mich."
        with patch.object(venues,"get_html",side_effect=lambda u: school_html(when=dates) if u==source else (_ for _ in ()).throw(OSError("skip"))):
            r=venues.enrich_gliac_venues("men",games,{home:{}, "ferris-state":{}})
        self.assertEqual(r["quarantined_conflicts"],1)
        self.assertEqual(r["enriched"],9)
        self.assertEqual(games["0"]["venue"],"Different Facility · Allendale, Mich.")
        self.assertTrue(r["sample_conflicts"])


if __name__=="__main__":
    unittest.main()
