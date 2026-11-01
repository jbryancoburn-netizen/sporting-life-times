"""No-network tests: official FEC schemas, candidate registration caveats and Census 435 IDs."""
import datetime as dt
import io
import zipfile
import unittest
from scripts.politics_real_inputs import (
    parse_fec_candidates,parse_fec_financials,parse_census,make_fec,make_census,unzip_tabular
)
def zipdata(content,name="cn.txt"):
    buff=io.BytesIO()
    with zipfile.ZipFile(buff,"w",zipfile.ZIP_DEFLATED) as z:z.writestr(name,content)
    return buff.getvalue()

def master(id="H6FL01001",year="2026",office="H",district="01",state="FL"):
    return "|".join([id,"EXAMPLE, JANE","DEM",year,state,office,district,"I","C","C12345678","","","","",""])

def finance(id="H6FL01001"):
    cols=[""]*30;cols[0]=id;cols[5]="1000000";cols[7]="500000";cols[10]="400000";cols[27]="10/15/2026"
    return "|".join(cols)

class RealInputTests(unittest.TestCase):
    def test_fec_master_schema_no_ballot_claim(self):
        data=zipdata(master()+"\n"+master("S6FL00001",office="S",district="00")+"\n")
        rows=unzip_tabular(data,15)
        candidate=parse_fec_candidates(rows)
        self.assertEqual(len(candidate),2)
        self.assertEqual(candidate[0]["filing_status"],"C")
        self.assertTrue(candidate[0]["fec_registration_only"])
        self.assertEqual(candidate[0]["district"],"01")
    def test_fec_financial_fields_and_missing(self):
        rows=unzip_tabular(zipdata(finance()+"\n","weball26.txt"),30)
        vals=parse_fec_financials(rows,{"H6FL01001"})
        self.assertEqual(vals["H6FL01001"]["cash_on_hand"],400000)
        self.assertEqual(vals["H6FL01001"]["report_end"],"10/15/2026")
        self.assertNotIn("H6ZZ00001",vals)
    def test_integration_offline(self):
        cand=zipdata(master()+"\n")
        cash=zipdata(finance()+"\n","weball26.txt")
        def fetch(url):
            return cand if "cn26" in url else cash
        result=make_fec(fetch=fetch,now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(result["house_count"],1)
        self.assertFalse(result["forecast_eligible"])
        self.assertIn("NOT certified",result["warning"])
        self.assertEqual(result["finance_records_joined"],1)
    def test_census_435_district_contract(self):
        head=["NAME","B01003_001E","B19013_001E","B15003_001E","B15003_022E","B15003_023E","B15003_024E","B15003_025E","state","congressional district"]
        row=["Congressional District 1","100000","70000","60000","12000","5000","1000","1000","12","01"]
        with self.assertRaises(ValueError):parse_census([head]+[row]*435)
    def test_census_two_unique_rows(self):
        head=["NAME","B01003_001E","B19013_001E","B15003_001E","B15003_022E","B15003_023E","B15003_024E","B15003_025E","state","congressional district"]
        a=["Congressional District 1","100000","70000","60000","12000","5000","1000","1000","12","01"]
        b=a.copy();b[-1]="02"
        # Census parser requires a large response; smaller test must be rejected.
        with self.assertRaises(ValueError):parse_census([head,a,b])
        with self.assertRaises(ValueError):parse_census([head]+[a]*435)
if __name__=="__main__":unittest.main()
