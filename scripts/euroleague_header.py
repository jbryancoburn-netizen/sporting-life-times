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

def completed_score(raw,home_code,away_code,minutes_after_tipoff=0):
    """Conservatively confirm a final from EuroLeague's own completed Q4 fields.

    A false live flag alone is NOT enough: it may also mean timeout or source
    delay. We require matching clubs, non-tied final totals, 4th-period totals
    matching the final score, and a finished game clock after tipoff.
    """
    if not isinstance(raw,dict) or minutes_after_tipoff<85:return None
    def pick(*keys):
        return next((raw[k] for k in keys if k in raw and raw[k] is not None),None)
    if pick("Live","live") is not False:return None
    if (str(pick("CodeTeamA","codeTeamA") or "").strip().upper()!=home_code.upper() or
        str(pick("CodeTeamB","codeTeamB") or "").strip().upper()!=away_code.upper()):
        return None
    def number(v):
        if isinstance(v,bool) or v is None:return None
        try:
            n=int(str(v).strip())
            return n if 0<=n<=250 else None
        except (TypeError,ValueError):return None
    home=number(pick("ScoreA","scoreA"))
    away=number(pick("ScoreB","scoreB"))
    q4h=number(pick("ScoreQuarter4A","scoreQuarter4A"))
    q4a=number(pick("ScoreQuarter4B","scoreQuarter4B"))
    clock=str(pick("RemainingPartialTime","remainingPartialTime") or "").strip()
    game_time=str(pick("GameTime","gameTime") or "").strip()
    clock_finished=clock in ("00:00","0:00") or game_time in ("40:00","45:00","50:00")
    if not clock_finished or home is None or away is None or home==away:return None
    # Regulation conclusion. Do not confuse third-quarter / partial game
    # snapshots with a finished forty-minute game.
    if q4h==home and q4a==away:
        return {"home":home,"away":away,"method":"euroleague_completed_fourth_quarter"}
    # Overtime requires a tied fourth period and positive extra-time points.
    exh=number(pick("ScoreExtraTimeA","scoreExtraTimeA"))
    exa=number(pick("ScoreExtraTimeB","scoreExtraTimeB"))
    if (q4h is not None and q4a is not None and q4h==q4a and
        exh is not None and exa is not None and exh+exa>0 and
        home==q4h+exh and away==q4a+exa):
        return {"home":home,"away":away,"method":"euroleague_completed_overtime"}
    return None
