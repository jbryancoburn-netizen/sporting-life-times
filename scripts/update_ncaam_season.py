#!/usr/bin/env python3
"""Own NCAA men's Elo current-season publisher.

Source: ESPN completed-event status, with local CSV for deterministic tests. Does not ingest
uncertified scoring-quality beta. Every run REPLAYS deduplicated finals from
the immutable 365-school preseason rating baseline; never double-counts.
"""
import argparse,csv,gzip,io,json,math,sys,urllib.request,unicodedata
from collections import defaultdict
from datetime import date,datetime,timezone
from pathlib import Path

ROOT=Path("data")
SCHEDULE="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mbb_schedule/ncaa_mbb_schedule_2027.csv.gz"
K=24.0
MOV=0.55
HOME_ADV=0.0  # Neutral until venue calibration independently verified.

def key(v):
    normalized=unicodedata.normalize('NFKD',str(v or '').lower())
    return ''.join(c for c in normalized if c.isalnum() and not unicodedata.combining(c))

ALIASES={
    "southerncalifornia":"usc","southernill":"southernillinois",
    "mississippival":"mississippivalley","texasamcommerce":"easttexasam",
    "texasaandmcommerce":"easttexasam","texasamcorpuschristi":"texasamcorpuschristi",
    "miamifl":"miami","miamioh":"miamiohio",
    "fairleighdickinson":"fdu","iuindy":"iupui",
    "saintfrancispa":"saintfrancis","stfrancispa":"saintfrancis",
    "ucsd":"ucsandiego","olemiss":"mississippi","pitt":"pittsburgh",
    "unc":"northcarolina","uconn":"connecticut",
}
# ESPN's verified school labels differ from NCAA short-name conventions.
# Only explicit, reviewed program aliases are admitted to live Elo joins.
ALIASES.update({
    "alcornstate": "alcorn",
    "arkansaspinebluff": "arkpinebluff",
    "army": "armywestpoint",
    "ballstate": "ballst",
    "calstatebakersfield": "csubakersfield",
    "calstatefullerton": "calstfullerton",
    "calstatenorthridge": "csun",
    "centralarkansas": "centralark",
    "centralconnecticut": "centralconnst",
    "centralmichigan": "centralmich",
    "charleston": "colofcharleston",
    "easternillinois": "easternill",
    "easternkentucky": "easternky",
    "easternmichigan": "easternmich",
    "easternwashington": "easternwash",
    "floridaatlantic": "flaatlantic",
    "incarnateword": "uiw",
    "iowastate": "iowast",
    "jacksonvillestate": "jacksonvillest",
    "kentstate": "kentst",
    "lsuneworleans": "neworleans",
    "lamar": "lamaruniversity",
    "longislanduniversity": "liu",
    "loyolamarymount": "lmuca",
    "marylandeasternshore": "umes",
    "mississippivalleystate": "mississippivalley",
    "northalabama": "northala",
    "northdakotastate": "northdakotast",
    "northernarizona": "northernariz",
    "northerncolorado": "northerncolo",
    "northernillinois": "niu",
    "northerniowa": "uni",
    "northernkentucky": "northernky",
    "northwesternstate": "northwesternst",
    "ohiostate": "ohiost",
    "pennstate": "pennst",
    "selouisiana": "southeasternla",
    "saintmarys": "saintmarysca",
    "sanjosestate": "sanjosest",
    "southcarolinastate": "southcarolinast",
    "southcarolinaupstate": "uscupstate",
    "southdakotastate": "southdakotast",
    "southflorida": "southfla",
    "southeastmissouristate": "southeastmost",
    "southern": "southernu",
    "stjohns": "stjohnsny",
    "stthomas": "stthomasmn",
    "stephenfaustin": "sfa",
    "texasandmcorpuschristi": "amcorpuschristi",
    "texasamcorpuschristi": "amcorpuschristi",
    "ulmonroe": "ulm",
    "uncwilmington": "uncw",
    "utriograndevalley": "utrgv",
    "utahstate": "utahst",
    "westgeorgia": "westga",
    "westerncarolina": "westerncaro",
    "westernillinois": "westernill",
    "westernmichigan": "westernmich",
    "middletennessee": "middletenn",
})

def school_key(v):
    k=key(v)
    return ALIASES.get(k,k)

def read_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def source_rows(path=None):
    if path:
        raw=Path(path).read_bytes()
    else:
        req=urllib.request.Request(SCHEDULE,headers={"User-Agent":"SportingLifeTimes-CBB-Elo/1.0"})
        with urllib.request.urlopen(req,timeout=90) as response:
            raw=response.read(25000000)
    if raw.startswith(bytes((31,139))):raw=gzip.decompress(raw)
    rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    if not rows:raise ValueError("NCAA schedule source returned zero rows")
    return rows

