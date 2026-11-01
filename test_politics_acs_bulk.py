"""No-key Census ACS bulk files: original 119th-boundary measurements, never votes."""
import copy
import datetime as dt
import hashlib
import unittest
from scripts.politics_acs_bulk import (
    read_table,assemble,BASE,SOURCES,CHANGED_2026_STATES,ROOT,
)
from scripts.politics_real_inputs import FIPS
from scripts.politics_history import APPORTIONMENT

def fixture():
    keys=[]
    for fips,state in sorted(FIPS.items()):
        count=APPORTIONMENT[2020][state]
        for i in range(1,count+1) if count>1 else (0,):
            keys.append(state+"-"+str(i).zfill(2))
    assert len(keys)==435
    tables={"B01003":{},"B19013":{},"B15003":{}}
    for rid in keys:
        tables["B01003"][rid]={"B01003_E001":760000,"B01003_M001":1800}
        tables["B19013"][rid]={"B19013_E001":76000,"B19013_M001":1250}
        tables["B15003"][rid]={
            "B15003_E001":450000,
            "B15003_E022":90000,"B15003_E023":40000,
            "B15003_E024":9000,"B15003_E025":6000
        }
    sources={k:{"url":BASE+f[0],"sha256":"a"*64,"bytes":1000000,"districts":435} for k,f in SOURCES.items()}
    return tables,sources

class CensusBulkTests(unittest.TestCase):
    def test_full_official_shape_and_old_2024_geography(self):
        tables,source=fixture()
        a=assemble(tables,source,now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc))
        self.assertEqual(a["district_count"],435)
        self.assertEqual(len({r["id"] for r in a["districts"]}),435)
        self.assertEqual(len({r["state"] for r in a["districts"]}),50)
        self.assertEqual(a["districts"][0]["boundary_vintage"],"119th_Congress_2024")
        self.assertFalse(a["forecast_eligible"])
        self.assertFalse(a["model_eligible"])
        self.assertFalse(a["2026_district_geography_harmonized"])
        fl=next(r for r in a["districts"] if r["id"]=="FL-22")
        self.assertTrue(fl["2026_boundary_change_requires_remap"])
        self.assertFalse(fl["geographically_usable_as_2026_population"])
        self.assertEqual(fl["bachelors_plus_age25_pct_est"],round(100*145000/450000,2))
        ak=next(r for r in a["districts"] if r["id"]=="AK-00")
        self.assertFalse(ak["2026_boundary_change_requires_remap"])

    def test_missing_or_misaligned_geography_rejected(self):
        tables,source=fixture()
        tables["B15003"].pop("FL-22")
        with self.assertRaises(ValueError):assemble(tables,source)
        tables,source=fixture()
        tables["B01003"]["FL-22"]["B01003_E001"]=None
        with self.assertRaises(ValueError):assemble(tables,source)

    def test_invalid_education_percentage_or_suppression_rejected(self):
        tables,source=fixture()
        tables["B15003"]["FL-22"]["B15003_E022"]=1000000
        with self.assertRaises(ValueError):assemble(tables,source)

    def test_changed_original_source_requires_review(self):
        tables,source=fixture()
        a=assemble(tables,source)
        newer=copy.deepcopy(source)
        newer["B19013"]["sha256"]="b"*64
        with self.assertRaisesRegex(ValueError,"fingerprint changed"):
            assemble(tables,newer,previous=a)

    def test_parse_only_119th_congressional_districts_not_counties(self):
        tables,source=fixture()
        rows=["GEO_ID|B01003_E001|B01003_M001"]
        for rid in sorted(tables["B01003"]):
            state=rid[:2]
            fips=next(k for k,v in FIPS.items() if v==state)
            rows.append("5001900US"+fips+rid[3:]+"|760000|1800")
        rows+=["0500000US12057|123456|123","5001900US1198|700000|1200","0100000US|200000000|999"]
        blob=("\n".join(rows)+"\n").encode()
        got,meta=read_table("B01003",fetch=lambda url:blob)
        self.assertEqual(len(got),435)
        self.assertNotIn("DC-98",got)
        self.assertEqual(got["FL-22"]["B01003_E001"],760000)
        self.assertEqual(meta["sha256"],hashlib.sha256(blob).hexdigest())

    def test_duplicate_geographic_identifier_rejected(self):
        tables,source=fixture()
        rows=["GEO_ID|B01003_E001|B01003_M001"]
        for rid in sorted(tables["B01003"]):
            fips=next(k for k,v in FIPS.items() if v==rid[:2])
            rows.append("5001900US"+fips+rid[3:]+"|760000|1800")
        rows.append(rows[-1])
        with self.assertRaisesRegex(ValueError,"Duplicate congressional district"):
            read_table("B01003",fetch=lambda url:("\n".join(rows)+"\n").encode())

    def test_html_error_page_is_rejected_even_if_http_200(self):
        with self.assertRaises(ValueError):
            read_table("B01003",fetch=lambda url:b"<html><title>Missing Key</title></html>")
if __name__=="__main__":
    unittest.main()
