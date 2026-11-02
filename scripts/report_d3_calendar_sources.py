#!/usr/bin/env python3
"""Document verified NCAA DIII school calendars, exact refresh URLs and remaining individual failures."""
import json
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
DATA=Path(__file__).resolve().parents[1]/"data"
def run():
    schools=[]; summary={}
    for gender in ("men","women"):
        roster=json.loads((DATA/f"d3-{gender}-2026-27.json").read_text())
        feed=json.loads((DATA/f"d3-{gender}-official-fixtures-2026-27.json").read_text())
        teams={t["ncaa_org_id"]:t for t in roster["teams"] if t.get("membership_year")==2027 and t.get("d3_confirmed")}
        audit={a["owner_org_id"]:a for a in feed["source_audit"]}
        missing={a["ncaa_org_id"]:a for a in feed.get("unverified_school_review",[])}
        known={int(k):v for k,v in feed.get("last_verified_school_source",{}).items()}
        games={org:[] for org in teams}
        for f in feed["fixtures"]:
            for org in (f["away_org_id"],f["home_org_id"]):
                if org not in games:raise ValueError("Non-DIII fixture team")
                games[org].append(f)
        if len(teams)!=len(audit) or len(teams)!=feed["school_calendars_checked"]:
            raise ValueError("Partial NCAA source ledger")
        tally=Counter()
        for org,team in sorted(teams.items(),key=lambda x:x[1]["name"]):
            a=audit[org];m=missing.get(org,{})
            status={"parsed":"verified_university","parsed_conference":"verified_conference"}.get(a["status"],"unresolved")
            tally[status]+=1
            url=(a.get("verified_direct_url") or a.get("source_url","")) if status!="unresolved" else ""
            other=[g for g in games[org] if org not in g["verified_by_org_ids"]]
            schools.append({"gender":gender,"ncaa_org_id":org,"school":team["name"],
                "conference":team.get("conference",""),
                "ncaa_athletics_url":team.get("athletics_site",""),"status":status,
                "verified_2026_27_schedule_url":url,
                "previously_verified_university_url":known.get(org,""),
                "discovery_method":a.get("discovery_method",a.get("calendar_origin","")),
                "verified_opponent_rows":a.get("verified_member_opponents",0),
                "dated_games_from_other_official_sources":len(other),
                "opponent_source_examples":m.get("opponent_source_examples",[]),
                "attempted_source_urls":a.get("candidate_urls_tried",0),
                "additional_candidate_links":m.get("discovered_schedule_links",[]),
                "failure_category":m.get("category",""),
                "next_manual_action":m.get("next_action",""),
                "source_error":a.get("error",""),
                "rejected_page_evidence":a.get("rejected_page_evidence",[]),
                "refresh_rule":("Refresh exact URL and reverify season/gender/opponents/date; never infer scores"
                    if status=="verified_university" else
                    "Recheck official conference schedule; do not certify university calendar"
                    if status=="verified_conference" else
                    "Follow official university sports navigation, conference calendars and opponent evidence without inventing missing games")})
        summary[gender]={"ncaa_teams":len(teams),**tally}
    payload={"division":"d3","season":"2026-27",
        "updated_utc":datetime.now(timezone.utc).isoformat(),
        "summary":summary,"schools":schools}
    (DATA/"d3-calendar-source-register-2026-27.json").write_text(json.dumps(payload,indent=2)+"\n")
    lines=["# NCAA DIII 2026-27 basketball schedule sourcebook","",
      "Every NCAA-confirmed men/women program has an individual source status and refresh rule.",
      "An opponent-published game does not prove the missing school's full calendar.",
      "No schedule row is evidence of a final score. Access restrictions must not be bypassed.","",
      "| Measure | Men | Women |","|---|---:|---:|"]
    for field,label in [("ncaa_teams","NCAA-listed teams"),("verified_university","University schedules"),
      ("verified_conference","Official conference calendars"),("unresolved","School and conference calendars unresolved")]:
        lines.append("| "+label+" | "+str(summary["men"].get(field,0))+" | "+str(summary["women"].get(field,0))+" |")
    for gender in ("men","women"):
        rows=[x for x in schools if x["gender"]==gender]
        lines.extend(["","## "+gender.title()+" — verified calendar source URLs","",
          "| School / NCAA ID | Verification | Working refresh source | Matched opponents |",
          "|---|---|---|---:|"])
        for x in rows:
            if x["status"]=="unresolved":continue
            url=x["verified_2026_27_schedule_url"]
            link="[Exact verified URL]("+url+")" if url.startswith("https://") else "URL not captured"
            lines.append("| "+x["school"].replace("|","/")+" ("+str(x["ncaa_org_id"])+") | "+
                x["status"]+" | "+link+" | "+str(x["verified_opponent_rows"])+" |")
        lines.extend(["","## "+gender.title()+" — schools requiring individual source investigation","",
          "| School / NCAA ID | Starting official school site | Failure / exact next action | Games confirmed by opponents |",
          "|---|---|---|---:|"])
        for x in rows:
            if x["status"]!="unresolved":continue
            official=x["ncaa_athletics_url"]
            link="[NCAA athletics]("+official+")" if official.startswith("https://") else "No official link"
            note=x["failure_category"]+"; "+x["next_manual_action"]+"; "+str(x["attempted_source_urls"])+" URLs checked"
            if x["additional_candidate_links"]:
                note+="; [discovered schedule]("+x["additional_candidate_links"][0]+")"
            lines.append("| "+x["school"].replace("|","/")+" ("+str(x["ncaa_org_id"])+") | "+
                link+" | "+note.replace("|","/")+" | "+str(x["dated_games_from_other_official_sources"])+" |")
    lines.extend(["","## Ongoing refresh procedure","",
      "1. Refresh each exact successful university or official conference source URL above.",
      "2. Recheck sport, year, opponent NCAA org ID, home/away and postseason exclusions.",
      "3. If changed, follow the university athletics schedule links and record the new verified URL.",
      "4. Use official opponent sources only for individual documented fixtures, not full calendar certification.",
      "5. Final scores remain exclusive to the independently verified NCAA result ledger.",""])
    (DATA/"d3-calendar-source-notebook-2026-27.md").write_text("\n".join(lines))
    print("DIII individual source documents:",len(schools),"entries;",
          sum(s["unresolved"] for s in summary.values()),"unresolved")
if __name__=="__main__":run()
