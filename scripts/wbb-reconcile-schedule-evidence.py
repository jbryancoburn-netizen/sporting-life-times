#!/usr/bin/env python3
"""Evidence-first women's basketball broadcast and source crosscheck reconciler.

Run after the 363-team schedule import. Works offline from repository JSON.
Priorities: official university/conference announcement > women-specific ESPN
scoreboard > women-specific ESPN team-schedule field. No conference-wide guessing.
Never count school-calendar duplicates as distinct verified games.
"""
import collections
import datetime
import json
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
CAL=ROOT/"ncaaw-schedules-2026-27.json"
AUDIT=ROOT/"ncaaw-schedules-2026-27-audit.json"
OFFICIAL=ROOT/"ncaaw-2026-27-official-broadcast-overrides.json"
SCORES=ROOT/"ncaaw-2026-27-games.json"

def text(s):
    return str(s or "").strip()

def norm_broadcast(value):
    s=re.sub(r"[^A-Z0-9+]","",text(value).upper())
    aliases={
        "SECN+":"SECNETWORK+","SECNETWORKPLUS":"SECNETWORK+",
        "SECN":"SECNETWORK","BTN":"BIGTENNETWORK",
        "B1G+":"BIGTEN+","BIGTENPLUS":"BIGTEN+",
        "ACCN":"ACCNETWORK","ACCNX":"ACCNETWORKEXTRA",
        "FS1":"FOXSPORTS1","FS2":"FOXSPORTS2",
    }
    return aliases.get(s,s)

def load(path,required=True):
    if not path.exists():
        if required:raise RuntimeError("Required source file missing: "+str(path))
        return None
    return json.loads(path.read_text(encoding="utf-8"))

def verified_espn_index(score):
    if score.get("season")!="2026-27":raise RuntimeError("Wrong season scoreboard source")
    found={}
    for g in (score.get("upcoming") or [])+(score.get("finals") or []):
        gid=text(g.get("id"))
        if not gid:continue
        prior=found.get(gid)
        if prior and any(text(prior.get(x))!=text(g.get(x)) for x in ("date","home_id","away_id","broadcast")):
            raise RuntimeError("Disputed scoreboard game: "+gid)
        found[gid]=g
    return found

