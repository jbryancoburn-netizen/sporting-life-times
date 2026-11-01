"""Regression coverage for raw vintage 2000–2010 election observations."""
import datetime as dt
import unittest
from scripts.politics_deep_archive import YEARS,build,archive_year
from scripts.politics_history import APPORTIONMENT

def fake(chamber,year,short=False):
    out=[]
    if chamber=="house":
        for state,n in APPORTIONMENT[2010].items():
            for district in ([0] if n==1 else range(1,n+1)):
                if short and state=="FL":continue
                for party,candidate,votes in (("DEMOCRAT","EXAMPLE D",1000),("REPUBLICAN","EXAMPLE R",1200)):
                    out.append({"year":year,"state_po":state,"district":district,"stage":"GEN",
                        "special":False,"runoff":False,"candidate":candidate,"party":party,
                        "candidate_total_votes":votes})
    else:
        for state in sorted(APPORTIONMENT[2010])[:33]:
            for party,candidate,votes in (("DEMOCRAT","EXAMPLE D",1000),("REPUBLICAN","EXAMPLE R",1200)):
                out.append({"year":year,"state_po":state,"stage":"GEN",
                    "special":False,"runoff":False,"candidate":candidate,
                    "party_simplified":party,"candidate_total_votes":votes})
    return out

class OlderHistoryTests(unittest.TestCase):
    def test_original_vintage_source_retention_and_nonforecast(self):
        d=build(loader=fake,now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(d["status"],"ok")
        self.assertEqual(d["years"],[2000,2002,2004,2006,2008,2010])
        self.assertEqual(len(d["house"]),6*435)
        self.assertEqual(len(d["senate"]),6*33)
        self.assertEqual(d["house"][0]["geography_vintage"],"1990_census")
        self.assertEqual(next(x for x in d["house"] if x["year"]==2002)["geography_vintage"],"2000_census")
        self.assertFalse(d["forecast_2026_eligible"])
        self.assertFalse(d["house_winner_party_totals_certified"])
    def test_cannot_claim_complete_if_missing_states(self):
        with self.assertRaisesRegex(ValueError,"House source district coverage"):
            archive_year("house",2000,fake("house",2000,short=True))
    def test_no_votes_no_fabrication(self):
        d=fake("house",2004)
        for row in d:row["candidate_total_votes"]=None
        with self.assertRaisesRegex(ValueError,"numeric contest"):
            archive_year("house",2004,d)
if __name__=="__main__":unittest.main()
