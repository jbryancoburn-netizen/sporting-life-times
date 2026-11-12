#!/usr/bin/env python3
"""Read-only season-to-public CBB reconciliation. Never changes results or RETRO.

All final-game discrepancies include event IDs, teams, dates and source/Pages links.
Absence of optional player/venue evidence is reported as a coverage gap, never
silently equated to a correct box score. Real publication errors fail CI.
"""
import collections
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
OUT=Path(os.environ.get("CBB_BASELINE_OUTPUT","artifacts/cbb-baseline"))
SITE=os.environ.get("CBB_SITE_URL","https://jbryancoburn-netizen.github.io/sporting-life-times/").rstrip("/")+"/"
BLOB="https://github.com/jbryancoburn-netizen/sporting-life-times/blob/main/"
UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
STAMP=str(int(NOW.timestamp()))
OUT.mkdir(parents=True,exist_ok=True)

def load(name):
    return json.loads((DATA/name).read_text(encoding="utf-8"))

def date_of(value):
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except (TypeError,ValueError):
        return None

def numeric(value):
    if isinstance(value,dict):
        value=value.get("value",value.get("displayValue"))
    try:
        return int(value)
    except (ValueError,TypeError):
        return None

def normalized_id(value):
    return str(value or "").removeprefix("espn:")

def source_link(gender,gid):
    sport="mens" if gender=="men" else "womens"
    return "https://www.espn.com/"+sport+"-college-basketball/game/_/gameId/"+quote(normalized_id(gid))

def team_link(gender,id):
    return SITE+("ncaam-team.html?team=" if gender=="men" else "ncaaw-team.html?team=")+quote(str(id),safe="")

def public_link(file):
    return SITE+"data/"+file

def read_public(path):
    url=public_link(path)+"?cbb_baseline="+STAMP
    last=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={
                "User-Agent":"SportingLifeTimes-CBB-Baseline/1.0",
                "Cache-Control":"no-cache","Pragma":"no-cache"})
            with urllib.request.urlopen(req,timeout=40) as response:
                raw=response.read()
            return json.loads(raw),len(raw),None
        except (OSError,ValueError,TypeError) as exc:
            last=str(exc)[:220]
            if attempt<2:
                time.sleep(2+attempt*2)
    return None,0,last

def index_games(rows):
    found={}; duplicates=[]
    for row in rows:
        key=normalized_id(row.get("id"))
        if not key:
            duplicates.append({"id":"", "reason":"missing ID"})
        elif key in found:
            duplicates.append({"id":key,"reason":"duplicate source ID"})
        else:
            found[key]=row
    return found,duplicates

def identity(game):
    return (str(game.get("home_id")),str(game.get("away_id")),
            numeric(game.get("home_score")),numeric(game.get("away_score")))

def final_state(row):
    return row.get("status",{}).get("type",{}).get("completed") is True

def schedule_team_scores(row):
    members=(row.get("competitions") or [{}])[0].get("competitors") or []
    if len(members)!=2:
        return None
    scores={str((s.get("team") or {}).get("id")):numeric(s.get("score")) for s in members}
    return scores if len(scores)==2 else None

def schedule_match(row,game,ids,gender):
    if gender=="men":
        scores=schedule_team_scores(row)
        if scores != ids or not final_state(row):
            return False
        if normalized_id(row.get("id"))!=normalized_id(game.get("id")):
            if not (row.get("official_source") is True and
                    str(row.get("school_source_url","")).startswith("https://")):
                return False
    else:
        if normalized_id(row.get("id"))!=normalized_id(game.get("id")) or not row.get("completed"):
            return False
        h,a=str(row.get("home_id")),str(row.get("away_id"))
        scores={h:numeric(row.get("home_score")),a:numeric(row.get("away_score"))}
        if scores != ids:
            return False
    first,second=date_of(row.get("date")),date_of(game.get("date"))
    return first is not None and second is not None and abs((first-second).days)<=1

def venue_of(row,gender):
    if not row:
        return ""
    if gender=="women":
        return str(row.get("venue") or "").strip()
    comp=(row.get("competitions") or [{}])[0]
    v=comp.get("venue") or {}
    return str(v.get("arenaName") or v.get("fullName") or "").strip()

def norm_venue(v):
    return re.sub(r"[^a-z0-9]+","",str(v or "").lower())

def venue_agrees(a,b):
    aa,bb=norm_venue(a),norm_venue(b)
    return not aa or not bb or aa==bb or (
        len(aa)>7 and len(bb)>7 and (aa in bb or bb in aa))

