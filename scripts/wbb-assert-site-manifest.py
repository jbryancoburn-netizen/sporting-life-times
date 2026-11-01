#!/usr/bin/env python3
"""Fail-closed reconciliation of an already crawled WBB site-conflict manifest.

Used just before a small manifest-only GitHub push. Never trusts a stale claim
from an older game schedule after another publisher has updated main.
"""
import datetime
import json
import pathlib
import re
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]/"data"
SOURCE = ROOT/"ncaaw-2026-27-official-site-conflicts.json"
CAL = ROOT/"ncaaw-schedules-2026-27.json"

def ny_date(timestamp):
    return datetime.datetime.fromisoformat(str(timestamp).replace("Z","+00:00")).astimezone(
        ZoneInfo("America/New_York")).date().isoformat()

def validate(doc,calendar):
    if doc.get("season")!="2026-27" or doc.get("gender")!="women" or doc.get("status")!="unresolved_university_site_claims":
        raise ValueError("Site manifest must be for current women-only school-site disagreements")
    if calendar.get("gender")!="women" or calendar.get("season")!="2026-27" or len(calendar.get("teams",{}))!=363:
        raise ValueError("Full 363-team women's 2026-27 calendar required")
    cases=doc.get("games")
    if not isinstance(cases,list) or not cases:
        raise ValueError("Empty school-site case set is not a verification result")
    index={(tid,str(g["id"])):g for tid,entry in calendar["teams"].items() for g in entry.get("games",[])}
    seen=set()
    for c in cases:
        tid,gid,opp=str(c.get("team_id","")),str(c.get("game_id","")),str(c.get("opponent_id",""))
        if not all(re.fullmatch(r"\d+",z) for z in (tid,gid,opp)):
            raise ValueError("School-site case missing numeric participant or exact event ID")
        if (tid,gid) in seen:
            raise ValueError("Duplicate conflicting school-game claim")
        seen.add((tid,gid))
        g=index.get((tid,gid))
        if not g or str(g.get("opponent_id"))!=opp or c.get("published_site")!=g.get("site"):
            raise ValueError("Site claim no longer matches the current women's game identity "+gid)
        if ny_date(g.get("date"))!=c.get("date"):
            raise ValueError("Site claim local game day changed "+gid)
        if tid not in (str(g.get("home_id")),str(g.get("away_id"))):
            raise ValueError("Site claim school is not a participant in "+gid)
        if c.get("published_site") not in ("home","away","neutral") or c.get("university_listed_site") not in ("home","away","neutral"):
            raise ValueError("Unknown location classification")
        if c.get("published_site")==c.get("university_listed_site"):
            raise ValueError("Matched source site incorrectly labeled as disputed")
        if not str(c.get("source_url","")).startswith("https://"):
            raise ValueError("Site conflict has no independently cited university source")
    if doc.get("school_game_claims")!=len(cases) or doc.get("unique_game_ids")!=len({c["game_id"] for c in cases}):
        raise ValueError("Site-conflict summary counts do not match case records")
    if doc.get("ambiguous_vs_at_neutral")!=sum(c.get("review_classification")=="ambiguous_vs_at_neutral_site" for c in cases):
        raise ValueError("Ambiguous neutral count is inconsistent")
    if doc.get("explicit_university_site_disagreements")!=sum(c.get("review_classification")=="explicit_site_claim_disagreement" for c in cases):
        raise ValueError("Explicit neutral count is inconsistent")
    return len(cases),len({c["game_id"] for c in cases})

def main():
    cases,games=validate(json.loads(SOURCE.read_text()),json.loads(CAL.read_text()))
    print("WBB CASE-PUBLISH SAFETY:",cases,"attributed school claims for",games,"distinct current 2026-27 women's games")

if __name__=="__main__":
    main()
