#!/usr/bin/env python3
"""Florida 2024 presidential precinct returns directly from election officials.

Preserves original precinct-level vote observations, reconciles them with
the separately hosted certified county canvass and explicitly quarantines
the one-vote Hardee County Trump / Vance disagreement.
This dataset has NO precinct GIS or 2026 House district vote allocations.
"""
from __future__ import annotations
from collections import Counter,defaultdict
import csv
import datetime as dt
import hashlib
from html.parser import HTMLParser
import io
import json
import pathlib
import re
import urllib.request
import zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
ZIP_URL="https://dos.fl.gov/media/708761/2024-gen-outputofficial1.zip"
ZIP_SHA256="1a954b8bf9e261e2eb11443b016f55c87a52f69a1778ba1d5e7d229cddd79856"
OFFICIAL_COUNTIES_URL="https://results.elections.myflorida.com/DetailRpt.Asp?DATAMODE=&DIST=&ELECTIONDATE=11%2F5%2F2024&GRP=&PARTY=&RACE=PRE"
DATA_PATH=ROOT/"politics-fl-2024-presidential-precincts.json"
AUDIT_PATH=ROOT/"politics-fl-2024-precinct-reconciliation.json"
PARTY_TICKETS={
 "REP":"Trump / Vance","DEM":"Harris / Walz","LPF":"Oliver / ter Maat",
 "PSL":"De la Cruz / Garcia","CPF":"Terry / Broden",
 "ASP":"Sonski / Onak","GRE":"Stein / Ware"
}
OFFICIAL_MAJOR_TOTALS={"REP":6_110_125,"DEM":4_683_038}
EXPECTED_ANOMALIES={("hardee","REP"):1}
ZIP_MAX_BYTES=15_000_000
ZIP_MAX_UNCOMPRESSED=130_000_000
COUNTY_FILE_RE=re.compile(r"[A-Z]{3}_PctResults20241105\.txt")

def get(url,limit=15_000_000):
    if url not in (ZIP_URL,OFFICIAL_COUNTIES_URL):
        raise ValueError("Unreviewed 2024 state-election source URL")
    req=urllib.request.Request(url,headers={
        "User-Agent":"Political-Life-and-Times/1.0 (source-verified nonprofit civic data)",
        "Accept":"text/html,application/zip,application/octet-stream,*/*"
    })
    with urllib.request.urlopen(req,timeout=50) as response:
        if response.status!=200:raise ValueError("Florida source request returned non-200")
        raw=response.read(limit+1)
    if not raw or len(raw)>limit:raise ValueError("Unexpected Florida source size")
    return raw

class StateResultsHTML(HTMLParser):
    def __init__(self):
        super().__init__();self.rows=[];self.current=None;self.text=None
    def handle_starttag(self,tag,attrs):
        if tag=="tr":self.current=[]
        if tag in ("td","th") and self.current is not None:self.text=[]
    def handle_data(self,value):
        if self.text is not None:self.text.append(value)
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.text is not None and self.current is not None:
            self.current.append(" ".join("".join(self.text).split()));self.text=None
        if tag=="tr" and self.current is not None:
            if self.current:self.rows.append(self.current)
            self.current=None

def official_counties(raw):
    if not isinstance(raw,bytes) or len(raw)<5_000:raise ValueError("Official Florida canvass HTML missing")
    text=raw.decode("utf-8",errors="replace")
    if "November 5, 2024" not in text or "President" not in text:
        raise ValueError("Wrong Florida certified county result page")
    parser=StateResultsHTML();parser.feed(text)
    out={}
    for cells in parser.rows:
        if len(cells)<3:continue
        name=cells[0].strip().casefold()
        if not re.fullmatch("[a-z][a-z .-]{1,30}",name) or name in ("county","total"):
            continue
        try: rep=int(cells[1].replace(",",""));dem=int(cells[2].replace(",",""))
        except ValueError:continue
        if rep<0 or dem<0 or name in out:raise ValueError("Invalid duplicate 2024 official county results")
        out[name]={"REP":rep,"DEM":dem}
    if len(out)!=67:raise ValueError("Official 2024 Florida presidential county coverage not 67: "+str(len(out)))
    for party in ("REP","DEM"):
        total=sum(c[party] for c in out.values())
        if total != OFFICIAL_MAJOR_TOTALS[party]:
            raise ValueError("Official Florida county vote totals no longer match audited certified figures")
    return out

