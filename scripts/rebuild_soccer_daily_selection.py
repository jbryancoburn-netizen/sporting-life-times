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
    # Fail closed until selection evidence satisfies the 2026 NCAA manual.
    # The daily pipeline must never publish Elo-only at-large picks as NCAA-compliant.
    verified_rpi_path=DATA/"college-soccer-ncaa-verified-selection-inputs-2026.json"
    if not verified_rpi_path.exists():
        raise ValueError("NCAA selection rebuild blocked: missing certified 2026 adjusted RPI, DI-only records and eligibility inputs")
    verified=read("college-soccer-ncaa-verified-selection-inputs-2026.json")
    if verified.get("status")!="verified" or verified.get("season")!=2026 or not isinstance(verified.get("teams"),dict):
        raise ValueError("NCAA selection rebuild blocked: selection input verification incomplete")
    if any(not all(k in v for k in ("adjusted_rpi_rank","di_wins","di_losses","di_ties","eligible")) for v in verified["teams"].values()):
        raise ValueError("NCAA selection rebuild blocked: incomplete eligibility or RPI evidence")
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
        pick=champion or max(choices,key=lambda x:(x["elo"],x["team_id"]))
        if pick["team_id"] in used:
            raise ValueError("Duplicate automatic qualifier "+pick["team_id"])
        used.add(pick["team_id"])
        scenarios.append(dict(conference=key,conference_name=old.get("conference_name",key),
            team_id=pick["team_id"],team=pick["team"],elo=pick["elo"],
            method="verified_championship_result" if champion else "retro_highest_rated_conference_member_projection",
            official_aq=bool(champion),
            source_url=bracket["source_url"] if champion else None))
    if len(scenarios)!=23: raise ValueError("Expected 23 conference bids")
    # NCAA 2026 manual: at-large teams must be eligible and .500 or better in DI games.
    # RPI is the primary transparent proxy here, NOT a claim to replicate committee deliberation.
    def eligible(x):
        v=verified["teams"].get(x["team_id"],{})
        w,l,t=(v.get("di_wins"),v.get("di_losses"),v.get("di_ties"))
        if not all(isinstance(n,int) and n>=0 for n in (w,l,t)) or not v.get("eligible"):
            return False
        return w+l+t>0 and 2*w+t>=w+l+t and isinstance(v.get("adjusted_rpi_rank"),int)
    atlarge=sorted((x for x in ranked if x["team_id"] not in used and eligible(x)),
                   key=lambda x:(verified["teams"][x["team_id"]]["adjusted_rpi_rank"],x["team_id"]))[:29]
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
    previous["status"]="retro_daily_provisional_official_aq_when_verified"
    previous["automatic_bid_scenarios"]=scenarios
    previous["at_large_proxy"]=at
    previous["first_four_out_proxy"]=[entry(x,"outside_field_proxy",reverse_confs.get(x["team_id"],"")) for x in atlarge[25:29]]
    previous["field"]=field
    previous["elo_reconciliation"].update(
        audit_status=audit.get("status","unverified"),
        excluded_finals=audit.get("excluded_finals"),
        source_checked_through=audit.get("checked_through"),
        source_certified=(audit.get("status")=="certified"))
    previous["methodology"]["automatic_bids"]="Official AQ only from a source-linked championship match with verified final score; otherwise highest-rated eligible conference member is an explicitly hypothetical RETRO pick."
    previous["methodology"]["at_large"]="Verified .500 Division I eligibility gate, followed by verified adjusted RPI ranking as a transparent proxy. Full committee decision also considers SOS, head-to-head, common opponents and other NCAA criteria; NOT an official committee result."
    previous["daily_rebuild"]={"rating_cutoff":ratings["as_of"],
        "official_automatic_bids":sum(x["official_aq"] for x in scenarios),
        "projected_automatic_bids":sum(not x["official_aq"] for x in scenarios),
        "source_checked_through":audit.get("checked_through")}
    write("college-soccer-ncaa-selection-forecast.json",previous)
    print("RETRO soccer selection:",len(field),"teams,",sum(x["official_aq"] for x in scenarios),"confirmed AQs, cutoff",ratings["as_of"])

if __name__=="__main__":
    main()
