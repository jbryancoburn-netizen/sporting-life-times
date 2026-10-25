#!/usr/bin/env python3
"""Fail-closed refresh for 2026 MIAC men's soccer conference standings."""
from __future__ import annotations
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

SOURCE = "https://miacathletics.com/standings.aspx?path=msoc"
OUTPUT = Path("data/college-soccer-miac-standings.json")
ALIASES = {
    "st-olaf": ("st. olaf", "st olaf", "saint olaf"),
    "gust-adolphus": ("gustavus",),
    "carleton": ("carleton",),
    "saint-johns-mn": ("saint john", "st. john", "st john"),
    "augsburg": ("augsburg",),
    "st-scholastica": ("scholastica",),
    "macalester": ("macalester",),
    "hamline": ("hamline",),
    "bethel-mn": ("bethel",),
    "concordia-mhead": ("concordia",),
    "st-marys-mn": ("saint mary", "st. mary", "st mary"),
}
RECORD = re.compile(r"^\d+\s*-\s*\d+(?:\s*-\s*\d+)?$")
def normalize(v):
    v=unicodedata.normalize("NFKC",v).lower().replace("\u2019","'").replace("\xa0"," ")
    return re.sub(r"\s+"," ",v).strip()
def parse_rows(html):
    soup=BeautifulSoup(html,"html.parser")
    for table in soup.find_all("table"):
        found={}
        for tr in table.find_all("tr"):
            cells=[normalize(td.get_text(" ",strip=True)) for td in tr.find_all("td",recursive=False)]
            if len(cells)<3:continue
            raw_name=cells[0]
            matches=[key for key,aliases in ALIASES.items() if any(alias in raw_name for alias in aliases)]
            if len(matches)!=1:continue
            key=matches[0]
            records=[re.sub(r"\s+","",c) for c in cells[1:] if RECORD.fullmatch(c)]
            if not records:raise ValueError("Missing conference record for "+key)
            conf=records[0]
            parts=[int(v) for v in conf.split("-")]
            wins,losses=parts[:2]
            draws=parts[2] if len(parts)>2 else 0
            points=wins*3+draws
            overall=records[1] if len(records)>1 else ""
            # A standings-only feed does not prove a last match date.
            row={"team_id":key,"conference_record":conf,"conference_points":points,
                 "overall_record":overall,"conference_games":wins+losses+draws}
            if key in found and found[key]!=row:raise ValueError("Conflicting duplicate row "+key)
            found[key]=row
        if set(found)==set(ALIASES):return found
    raise ValueError("No complete 11-team MIAC standings table found; refuse partial update")

def main():
    request=Request(SOURCE,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0; soccer standings integrity audit)"})
    with urlopen(request,timeout=30) as response:page=response.read().decode("utf-8","replace")
    parsed=parse_rows(page)
    saved=json.loads(OUTPUT.read_text(encoding="utf-8"))
    old={r["team_id"]:r for r in saved["rows"]}
    new=[parsed[key] for key in ALIASES]
    for r in new:
        old_record=old.get(r["team_id"],{})
        prior=int(old_record.get("conference_games",sum(map(int,old_record.get("conference_record","0-0").split("-")))))
        if r["conference_games"]<prior:
            raise ValueError("Source games regressed for "+r["team_id"])
        if r["conference_games"]==prior and old_record.get("conference_points") is not None and r["conference_points"]!=old_record["conference_points"]:
            raise ValueError("Same-game points changed; manual correction required: "+r["team_id"])
    current=lambda rows:[(r["team_id"],r["conference_record"],r["conference_points"],r["overall_record"]) for r in rows]
    if current(saved["rows"])==current(new):
        print("No change to official MIAC conference results")
        return
    saved["rows"]=new
    saved["snapshot_checked_date"]=datetime.now(timezone.utc).date().isoformat()
    saved["last_verified_game_date"]=None
    saved["checked_at_utc"]=datetime.now(timezone.utc).isoformat(timespec="seconds")
    saved["note"]="Official MIAC 2026 11-team conference table parsed and validated. Last individual match date not inferred from standings."
    OUTPUT.write_text(json.dumps(saved,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Updated MIAC men's soccer 11-school standings")

if __name__=="__main__":main()