def parse_archive(blob,minimum_rows=500_000,expected_counties=67):
    if not isinstance(blob,bytes) or not zipfile.is_zipfile(io.BytesIO(blob)):
        raise ValueError("Expected original Florida state precinct ZIP")
    by_precinct={}
    county_names={}
    record_count=0
    candidate_records=0
    administrative=Counter()
    candidate_sums=Counter()
    seen_counties=set()
    recount_files=[]
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        members=archive.infolist()
        if sum(i.file_size for i in members)>ZIP_MAX_UNCOMPRESSED:
            raise ValueError("Florida archive uncompressed size too large")
        for info in members:
            name=info.filename
            if name.endswith("_Recount.txt"):
                recount_files.append(name)
                continue
            if info.is_dir():continue
            if not COUNTY_FILE_RE.fullmatch(name):
                raise ValueError("Unexpected ZIP member in official 2024 Florida precinct archive")
            county_code=name[:3]
            if county_code in seen_counties:
                raise ValueError("Duplicate official county result file")
            seen_counties.add(county_code)
            with archive.open(info) as stream:
                reader=csv.reader(io.TextIOWrapper(stream,encoding="utf-8-sig",errors="replace",newline=""),
                                  delimiter="\t")
                for row in reader:
                    if not row:continue
                    record_count+=1
                    if len(row)!=19:
                        raise ValueError("Florida ZIP row not 19 tab fields in "+name)
                    if row[0].strip()!=county_code or row[3].strip()!="11/05/2024" or row[4].strip()!="2024 General Election":
                        raise ValueError("Unexpected county, election date or election title in "+name)
                    current_name=row[1].strip()
                    if not current_name or (county_code in county_names and county_names[county_code]!=current_name):
                        raise ValueError("Inconsistent official Florida county name")
                    county_names[county_code]=current_name
                    if row[11].strip()!="President and Vice President":continue
                    prec_id=row[5].strip()
                    prec_name=row[6].strip()
                    if not prec_id or not prec_name:
                        raise ValueError("Incomplete precinct name/id")
                    try:votes=int(row[18].strip())
                    except ValueError as e:raise ValueError("Missing numeric presidential precinct votes") from e
                    if votes<0 or votes>1_000_000:raise ValueError("Out-of-range precinct vote total")
                    key=(county_code,prec_id)
                    if key not in by_precinct:
                        by_precinct[key]={"county_code":county_code,"county":current_name,
                                         "precinct_id":prec_id,"precinct_name":prec_name,
                                         "candidate_votes":{}}
                    precinct=by_precinct[key]
                    if precinct["precinct_name"]!=prec_name:
                        raise ValueError("Conflicting name for same county precinct")
                    party=row[15].strip()
                    candidate=row[14].strip()
                    if party in PARTY_TICKETS:
                        if candidate!=PARTY_TICKETS[party]:
                            raise ValueError("Unexpected 2024 Florida presidential ticket for party "+party)
                        if party in precinct["candidate_votes"]:
                            raise ValueError("Duplicate president party entry within one precinct")
                        precinct["candidate_votes"][party]=votes
                        candidate_sums[party]+=votes
                        candidate_records+=1
                    elif party=="" and candidate in ("OverVotes","UnderVotes","WriteinVotes"):
                        administrative[candidate]+=votes
                    else:
                        raise ValueError("Unexpected presidential record party/candidate; review state codebook")
    if len(seen_counties)!=expected_counties or record_count<minimum_rows:
        raise ValueError("Incomplete statewide official 2024 county files")
    if len(by_precinct)<4_000 and expected_counties==67:
        raise ValueError("Inadequate number of precincts in 2024 Florida state archive")
    if not all("REP" in item["candidate_votes"] and "DEM" in item["candidate_votes"] for item in by_precinct.values()):
        raise ValueError("Missing major candidate vote rows in at least one precinct; no zero imputation")
    output=sorted(by_precinct.values(),key=lambda p:(p["county_code"],p["precinct_id"]))
    return {
       "precincts":output,"counties":county_names,"county_count":len(seen_counties),
       "raw_rows":record_count,"presidential_ticket_rows":candidate_records,
       "candidate_totals":dict(candidate_sums),
       "administrative_fields_not_presidential_ticket_votes":dict(administrative),
       "excluded_recount_members":sorted(recount_files)
    }