def parse_day(raw):
    for fmt in ("%m/%d/%Y","%Y-%m-%d","%Y-%m-%dT%H:%M:%SZ"):
        try:return datetime.strptime(str(raw),fmt).date()
        except (ValueError,TypeError):pass
    raise ValueError("unrecognized schedule date "+str(raw))

def probability(home,away):
    return 1.0/(1+10**(-(home-away+HOME_ADV)/400.0))

def numeric_score(x):
    try:
        if str(x).strip()=="":return None
        f=float(x)
        if not math.isfinite(f) or f<0 or not f.is_integer():return None
        return int(f)
    except (ValueError,TypeError):return None

def translate(roster,source,through):
    index=defaultdict(list)
    for t in roster:
        index[school_key(t["team"])].append(t["team_id"])
    # Never make a guessed match when an alias collides.
    matched={k:v[0] for k,v in index.items() if len(v)==1}
    ambiguous={k for k,v in index.items() if len(v)!=1}
    rejected=defaultdict(int)
    seen={}
    for row in source:
        gid=str(row.get("contest_id") or "").strip()
        if not gid:
            rejected["missing_event_id"]+=1;continue
        try:day=parse_day(row.get("game_date"))
        except ValueError:
            rejected["unparseable_date"]+=1;continue
        if not date(2026,11,1)<=day<=date(2027,4,30):
            rejected["outside_season"]+=1;continue
        home_key=school_key(row.get("home"))
        away_key=school_key(row.get("away"))
        if home_key in ambiguous or away_key in ambiguous:
            rejected["ambiguous_team_name"]+=1;continue
        h,a=matched.get(home_key),matched.get(away_key)
        if not h or not a or h==a:
            rejected["unmatched_d1_teams"]+=1;continue
        hs=numeric_score(row.get("home_score"))
        aws=numeric_score(row.get("away_score"))
        status=str(row.get("status") or row.get("game_status") or "").strip().lower()
        explicit_final=status in ("final","post","completed","complete","official","closed")
        # Without explicit status, a dated *past* game with both non-tied
        # reported scores may be accepted; never use current-day live totals.
        has_score=hs is not None and aws is not None and hs!=aws and hs>0 and aws>0
        is_final=has_score and (explicit_final or (not status and day<through))
        if status and not explicit_final: is_final=False
        game={"id":gid,"date":day.isoformat(),"home_id":h,"away_id":a,
              "home":row.get("home"),"away":row.get("away"),"home_score":hs,
              "away_score":aws,"final":is_final}
        if gid in seen:
            prev=seen[gid]
            if prev!=game:raise ValueError("Contradictory duplicate NCAA contest ID "+gid)
            rejected["identical_duplicate"]+=1
        else:seen[gid]=game
    return sorted(seen.values(),key=lambda g:(g["date"],g["id"])),dict(rejected)

