"""Independent release verification of the deployed EuroLeague newspaper."""
import json
import urllib.request
import urllib.error

BASE="https://jbryancoburn-netizen.github.io/sporting-life-times/"
def load(path):
    request=urllib.request.Request(BASE+path,headers={"User-Agent":"SportingLifeTimesReleaseAudit/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(request,timeout=25) as response:
        return response.read().decode("utf-8")
def main():
    page=load("euroleague.html")
    expected={"Elo table":'id="el-elo-table"',"standings":'id="el-standings"',
        "upcoming forecasts":'id="el-forecasts"',"live scorebugs":'id="el-live-scorebugs"'}
    missing=[label for label,needle in expected.items() if needle not in page]
    if missing:raise RuntimeError("Deployed newspaper missing: "+", ".join(missing))
    model=json.loads(load("data/euroleague-model.json"))
    live=json.loads(load("data/euroleague-live.json"))
    assert len(model["standings"])==len(model["rankings"])==20
    assert sum(row["wins"] for row in model["standings"])==model["games_completed"]
    assert sum(row["losses"] for row in model["standings"])==model["games_completed"]
    assert isinstance(live.get("games"),list) and len(live["games"])>0
    for script in ("euroleague-model-desk.js","euroleague-live.js","euroleague-edition.js"):
        body=load(script)
        assert len(body)>200, "Deployed script not available: "+script
    print(json.dumps({"result":"PASS","teams":20,"completed":model["games_completed"],"scorebugs":len(live["games"]),"elo_updated":model["updated_at"],"live_updated":live["updated_at"]}))
if __name__=="__main__":main()
