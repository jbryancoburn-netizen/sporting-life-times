#!/usr/bin/env python3
"""Extract certified 2026 California House nominees from the original CA SOS PDF.

No secondary forecasts, inferred ballot status, contact information or fuzzy
candidate matching. Existing other-state records are preserved exactly.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import pathlib
import re
import urllib.request
from pypdf import PdfReader
import io

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"politics-official-ballots.json"
STATUS=ROOT/"politics-ca-certified-ballot-status.json"
URL="https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf"
SHA256="0e514ae7b14378b1837bcea99c07e6a05ce35baa9db4c3d3a2297704dc7e6017"
SOURCE_ID="CA_SOS_2026_GENERAL"
MAX_BYTES=18_000_000
PARTY={
    "Democratic":"DEM",
    "Republican":"REP",
    "No Party Preference":"NPA",
    "American Independent":"AIP",
    "Libertarian":"LIB",
    "Green":"GRE",
    "Peace and Freedom":"PFP",
}
DISTRICT_RE=re.compile(r"^United States Representative District (\d{1,2})$")
PARTY_RE=re.compile(r"^(.+?)\s{3,}(Democratic|Republican|No Party Preference|American Independent|Libertarian|Green|Peace and Freedom)\s*$")

def get_pdf():
    req=urllib.request.Request(URL,headers={"User-Agent":"Political-Life-and-Times/1.0 public election-source audit"})
    with urllib.request.urlopen(req,timeout=70) as response:
        if response.status!=200:raise ValueError("California secretary of state source not available")
        data=response.read(MAX_BYTES+1)
    if not data.startswith(b"%PDF") or not 1_000_000<len(data)<=MAX_BYTES:
        raise ValueError("Unexpected official California certified PDF size or content")
    if hashlib.sha256(data).hexdigest()!=SHA256:
        raise ValueError("California secretary-of-state certified PDF changed; require new human source review before publication")
    return data

def extract_pdf_text(data):
    reader=PdfReader(io.BytesIO(data))
    if not 20<=len(reader.pages)<=100:
        raise ValueError("Unexpected California official candidate-list PDF page count")
    return "\n".join(page.extract_text(extraction_mode="layout") or "" for page in reader.pages)

def parse_house(text,required=52):
    if not isinstance(text,str) or not text.strip():raise ValueError("Missing original certified candidate text")
    lines=text.splitlines()
    heads=[]
    for i,line in enumerate(lines):
        found=DISTRICT_RE.fullmatch(line.strip())
        if found:heads.append((i,int(found.group(1))))
    numbers=[d for _,d in heads]
    if len(numbers)!=required or set(numbers)!=set(range(1,required+1)):
        raise ValueError(f"California certified House districts missing/duplicated: {numbers[:70]}")
    out=[]
    for index,(line_number,district) in enumerate(heads):
        following=heads[index+1][0] if index+1<len(heads) else len(lines)
        # The 52nd congressional district is followed by California legislature headings.
        section=lines[line_number+1:min(following,line_number+48)]
        if district==52:
            cutoff=next((j for j,v in enumerate(section) if re.match(r"^\s*State (Senator|Assembly|Senate)\b",v)),len(section))
            section=section[:cutoff]
        candidates=[]
        for line in section:
            m=PARTY_RE.fullmatch(line.strip())
            if not m:continue
            name=m.group(1).strip()
            party=PARTY[m.group(2)]
            if not 2<=len(name)<=85 or re.search(r"\d|@|https?://",name):
                raise ValueError("Suspicious candidate name or contact information in certified record")
            candidates.append({"name":name,"party":party})
        if len(candidates)!=2 or len({(c["name"].casefold(),c["party"]) for c in candidates})!=2:
            raise ValueError(f"California district {district} does not contain exactly two distinct official nominees: {candidates!r}")
        out.append({
            "id":f"CA-{district:02d}","state":"CA","office":"H","district":f"{district:02d}",
            "source_id":SOURCE_ID,"candidates":candidates,
            "verification":"source_transcribed_as_of_review_date","fec_identity_match_certified":False
        })
    return out

def integrate(ledger,races,reviewed_at=None):
    from scripts.politics_ballot_audit import validate
    d=json.loads(json.dumps(ledger))
    ca=next((s for s in d.get("sources",[]) if s.get("id")==SOURCE_ID),None)
    if ca is None or ca.get("url")!=URL or ca.get("state")!="CA":
        raise ValueError("Original CA SOS source not registered")
    if len(races)!=52 or {r["id"] for r in races}!={f"CA-{i:02d}" for i in range(1,53)}:
        raise ValueError("California source has incomplete candidate coverage")
    existing=[r for r in d["races"] if r["state"]=="CA"]
    if existing and existing!=races:
        raise ValueError("Existing California source transcriptions differ; never replace without review")
    if not existing:d["races"].extend(races)
    d["races"].sort(key=lambda r:(r["state"],r["office"],r["id"]))
    ca["transcription_status"]="reviewed"
    ca["scope"]="full_52_california_house_districts_from_august_27_certified_general_list"
    ca["source_sha256"]=SHA256
    ca["reviewed_at"]=reviewed_at or dt.datetime.now(dt.timezone.utc).date().isoformat()
    ca["publication_date"]="2026-08-27"
    d["reviewed_at"]=ca["reviewed_at"]
    d["warning"]="Original state-certified candidate snapshots, not live continuously updated ballots; write-ins and unopposed offices require separate flags. California has 52 certified House contests; its official certified list has no U.S. Senate contest in 2026. No winner odds are inferred from the candidate roster."
    validate(d)
    return d

def main():
    now=dt.datetime.now(dt.timezone.utc)
    source=json.loads(OUTPUT.read_text(encoding="utf-8"))
    pdf=get_pdf()
    text=extract_pdf_text(pdf)
    races=parse_house(text)
    integrated=integrate(source,races,reviewed_at=now.date().isoformat())
    OUTPUT.write_text(json.dumps(integrated,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    status={"status":"CERTIFIED_CALIFORNIA_HOUSE_SOURCE_PARSED","checked_at":now.isoformat(timespec="seconds"),
            "source_url":URL,"source_sha256":SHA256,"certified_at":"2026-08-27",
            "house_districts":52,"source_candidate_entries":104,
            "senate_election_from_this_source":False,
            "forecast_eligible":False,"certified_2026_probability_count":0}
    STATUS.write_text(json.dumps(status,indent=2)+"\n",encoding="utf-8")
    print("Original CA Secretary of State: 52 House districts, 104 candidates, no independent forecast odds")
if __name__=="__main__":main()