def replay(baseline, games, through):
    roster=baseline["rankings"]
    ratings={t["team_id"]:float(t["elo"]) for t in roster}
    wins=defaultdict(int);losses=defaultdict(int)
    conf_wins=defaultdict(int);conf_losses=defaultdict(int)
    conf={t["team_id"]:t.get("conference") for t in roster}
    ledger=[]
    recent=[]
    # The published Elo state always begins at the proven preseason baseline.
    finals=[g for g in games if g["final"] and date.fromisoformat(g["date"])<=through]
    for day in sorted(set(g["date"] for g in finals)):
        match=[g for g in finals if g["date"]==day]
        changes=defaultdict(float)
        for g in match:
            h,a=g["home_id"],g["away_id"]
            p=probability(ratings[h],ratings[a])
            margin=abs(g["home_score"]-g["away_score"])
            shift=K*(1+MOV*math.log10(1+margin))*((g["home_score"]>g["away_score"])-p)
            changes[h]+=shift;changes[a]-=shift
            winner=h if g["home_score"]>g["away_score"] else a
            loser=a if winner==h else h
            wins[winner]+=1;losses[loser]+=1
            if conf.get(h) and conf.get(h)==conf.get(a):
                conf_wins[winner]+=1;conf_losses[loser]+=1
            ledger.append({"id":g["id"],"date":day,"home_id":h,"away_id":a,
                "home_score":g["home_score"],"away_score":g["away_score"],
                "home_win_probability":round(p,6),"winner_id":winner})
        for team,delta in changes.items():ratings[team]+=delta
    for g in games:
        if g["final"] and date.fromisoformat(g["date"])<=through:continue
        if date.fromisoformat(g["date"])<through:continue
        h,a=g["home_id"],g["away_id"]
        recent.append({"id":g["id"],"date":g["date"],"home_id":h,"away_id":a,
                       "home_win_probability":round(probability(ratings[h],ratings[a]),6),
                       "home_score":g["home_score"],"away_score":g["away_score"],
                       "status":"scheduled_or_unconfirmed"})
    order=sorted(roster,key=lambda t:(-ratings[t["team_id"]],t["team"]))
    rankings=[]
    for rank,t in enumerate(order,1):
        x=dict(t)
        x.update(rank=rank,elo=round(ratings[t["team_id"]],4),
                 wins=wins[t["team_id"]],losses=losses[t["team_id"]],
                 conference_wins=conf_wins[t["team_id"]],
                 conference_losses=conf_losses[t["team_id"]],
                 season_games=wins[t["team_id"]]+losses[t["team_id"]])
        rankings.append(x)
    result=dict(
        model="slat-ncaam-2026-27-independent-season-elo-v1",
        season="2026-27",status="provisional-inseason",
        team_count=len(rankings),games_played=len(ledger),
        preseason_roster_informed=True,production_elo_approved=False,
        source="NCAA-origin season schedule, exact D1-team matching",
        as_of=through.isoformat(),preseason_baseline="data/ncaam-2026-27-preseason-roster-informed.json",
        k=K,margin_factor=MOV,home_advantage=HOME_ADV,
        caveat="No home-court adjustment without separately validated venue data. Unmatched or incomplete games excluded.",
        rankings=rankings)
    return result,ledger,recent

def build(preseason,source,through):
    if len(preseason.get("rankings",[]))!=365:raise ValueError("Preseason baseline not verified")
    games,excluded=translate(preseason["rankings"],source,through)
    current,ledger,upcoming=replay(preseason,games,through)
    current["source_games_seen"]=len(games)
    current["excluded_source_rows"]=excluded
    integrity={"as_of":through.isoformat(),"matched_source_games":len(games),
        "completed_unique_games":len(ledger),
        "upcoming_or_unconfirmed_games":len(upcoming),
        "excluded":excluded,
        "unmapped_teams_fatal":False,
        "score_sanity_checked":True,
        "stable_event_deduplication":True,
        "preseason_fallback_count":sum(t.get("roster_coverage")=="baseline-fallback" for t in current["rankings"])}
    return current,{"season":"2026-27","as_of":through.isoformat(),
            "count":len(ledger),"games":ledger}, {"season":"2026-27","as_of":through.isoformat(),"games":upcoming[:200]},integrity

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--schedule",help="Optional local NCAA schedule CSV or gz for deterministic tests")
    p.add_argument("--espn-crosswalk",default=str(ROOT/"ncaam-2026-27-espn-program-crosswalk.json"))
    p.add_argument("--espn-cache",default=str(ROOT/"ncaam-2026-27-source-events.json"))
    p.add_argument("--baseline",default=str(ROOT/"ncaam-2026-27-preseason-roster-informed.json"))
    p.add_argument("--as-of",default=datetime.now(timezone.utc).date().isoformat())
    p.add_argument("--out-dir",default=str(ROOT))
    a=p.parse_args()
    preseason=read_json(a.baseline)
    through=date.fromisoformat(a.as_of)
    if a.schedule:
        source=source_rows(a.schedule)
        source_details={"provider":"local_verified_fixture"}
    else:
        from ncaam_espn_source import collect
        source,source_details=collect(through,a.espn_crosswalk,a.espn_cache)
    current,ledger,upcoming,integrity=build(preseason,source,through)
    current["source"]=source_details["provider"]+" completed event statuses; independent Elo calculation"
    integrity["provider_audit"]=source_details
    dest=Path(a.out_dir);dest.mkdir(parents=True,exist_ok=True)
    for fn,doc in (
        ("ncaam-2026-27-current-provisional.json",current),
        ("ncaam-2026-27-game-ledger.json",ledger),
        ("ncaam-2026-27-upcoming-forecasts.json",upcoming),
        ("ncaam-2026-27-source-audit.json",integrity)):
        (dest/fn).write_text(json.dumps(doc,indent=2)+"\n",encoding="utf-8")
    if not a.schedule:
        from ncaam_espn_source import write_cache
        write_cache(dest/"ncaam-2026-27-source-events.json",source)
    print(json.dumps({k:integrity[k] for k in ("completed_unique_games","upcoming_or_unconfirmed_games","excluded")},indent=2))
if __name__=="__main__":main()
