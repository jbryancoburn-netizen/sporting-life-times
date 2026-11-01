"""No-network archival tests: 2012–2016 are not automatically 2026-safe districts."""
import datetime as dt
import unittest
from scripts.politics_history import APPORTIONMENT
from scripts.politics_historical_archive import YEARS,build

def mock_loader(chamber,year,drop=None):
    rows=[]
    if chamber=="house":
        for st,n in APPORTIONMENT[2010].items():
            for district in ([0] if n==1 else range(1,n+1)):
                if drop and (chamber,year,st,district)==drop:continue
                for party,candidate,votes in (("DEMOCRAT","EXAMPLE D",25000),("REPUBLICAN","EXAMPLE R",30000)):
                    rows.append({"year":year,"state_po":st,"district":district,
                                 "stage":"GEN","special":False,"runoff":False,
                                 "candidate":candidate,"party":party,
                                 "candidate_total_votes":votes})
    else:
        for st in sorted(APPORTIONMENT[2010])[:27]:
            for party,candidate,votes in (("DEMOCRAT","EXAMPLE D",25000),("REPUBLICAN","EXAMPLE R",30000)):
                rows.append({"year":year,"state_po":st,"stage":"GEN",
                             "special":False,"runoff":False,"candidate":candidate,
                             "party_simplified":party,"candidate_total_votes":votes})
    return rows

class ArchiveTests(unittest.TestCase):
    def test_three_cycles_and_source_provenance(self):
        d=build(loader=mock_loader,now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(d["status"],"ok")
        self.assertEqual(d["years"],list(YEARS))
        self.assertEqual(len(d["house"]),3*435)
        self.assertEqual(len(d["senate"]),3*27)
        self.assertFalse(d["reconciled_against_official_chamber_totals"])
        self.assertFalse(d["district_geography_certified"])
        self.assertFalse(d["2026_forecast_eligible"])
        self.assertIn("2012.json",d["house"][0]["source_url"])
        self.assertEqual(d["house"][0]["geography_vintage"],"2010_apportionment")
    def test_missing_district_fails_closed(self):
        def incomplete(chamber,year):
            return mock_loader(chamber,year,drop=("house",2012,"FL",1))
        with self.assertRaisesRegex(ValueError,"Missing House district"):
            build(loader=incomplete)
    def test_missed_senate_cycle_fails_closed(self):
        def incomplete(chamber,year):
            return [] if chamber=="senate" and year==2014 else mock_loader(chamber,year)
        with self.assertRaisesRegex(ValueError,"Insufficient senate"):
            build(loader=incomplete)
if __name__=="__main__":unittest.main()
