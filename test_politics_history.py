"""Deterministic offline tests for MEDSL election history parser."""
import datetime as dt
import unittest
from scripts.politics_history import collate, baseline_check, describe, classify

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

if __name__=="__main__":unittest.main()
