"""EuroLeague live game Header adapter with conservative status classification."""
import json
import urllib.parse
import urllib.request

def get_header(game_code, season="E2026"):
    query=urllib.parse.urlencode({"gamecode":str(game_code),"seasoncode":season})
    request=urllib.request.Request("https://live.euroleague.net/api/Header?"+query,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
    with urllib.request.urlopen(request,timeout=10) as response:
        body=response.read()
    if not body.strip():return None
    data=json.loads(body)
    return data if isinstance(data,dict) else None

def details(raw,home_code,away_code,scheduled_state):
    if not isinstance(raw,dict):return None
    def val(*names):
        return next((raw[k] for k in names if k in raw and raw[k] is not None),None)
    def score(x):
        if isinstance(x,bool) or x is None:return None
        try:
            s=str(x).strip()
            n=int(s)
            return n if s and n>=0 else None
        except (ValueError,TypeError):return None
    home=str(val("CodeTeamA","codeTeamA","code_team_a") or "").strip().upper()
    away=str(val("CodeTeamB","codeTeamB","code_team_b") or "").strip().upper()
    if home!=home_code.upper() or away!=away_code.upper():return None
    live=val("Live","live")
    if not isinstance(live,bool):return None
    a=score(val("ScoreA","scoreA","score_a"))
    b=score(val("ScoreB","scoreB","score_b"))
    if a is None or b is None:return None
    if live:state="live"
    elif scheduled_state=="final":state="final"
    else:return None
    period=val("Quarter","quarter")
    clock=val("RemainingPartialTime","remainingPartialTime","remaining_partial_time")
    detail=" · ".join(str(x).strip() for x in (period,clock) if x is not None and str(x).strip())
    return {"state":state,"home":a,"away":b,"detail":detail}