def main():
    cal=load(CAL)
    if cal.get("season")!="2026-27" or cal.get("gender")!="women" or len(cal.get("teams",{}))!=363:
        raise RuntimeError("Requires 363-team verified women calendar")
    scores=verified_espn_index(load(SCORES))
    official=load(OFFICIAL,required=False) or {"season":"2026-27","gender":"women","rows":[]}
    if official.get("gender")!="women" or official.get("season")!="2026-27":
        raise RuntimeError("Wrong sport or season in official TV evidence")
    official_index={}
    for row in official.get("rows",[]):
        gid=text(row.get("game_id"))
        if not gid or not text(row.get("broadcast")) or not text(row.get("source_url")):
            raise RuntimeError("Official evidence missing game ID, broadcast or citation")
        if not row["source_url"].startswith("https://"):
            raise RuntimeError("Official source citation is not HTTPS")
        if gid in official_index and norm_broadcast(official_index[gid]["broadcast"])!=norm_broadcast(row["broadcast"]):
            raise RuntimeError("Two disagreeing official network assignments for "+gid)
        official_index[gid]=row
    by_game=collections.defaultdict(list)
    for tid,team in cal["teams"].items():
        for g in team.get("games",[]):
            gid=text(g.get("id"))
            if not gid:raise RuntimeError("Missing game ID in school "+tid)
            if tid not in (text(g.get("home_id")),text(g.get("away_id"))):
                raise RuntimeError("Game doesn't contain the school "+tid+" "+gid)
            by_game[gid].append((tid,g))
    school_date_conflicts=0
    duplicate_id_conflicts=0
    for gid,group in by_game.items():
        if len(group)>2:raise RuntimeError("Game appears in more than two school ledgers: "+gid)
        if len(group)==2:
            a,b=(x[1] for x in group)
            if any(text(a.get(k))!=text(b.get(k)) for k in ("date","home_id","away_id","venue")):
                duplicate_id_conflicts+=1
    if duplicate_id_conflicts:
        raise RuntimeError("Cross-school calendar disagreement count "+str(duplicate_id_conflicts))
    # Build game-ID aligned broadcasts. Official school/conference evidence always
    # wins, but differences with scoreboard are logged in a separate conflict audit.
    corrections=collections.Counter()
    discrepancies=[]
    scoreboard_matched=set()
    source_count=collections.Counter()
    unique_official=set()
    unique_scoreboard=set()
    for gid,group in by_game.items():
        template=group[0][1]
        e=scores.get(gid)
        if e:
            match=(text(e.get("date"))==text(template.get("date")) and
                   text(e.get("home_id"))==text(template.get("home_id")) and
                   text(e.get("away_id"))==text(template.get("away_id")))
            if not match:
                school_date_conflicts+=1
                discrepancies.append({"game_id":gid,"type":"scoreboard_calendar_identity_or_time",
                                      "calendar_date":template.get("date"),"scoreboard_date":e.get("date")})
                e=None
            else:scoreboard_matched.add(gid)
        off=official_index.get(gid)
        if off and e and text(e.get("broadcast")) and norm_broadcast(e["broadcast"])!=norm_broadcast(off["broadcast"]):
            discrepancies.append({"game_id":gid,"type":"espn_official_broadcast_disagree",
                                  "scoreboard":e["broadcast"],"official":off["broadcast"],
                                  "official_source_url":off["source_url"]})
        if off:
            value=off["broadcast"]
            citation=off["source_url"]
            kind=off.get("source_type") or "official_school_or_conference"
            unique_official.add(gid)
        elif e and text(e.get("broadcast")):
            value=e["broadcast"]
            citation="https://www.espn.com/womens-college-basketball/game/_/gameId/"+gid
            kind="espn_womens_game_scoreboard"
            unique_scoreboard.add(gid)
        else:
            continue
        # An existing attribution may contain additional manual evidence.
        # Never erase it merely because the rolling scoreboard changes.
        for _,g in group:
            old=text(g.get("broadcast"))
            oldkind=text(g.get("broadcast_source_type"))
            if old and norm_broadcast(old)!=norm_broadcast(value):
                if oldkind.startswith("official_") and not kind.startswith("official_"):
                    discrepancies.append({"game_id":gid,"type":"preserved_official_vs_scoreboard",
                                          "original":old,"scoreboard":value})
                    continue
                if oldkind.startswith("official_") and kind.startswith("official_"):
                    raise RuntimeError("Disputed official published broadcast for game "+gid)
                corrections["previous_value_replaced"]+=1
            if not old:corrections["previously_blank_entries_filled"]+=1
            g["broadcast"]=value
            g["broadcast_source_type"]=kind
            g["broadcast_source_url"]=citation
            g["broadcast_verified"]=kind.startswith("official_")
            source_count[kind]+=1
    # Official overrides are allowed for any identified scheduled contest, but
    # unmatched overrides fail so incorrect game IDs cannot silently pass.
    bad_official=sorted(set(official_index)-set(by_game))
    if bad_official:raise RuntimeError("Unmatched official TV game IDs: "+str(bad_official[:20]))
    assigned=collections.Counter()
    for rows in by_game.values():
        broadcasts={norm_broadcast(g.get("broadcast")) for _,g in rows if g.get("broadcast")}
        if len(broadcasts)>1:
            raise RuntimeError("Two newspaper versions disagree on TV: "+rows[0][1]["id"])
        if broadcasts:assigned["distinct_games"]+=1
    total=sum(len(r.get("games",[])) for r in cal["teams"].values())
    broadcast_total=sum(bool(g.get("broadcast")) for t in cal["teams"].values() for g in t.get("games",[]))
    missing=total-broadcast_total
    # Integrate university calendars only after exact date, opponent ID and
    # home/away/site confirmation; this is distinct from ESPN self-consistency.
    import datetime
    from zoneinfo import ZoneInfo
    university_index={}
    quarantine=[]
    for suffix in ("01","02","03"):
        p=ROOT/("ncaaw-official-school-verification-batch-"+suffix+".json")
        if not p.exists():
            continue
        blob=load(p)
        if blob.get("season")!="2026-27" or blob.get("gender")!="women":
            raise RuntimeError("Wrong women university official verification batch: "+suffix)
        for row in blob.get("rows",[]):
            ident=(text(row.get("team_id")),text(row.get("game_id")))
            match=next((g for tid,g in by_game.get(ident[1],[]) if tid==ident[0]),None)
            if not match:
                quarantine.append({"game_id":ident[1],"team_id":ident[0],"reason":"no_game_id_match"})
                continue
            local=datetime.datetime.fromisoformat(match["date"].replace("Z","+00:00")).astimezone(
                ZoneInfo("America/New_York")).date().isoformat()
            if (text(row.get("date"))!=local
                or text(row.get("opponent_id"))!=text(match.get("opponent_id"))
                or text(row.get("site"))!=text(match.get("site"))):
                quarantine.append({"game_id":ident[1],"team_id":ident[0],"reason":"official_identity_date_site_conflict"})
                continue
            if not text(row.get("source_url")).startswith("https://"):
                quarantine.append({"game_id":ident[1],"team_id":ident[0],"reason":"missing_provenance"})
                continue
            previous=university_index.get(ident)
            if previous and previous["source_url"]!=row["source_url"]:
                quarantine.append({"game_id":ident[1],"team_id":ident[0],"reason":"duplicate_official_source"})
                continue
            university_index[ident]=row
    if quarantine:
        raise RuntimeError("Official university source records require review: "+str(quarantine[:5]))
    for (tid,gid),row in university_index.items():
        g=next(g for school,g in by_game[gid] if school==tid)
        g["official_schedule_verified_fields"]=["local_game_date","opponent_id","home_away_or_neutral"]
        g["official_schedule_source_url"]=row["source_url"]
        g["official_schedule_source_type"]=row.get("source_type","official_university_2026_27_womens_schedule")
        if row.get("source_time_as_printed"):
            g["official_time_as_printed"]=row["source_time_as_printed"]
            g["official_time_source_url"]=row["source_url"]
        if row.get("source_location_as_printed"):
            g["official_location_as_printed"]=row["source_location_as_printed"]
            g["official_location_source_url"]=row["source_url"]
    legacy_source=ROOT/"ncaaw-2026-27-official-schedule-verifications.json"
    legacy_count=0
    if legacy_source.exists():
        legacy=load(legacy_source)
        for row in legacy.get("rows",[]):
            ident=(text(row.get("team_id")),text(row.get("game_id")))
            if ident in university_index:
                continue
            match=next((g for tid,g in by_game.get(ident[1],[]) if tid==ident[0]),None)
            if not match or not text(row.get("source_url")).startswith("https://"):
                continue
            match["official_schedule_verified_fields"]=row.get("verified_fields",["scheduled_date","opponent"])
            match["official_schedule_source_url"]=row["source_url"]
            match["official_schedule_source_type"]=row.get("source_type","official_school_schedule")
            legacy_count+=1
    # Preserve the larger direct-university source pass across weekly ESPN
    # refreshes, including date+opponent evidence where site was disputed.
    bulk_path=ROOT/"ncaaw-2026-27-official-schedule-bulk-evidence.json"
    bulk_added=0
    bulk_date_conflicts=0
    if bulk_path.exists():
        bulk=load(bulk_path)
        if bulk.get("gender")!="women" or bulk.get("season")!="2026-27":
            raise RuntimeError("Wrong bulk university schedule source")
        for row in bulk.get("rows",[]):
            tid,gid=text(row.get("team_id")),text(row.get("game_id"))
            match=next((g for t,g in by_game.get(gid,[]) if t==tid),None)
            if not match or not text(row.get("source_url")).startswith("https://"):
                continue
            local=datetime.datetime.fromisoformat(match["date"].replace("Z","+00:00")).astimezone(
                ZoneInfo("America/New_York")).date().isoformat()
            if text(row.get("verified_date"))!=local:
                bulk_date_conflicts+=1
                continue
            if match.get("official_schedule_source_url"):
                continue
            fields=[x for x in row.get("verified_fields",[]) if x in (
                "scheduled_date","opponent","home_away","local_game_date","opponent_id","home_away_or_neutral")]
            if "scheduled_date" not in fields and "local_game_date" not in fields:
                continue
            match["official_schedule_verified_fields"]=fields
            match["official_schedule_source_url"]=row["source_url"]
            match["official_schedule_source_type"]=row.get("source_type","official_university_schedule")
            bulk_added+=1
    # These separate field crosschecks confirm individual named ARENAS or
    # tipoffs; printed city or unsuffixed local time is not certification.
    extra_path=ROOT/"ncaaw-2026-27-official-field-crosschecks.json"
    official_venue_rows=0
    official_tipoff_rows=0
    venue_conflict_count=0
    printed_time_disagreements=0
    if extra_path.exists():
        additional=load(extra_path)
        if additional.get("season")!="2026-27" or additional.get("gender")!="women":
            raise RuntimeError("Wrong-season official field crosschecks")
        printed_time_disagreements=len(additional.get("official_tipoff_discrepancies_for_review",[]))
        for row in additional.get("university_venue_confirmation_rows",[]):
            match=next((g for tid,g in by_game.get(text(row.get("game_id")),[])
                        if tid==text(row.get("team_id"))),None)
            if not match or not match.get("official_schedule_source_url"):
                continue
            v=text(row.get("verified_venue"))
            if not v or not text(row.get("source_url")).startswith("https://"):
                continue
            if text(match.get("venue")) and re.sub(r"[^a-z0-9]","",text(match["venue"]).lower()) != re.sub(r"[^a-z0-9]","",v.lower()):
                venue_conflict_count+=1
                continue
            match["official_venue_verified"]=True
            match["official_venue_name"]=v
            match["official_venue_source_url"]=row["source_url"]
            official_venue_rows+=1
        for row in additional.get("explicitly_timezone_confirmed_tipoff_rows",[]):
            match=next((g for tid,g in by_game.get(text(row.get("game_id")),[])
                        if tid==text(row.get("team_id"))),None)
            if not match or not match.get("official_schedule_source_url"):
                continue
            if text(row.get("calendar_utc"))!=text(match.get("date")):
                continue
            if not text(row.get("source_url")).startswith("https://"):
                continue
            match["official_tipoff_verified"]=True
            match["official_tipoff_as_printed"]=row["official_time"]
            match["official_tipoff_source_url"]=row["source_url"]
            official_tipoff_rows+=1
    official_school_ids={
        tid for tid,t in cal["teams"].items()
        if any(g.get("official_schedule_source_url") for g in t.get("games",[]))
    }
    university_time_count=sum(bool(r.get("source_time_as_printed")) for r in university_index.values())
    university_location_count=sum(bool(r.get("source_location_as_printed")) for r in university_index.values())
    audit=load(AUDIT)
    audit.update({
        "official_school_calendar_verified":len(official_school_ids),
        "official_school_schedules_date_and_opponent_checked":len(official_school_ids),
        "official_school_schedule_entries_date_and_opponent_checked":sum(
            bool(g.get("official_schedule_source_url"))
            for t in cal["teams"].values() for g in t.get("games",[])),
        "official_school_calendar_entries_3_fields_verified":len(university_index),
        "additional_bulk_official_school_entries_kept":bulk_added,
        "bulk_university_date_conflicts_quarantined":bulk_date_conflicts,
        "official_school_venue_verified":official_venue_rows,
        "official_school_tipoff_verified":official_tipoff_rows,
        "official_school_venue_confirmation_discrepancies":venue_conflict_count,
        "official_tipoff_discrepancies_for_review":printed_time_disagreements,
        "official_school_verified_printed_time_fields":university_time_count,
        "official_school_verified_printed_location_fields":university_location_count,
        "official_university_schedule_batch_files":[
            "data/ncaaw-official-school-verification-batch-"+x+".json"
            for x in ("01","02","03") if (ROOT/("ncaaw-official-school-verification-batch-"+x+".json")).exists()
        ],
        "university_source_policy":"Exact official school dates, opponent IDs and site matched to game IDs. Printed time/location are source-labeled; not automatic arena, timezone or network verification."
    })
    audit.update({
        "unique_games":len(by_game),
        "cross_school_matched_game_ids":sum(len(rows)==2 for rows in by_game.values()),
        "cross_school_date_venue_identity_conflicts":duplicate_id_conflicts,
        "espn_scoreboard_identity_time_conflicts":school_date_conflicts,
        "espn_scoreboard_matched_unique_games":len(scoreboard_matched),
        "published_broadcast_unique_games":assigned["distinct_games"],
        "published_broadcast_team_entries":broadcast_total,
        "missing_broadcast":missing,
        "official_broadcast_unique_games":len(unique_official),
        "official_broadcast_team_entries":sum(g.get("broadcast_verified") is True for t in cal["teams"].values() for g in t.get("games",[])),
        "espn_scoreboard_broadcast_unique_games":len(unique_scoreboard),
        "recovered_broadcast_team_entries_this_pass":corrections["previously_blank_entries_filled"],
        "source_counts_by_team_entry":dict(source_count),
        "broadcast_source_conflicts":discrepancies,
        "network_policy":"Only exact game-ID and matching date/team evidence; official university/conference announcements preferred. ESPN scoreboard is labeled as a separate non-official source.",
        "schedule_verification_policy":"ESPN school-calendar duplication verifies internal ledger consistency; it does not constitute official university athletics schedule verification."
    })
    # Retire pre-reconciliation coverage notes so the public audit never says
    # the base file still has 11,110 blank networks after publication.
    audit["missing_broadcast_in_base_schedule"]=missing
    audit["effective_missing_network_after_verified_overlay"]=missing
    audit["broadcast_caveat"]="Populated networks are game-specific and labeled by official source or women-specific scoreboard; the remaining "+str(missing)+" team-game rows have no confirmed listing."
    audit["official_schools_with_at_least_one_verified_game"]=len(official_school_ids)
    audit["official_school_check_scope"]=str(len(official_school_ids))+" university programs have at least one source-matched game; not every game or whole school schedule is fully certified."
    audit["venue_caveat"]=str(official_venue_rows)+" individual school-game venue rows are independently named by a university source; all other ESPN venue strings remain unverified until school-level confirmation."
    cal["note"]="Women's source calendars with exact-match official broadcast citations, ESPN women's scoreboard TV evidence, and game-specific university schedule provenance. Unverified school records and unknown networks remain explicitly identified."
    for path,payload in ((CAL,cal),(AUDIT,audit)):
        body=json.dumps(payload,ensure_ascii=False,indent=2)+"\n"
        if not path.exists() or path.read_text(encoding="utf-8")!=body:
            path.write_text(body,encoding="utf-8")
    print("WBB source reconciliation: "+json.dumps({
        "unique_games":len(by_game),"official_broadcast_games":len(unique_official),
        "scoreboard_broadcast_games":len(unique_scoreboard),
        "filled_team_entries":corrections["previously_blank_entries_filled"],
        "remaining_broadcast_blanks":missing,"cross_source_conflicts":len(discrepancies)
    }))

if __name__=="__main__":
    main()
