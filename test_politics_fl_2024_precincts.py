"""Original 2024 Florida precinct votes must keep certified county differences visible."""
from collections import Counter
import io
import json
import unittest
import zipfile
from scripts.politics_fl_2024_precincts import (
    parse_archive,reconcile,official_counties,OFFICIAL_MAJOR_TOTALS,PARTY_TICKETS,
    ZIP_SHA256,EXPECTED_ANOMALIES
)

def row(code,county,precinct,party,candidate,votes,date="11/05/2024"):
    data=[code,county,"43888",date,"2024 General Election",precinct,"Town Center",
          "450","0","0","0","President and Vice President"," ","100000",
          candidate,party,"0","84375",str(votes)]
    assert len(data)==19
    return "\t".join(data)+"\r\n"

def zipped(rows):
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w",compression=zipfile.ZIP_DEFLATED) as z:
        for key,data in rows.items():z.writestr(f"{key}_PctResults20241105.txt",data)
    return out.getvalue()

class FloridaPrecinctTests(unittest.TestCase):
    def fixture(self):
        return zipped({
          "HAR":row("HAR","Hardee","1","REP","Trump / Vance",6)+row("HAR","Hardee","1","DEM","Harris / Walz",2),
          "WAS":row("WAS","Washington","1","REP","Trump / Vance",5)+row("WAS","Washington","1","DEM","Harris / Walz",3)
        })

    def test_original_19_column_tab_rows_without_autoallocation(self):
        parsed=parse_archive(self.fixture(),minimum_rows=4,expected_counties=2)
        self.assertEqual(parsed["county_count"],2)
        self.assertEqual(parsed["raw_rows"],4)
        self.assertEqual(parsed["candidate_totals"]["REP"],11)
        self.assertEqual(parsed["candidate_totals"]["DEM"],5)
        self.assertEqual(len(parsed["precincts"]),2)
        self.assertEqual(parsed["precincts"][0]["precinct_name"],"Town Center")

    def test_bad_candidate_and_duplicate_precinct_party_rejected(self):
        a=self.fixture()
        bad=zipped({"HAR":row("HAR","Hardee","1","REP","Bad made-up name",6),
                    "WAS":row("WAS","Washington","1","DEM","Harris / Walz",2)})
        with self.assertRaises(ValueError):parse_archive(bad,minimum_rows=2,expected_counties=2)
        dup=zipped({"HAR":row("HAR","Hardee","1","REP","Trump / Vance",6)
                           +row("HAR","Hardee","1","REP","Trump / Vance",6),
                    "WAS":row("WAS","Washington","1","DEM","Harris / Walz",3)})
        with self.assertRaises(ValueError):parse_archive(dup,minimum_rows=2,expected_counties=2)

    def test_bad_election_date_and_zip_member_not_allowed(self):
        wrong=zipped({"HAR":row("HAR","Hardee","1","REP","Trump / Vance",2,date="11/03/2026")})
        with self.assertRaises(ValueError):parse_archive(wrong,minimum_rows=1,expected_counties=1)
        o=io.BytesIO()
        with zipfile.ZipFile(o,"w") as z:z.writestr("../bad.txt","not a source file")
        with self.assertRaises(ValueError):parse_archive(o.getvalue(),minimum_rows=1,expected_counties=1)

    def test_anomaly_is_exactly_one_hardee_republican_vote(self):
        counties={f"county{i:02d}":code for i,code in enumerate(range(67))}
        # Rename one county to Hardee. Reconcile uses reported values and
        # never edits a precinct to absorb any discrepancy.
        county_names={f"{i:03d}":name for i,name in enumerate(counties)}
        county_names["000"]="hardee"
        official={name:{"REP":2,"DEM":3} for name in county_names.values()}
        precincts=[
          {"county_code":code,"candidate_votes":{"REP":official[name]["REP"]+(name=="hardee"),
                                                   "DEM":official[name]["DEM"]}}
          for code,name in county_names.items()
        ]
        parsed={"counties":county_names,"precincts":precincts}
        summary,discrepancies=reconcile(parsed,official)
        self.assertEqual(discrepancies,EXPECTED_ANOMALIES)
        hardee=next(d for d in summary if d["county"]=="Hardee")
        self.assertEqual(hardee["REP_discrepancy_zip_minus_certified"],1)
        self.assertEqual(hardee["DEM_discrepancy_zip_minus_certified"],0)

    def test_any_extra_second_county_mismatch_invalidates_release(self):
        county_names={f"{i:03d}":f"county{i:02d}" for i in range(67)}
        county_names["000"]="hardee"
        official={name:{"REP":2,"DEM":3} for name in county_names.values()}
        precincts=[
           {"county_code":code,"candidate_votes":{"REP":official[name]["REP"]+(name=="hardee"),
                                                     "DEM":official[name]["DEM"]+(name=="county05")}}
           for code,name in county_names.items()
        ]
        with self.assertRaises(ValueError):reconcile({"counties":county_names,"precincts":precincts},official)

    def test_official_results_page_requires_all_counties_and_vetted_totals(self):
        raw=b"November 5, 2024 President of the United States<html><table><tr><td>Hardee</td><td>6,336</td><td>1,751</td></tr></table></html>"
        with self.assertRaises(ValueError):official_counties(raw)
        self.assertEqual(OFFICIAL_MAJOR_TOTALS,{"REP":6110125,"DEM":4683038})
        self.assertEqual(len(ZIP_SHA256),64)
        self.assertEqual(PARTY_TICKETS["REP"],"Trump / Vance")

if __name__=="__main__":unittest.main()