def issue(gender,row,kind,detail,severity,links=None):
    return {
        "gender":gender,"game_id":normalized_id(row.get("id")),
        "date":str(row.get("date") or "")[:10],
        "home_id":str(row.get("home_id")),"away_id":str(row.get("away_id")),
        "home_score":row.get("home_score"),"away_score":row.get("away_score"),
        "type":kind,"severity":severity,"detail":str(detail)[:300],
        "urls":[source_link(gender,row.get("id"))]+(links or [])
    }

def get_player_evidence(feed,gender):
    expected="men" if gender=="men" else "women"
    out=collections.defaultdict(list)
    for kind in ("ncaa_player_boxscores","ncaa_team_boxscores"):
        raw=(feed.get(kind) or {}).get("games") or {}
        for entry in (raw.values() if isinstance(raw,dict) else raw):
            if entry.get("gender")!=expected or not entry.get("espn_id"):
                continue
            out[normalized_id(entry["espn_id"])].append((kind,entry))
    return out

def inspect_player(gender,game,evidence):
    # Only claim player-to-final verification when real per-game source evidence exists.
    notes=[];problems=[]
    for kind,row in evidence:
        if kind=="ncaa_player_boxscores":
            for side in ("home","away"):
                part=row.get(side) or {}
                players=part.get("players") or []
                if not players:
                    continue
                total=sum(numeric(p.get("pts")) or 0 for p in players)
                wanted=numeric(game.get(side+"_score"))
                if total != wanted:
                    problems.append((kind+"_points_disagree",side+
                        " player total "+str(total)+" vs final "+str(wanted)))
                else:
                    notes.append("player "+side+" reconciled")
        if kind=="ncaa_team_boxscores":
            for side in ("home","away"):
                part=row.get(side) or {}
                pts=numeric(part.get("pts"))
                wanted=numeric(game.get(side+"_score"))
                if pts is not None and pts!=wanted:
                    problems.append((kind+"_points_disagree",side+
                        " team boxscore "+str(pts)+" vs final "+str(wanted)))
                elif pts is not None:
                    notes.append("team "+side+" reconciled")
    return notes,problems

