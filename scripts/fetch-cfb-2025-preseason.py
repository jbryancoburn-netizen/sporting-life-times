#!/usr/bin/env python3
"""Fetch 2024/2025 NCAA football roster snapshots from public SportsDataverse release assets.
Requires: pip install pandas pyarrow requests. Does not use 2025 game results as preseason inputs.
Usage: python scripts/fetch-cfb-2025-preseason.py
"""
from pathlib import Path
import json, hashlib, datetime
import pandas as pd
import requests
BASE="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mfb_rosters/ncaa_mfb_rosters_{}.parquet"
OUT=Path("data/cfb/preseason-2025")
OUT.mkdir(parents=True,exist_ok=True)
manifest={"cutoff":"2025-08-01","retrieved_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":[]}
frames={}
for year in (2024,2025):
    url=BASE.format(year)
    response=requests.get(url,timeout=120)
    response.raise_for_status()
    target=OUT/f"rosters-{year}.parquet"
    target.write_bytes(response.content)
    df=pd.read_parquet(target)
    required={"team_id","player_id","player_name","position"}
    missing=required-set(df.columns)
    if missing: raise RuntimeError(f"{year} roster missing columns: {sorted(missing)}")
    frames[year]=df
    manifest["sources"].append({"year":year,"url":url,"rows":len(df),"sha256":hashlib.sha256(response.content).hexdigest()})
a,b=frames[2024],frames[2025]
a_ids=set(a.player_id.dropna().astype(str))
b=b.copy()
b["returning_2024_roster"]=b.player_id.astype(str).isin(a_ids)
b["matched_2024_team"]=b.player_id.astype(str).map(dict(zip(a.player_id.astype(str),a.team_id.astype(str))))
b["transferred_from_2024"]=b.returning_2024_roster & (b.team_id.astype(str)!=b.matched_2024_team)
b.to_csv(OUT/"2025-roster-matches.csv",index=False)
manifest["counts"]={"players_2025":len(b),"matched_2024":int(b.returning_2024_roster.sum()),"transferred":int(b.transferred_from_2024.sum()),"unmatched":int((~b.returning_2024_roster).sum())}
manifest["warning"]="Roster assets may reflect later-season edits; cutoff provenance is not established. Do not certify preseason ratings from these files alone."
(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest["counts"],indent=2))
