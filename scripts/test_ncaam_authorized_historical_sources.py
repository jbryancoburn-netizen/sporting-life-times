#!/usr/bin/env python3
"""Self-contained test: two source exports, flipped home labels and one score conflict."""
import csv,hashlib,json,subprocess,sys,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);sources=[]
 for name,rows in [
  ("conference",[["1950","1949-12-01","North Carolina","Duke","65","60"],["1950","1949-12-02","Kentucky","Indiana","70","59"]]),
  ("school",[["1950","1949-12-01","Duke","North Carolina","60","65"],["1950","1949-12-02","Indiana","Kentucky","59","71"]])]:
  p=root/(name+".csv")
  with p.open("w",newline="") as f:
   w=csv.writer(f);w.writerow(["season","date","homeTeam","awayTeam","homePoints","awayPoints"]);w.writerows(rows)
  sources.append({"name":name,"path":str(p),"source_url":"https://example.org/"+name,"license_or_permission":"test fixture","reuse_authorized":True,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()})
 manifest=root/"sources.json";manifest.write_text(json.dumps({"sources":sources}))
 output=root/"coverage.json"
 subprocess.run([sys.executable,"scripts/reconcile_ncaam_authorized_historical_sources.py","--manifest",str(manifest),"--output-dir",str(root/"clean"),"--report",str(output)],check=True)
 obj=json.loads(output.read_text())
 assert obj["games_accepted"]==1,obj
 assert obj["conflicting_games_quarantined"]==1,obj
 assert obj["school_seasons"][0]["season"]==1950,obj
 assert obj["national_completeness_certified"] is False
 print("PASS source authorization, cross-schedule deduplication, conflict quarantine and coverage")
