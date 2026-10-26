#!/usr/bin/env python3
import csv,json,subprocess,sys,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as d:
 root=Path(d);f=root/"source.csv";out=root/"coverage.json";clean=root/"verified.csv"
 with f.open("w",newline="") as o:
  w=csv.writer(o);w.writerow(["season","date","homeTeam","awayTeam","homePoints","awayPoints"])
  w.writerows([[1950,"1949-12-01","North Carolina","Duke",65,60],[1950,"1949-12-01","Duke","North Carolina",60,65],[1984,"1984-03-01","Indiana","Purdue",72,69]])
 subprocess.run([sys.executable,"scripts/import_ncaam_pre1985_national.py","--input",str(f),"--output",str(out),"--fixtures-output",str(clean)],check=True)
 v=json.loads(out.read_text())
 assert v["games_verified"]==2,v
 assert v["exclusions"]["matching_duplicate"]==1,v
 assert v["seasons_targeted"]==35,v
 print("PASS 1949–1984 national fixture source ingestion and duplicate controls")
