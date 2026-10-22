"""Validate private USRS EPL Match Center export before newspaper ingestion."""
import argparse,datetime as dt,json,math
from pathlib import Path

def validate(data,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    if data.get("schema_version")!=1 or data.get("competition")!="EPL" or data.get("status")!="provisional_research":
        raise ValueError("unsupported EPL export")
    if data.get("model")!="eps-9.2-elo-poisson-50-50-research" or data.get("source_provider")!="espn-eng1":
        raise ValueError("unexpected model/provider")
    if not isinstance(data.get("source_sha256"),str) or len(data["source_sha256"])!=64 or any(x not in "0123456789abcdef" for x in data["source_sha256"]):
        raise ValueError("missing source provenance")
    issued=dt.datetime.fromisoformat(data["issued_at_utc"].replace("Z","+00:00"))
    if issued.tzinfo is None or issued>now or (now-issued).total_seconds()>36*3600:
        raise ValueError("stale or future forecast export")
    matches=data.get("fixtures")
    if not isinstance(matches,list) or not matches:raise ValueError("no forecasts")
    seen=set()
    for m in matches:
        fid=str(m["fixture_id"])
        if fid in seen:raise ValueError("duplicate fixture")
        seen.add(fid)
        kickoff=dt.datetime.fromisoformat(m["kickoff_utc"].replace("Z","+00:00"))
        if kickoff.tzinfo is None or kickoff<=issued:raise ValueError("not pre-match")
        if kickoff<=now:raise ValueError("already kicked off")
        for side in ("home","away"):
            team=m[side]
            if not isinstance(team.get("name"),str) or not team["name"].strip() or not str(team.get("id","")):
                raise ValueError("missing team identity")
            for k in ("elo","expected_goals"):
                v=team[k]
                if type(v) not in (int,float) or not math.isfinite(v) or (k=="expected_goals" and v<=0):
                    raise ValueError("invalid rating/goals")
        if str(m["home"]["id"])==str(m["away"]["id"]):raise ValueError("same team")
        probs=m["probabilities"]
        values=[probs[k] for k in ("home","draw","away")]
        if any(type(v) not in (int,float) or not math.isfinite(v) or not 0<v<1 for v in values) or abs(sum(values)-1)>1e-8:
            raise ValueError("invalid probabilities")
        if m.get("issued_at_utc")!=data["issued_at_utc"]:raise ValueError("mixed issue dates")
        if "projected_score" in m:
            score=m["projected_score"]
            if any(type(score.get(k))!=int or not 0<=score[k]<=11 for k in ("home","away")):raise ValueError("invalid projected score")
            prob=score.get("probability")
            if type(prob) not in (int,float) or not math.isfinite(prob) or not 0<prob<1:raise ValueError("invalid exact score probability")
        if "goal_markets" in m:
            markets=m["goal_markets"]
            for key in ("over_2_5","under_2_5","both_teams_to_score_yes","both_teams_to_score_no"):
                value=markets.get(key)
                if type(value) not in (int,float) or not math.isfinite(value) or not 0<=value<=1:raise ValueError("invalid goal market")
            if abs(markets["over_2_5"]+markets["under_2_5"]-1)>1e-8 or abs(markets["both_teams_to_score_yes"]+markets["both_teams_to_score_no"]-1)>1e-8:
                raise ValueError("inconsistent goal market complements")
    return data

def publish(src,dest,now=None):
    data=validate(json.loads(Path(src).read_text()),now)
    path=Path(dest);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,indent=2)+"\n")
    return len(data["fixtures"])

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("output")
    a=p.parse_args();print(json.dumps({"published":publish(a.input,a.output)}))
