#!/usr/bin/env python3
"""Discover *historically dated* ACC 1980s logo candidates; never invent imagery."""
from __future__ import annotations
import re,json,time
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"data/acc-1980s-source-candidates.json"
TEAMS=[
 ("boston-college","Boston College Eagles",618),
 ("california","California Golden Bears",630),
 ("clemson","Clemson Tigers",643),
 ("duke","Duke Blue Devils",663),
 ("florida-state","Florida State Seminoles",679),
 ("georgia-tech","Georgia Tech Yellow Jackets",690),
 ("louisville","Louisville Cardinals",734),
 ("miami","Miami Hurricanes",748),
 ("nc-state","NC State Wolfpack",777),
 ("north-carolina","North Carolina Tar Heels",775),
 ("notre-dame","Notre Dame Fighting Irish",789),
 ("pittsburgh","Pittsburgh Panthers",803),
 ("smu","SMU Mustangs",842),
 ("stanford","Stanford Cardinal",854),
 ("syracuse","Syracuse Orange",859),
 ("virginia","Virginia Cavaliers",898),
 ("virginia-tech","Virginia Tech Hokies",901),
 ("wake-forest","Wake Forest Demon Deacons",903)
]
HEADERS={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36",
"Accept-Language":"en-US,en;q=0.9"}
# Type preferences: documented 1980s animal/character/mascot first.
PREFERENCE=["Mascot","Primary","Secondary","Alternate"]
def get(url,session):
    response=session.get(url,headers=HEADERS,timeout=35)
    response.raise_for_status()
    if len(response.content)<3000:raise ValueError("Archive page suspiciously short "+url)
    return response.text
def years(text):
    s=re.search(r"((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|Pres)",text,re.I)
    if s:return int(s.group(1)),9999 if s.group(2).lower()=="pres" else int(s.group(2))
    s=re.search(r"(?<!\d)(19\d{2}|20\d{2})(?!\d)",text)
    return (int(s.group(1)),int(s.group(1))) if s else (None,None)
def main():
    sess=requests.Session()
    records=[]
    for slug,name,team_id in TEAMS:
        root=f"https://www.sportslogos.net/logos/list_by_team/{team_id}/{slug.replace('-','-')}-Logos/"
        html=get(root,sess)
        soup=BeautifulSoup(html,"html.parser")
        found=[]
        for a in soup.select('a[href*="/logos/view/"]'):
            href=urljoin(root,a.get("href",""))
            if "sportslogos.net/logos/view/" not in href:continue
            label=a.get_text(" ",strip=True)
            img=a.find("img")
            if img:
                label+=" "+str(img.get("alt",""))+" "+str(img.get("title",""))
            heading=a.find_previous(["h3","h2"])
            kind=heading.get_text(" ",strip=True) if heading else "unknown"
            type_="Mascot" if "Mascot" in kind else "Primary" if "Primary" in kind and "Dark" not in kind else "Secondary" if "Secondary" in kind else "Alternate" if "Alternate" in kind else "Other"
            if type_=="Other":continue
            start,end=years(label)
            if start is None:
                parent=a.find_parent(["li","div"])
                nearby=parent.get_text(" ",strip=True)[-140:] if parent else ""
                start,end=years(nearby)
            if start is None or start>1989 or end<1980:continue
            # SportsLogos logo pages include a historical start/end; retain the
            # original link and provenance even if an older mascot wins.
            item={"kind":type_,"years":[start,end],"label":label[:150],
                  "archive_page":href,"img_src":(img.get("data-src") or img.get("src") or "") if img else "",
                  "heading":kind}
            if not any(x["archive_page"]==href for x in found):found.append(item)
        def score(row):
            pos=PREFERENCE.index(row["kind"]) if row["kind"] in PREFERENCE else 8
            # Prefer visual identity more specific to the midpoint of the 1980s.
            return (pos,abs((min(1989,row["years"][1])+max(1980,row["years"][0]))/2-1985),-row["years"][0])
        found.sort(key=score)
        rec={"slug":slug,"team":name,"sportslogos_team_id":team_id,"team_archive_url":root,
             "candidate_count":len(found),"candidates":found[:15],
             "recommended":found[0] if found else None}
        records.append(rec)
        print(f"{slug:<18}: {len(found):>2} era-dated matches",
              [f"{x['kind']} {x['years']} {x['archive_page'].split('/view/')[-1][:22]}" for x in found[:4]],flush=True)
        time.sleep(.1)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"year":1985,"conference":"ACC","schools":records},indent=2)+"\n")
    if len(records)!=18:raise AssertionError("ACC must have 18 schools")
    missing=[r["slug"] for r in records if not r["recommended"]]
    if missing:raise AssertionError(f"Missing verified-era sources: {missing}")
    print("PASS: all 18 ACC members have year-dated authentic archival candidate links")
if __name__=="__main__":main()
