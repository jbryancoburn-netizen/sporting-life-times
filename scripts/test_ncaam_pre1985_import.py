#!/usr/bin/env python3
"""Offline end-to-end smoke test of published UNC/Duke fixture importer."""
import csv,json,subprocess,sys,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as td:
 root=Path(td);source=root/"fixtures.csv";out=root/"result.json"
 fields=["Season","Game_Date","Opponent_School","Tm","Opp","Source_Team"]
 rows=[
 ["1950","1950-01-10","Duke",65,60,"North Carolina"],
 ["1950","1950-01-10","North Carolina",60,65,"Duke"],
 ["1950","1950-01-11","Wake Forest",80,70,"North Carolina"],
 ["1985","1985-01-02","Duke",79,76,"North Carolina"],
 ["1985","1985-01-02","North Carolina",76,79,"Duke"]]
 with source.open("w",newline="") as f:
  w=csv.writer(f);w.writerow(fields);w.writerows(rows)
 subprocess.run([sys.executable,"scripts/import_ncaam_pre1985_unc_duke.py","--input",str(source),"--output",str(out)],check=True)
 d=json.loads(out.read_text())
 assert d["verified_imported_rows"]==3,d
 assert d["seasons_present"]==2,d
 assert d["season_coverage"][0]["season"]==1950,d
 assert d["season_coverage"][-1]["season"]==1985,d
 assert d["exclusions"]["duplicate_fixture"]==2,d
 assert d["not_a_national_rankings_history"] is True,d
 print("PASS pre-1985 fixture importer smoke test")