def analyze():
    cross=load("ncaam-2026-27-espn-team-crosswalk.json")["teams"]
    ncaa_to_espn={str(x["id"]):str(x["espn_id"]) for x in cross if x.get("espn_id")}
    men_sched={str(x["espn_id"]):"mbb-schedules-2026-27/"+str(x["espn_id"])+".json"
               for x in cross if x.get("espn_id")}
    local_men={tid:load(path) for tid,path in men_sched.items()}
    local_women=load("ncaaw-schedules-2026-27.json")["teams"]
    local_live=load("mbb-live.json")
    player_sources={g:get_player_evidence(local_live,g) for g in ("men","women")}
    overall=load("mbb-overall-records-2026-27.json").get("records",{})
    legacy=load("mbb-2026-2027-results.json")
    results={}
    published_paths={
        "ncaam-2026-27-retro-primary.json","ncaaw-2026-27-retro-primary.json",
        "ncaaw-schedules-2026-27.json","mbb-overall-records-2026-27.json",
        "mbb-live.json","mbb-current-player-stats.json"}
    published_paths.update(men_sched.values())
    public={}; fetch_errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures={executor.submit(read_public,p):p for p in sorted(published_paths)}
        for future in concurrent.futures.as_completed(futures):
            p=futures[future]
            try:
                obj,bytes_received,error=future.result()
            except Exception as exc:
                obj,bytes_received,error=None,0,str(exc)
            if error:
                fetch_errors[p]=error
            else:
                public[p]={"content":obj,"bytes":bytes_received}
    # Public Pages validation covers ALL 365 men's individual school JSONs,
    # not only the most recently active programs.
    public_men={tid:(public.get(path) or {}).get("content",{})
                for tid,path in men_sched.items()}
    public_women=((public.get("ncaaw-schedules-2026-27.json") or {})
                  .get("content") or {}).get("teams",{})
    public_live=((public.get("mbb-live.json") or {}).get("content") or {})
    public_player={g:get_player_evidence(public_live,g) for g in ("men","women")}
    differences=[]
    all_rows=[]
    misc=[]
    legacy_ids={normalized_id(g.get("id")) for g in legacy.get("games",[])}
    source_men=load("mbb-retro-live-finals.json")["games"]
    source_women=[g for g in load("ncaaw-2026-27-verified-games.json")["games"]
                  if g.get("status")=="final"]
    sources={"men":source_men,"women":source_women}
    for gender in ("men","women"):
        source,dup=index_games(sources[gender])
        retro=load("ncaam-2026-27-retro-primary.json" if gender=="men"
                   else "ncaaw-2026-27-retro-primary.json")
        prpath="ncaam-2026-27-retro-primary.json" if gender=="men" else "ncaaw-2026-27-retro-primary.json"
        public_doc=(public.get(prpath) or {}).get("content") or {}
        retro_rows,retro_dups=index_games(retro.get("events") or [])
        public_rows,public_dups=index_games(public_doc.get("events") or [])
        team_records=collections.defaultdict(lambda:{"wins":0,"losses":0,"games":0})
        for game in sources[gender]:
            home,away=game.get("home_id"),game.get("away_id")
            hs,ass=numeric(game.get("home_score")),numeric(game.get("away_score"))
            if hs is not None and ass is not None and hs!=ass:
                for team,won in ((str(home),hs>ass),(str(away),ass>hs)):
                    team_records[team]["games"]+=1
                    team_records[team]["wins"]+=int(won)
                    team_records[team]["losses"]+=int(not won)
        ratings={str(t.get("team_id")):t for t in retro.get("rankings") or []}
        public_ratings={str(t.get("team_id")):t for t in public_doc.get("rankings") or []}
        local_meta={
            "source_finals":len(sources[gender]),"source_unique":len(source),
            "retro_finals":len(retro_rows),"public_retro_finals":len(public_rows),
            "ranked_programs":len(ratings),"public_ranked_programs":len(public_ratings),
            "duplicate_source_ids":dup,"duplicate_retro_ids":retro_dups,
            "duplicate_public_retro_ids":public_dups,
            "school_schedules_expected":365 if gender=="men" else 363,
            "player_boxscore_evidence":len(player_sources[gender]),
            "public_player_boxscore_evidence":len(public_player[gender])
        }
        results[gender]=local_meta
        for t,expected in team_records.items():
            actual=ratings.get(t,{})
            published=public_ratings.get(t,{})
            for label,obj in (("local",actual),("public",published)):
                wins,losses=numeric(obj.get("wins")),numeric(obj.get("losses"))
                if (wins,losses)!=(expected["wins"],expected["losses"]):
                    misc.append({
                        "gender":gender,"team_id":t,"type":"standings_record_mismatch",
                        "severity":"critical","location":label,
                        "expected":expected,"actual":{"wins":wins,"losses":losses},
                        "url":team_link(gender,t)
                    })
            if gender=="men":
                rec=overall.get(t,{})
                if (numeric(rec.get("retro_wins")),numeric(rec.get("retro_losses")))!=(
                    expected["wins"],expected["losses"]):
                    misc.append({
                        "gender":gender,"team_id":t,"type":"overall_record_retro_component_mismatch",
                        "severity":"critical","expected":expected,
                        "actual":{"retro_wins":rec.get("retro_wins"),"retro_losses":rec.get("retro_losses")},
                        "url":team_link(gender,t)
                    })
        for key,g in source.items():
            record={
                "gender":gender,"game_id":key,"date":g.get("date"),
                "teams":{"home":g.get("home_id"),"away":g.get("away_id")},
                "scores":{"home":g.get("home_score"),"away":g.get("away_score")},
                "source_url":source_link(gender,key),
                "retro_local":"pending","retro_public":"pending",
                "school_calendar_local":{},"school_calendar_public":{},
                "player_evidence":{},"venue_evidence":{},
                "issues":[]
            }
            all_rows.append(record)
            def flag(code,detail,severity="critical",links=None):
                v=issue(gender,g,code,detail,severity,links)
                record["issues"].append(v)
                differences.append(v)
            for place,lookup in (("local",retro_rows),("public",public_rows)):
                obj=lookup.get(key)
                status="match" if obj is not None and identity(obj)==identity(g) else "mismatch"
                record["retro_"+place]=status
                if status!="match":
                    flag("retro_"+place+"_missing_or_conflicting_final",
                         "No exact published ID/team/score final: "+str(identity(obj) if obj else "missing"),
                         links=[public_link(prpath)])
            if gender=="men" and key not in legacy_ids:
                flag("legacy_results_lag","Legacy results document omits canonical verified final",
                     "warning",[BLOB+"data/mbb-2026-2027-results.json"])
            ids={str(g.get("home_id")):numeric(g.get("home_score")),
                 str(g.get("away_id")):numeric(g.get("away_score"))}
            if gender=="men":
                try:
                    mapped={ncaa_to_espn[t]:points for t,points in ids.items()}
                except KeyError:
                    flag("crosswalk_missing","Canonical team ID cannot map to ESPN school calendar")
                    continue
            else:
                mapped=ids
            for team_id in mapped:
                if gender=="men":
                    doc=local_men.get(team_id,{})
                    rows=doc.get("events") or []
                    published_rows=(public_men.get(team_id) or {}).get("events") or []
                    team_path=men_sched.get(team_id,"")
                else:
                    rows=(local_women.get(team_id) or {}).get("games") or []
                    published_rows=(public_women.get(team_id) or {}).get("games") or []
                    team_path="ncaaw-schedules-2026-27.json"
                local_matches=[s for s in rows if schedule_match(s,g,mapped,gender)]
                public_matches=[s for s in published_rows if schedule_match(s,g,mapped,gender)]
                for place,matches in (("local",local_matches),("public",public_matches)):
                    status="match" if len(matches)==1 else ("duplicate" if len(matches)>1 else "missing")
                    record["school_calendar_"+place][team_id]=status
                    if status!="match":
                        flag("calendar_"+place+"_"+status,
                             "School "+team_id+" "+status+" exact final (identity, score, date, state)",
                             links=[public_link(team_path),team_link(gender,g["home_id"]),
                                    team_link(gender,g["away_id"])])
                # Venue comparisons are done against source-confirmed venue only
                # and against two university views; no guessing from home-arena registry.
                venue=venue_of(local_matches[0],gender) if local_matches else ""
                record["venue_evidence"][team_id]=venue
                if gender=="women" and g.get("venue") and not venue:
                    flag("source_venue_not_in_school_calendar",
                         "Verified-game venue "+str(g.get("venue"))+" absent from school "+team_id,
                         "warning",[public_link(team_path)])
                elif gender=="women" and g.get("venue") and venue and not venue_agrees(g["venue"],venue):
                    flag("source_venue_disagreement","Verified "+str(g.get("venue"))+
                         " vs school "+team_id+": "+venue,
                         "warning",[public_link(team_path)])
            venues=[v for v in record["venue_evidence"].values() if v]
            if len(venues)==2 and not venue_agrees(*venues):
                flag("two_school_venue_disagreement",
                     "The participating university calendars report different venues: "+str(venues),
                     "warning",[team_link(gender,g["home_id"]),team_link(gender,g["away_id"])])
            for place,source_index in (("local",player_sources),("public",public_player)):
                evidence=source_index[gender].get(key,[])
                notes,problems=inspect_player(gender,g,evidence)
                record["player_evidence"][place]={
                    "sources":len(evidence),"reconciled":notes,
                    "state":"available" if evidence else "not_published_or_not_source_verified"}
                for kind,detail in problems:
                    flag("player_"+place+"_"+kind,detail,
                         "critical",[public_link("mbb-live.json")])
            if not record["player_evidence"]["local"]["sources"]:
                record["player_evidence"]["coverage_gap"]=True
        results[gender]["unresolved_games"]=sum(bool(x["issues"]) for x in all_rows if x["gender"]==gender)
        results[gender]["critical_game_discrepancies"]=sum(
            any(y["severity"]=="critical" for y in x["issues"]) for x in all_rows if x["gender"]==gender)
    # Audited player file publication provenance; not an invented per-game validation.
    player_file_local=DATA/"mbb-current-player-stats.json"
    local_digest=hashlib.sha256(player_file_local.read_bytes()).hexdigest() if player_file_local.exists() else None
    published_current=(public.get("mbb-current-player-stats.json") or {}).get("content")
    # Re-encode only as additional descriptive info: public JSON whitespace may differ.
    player_file={"source_sha256":local_digest,
                 "source_bytes":player_file_local.stat().st_size if player_file_local.exists() else 0,
                 "public_available":published_current is not None,
                 "public_schema_keys":list(published_current)[:20] if isinstance(published_current,dict) else [],
                 "source_note":"Aggregate player statistics cannot certify every game without a linked game ID"}
    report={
        "schema_version":1,"generated_at":NOW.isoformat(),"season":"2026-27",
        "scope":"All verified D-I men's and women's season finals, all school calendars, public Pages, RETRO, records, player and venue source coverage",
        "site":SITE,"repository_revision":os.environ.get("GITHUB_SHA","unknown"),
        "gender_summary":results,"public_files_requested":len(published_paths),
        "public_files_fetched":len(public),"public_fetch_failures":fetch_errors,
        "player_statistics_file":player_file,
        "issues_summary":dict(collections.Counter(i["type"] for i in differences)),
        "severity_summary":dict(collections.Counter(i["severity"] for i in differences)),
        "team_standings_issues":misc,
        "per_game":all_rows,
        "discrepancies":differences,
        "remaining_uncertainty":[
            "An unpublished player box score is an explicit coverage gap, not evidence of zero points.",
            "Venue names without independent school/source corroboration are not certified by this report.",
            "Source ledgers may omit an ESPN final not yet ingested; the separate 5-minute scoreboard watchdog covers recent source discovery.",
            "This baseline is a measurement, not a repair of discrepancies."
        ]
    }
    return report

