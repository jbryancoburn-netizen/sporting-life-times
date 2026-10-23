"""Independent release verification of the deployed EuroLeague newspaper."""
import json
import urllib.request
import urllib.error
import time
import pathlib

BASE="https://jbryancoburn-netizen.github.io/sporting-life-times/"
def load(path):
    request=urllib.request.Request(BASE+path,headers={"User-Agent":"SportingLifeTimesReleaseAudit/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(request,timeout=25) as response:
        return response.read().decode("utf-8")
def verify():
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
def main():
    root=pathlib.Path(__file__).resolve().parents[1]
    expected=json.loads((root/"data/euroleague-model.json").read_text())
    last=None
    for attempt in range(8):
        try:
            verify()
            published=json.loads(load("data/euroleague-model.json"))
            if published.get("games_completed",0)<expected.get("games_completed",0):
                raise RuntimeError("GitHub Pages lags repository finals")
            if published.get("updated_at","")<expected.get("updated_at",""):
                raise RuntimeError("GitHub Pages has older Elo publication")
            print("DEPLOY MATCH:",published["games_completed"],"completed games")
            return
        except (OSError,ValueError,AssertionError,RuntimeError) as error:
            last=error
            if attempt<7:time.sleep(20)
    raise RuntimeError("Production site verification failed after retries: "+str(last))
if __name__=="__main__":main()