def reconcile(parsed,official):
    county_code_name={c:name.casefold() for c,name in parsed["counties"].items()}
    if len(county_code_name)!=67 or set(county_code_name.values())!=set(official):
        raise ValueError("Precinct ZIP and official county canvass name sets differ")
    votes=defaultdict(lambda:Counter())
    district_count=Counter()
    for p in parsed["precincts"]:
        name=county_code_name[p["county_code"]]
        district_count[name]+=1
        for party,count in p["candidate_votes"].items():
            votes[name][party]+=count
    summaries=[]
    discrepancies={}
    for name in sorted(official):
        diff={}
        for party in ("REP","DEM"):
            delta=votes[name][party]-official[name][party]
            if delta:discrepancies[(name,party)]=delta
            diff[party]=delta
        summaries.append({
            "county":name.title(),"precinct_count":district_count[name],
            "precinct_reported_REP_presidential_votes":votes[name]["REP"],
            "precinct_reported_DEM_presidential_votes":votes[name]["DEM"],
            "certified_REP_presidential_votes":official[name]["REP"],
            "certified_DEM_presidential_votes":official[name]["DEM"],
            "REP_discrepancy_zip_minus_certified":diff["REP"],
            "DEM_discrepancy_zip_minus_certified":diff["DEM"]
        })
    if discrepancies!=EXPECTED_ANOMALIES:
        raise ValueError("State-versus-precinct county discrepancies changed; independent review required: "+repr(discrepancies))
    return summaries,discrepancies

def build(fetch=get,now=None):
    raw=fetch(ZIP_URL)
    if hashlib.sha256(raw).hexdigest()!=ZIP_SHA256:
        raise ValueError("Original state precinct ZIP hash changed; require source review")
    parsed=parse_archive(raw)
    certified=official_counties(fetch(OFFICIAL_COUNTIES_URL,limit=1_000_000))
    summaries,issues=reconcile(parsed,certified)
    now=now or dt.datetime.now(dt.timezone.utc)
    common={
        "source":"Florida Department of State Division of Elections",
        "official_2024_precinct_archive":ZIP_URL,"official_2024_precinct_archive_sha256":ZIP_SHA256,
        "certified_2024_county_results":OFFICIAL_COUNTIES_URL,
        "retrieved_at":now.isoformat(timespec="seconds")
    }
    totals=parsed["candidate_totals"]
    dataset={
       **common,"status":"ORIGINAL_2024_FL_PRESIDENTIAL_PRECINCT_RETURNS_SOURCE_RECONCILED_WITH_EXCEPTION",
       "election_date":"2024-11-05","county_count":67,"precinct_count":len(parsed["precincts"]),
       "presidential_party_tickets":PARTY_TICKETS,
       "precinct_records":parsed["precincts"],
       "data_are_2024_precincts_not_2026_congressional_districts":True,
       "2026_precinct_block_geography_reconciled":False,"forecast_eligible":False,
       "original_2026_house_probabilities_published":0,
       "warning":"Hardee has one additional Trump/Vance vote in the original state precinct ZIP versus the separately certified county canvass; no precinct has been altered. These returns have no geometry and cannot be assigned to 2026 House districts without validating precinct boundaries, precinct splits, and allocation of election votes."
    }
    audit={
      **common,"status":"ORIGINAL_FLORIDA_PRECINCT_RETURNS_VERIFIED_WITH_ONE_VOTE_QUARANTINED_DISCREPANCY",
      "county_count":67,"precinct_count":len(parsed["precincts"]),"all_original_input_rows":parsed["raw_rows"],
      "presidential_candidate_vote_records":parsed["presidential_ticket_rows"],
      "candidate_vote_totals_from_precinct_ZIP":totals,
      "official_statewide_major_candidate_totals":OFFICIAL_MAJOR_TOTALS,
      "county_aggregates":summaries,
      "county_party_discrepancies_count":len(issues),
      "known_discrepancies":[{"county":name,"party":party,"precinct_zip_minus_certified":amount} for (name,party),amount in sorted(issues.items())],
      "recount_files_excluded":parsed["excluded_recount_members"],
      "administrative_fields_excluded_from_candidate_voting_totals":parsed["administrative_fields_not_presidential_ticket_votes"],
      "statewide_major_candidate_total_fully_reconciled":False,
      "all_67_county_precinct_and_certified_counties_accounted_for":True,
      "2024_precinct_to_2026_congressional_district_geography_verified":False,
      "2026_vote_baselines_certified":False,"forecast_eligible":False,
      "certified_original_2026_probability_count":0,
      "warning":"Hardee original precinct ZIP contains 6,337 Trump votes versus 6,336 in the official certified county result; all other 66 county Trump and all 67 Harris totals match exactly. No vote is arbitrarily deleted or assigned to a particular precinct, so 2026 congressional-district retabulation remains BLOCKED."
    }
    return dataset,audit

def main():
    data,audit=build()
    DATA_PATH.write_text(json.dumps(data,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("FL 2024 certified-source import: counties",audit["county_count"],"precincts",audit["precinct_count"],
          "votes REP",audit["candidate_vote_totals_from_precinct_ZIP"]["REP"],
          "votes DEM",audit["candidate_vote_totals_from_precinct_ZIP"]["DEM"],
          "Hardee one-vote discrepancy EXPLICIT, no 2026 forecasts")
if __name__=="__main__":main()
