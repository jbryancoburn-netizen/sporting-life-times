#!/usr/bin/env python3
"""Offline exact-match importer for cited 2026-27 women's school/league sources.

Never assert that a school's ESPN calendar, a generic media deal, or a
reciprocal school page constitutes direct university confirmation.
"""
import collections,datetime as dt,json,pathlib,re
from zoneinfo import ZoneInfo

ROOT=pathlib.Path("data")
M=ROOT/"ncaaw-2026-27-final-five-official-evidence.json"
CAL=ROOT/"ncaaw-schedules-2026-27.json"
EVID=ROOT/"ncaaw-2026-27-official-schedule-bulk-evidence.json"
BULK=ROOT/"ncaaw-2026-27-official-schedule-bulk-audit.json"
AUDIT=ROOT/"ncaaw-schedules-2026-27-audit.json"
REPORT=ROOT/"ncaaw-2026-27-final-five-official-evidence-audit.json"
NY=ZoneInfo("America/New_York")
ALIASES={
 "neworleans":"lsuneworleans","uapb":"arkansaspinebluff",
 "ulm":"ulmonroe","nku":"northernkentucky",
 "una":"northalabama","etsu":"easttennesseestate",
 "uscupstate":"southcarolinaupstate","southerncal":"usc",
 "pitt":"pittsburgh","cal":"california","ncstate":"ncstate",
 "uncgreensboro":"uncgreensboro","olemiss":"olemiss",
 "floridainternational":"floridainternational","uconn":"uconn",
 "lsu":"lsu"
}
def get(path):return json.loads(path.read_text(encoding="utf-8"))
def norm(s):
 return re.sub(r"[^a-z0-9]","",str(s or "").lower())
def local_day(s):
 return dt.datetime.fromisoformat(str(s).replace("Z","+00:00")).astimezone(NY).date().isoformat()
def match(label,name):
 needle=norm(label);full=norm(name)
 # Local matchup date + school team ID must still be unique; never rely
 # on a league-wide guess. Prevent weak/ambiguous short substrings.
 if len(needle)<3:return False
 alias=ALIASES.get(needle,needle)
 if needle=="lsu":return full.startswith("lsutigers") and not full.startswith("lsuneworleans")
 if needle=="cal":return full.startswith("californiagolden")
 if needle=="tennessee":return full.startswith("tennesseelady")
 if needle=="georgia":return full.startswith("georgialady")
 if needle=="alabama":return full.startswith("alabamacrimson")
 if needle=="florida":return full.startswith("floridagators")
 if needle=="texas":return full.startswith("texaslonghorns")
 if needle=="southcarolina":return full.startswith("southcarolinagamecocks")
 if needle=="southern":return full.startswith("southernjaguars")
 if needle=="miami":return full.startswith("miamihurricanes")
 if needle=="arizona":return full.startswith("arizonawildcats")
 return full==alias or (len(alias)>=5 and full.startswith(alias))

