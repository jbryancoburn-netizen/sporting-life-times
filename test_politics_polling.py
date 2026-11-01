"""Offline tests for original poll averaging."""
import datetime as dt
import unittest
from scripts.politics_polling_refresh import average, classify
class PollTests(unittest.TestCase):
    def setUp(self):
        self.date=dt.date(2026,11,1)
    def poll(self,pollster,d,r,end="2026-10-29",partisan=None):
        return {"poll_type":"generic-ballot","end_date":end,"pollster":pollster,"sample_size":"1000",
            "population":"lv","partisan":partisan,"internal":False,
            "answers":[{"choice":"Dem","pct":d},{"choice":"Rep","pct":r}],"url":"https://example.org/poll","id":pollster}
    def test_real_average(self):
        inp=[self.poll("A",52,44),self.poll("B",48,46),self.poll("C",50,45)]
        output=average(inp,self.date)
        self.assertEqual(output["status"],"ok")
        self.assertEqual(output["average"]["dem_margin"],5.0)
        self.assertEqual(output["pollsters"],3)
    def test_rejects_partisan_and_duplicate(self):
        inp=[self.poll("A",55,30),self.poll("A",55,30),self.poll("B",42,53,partisan=True)]
        output=average(inp,self.date)
        self.assertEqual(output["status"],"insufficient_polling")
        self.assertEqual(output["poll_count"],1)
    def test_rejects_future_and_old(self):
        output=average([self.poll("A",50,50,end="2026-12-01"),self.poll("B",49,50,end="2025-01-01")],self.date)
        self.assertEqual(output["poll_count"],0)
    def test_party_classification(self):
        self.assertEqual(classify("Democrats"),"D")
        self.assertIsNone(classify("Undecided"))
if __name__=="__main__":unittest.main()
