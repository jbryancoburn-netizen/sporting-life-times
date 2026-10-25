#!/usr/bin/env python3
"""Audit every published NCAA soccer conference desk against its verified registry.
Fail closed on missing pages, ratings, standings, rules, malformed seeds or duplicates.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def data(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))
def validate():
    registry=data("data/college-soccer-conferences.json")
    elo=data("data/college-soccer-elo.json")
    rules=data("data/college-soccer-postseason-rules.json")
    assert registry["conferences"], "Empty verified directory"
    paths=set()
    errors=[]
    covered={c:0 for c in elo["cohorts"]}
    for key,conference in registry["conferences"].items():
        if ":" not in key:
            errors.append(f"{key}: invalid cohort/conference key");continue
        cohort,league=key.split(":",1)
        teams=conference.get("teams",[])
        path=conference.get("page")
        feed=conference.get("standings_feed")
        if cohort not in elo["cohorts"]:
            errors.append(f"{key}: missing rating cohort");continue
        if not teams or len(set(teams))!=len(teams):
            errors.append(f"{key}: missing or repeated members")
        if not path or not path.endswith(".html") or path in paths or not (ROOT/path).is_file():
            errors.append(f"{key}: missing/duplicate conference page {path}")
        paths.add(path)
        if not feed or not (ROOT/feed).is_file():
            errors.append(f"{key}: missing official standings feed {feed}");continue
        if key not in rules.get("conferences",{}):
            errors.append(f"{key}: missing conference championship rules")
        else:
            rule=rules["conferences"][key]
            if rule.get("cohort")!=cohort:
                errors.append(f"{key}: tournament rules assigned to wrong NCAA cohort")
        if path and (ROOT/path).is_file():
            html=(ROOT/path).read_text(encoding="utf-8")
            if f'data-conference="{key}"' not in html:
                errors.append(f"{key}: page displays another conference")
            if "college-soccer-conference-page.js" not in html or "college-soccer-cup-ui.js" not in html:
                errors.append(f"{key}: missing bracket or rating engine")
        current={r["team_id"] for r in elo["cohorts"][cohort]}
        for team in teams:
            if team not in current:
                errors.append(f"{key}: Elo missing {team}")
            if registry.get("team_to_conference",{}).get(f"{cohort}:{team}")!=key:
                errors.append(f"{key}: reverse conference mapping missing {team}")
        table=data(feed)
        rows=table.get("rows",[])
        ids=[r.get("team_id") for r in rows]
        if set(ids)!=set(teams) or len(rows)!=len(teams):
            errors.append(f"{key}: official standings / membership mismatch")
        for row in rows:
            record=row.get("conference_record","")
            try:
                wins,losses,*draws=map(int,record.split("-"))
                draw=draws[0] if draws else 0
                expected=3*wins+draw
                if expected!=row.get("conference_points"):
                    errors.append(f"{key}: incorrect points for {row.get('team_id')}")
            except (ValueError,TypeError):
                errors.append(f"{key}: invalid official conference record {record}")
        covered[cohort]+=len(teams)
    report={"conference_desks":len(registry["conferences"]),"conference_team_entries":sum(covered.values()),"rated_teams":{k:len(v) for k,v in elo["cohorts"].items()},"mapped_team_entries_by_cohort":covered,"errors":errors}
    print(json.dumps(report,indent=2))
    if errors:raise AssertionError(f"{len(errors)} NCAA conference release conflicts")
    return report
if __name__=="__main__":validate()
