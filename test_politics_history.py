"""Deterministic offline tests for MEDSL election history parser."""
import datetime as dt
import unittest
from scripts.politics_history import collate, baseline_check, describe, classify, experimental_holdout, reconcile_house_year, OFFICIAL_HOUSE, APPORTIONMENT, apportionment_audit

def item(name,party,votes,district=1,year=2024,fusion=False,total=None,stage="GEN",special=False,chamber="house"):
    return {"year":year,"state_po":"FL","district":district,"candidate":name,"party":party,
            "party_simplified":party,"candidatevotes":votes,"candidate_total_votes":total,
            "fusion_ticket":fusion,"stage":stage,"special":special,"unofficial":False,"runoff":False}

class HistoryTests(unittest.TestCase):
    def test_party_parsing(self):
        self.assertEqual(classify("DEMOCRAT"),"D")
        self.assertEqual(classify("REPUBLICAN"),"R")
        self.assertEqual(classify("LIBERTARIAN"),"O")
    def test_house_two_party_and_uncontested(self):
        data=[item("Jane","DEMOCRAT",500),item("Bob","REPUBLICAN",450),
              item("Cara","DEMOCRAT",1000,district=2)]
        races,quality=collate(data,"house",2024)
        self.assertEqual(len(races),2)
        self.assertEqual(races[0]["two_party_margin"],round(100*50/950,2))
        self.assertEqual(races[1]["two_party_margin"],None)
        self.assertEqual(describe(races,2024,"house",quality)["dem_wins"],2)
    def test_special_and_runoff_excluded(self):
        rows=[item("Jane","DEMOCRAT",500,special=True),item("Other","REPUBLICAN",10,stage="PRI")]
        races,_=collate(rows,"house",2024)
        self.assertEqual(races,[])
    def test_fusion_candidate_not_double_counted(self):
        rows=[item("Jane","DEMOCRAT",400,total=550),
              item("Jane","WORKING FAMILIES",150,total=550,fusion=True),
              item("Bob","REPUBLICAN",440)]
        races,_=collate(rows,"house",2024)
        self.assertEqual(races[0]["dem_votes"],550)
        self.assertEqual(races[0]["rep_votes"],440)
    def test_unofficial_senate_parsing(self):
        rows=[item("Jane","DEMOCRAT",550,chamber="senate"),
              item("Bob","REPUBLICAN",450,chamber="senate")]
        races,quality=collate(rows,"senate",2024)
        self.assertEqual(races[0]["id"],"FL")
        self.assertEqual(quality["valid_contests"],1)
    def test_baseline_is_not_a_model(self):
        a=[{"id":"FL-01","two_party_margin":-2.0}]
        b=[{"id":"FL-01","two_party_margin":3.0}]
        out=baseline_check(a,b,2022,2024)
        self.assertEqual(out["mean_absolute_margin_error"],5.0)
        self.assertEqual(out["sign_changes"],1)
        self.assertIn("Not a calibrated",out["interpretation"])


    def test_census_apportionment_totals_and_exclude_delegates(self):
        self.assertEqual(sum(APPORTIONMENT[2010].values()),435)
        self.assertEqual(sum(APPORTIONMENT[2020].values()),435)
        self.assertEqual(len(APPORTIONMENT[2020]),50)
        data=[item("JANE","DEMOCRAT",600,year=2024)]
        district_columbia=item("DELEGATE","DEMOCRAT",300,year=2024,district=0)
        district_columbia["state_po"]="DC"
        data.append(district_columbia)
        races,_=collate(data,"house",2024)
        self.assertEqual(len(races),1)
        self.assertEqual(races[0]["id"],"FL-01")
        audit=apportionment_audit(data,2024)
        self.assertEqual(audit["expected_voting_house_districts"],435)
        self.assertIn("DC-00",audit["unexpected_districts"])
        self.assertEqual(audit["status"],"requires_review")
    def test_ranked_choice_ballot_metadata_not_candidate(self):
        rows=[
          item("EXHAUSTED BALLOT","",344433,district=2,year=2022),
          item("JARED GOLDEN","DEMOCRAT",153074,district=2,year=2022),
          item("BRUCE POLIQUIN","REPUBLICAN",141260,district=2,year=2022)
        ]
        for row in rows:row["state_po"]="ME"
        races,quality=collate(rows,"house",2022)
        self.assertEqual(races[0]["party_winner"],"D")
        self.assertEqual(races[0]["winner_name"],"JARED GOLDEN")
        self.assertIsNone(races[0]["two_party_margin"])
        self.assertTrue(races[0]["ranked_choice_official_winner_override"])
        self.assertEqual(races[0]["total_votes"],294334)
        self.assertEqual(len(quality["rcv_verified_winners"]),1)
    def test_void_2018_nc_09_excluded_not_counted(self):
        row=item("MARK HARRIS","REPUBLICAN",139246,district=9,year=2018)
        row["state_po"]="NC"
        races,quality=collate([row],"house",2018)
        self.assertEqual(races,[])
        self.assertEqual(quality["excluded_contests"][0]["reason"],"2018_general_election_not_certified")
    def test_official_seats_not_imputed_into_unmatched_results(self):
        official={2018:(235,199,1),2020:(222,213,0),2022:(213,222,0),2024:(215,220,0)}
        for year,(dem,rep,unresolved) in official.items():
            self.assertEqual((OFFICIAL_HOUSE[year]["dem"],OFFICIAL_HOUSE[year]["rep"],OFFICIAL_HOUSE[year]["unresolved"]),(dem,rep,unresolved))
        data=[item("Jane","DEMOCRAT",500),item("Bob","REPUBLICAN",450)]
        contests,quality=collate(data,"house",2024)
        result=reconcile_house_year(contests,2024,quality)
        self.assertEqual(result["status"],"requires_district_reconciliation")
        self.assertEqual(result["official"]["dem_wins"],215)
        self.assertEqual(result["reconstructed"]["dem"],1)
        self.assertEqual(result["difference_official_minus_reconstructed"]["rep"],220)
    def test_missing_votes_are_reported_not_filled(self):
        races,quality=collate([item("Unopposed","REPUBLICAN",None)],"house",2024)
        self.assertEqual(races,[])
        self.assertEqual(quality["excluded_contests"][0]["id"],"FL-01")
        self.assertEqual(quality["skipped"]["missing_votes"],1)
    def test_experimental_holdout_is_never_a_2026_forecast(self):
        def sample_year(offset):
            out=[]
            for i in range(200):
                margin=(i-100)/3.0+offset
                out.append({"id":"S-%03d"%i,"two_party_margin":margin,
                            "party_winner":"D" if margin>0 else "R"})
            return out
        report=experimental_holdout(sample_year(0),sample_year(2),sample_year(-3),sample_year(-1))
        self.assertEqual(report["status"],"experimental_holdout_only")
        self.assertFalse(report["forecast_2026_certified"])
        self.assertFalse(report["backtest_certified"])
        self.assertEqual(report["test_samples"],200)
        self.assertTrue(0<=report["holdout_brier_score"]<=1)
        self.assertEqual(sum(b["count"] for b in report["calibration_bins"]),200)

if __name__=="__main__":unittest.main()
