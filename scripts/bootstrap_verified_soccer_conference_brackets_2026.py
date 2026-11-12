#!/usr/bin/env python3
"""One-time, evidence-backed 2026 DI men's conference championship bracket backfill.

Each field, seed and fixture listed here comes from the published conference
tournament announcement. Scores come ONLY from NCAA's published final ledger.
Penalty shootout decisions require explicit official evidence. Never derive
seeding from the older standings snapshots, RETRO ratings or prediction order.
Existing authoritative tournament_bracket data is never overwritten.
"""
from __future__ import annotations
from datetime import date
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
def load(name):
    return json.loads((DATA/name).read_text(encoding="utf-8"))

# Format: stage/date/first listed team/second listed team/optional winner,
# penalty goals for first listed team, penalty goals for second listed team.
def G(stage, day, home, away, winner=None, hp=None, ap=None):
    return (stage, day, home, away, winner, hp, ap)

CONF={
"acc":dict(source="https://theacc.com/news/2026/11/11/semifinals-of-2026-acc-mens-soccer-championship-slated-for-thursday.aspx",
 seeds="smu clemson wake-forest pittsburgh louisville virginia-tech north-carolina notre-dame virginia california north-carolina-st stanford syracuse boston-college duke",
 games=[
 G("R1","2026-11-04","notre-dame","virginia","virginia",4,5),
 G("R1","2026-11-04","pittsburgh","syracuse","syracuse",6,7),
 G("R1","2026-11-04","louisville","stanford"),
 G("R1","2026-11-04","wake-forest","boston-college","wake-forest",6,5),
 G("R1","2026-11-04","virginia-tech","north-carolina-st"),
 G("R1","2026-11-04","north-carolina","california","north-carolina",4,3),
 G("R1","2026-11-04","clemson","duke"),
 G("QF","2026-11-08","smu","virginia"),
 G("QF","2026-11-08","stanford","syracuse"),
 G("QF","2026-11-08","wake-forest","north-carolina-st"),
 G("QF","2026-11-08","clemson","north-carolina"),
 G("SF","2026-11-12","north-carolina-st","north-carolina"),
 G("SF","2026-11-12","syracuse","smu"),
 G("F","2026-11-15",None,None)]),
"big-east":dict(source="https://www.bigeast.com/news/2026/11/7/2026-big-east-mens-soccer-championship-bracket-set.aspx",
 seeds="georgetown creighton akron seton-hall",
 games=[G("SF","2026-11-12","creighton","akron"),
 G("SF","2026-11-12","georgetown","seton-hall"),G("F","2026-11-15",None,None)]),
"america-east":dict(source="https://americaeast.com/news/2026/11/4/2026-msoc-bracket-release.aspx",
 seeds="albany-ny vermont bryant njit new-hampshire binghamton",
 games=[G("QF","2026-11-07","bryant","binghamton"),
 G("QF","2026-11-07","njit","new-hampshire"),
 G("SF","2026-11-11","albany-ny","njit"),
 G("SF","2026-11-11","vermont","bryant","bryant",3,4),
 G("F","2026-11-15","bryant","njit")]),
"american":dict(source="https://theamerican.org/news/2026/11/2/field-set-for-2026-american-conference-mens-soccer-championship.aspx",
 seeds="tulsa missouri-st charlotte fla-atlantic memphis fiu",
 games=[G("QF","2026-11-06","charlotte","fiu"),
 G("QF","2026-11-06","fla-atlantic","memphis"),
 G("SF","2026-11-11","missouri-st","charlotte"),
 G("SF","2026-11-11","tulsa","memphis"),
 G("F","2026-11-14","tulsa","charlotte")]),
"ivy":dict(source="https://ivyleague.com/news/2026/11/11/mens-soccer-tournament-set-for-this-week-in-ithaca-n-y.aspx",
 seeds="cornell penn yale harvard",
 games=[G("SF","2026-11-12","cornell","harvard"),
 G("SF","2026-11-12","penn","yale"),G("F","2026-11-15",None,None)]),
"wcc":dict(source="https://wccsports.com/news/2026/11/7/bracket-set-for-2026-west-coast-conference-mens-soccer-championship.aspx",
 seeds="portland san-diego denver san-francisco",
 games=[G("SF","2026-11-11","denver","san-diego"),
 G("SF","2026-11-11","portland","san-francisco"),
 G("F","2026-11-14","portland","san-diego")]),
"ovc":dict(source="https://ovcsports.com/news/2026/10/29/2026-ovc-mens-soccer-championship-field-set.aspx",
 seeds="lindenwood-mo siu-edwardsville uiw houston-christian western-ill eastern-ill",
 games=[G("QF","2026-11-08","houston-christian","western-ill","houston-christian",5,4),
 G("QF","2026-11-08","uiw","eastern-ill"),
 G("SF","2026-11-11","lindenwood-mo","houston-christian"),
 G("SF","2026-11-11","siu-edwardsville","eastern-ill"),
 G("F","2026-11-14","houston-christian","eastern-ill")]),
"mvc":dict(source="https://mvc-sports.com/news/2026/11/5/bowling-green-and-evansville-share-regular-season-mens-soccer-title-championship-bracket-announced.aspx",
 seeds="bowling-green evansville western-mich belmont ill-chicago drake",
 games=[G("QF","2026-11-07","belmont","ill-chicago"),
 G("QF","2026-11-07","western-mich","drake"),
 G("SF","2026-11-11","bowling-green","ill-chicago"),
 G("SF","2026-11-11","evansville","western-mich"),
 G("F","2026-11-14","bowling-green","western-mich")]),
"asun":dict(source="https://asunsports.org/news/2026/10/26/2026-asun-mens-soccer-championship-field-set.aspx",
 seeds="north-florida central-ark west-florida stetson bellarmine queens-nc",
 games=[G("QF","2026-11-07","stetson","bellarmine"),
 G("QF","2026-11-07","west-florida","queens-nc"),
 G("SF","2026-11-09","north-florida","stetson"),
 G("SF","2026-11-09","central-ark","queens-nc"),
 G("F","2026-11-14","north-florida","queens-nc")]),
"horizon":dict(source="https://horizonleague.org/news/2026/11/4/mens-soccer-2026-hlmsoc-championship-bracket-set-with-milwaukee-earning-no-1-seed.aspx",
 seeds="milwaukee ipfw robert-morris northern-ill wright-st cleveland-st",
 games=[G("QF","2026-11-08","robert-morris","cleveland-st"),
 G("QF","2026-11-08","northern-ill","wright-st"),
 G("SF","2026-11-11","milwaukee","cleveland-st"),
 G("SF","2026-11-11","ipfw","wright-st"),
 G("F","2026-11-14","ipfw","cleveland-st")]),
"caa":dict(source="https://caasports.com/news/2026/11/1/2026-caa-mens-soccer-championship-bracket-announced.aspx",
 seeds="stony-brook unc-wilmington hofstra elon drexel col-of-charleston",
 seed_labels={"stony-brook":"N#1","hofstra":"N#2","drexel":"N#3",
              "unc-wilmington":"S#1","elon":"S#2","col-of-charleston":"S#3"},
 games=[G("QF","2026-11-05","hofstra","drexel"),
 G("QF","2026-11-05","elon","col-of-charleston"),
 G("SF","2026-11-08","stony-brook","hofstra"),
 G("SF","2026-11-08","unc-wilmington","col-of-charleston"),
 G("F","2026-11-14","hofstra","col-of-charleston")]),
"nec":dict(source="https://hurstathletics.com/news/2026/11/10/mens-soccer-set-for-first-ever-nec-postseason-appearance-at-top-seeded-liu.aspx",
 seeds="long-island fdu central-conn-st mercyhurst",
 games=[G("SF","2026-11-12","long-island","mercyhurst"),
 G("SF","2026-11-12","fdu","central-conn-st"),
 G("F","2026-11-15",None,None)]),
"socon":dict(source="https://uncgspartans.com/news/2026/11/1/mens-soccer-earns-the-third-seed-hosts-winner-of-no-6-vmi-no-7-mercer-on-thursday.aspx",
 seeds="furman wofford unc-greensboro east-tenn-st liberty vmi mercer",
 games=[G("R1","2026-11-03","vmi","mercer"),
 G("QF","2026-11-05","unc-greensboro","vmi"),
 G("QF","2026-11-05","east-tenn-st","liberty","liberty",1,3),
 G("SF","2026-11-08","wofford","unc-greensboro"),
 G("SF","2026-11-08","furman","liberty"),
 G("F","2026-11-14","unc-greensboro","liberty")]),
"summit":dict(source="https://thesummitleague.org/news/2026/11/1/mens-soccer-roos-garner-top-seed-in-2026-summitmsoc-championship-bracket.aspx",
 seeds="umkc neb-omaha massachusetts oral-roberts st-thomas-mn delaware",
 games=[G("QF","2026-11-06","oral-roberts","st-thomas-mn","st-thomas-mn",2,4),
 G("QF","2026-11-07","massachusetts","delaware"),
 G("SF","2026-11-11","neb-omaha","delaware"),
 G("SF","2026-11-11","umkc","st-thomas-mn","st-thomas-mn",4,5),
 G("F","2026-11-14","neb-omaha","st-thomas-mn")]),
"maac":dict(source="https://themetro.org/news/2026/11/6/2026-metro-mens-soccer-championship.aspx",
 seeds="fairfield marist quinnipiac sacred-heart niagara merrimack",
 games=[G("QF","2026-11-07","sacred-heart","niagara"),
 G("QF","2026-11-07","quinnipiac","merrimack"),
 G("SF","2026-11-11","merrimack","fairfield"),
 G("SF","2026-11-11","marist","sacred-heart"),
 G("F","2026-11-14","sacred-heart","merrimack")]),
"pac-12":dict(source="https://pac-12.com/news/2026/11/1/beavers-clinch-regular-season-title-seeding-set-for-pac-12-mens-soccer-championship.aspx",
 seeds="oregon-st california-baptist san-diego-st uc-riverside",
 games=[G("SF","2026-11-07","california-baptist","san-diego-st"),
 G("SF","2026-11-08","oregon-st","uc-riverside"),
 G("F","2026-11-13","oregon-st","san-diego-st")]),
}
PENALTY_EVIDENCE={
("acc","notre-dame","virginia"):"https://theacc.com/news/2026/11/9/unc-nc-state-smu-syracuse-clinch-semifinals-berths-in-2026-acc-mens-soccer-championship.aspx",
("acc","pittsburgh","syracuse"):"https://theacc.com/news/2026/11/9/unc-nc-state-smu-syracuse-clinch-semifinals-berths-in-2026-acc-mens-soccer-championship.aspx",
("acc","wake-forest","boston-college"):"https://theacc.com/news/2026/11/9/unc-nc-state-smu-syracuse-clinch-semifinals-berths-in-2026-acc-mens-soccer-championship.aspx",
("acc","north-carolina","california"):"https://theacc.com/news/2026/11/9/unc-nc-state-smu-syracuse-clinch-semifinals-berths-in-2026-acc-mens-soccer-championship.aspx",
("america-east","vermont","bryant"):"https://americaeast.com/news/2026/11/12/2026-aemsoc-semifinals.aspx",
("ovc","houston-christian","western-ill"):"https://hcuhuskies.com/news/2026/11/8/mens-soccer-msoc-hcu-outlasts-western-illinois-advances-to-ovc-semifinals-on-penalties.aspx",
("socon","east-tenn-st","liberty"):"https://libertyflames.com/news/2026/11/5/mens-soccer-liberty-advances-to-socon-semifinals-on-pks-3-1",
("summit","oral-roberts","st-thomas-mn"):"https://thesummitleague.org/news/2026/11/7/mens-soccer-tommies-advance-to-summitmsoc-semifinal-match-after-pk-victory-over-oral-roberts.aspx",
("summit","umkc","st-thomas-mn"):"https://thesummitleague.org/news/2026/11/12/mens-soccer-st-thomas-makes-history-advances-to-first-division-i-championship-match-after-pk-victory-over-kansas-city.aspx",
}
STAGES={"R1":"FIRST ROUND","QF":"QUARTERFINALS","SF":"SEMIFINALS","F":"CHAMPIONSHIP"}
def build():
    directory=load("college-soccer-conferences.json")["conferences"]
    ledger=load("college-soccer-elo-final-ledger.json")["results"]
    if len(CONF)!=16:raise ValueError("Expected exactly 16 missing conference brackets")
    updated=0
    for slug,config in CONF.items():
        key="men-d1:"+slug
        meta=directory[key]
        members=set(meta["teams"])
        seeds=config["seeds"].split()
        if len(seeds)<4 or len(set(seeds))!=len(seeds) or not set(seeds)<=members:
            raise ValueError("Bad tournament seed list: "+slug)
        path=ROOT/meta["standings_feed"]
        table=json.loads(path.read_text(encoding="utf-8"))
        if table.get("tournament_bracket",{}).get("status")=="official":
            print("PRESERVE existing official "+slug)
            continue
        if set(x["team_id"] for x in table["rows"])!=members:
            raise ValueError("Unmatched conference roster: "+slug)
        rounds={"R1":0,"QF":0,"SF":0,"F":0}
        matches=[]
        for stage,when,h,a,w,hp,ap in config["games"]:
            if stage not in STAGES:raise ValueError("Unrecognized round "+stage)
            if h and h not in seeds or a and a not in seeds:
                raise ValueError("Tournament competitor outside seed list "+slug+" "+str(h)+" "+str(a))
            if h is None and a is not None or a is None and h is not None:
                raise ValueError("Incomplete announced fixture for "+slug)
            rounds[stage]+=1
            fixture={
                "id":stage+str(rounds[stage]),
                "round":STAGES[stage]+" · NOV "+str(int(when[-2:])),
                "home_id":h,"away_id":a,"status":"scheduled",
            }
            if stage=="F" and h is None and a is None and rounds["SF"]==2:
                fixture["home_from"]="SF1"
                fixture["away_from"]="SF2"
                fixture["round_note"]="Championship participants follow the certified semifinal winners."
            if h and a:
                options=[game for game in ledger if
                    game.get("gender")=="men" and game.get("date")==when and
                    {game.get("home_team"),game.get("away_team")}=={h,a}]
                if len(options)>1:
                    raise ValueError("Ambiguous NCAA matchup "+slug+" "+when)
                if options:
                    game=options[0]
                    hs=int(game["home_goals"]) if game["home_team"]==h else int(game["away_goals"])
                    as_=int(game["away_goals"]) if game["away_team"]==a else int(game["home_goals"])
                    fixture.update(status="final",home_score=hs,away_score=as_,
                                   result_date=when,source_url=game["source_game"])
                    if hs==as_:
                        if w is None or hp is None or ap is None or not (hp>=0 and ap>=0) or w!=(h if hp>ap else a if ap>hp else None):
                            raise ValueError("No verified shootout winner "+slug+" "+str((h,a)))
                        official=PENALTY_EVIDENCE.get((slug,h,a))
                        if not official:
                            raise ValueError("No official penalty evidence "+slug+" "+str((h,a)))
                        fixture.update(winner_id=w,decision="penalties",
                                       home_penalties=hp,away_penalties=ap,
                                       penalty_source_url=official)
                    else:
                        if w is not None or hp is not None or ap is not None:
                            raise ValueError("Shootout metadata unexpectedly given on decisive match")
                        fixture["winner_id"]=h if hs>as_ else a
                elif when<="2026-11-11":
                    raise ValueError("Missing completed historical NCAA result "+slug+" "+when+" "+h+" "+a)
            matches.append(fixture)
        bracket={
            "status":"official",
            "source_url":config["source"],
            "seed_source_url":config["source"],
            "verified_through":"2026-11-12",
            "matches":matches,
        }
        if config.get("seed_labels"):
            bracket["regional_seeding"]=True
            table["tournament_seed_labels"]=config["seed_labels"]
        table["tournament_seeds"]=seeds
        table["tournament_bracket"]=bracket
        table["note"]="Older dated regular-season table: not final overall records. 2026 conference tournament seeds and bracket verified from the league's championship announcement; completed scores are matched to the NCAA final-score ledger. RETRO does not override actual results."
        path.write_text(json.dumps(table,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        updated+=1
        print("PUBLISH "+slug+" seeds "+str(len(seeds))+" finals "+str(sum(m["status"]=="final" for m in matches)))
    print("Conference bracket bootstrap: "+str(updated)+" added; existing official brackets protected")
if __name__=="__main__":
    if "--self-test" in sys.argv:
        assert len(CONF)==16
        assert len(PENALTY_EVIDENCE)==9
        assert all(c["source"].startswith("https://") for c in CONF.values())
        assert set(STAGES)=={"R1","QF","SF","F"}
        print("PASS 16 conference official seed sources and nine penalty reports")
    else:build()
