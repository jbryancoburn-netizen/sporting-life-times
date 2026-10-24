"""Verify GitHub Pages serves precisely the latest committed NCAA soccer Elo."""
import json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="https://jbryancoburn-netizen.github.io/sporting-life-times/"
def get(p):
 req=urllib.request.Request(BASE+p,headers={"User-Agent":"SLT-CollegeSoccer-Verify/1.0","Cache-Control":"no-cache"})
 with urllib.request.urlopen(req,timeout=20) as r:return r.read().decode()
def main():
 expected=json.loads((ROOT/"data/college-soccer-elo.json").read_text())
 for attempt in range(12):
  try:
   public=json.loads(get("data/college-soccer-elo.json?attempt="+str(int(time.time()))))
   html=get("college-soccer.html")
   script=get("college-soccer-elo.js")
   assert public==expected,"public Elo differs from committed feed"
   assert 'id="college-soccer-elo"' in html,"missing Elo container"
   assert 'college-soccer-elo.js' in html,"missing browser loader"
   assert "data/college-soccer-elo.json" in script,"loader does not read Elo feed"
   assert len(public.get("cohorts",{}))==6,"missing NCAA division"
   print(json.dumps({"status":"PASS","as_of":public["as_of"],"applied_finals":public.get("applied_finals_since_baseline"),"teams":sum(map(len,public["cohorts"].values()))}))
   return
  except Exception as exc:
   print(f"public check {attempt+1}/12: {exc}",flush=True)
   if attempt==11:raise
   time.sleep(10)
if __name__=="__main__":main()