def render(report):
    lines=[
        "# College Basketball Baseline Reconciliation",
        "",
        "Generated: "+report["generated_at"]+" (UTC)",
        "",
        "All checks compare season-long verified finals with local and PUBLIC GitHub Pages artifacts.",
        "",
        "| Metric | Men | Women |","|---|---:|---:|"]
    m,w=report["gender_summary"]["men"],report["gender_summary"]["women"]
    for field,title in [
        ("source_finals","Canonical source finals"),("retro_finals","Local RETRO finals"),
        ("public_retro_finals","Public RETRO finals"),("school_schedules_expected","School calendars"),
        ("critical_game_discrepancies","Games with critical discrepancies"),
        ("unresolved_games","Games with any discrepancy or source coverage warning"),
        ("player_boxscore_evidence","Games with any local player/team-boxscore evidence")
    ]:
        lines.append("| "+title+" | "+str(m[field])+" | "+str(w[field])+" |")
    lines.extend(["","Public JSON documents fetched: "+str(report["public_files_fetched"])+
                  "/"+str(report["public_files_requested"]),"",
                  "## Discrepancy types"])
    for kind,n in sorted(report["issues_summary"].items(),key=lambda x:(-x[1],x[0])):
        lines.append("- "+kind+": "+str(n))
    lines.extend(["","Standings discrepancies: "+str(len(report["team_standings_issues"])),
                  "Public fetch errors: "+str(len(report["public_fetch_failures"])),"",
                  "## Itemized game issues (first 125; complete index in report.json)"])
    for issue_row in report["discrepancies"][:125]:
        links=issue_row["urls"]
        lines.append("- **"+issue_row["severity"].upper()+" "+issue_row["gender"]+
                     " "+issue_row["game_id"]+"** ("+issue_row["date"]+
                     "): "+issue_row["type"]+" — "+issue_row["detail"]+
                     " · [Source]("+links[0]+")"+
                     (" · [Public data]("+links[1]+")" if len(links)>1 else ""))
    lines.extend(["","## Full evidence",
      "All "+str(len(report["per_game"]))+" verified finals, both school-calendar",
      "status checks, boxscore coverage flags, venue evidence and all URLs are in report.json.",
      "Unverified coverage is identified explicitly; no implicit clean bill of health.",
      ""])
    return "\n".join(lines)

