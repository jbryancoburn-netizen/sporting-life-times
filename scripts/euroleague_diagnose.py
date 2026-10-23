"""Safe EuroLeague source diagnostics: print structure and counts, not full data."""
import json,urllib.request,sys
BASE="https://api-live.euroleague.net/v2/competitions/E/seasons/"
for season in ("E2024","E2025","E2026"):
    url=BASE+season+"/games?limit=2&offset=0"
    try:
        req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"SportingLifeTimes/1.0"})
        with urllib.request.urlopen(req,timeout=20) as res:
            raw=json.load(res)
        if not isinstance(raw,dict):raise ValueError("root not an object")
        records=raw.get("data",raw.get("games",raw.get("items",[])))
        if not isinstance(records,list):raise ValueError("missing records array")
        example=records[0] if records else {}
        side=example.get("local",{}) if isinstance(example,dict) else {}
        print(json.dumps({"season":season,"total":raw.get("total"),"envelope":sorted(raw.keys()),
           "example_fields":sorted(example.keys()),"local_fields":sorted(side.keys()),
           "local_club_fields":sorted(side.get("club",{}).keys()) if isinstance(side.get("club"),dict) else [],
           "game_status":example.get("gameStatus"),"played":example.get("played")}))
    except Exception as exc:
        print(f"EuroLeague API probe for {season} failed: {type(exc).__name__}: {str(exc)[:240]}",file=sys.stderr)
        raise
