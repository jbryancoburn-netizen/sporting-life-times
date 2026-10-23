"""Diagnose the actual EuroLeague production fetch and parser, without publishing data."""
import json
import sys
import euroleague_model as model

def main():
    failures=[]
    for season in ("E2024","E2025","E2026"):
        url=model.BASE+season+"/games?limit=2&offset=0"
        try:
            raw=model.get(url)
            payload=model.obj(raw)
            rows=model.field(payload,"data","games","items")
            if not isinstance(rows,list):
                raise ValueError("No games array; envelope keys: "+str(sorted(payload)))
            partial=dict(payload)
            partial.pop("total",None)
            partial.pop("totalCount",None)
            converted=model.parse(partial,season)
            example=rows[0] if rows else {}
            home=model.obj(model.field(example,"local"))
            print(json.dumps({
                "season":season,
                "envelope_keys":sorted(payload),
                "page_count":len(rows),
                "parsed_count":len(converted),
                "finals":sum(g["completed"] for g in converted),
                "game_fields":sorted(example) if isinstance(example,dict) else [],
                "home_fields":sorted(home),
                "home_code":converted[0]["home"]["code"] if converted else None,
                "away_code":converted[0]["away"]["code"] if converted else None,
            }),flush=True)
        except Exception as exc:
            failures.append(season)
            print(f"{season} production parser probe failed: {type(exc).__name__}: {str(exc)[:360]}",file=sys.stderr,flush=True)
    if failures:
        raise SystemExit("EuroLeague source diagnostics failed: "+", ".join(failures))

if __name__=="__main__":
    main()