def main():
    try:
        report=analyze()
    except Exception as exc:
        report={"generated_at":NOW.isoformat(),"audit_failed":repr(exc),
                "severity_summary":{"audit_exception":1},
                "discrepancies":[]}
        (OUT/"report.json").write_text(json.dumps(report,indent=2)+"\n")
        raise
    (OUT/"report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (OUT/"report.md").write_text(render(report),encoding="utf-8")
    counts={
        "men":report["gender_summary"]["men"],
        "women":report["gender_summary"]["women"],
        "public_files_fetched":report["public_files_fetched"],
        "public_files_requested":report["public_files_requested"],
        "critical":report["severity_summary"].get("critical",0)+
                   sum(i["severity"]=="critical" for i in report["team_standings_issues"]),
        "warnings":report["severity_summary"].get("warning",0),
        "public_errors":len(report["public_fetch_failures"]),
        "report":"artifacts/cbb-baseline/report.json"
    }
    print(json.dumps(counts,indent=2),flush=True)
    # Step #03 measures the baseline; critical mismatches are NOT a passing release gate.
    if counts["critical"] or counts["public_errors"]:
        print("::error::CBB baseline found real discrepancies or inaccessible public files.")
        return 1
    return 0

if __name__=="__main__":
    sys.exit(main())