def run():
 m,cal,ev,b,a=(get(p) for p in (M,CAL,EVID,BULK,AUDIT))
 if not (m.get("season")==cal.get("season")==ev.get("season")=="2026-27" and
         m.get("gender")==cal.get("gender")==ev.get("gender")=="women" and
         len(cal["teams"])==363):
  raise RuntimeError("Required 363-team women-only season or evidence source mismatch")
 previous=int(b.get("verified_school_count_including_prior") or 0)
 if previous<350:raise RuntimeError("Cannot import final official sources on regressed official baseline")
 existing={(str(r["team_id"]),str(r["game_id"])) for r in ev["rows"]}
 bygame={(str(tid),str(g["id"])):g for tid,t in cal["teams"].items() for g in t["games"]}
 ids=collections.defaultdict(set)
 for (tid,gid) in bygame:ids[tid].add(gid)
 found,skipped,source_count=[],[],collections.Counter()
 for source in m["sources"]:
  tid=str(source["team_id"]);url=str(source["source_url"]);kind=source["source_type"]
  if not url.startswith("https://") or tid not in cal["teams"]:
   raise RuntimeError("Invalid school or official citation")
  if not kind.startswith("official_"):raise RuntimeError("Unattributed source")
  games=collections.defaultdict(list)
  for g in cal["teams"][tid]["games"]:games[local_day(g["date"])].append(g)
  seen_ids=set()
  for row in source["rows"]:
   day,op=row["date"],row["opponent"]
   if not re.fullmatch(r"202[67]-\d\d-\d\d",day):raise RuntimeError("Invalid source date")
   candidates=[g for g in games[day] if match(op,g.get("opponent"))]
   if len(candidates)!=1:
    skipped.append({"school_id":tid,"date":day,"opponent":op,"reason":"not_unique_date_and_opponent","count":len(candidates)})
    continue
   g=candidates[0];gid=str(g["id"]);key=(tid,gid)
   if gid in seen_ids:
    skipped.append({"school_id":tid,"date":day,"opponent":op,"reason":"duplicate_source_game"})
    continue
   seen_ids.add(gid)
   site=row.get("site")
   if site and site not in ("home","away","neutral"):raise RuntimeError("Bad official site")
   if site and site!=g.get("site"):
    skipped.append({"school_id":tid,"date":day,"opponent":op,"reason":"official_site_conflicts_calendar","game_id":gid})
    # Preserve date+opponent evidence without claiming site proof.
   fields=["scheduled_date","opponent"]
   if site and site==g.get("site"):fields.append("home_away")
   if key in existing:continue
   item={"team_id":tid,"game_id":gid,"verified_date":day,"verified_opponent":op,
         "verified_fields":fields,"source_url":url,"source_type":kind,
         "source_record":"2026-27 official women's individually dated schedule"}
   ev["rows"].append(item);existing.add(key);found.append(item)
   g["official_schedule_verified_fields"]=fields
   g["official_schedule_source_url"]=url
   g["official_schedule_source_type"]=kind
   source_count[tid]+=1
 # Never alter or remove an existing verified citation.
 if len(existing)<int(b.get("verified_team_game_rows_including_prior") or 0):
  raise RuntimeError("Official source evidence was lost")
 evidence_schools={str(x["team_id"]) for x in ev["rows"]}
 for item in b.get("school_results",[]):
  tid=str(item["team_id"])
  if source_count[tid]:
   if item.get("status") not in ("matched_university_games","matched_conference_games","matched_reciprocal_opponent_games"):
    item["status"]=("matched_reciprocal_opponent_games" if tid=="2115" else
                    "matched_conference_games" if tid=="2635" else "matched_university_games")
   item["matched"]+=source_count[tid]
   item["source"]=next(x["source_url"] for x in m["sources"] if str(x["team_id"])==tid)
   item["source_rows"]+=sum(len(x["rows"]) for x in m["sources"] if str(x["team_id"])==tid)
 b["verified_school_count_including_prior"]=len(evidence_schools)
 b["verified_team_game_rows_including_prior"]=len(ev["rows"])
 b["verified_unique_game_ids"]=len({str(x["game_id"]) for x in ev["rows"]})
 b["official_home_away_matched"]=sum("home_away" in r.get("verified_fields",[]) for r in ev["rows"])
 b["status_counts"]=dict(collections.Counter(x["status"] for x in b["school_results"]))
 b["schools_with_matched_official_calendar"]=sum(x["matched"]>0 for x in b["school_results"])
 b["official_university_schools_with_matches"]=sum(x["matched"]>0 and x["status"]=="matched_university_games" for x in b["school_results"])
 b["official_conference_schools_with_matches"]=sum(x["matched"]>0 and x["status"]=="matched_conference_games" for x in b["school_results"])
 b["official_reciprocal_opponent_schools_with_matches"]=sum(x["matched"]>0 and x["status"]=="matched_reciprocal_opponent_games" for x in b["school_results"])
 b["offline_official_transcription_source_file"]=str(M)
 a["official_school_schedules_date_and_opponent_checked"]=len(evidence_schools)
 a["official_school_schedule_entries_date_and_opponent_checked"]=len(ev["rows"])
 a["offline_official_source_rows_newly_matched"]=len(found)
 a["offline_official_source_date_opponent_site_policy"]="Preserve existing evidence. Unique women's team+local date+source opponent required. No fabricated venue, tipoff or TV."
 report={"season":"2026-27","gender":"women","source_team_count":len({str(x["team_id"]) for x in m["sources"]}),
         "source_documents_count":len(m["sources"]),
         "source_printed_rows":sum(len(s["rows"]) for s in m["sources"]),
         "new_official_team_game_rows":len(found),"new_rows_by_team":dict(source_count),
         "skipped_count":len(skipped),"skipped":skipped,
         "overall_verified_schools":len(evidence_schools),"overall_verified_rows":len(ev["rows"]),
         "school_verified_count":b["official_university_schools_with_matches"],
         "conference_source_schools":b["official_conference_schools_with_matches"],
         "reciprocal_opponent_source_schools":b["official_reciprocal_opponent_schools_with_matches"],
         "policy":"Only independently printed 2026-27 women-specific games with unique date+opponent match. CCSU is reciprocal opponent-only, Tennessee Tech is conference-only. No broadcast/time/venue guesses."}
 for p,v in ((CAL,cal),(EVID,ev),(BULK,b),(AUDIT,a),(REPORT,report)):
  new=json.dumps(v,indent=2,ensure_ascii=False)+"\n"
  if not p.exists() or p.read_text(encoding="utf-8")!=new:p.write_text(new,encoding="utf-8")
 print("WBB LAST FIVE OFFICIAL RESEARCH:",json.dumps({k:v for k,v in report.items() if k!="skipped"}))
 if not found and not all(str(s["team_id"]) in evidence_schools for s in m["sources"]):
  raise RuntimeError("No newly source-matched games")
if __name__=="__main__":run()
