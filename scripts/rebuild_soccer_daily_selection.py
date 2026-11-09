#!/usr/bin/env python3
"""Daily NCAA men's soccer RETRO selection rebuild from published verified feeds.
Does not fabricate official champions, scores, or venues.
"""
import json
from pathlib import Path

DATA = Path("data")
def read(name):
    return json.loads((DATA/name).read_text(encoding="utf-8"))
def write(name, obj):
    (DATA/name).write_text(json.dumps(obj, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")

def main():
    previous=read("college-soccer-ncaa-selection-forecast.json")
    # A daily independent RETRO scenario can refresh without the certified RPI file.
    # It must NEVER be labeled as an NCAA committee selection.
    verified_path=DATA/"college-soccer-ncaa-verified-selection-inputs-2026.json"
    verified=read(verified_path.name) if verified_path.exists() else None
    certified=bool(verified and verified.get("status")=="verified" and
                   verified.get("season")==2026 and isinstance(verified.get("teams"),dict))
    ratings=read("college-soccer-elo.json")
    directory=read("college-soccer-conferences.json")
    audit=read("college-soccer-elo-live-audit.json")
    ranked=ratings["cohorts"]["men-d1"]
    by_id={x["team_id"]:x for x in ranked}
    members=directory["conferences"]
    scenarios=[]
    used=set()
    for old in previous["automatic_bid_scenarios"]:
        key=old["conference"]
        conf=members.get(key,{})
        choices=[by_id[x] for x in conf.get("teams",[]) if x in by_id]
        if not choices:
            raise ValueError("No rated members for automatic bid "+key)
        source=conf.get("standings_feed")
        bracket=None
        if source and (DATA/Path(source).name).exists():
            bracket=read(Path(source).name).get("tournament_bracket")
        champion=None
        if bracket and bracket.get("status")=="official" and bracket.get("source_url"):
            # An official champion is accepted only from a final championship match
            # whose score, winner and opponent are fully specified.
            for match in bracket.get("matches",[]):
                if "championship" not in str(match.get("round","")).lower():
                    continue
                a,b=match.get("home_id"),match.get("away_id")
                if (match.get("status")!="final" or a not in by_id or b not in by_id
                    or a==b or a not in conf.get("teams",[]) or b not in conf.get("teams",[])
                    or not isinstance(match.get("home_score"),int)
                    or not isinstance(match.get("away_score"),int)
                    or match["home_score"]==match["away_score"]):
                    continue
                winner=a if match["home_score"]>match["away_score"] else b
                if match.get("winner_id") and match["winner_id"]!=winner:
                    raise ValueError("Conflicting winner in official championship: "+key)
                champion=by_id[winner]
        # A published official bracket defines the eligible remaining contenders.
        # Never predict a team eliminated by a certified final.
        contenders=choices
        if bracket and bracket.get("status")=="official" and bracket.get("source_url"):
            seed_ids=read(Path(source).name).get("tournament_seeds") if source else None
            if seed_ids:
                contenders=[x for x in choices if x["team_id"] in seed_ids]
            eliminated=set()
            for match in bracket.get("matches",[]):
                if match.get("status")!="final": continue
                a,b=match.get("home_id"),match.get("away_id")
                if a not in by_id or b not in by_id or a==b: continue
                winner=match.get("winner_id")
                if winner not in (a,b):
                    hs,vs=match.get("home_score"),match.get("away_score")
                    if isinstance(hs,int) and isinstance(vs,int) and hs!=vs:
                        winner=a if hs>vs else b
                if winner in (a,b): eliminated.add(b if winner==a else a)
            contenders=[x for x in contenders if x["team_id"] not in eliminated]
            if not contenders and not champion:
                raise ValueError("All tournament contenders eliminated: "+key)
        pick=champion or max(contenders,key=lambda x:(x["elo"],x["team_id"]))
        if pick["team_id"] in used:
            raise ValueError("Duplicate automatic qualifier "+pick["team_id"])
        used.add(pick["team_id"])
        scenarios.append(dict(conference=key,conference_name=old.get("conference_name",key),
            team_id=pick["team_id"],team=pick["team"],elo=pick["elo"],
            method="verified_championship_result" if champion else "retro_highest_rated_conference_member_projection",
            official_aq=bool(champion),
            source_url=bracket["source_url"] if champion else None))
    if len(scenarios)!=23: raise ValueError("Expected 23 conference bids")
    # Certified RPI/eligibility, when available, guides the NCAA-résumé proxy.
    # Without it, compute a clearly labeled independent RETRO-only scenario.
    def eligible(x):
        if certified:
            v=verified["teams"].get(x["team_id"],{})
            w,l,t=v.get("di_wins"),v.get("di_losses"),v.get("di_ties")
            return (all(isinstance(n,int) and n>=0 for n in (w,l,t)) and
                    v.get("eligible") is True and w+l+t>0 and
                    2*w+t>=w+l+t and isinstance(v.get("adjusted_rpi_rank"),int))
        return True  # Experimental RETRO only; NCAA eligibility NOT verified.
    if certified:
        rank_key=lambda x:(verified["teams"][x["team_id"]]["adjusted_rpi_rank"],x["team_id"])
    else:
        rank_key=lambda x:(-x["elo"],x["team_id"])
    atlarge=sorted((x for x in ranked if x["team_id"] not in used and eligible(x)),key=rank_key)[:29]
    if len(atlarge)<29: raise ValueError("Insufficient at-large candidates")
    def entry(x,kind,conf):
        return dict(team_id=x["team_id"],team=x["team"],conference=conf,
                    elo=x["elo"],bid_type=kind)
    aqs=[entry(by_id[x["team_id"]],"official_aq" if x["official_aq"] else "projected_aq",x["conference"]) for x in scenarios]
    reverse_confs={}
    for key,conf in members.items():
        if not key.startswith("men-d1:"):continue
        for team in conf.get("teams",[]):reverse_confs[team]=key
    at=[entry(x,"at_large_proxy",reverse_confs.get(x["team_id"],"")) for x in atlarge[:25]]
    field=sorted(aqs+at,key=lambda x:(-x["elo"],x["team_id"]))
    if len(field)!=48 or len({x["team_id"] for x in field})!=48:
        raise ValueError("Field uniqueness/size failure")
    for i,x in enumerate(field,1):
        x.update(experimental_strength_order=i,ncaa_seed=None,
                 first_round_bye_candidate=i<=16,seeded_24_candidate=i<=24)
    previous["rating_cutoff"]=ratings["as_of"]
    previous["status"]="provisional_rpi_resume_proxy" if certified else "retro_daily_experimental_not_ncaa_selection"
    previous["automatic_bid_scenarios"]=scenarios
    previous["at_large_proxy"]=at
    previous["first_four_out_proxy"]=[entry(x,"outside_field_proxy",reverse_confs.get(x["team_id"],"")) for x in atlarge[25:29]]
    previous["field"]=field
    previous["selection_policy"]["at_large_record_gate"]="Verified Division I .500 eligibility" if certified else "NOT VERIFIED: RETRO scenario, not eligible NCAA field"
    previous["elo_reconciliation"].update(
        audit_status=audit.get("status","unverified"),
        excluded_finals=audit.get("excluded_finals"),
        source_checked_through=audit.get("checked_through"),
        source_certified=(audit.get("status")=="certified"))
    previous["methodology"]["automatic_bids"]="Official AQ only from a source-linked championship match with verified final score; otherwise highest-rated eligible conference member is an explicitly hypothetical RETRO pick."
    previous["methodology"]["at_large"]=("Verified DI .500 eligibility and adjusted RPI provisional résumé ordering, NOT the committee decision." if certified else "Independent RETRO Elo at-large scenario only; NCAA .500 DI eligibility and RPI are NOT verified. This is NOT an NCAA committee selection.")
    previous["daily_rebuild"]={"rating_cutoff":ratings["as_of"],
        "official_automatic_bids":sum(x["official_aq"] for x in scenarios),
        "projected_automatic_bids":sum(not x["official_aq"] for x in scenarios),
        "source_checked_through":audit.get("checked_through"),
        "selection_inputs_verified":certified}
    write("college-soccer-ncaa-selection-forecast.json",previous)
    print("RETRO soccer selection:",len(field),"teams,",sum(x["official_aq"] for x in scenarios),"confirmed AQs, cutoff",ratings["as_of"])

if __name__=="__main__":
    main()
