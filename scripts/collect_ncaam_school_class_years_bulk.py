#!/usr/bin/env python3
"""Conservative official-roster-only class-year collector.

Requires a current-season roster heading, exact unique person name in an
isolated HTML player/roster row, a unique local academic-year label, and
a university-athletics URL from the checked allowlist. No guessed class years.
Writes candidates/rejections and optionally merges validated results to CSV.
"""
import argparse,csv,json,re,urllib.request,html,collections
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

CLASS_MAP={"fr":"Freshman","freshman":"Freshman","r fr":"Redshirt Freshman",
"r freshman":"Redshirt Freshman","redshirt freshman":"Redshirt Freshman",
"so":"Sophomore","sophomore":"Sophomore","r so":"Redshirt Sophomore",
"redshirt sophomore":"Redshirt Sophomore","jr":"Junior","junior":"Junior",
"r jr":"Redshirt Junior","redshirt junior":"Redshirt Junior",
"sr":"Senior","senior":"Senior","r sr":"Redshirt Senior",
"redshirt senior":"Redshirt Senior","gr":"Graduate","grad":"Graduate",
"graduate":"Graduate","graduate student":"Graduate"}
def norm(s):return re.sub("[^a-z0-9]","",str(s).casefold())
def label(s):
    x=re.sub(r"[^a-z ]"," ",str(s).lower()).strip()
    x=" ".join(x.split())
    return CLASS_MAP.get(x)
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimesOfficialRosterResearch/1.0)"})
    with urllib.request.urlopen(req,timeout=25) as response:
        return response.read(4500000).decode("utf-8","replace")
def classify_player(soup,name):
    wanted=norm(name)
    hits=[]
    for tag in soup.find_all(["a","span","div","h3","h4","td","strong"]):
        own=tag.get_text(" ",strip=True)
        if norm(own)!=wanted or len(own)>len(name)+5:continue
        # Skip container duplications, prefer the most deeply nested matching text.
        if any(norm(c.get_text(" ",strip=True))==wanted for c in tag.find_all(True)):
            continue
        for parent in list(tag.parents)[:6]:
            if parent.name not in ("tr","li","div","article","section"):continue
            text=parent.get_text(" ",strip=True)
            if len(text)>450:continue
            # Restricted to an isolated roster table row or athlete card.
            if parent.name!="tr" and not any(k in " ".join(parent.get("class",[])).lower() for k in ("roster","player","card","athlete","person")):
                continue
            if text.lower().count(name.lower())>2:continue
            tokens=re.findall(r"(?<![A-Za-z])(?:R[-. ]?(?:Fr|So|Jr|Sr)|Fr|So|Jr|Sr|Gr|Grad|Freshman|Sophomore|Junior|Senior|Graduate(?: Student)?|Redshirt (?:Freshman|Sophomore|Junior|Senior))(?![A-Za-z])",text,re.I)
            classes={label(token) for token in tokens if label(token)}
            if len(classes)==1:
                hits.append(next(iter(classes)))
                break
    return next(iter(set(hits))) if len(set(hits))==1 else None
def run(targets,existing,sources):
    targeted={r["current_athlete_id"]:r for r in targets["players"]}
    old=set(row["current_athlete_id"] for row in existing)
    by_school=collections.defaultdict(list)
    for p in targeted.values():
        if p["current_athlete_id"] not in old:by_school[p["current_school"]].append(p)
    recovered=[];failed=[];sources_run=[]
    eligible={school:url for school,url in sources.items() if school in by_school}
    with ThreadPoolExecutor(max_workers=14) as pool:
        futures={school:pool.submit(fetch,url) for school,url in eligible.items()}
        responses={}
        for school,future in futures.items():
            try:responses[school]=(future.result(),None)
            except Exception as exc:responses[school]=(None,str(exc)[:110])
    for school,url in eligible.items():
        if not url.startswith("https://") or "espn" in url.lower():raise ValueError("Non-school URL")
        raw,error=responses[school]
        if error is not None:
            sources_run.append({"school":school,"status":"fetch_failed","error":error});continue
        soup=BeautifulSoup(raw,"html.parser")
        heading=soup.title.get_text(" ",strip=True) if soup.title else ""
        heading+=" "+ " ".join(h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=8))
        if not re.search(r"2026\s*[-–]\s*27|2026\s*/\s*27",heading):
            sources_run.append({"school":school,"status":"season_unverified","heading":heading[:130]});continue
        n=0
        for p in by_school[school]:
            year=classify_player(soup,p["player"])
            if year:
                recovered.append({"current_athlete_id":p["current_athlete_id"],"player":p["player"],
                    "team":school,"class_year":year,"official_roster_url":url})
                n+=1
            else: failed.append({"id":p["current_athlete_id"],"school":school,"name":p["player"],"reason":"no_unambiguous_card_year"})
        sources_run.append({"school":school,"status":"processed","matched":n,"targeted":len(by_school[school])})
    return recovered,{"input_targets":len(targeted),"already_classified":len(old & set(targeted)),
        "new_official_class_years":len(recovered),"source_results":sources_run,"still_unmatched_in_queue":len(targeted)-len(old & set(targeted))-len(recovered),
        "unmatched_sample":failed[:100],"class_counts":dict(collections.Counter(x["class_year"] for x in recovered))}
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--sources",default="data/ncaam-2026-27-official-roster-urls.json")
    a.add_argument("--queue",default="data/ncaam-2026-27-next-500-unclassified-targets.json")
    a.add_argument("--csv",default="data/ncaam-2026-27-school-roster-class-years.csv")
    a.add_argument("--report",default="data/ncaam-2026-27-official-bulk-recovery-report.json")
    z=a.parse_args()
    sources=json.loads(Path(z.sources).read_text())
    queue=json.loads(Path(z.queue).read_text())
    with open(z.csv,newline="",encoding="utf-8") as f: rows=list(csv.DictReader(f))
    added,report=run(queue,rows,sources)
    existing_ids={x["current_athlete_id"] for x in rows}
    assert len({x["current_athlete_id"] for x in added})==len(added)
    assert all(x["current_athlete_id"] not in existing_ids for x in added)
    with open(z.csv,"a",newline="",encoding="utf-8") as f:
        out=csv.writer(f)
        for x in added:out.writerow([x["current_athlete_id"],x["player"],x["team"],x["class_year"],x["official_roster_url"]])
    Path(z.report).write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
if __name__=="__main__":main()
