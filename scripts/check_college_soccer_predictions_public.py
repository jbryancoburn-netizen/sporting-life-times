"""Verify the deployed newspaper really serves the NCAA prospective predictions."""
import json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HOST="https://jbryancoburn-netizen.github.io/sporting-life-times/"
def fetch(path):
    request=urllib.request.Request(HOST+path,headers={"User-Agent":"SportingLifeTimes-ProspectiveIntegrity/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(request,timeout=25) as r:return r.read().decode("utf-8")
def main():
    expected=json.loads((ROOT/"data/college-soccer-prospective.json").read_text())
    assert expected["status"]=="prospective_research_only" and expected["count_locked"]>=1
    assert len({r["match_id"] for r in expected["forecasts"]})==len(expected["forecasts"])
    for trial in range(15):
        try:
            got=json.loads(fetch("data/college-soccer-prospective.json?stamp="+str(time.time())))
            html=fetch("college-soccer.html?stamp="+str(time.time()))
            js=fetch("college-soccer-predictions.js?stamp="+str(time.time()))
            assert got==expected,"deployed data differs from GitHub source"
            assert 'id="college-soccer-predictions"' in html,"forecast panel not deployed"
            assert "college-soccer-predictions.js" in html,"browser loader missing"
            assert "data/college-soccer-prospective.json" in js,"browser loader not reading real dataset"
            assert "Date.parse(x.kickoff_utc)>Date.now()" in js,"expired forecasts not being removed"
            print(json.dumps({"status":"PASS","locked":got["count_locked"],"available":len(got["forecasts"]),"html":"live","js":"live"}))
            return
        except Exception as e:
            print("Not deployed yet",trial+1,str(e),flush=True)
            if trial==14:raise
            time.sleep(12)
if __name__=="__main__":main()
