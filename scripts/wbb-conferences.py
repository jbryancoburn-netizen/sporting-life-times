#!/usr/bin/env python3
"""Verify women's 2026-27 conference membership using women's ESPN core group registry.
Replaces male/institutional proxy only when all group memberships can be checked.
"""
import json,pathlib,re,time,urllib.request
ROOT=pathlib.Path("data")
BASE="https://sports.core.api.espn.com/v2/sports/basketball/leagues/womens-college-basketball/seasons/2027/types/2/groups"
SITE="https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard/conferences?seasontype=2"
def read(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimesWBB/1.0"})
    for n in range(3):
        try:
            with urllib.request.urlopen(req,timeout=25) as f:return json.load(f)
        except Exception:
            if n==2:raise
            time.sleep((n+1)*2)
def main():
    old=json.loads((ROOT/"ncaaw-2026-27-teams.json").read_text())["teams"]
    known={str(t["team_id"]) for t in old}
    if len(known)!=363:raise RuntimeError("363 women teams needed")
    names={}
    try:
        raw=read(SITE)
    except Exception as exc:
        print("Optional women's conference-label endpoint unavailable:",exc)
        raw={}
    for c in raw.get("conferences",[]):
        cid=str(c.get("groupId") or c.get("group_id") or c.get("id") or "")
        names[cid]=c.get("shortName") or c.get("name") or cid
    raw=read(BASE+"/50/children?limit=1000&lang=en&region=us")
    refs=[i.get("$ref","") for i in raw.get("items",[]) if isinstance(i,dict)]
    gids=set()
    for url in refs:
        m=re.search(r"/groups/(\d+)(?:\?|$)",url)
        if m and m.group(1)!="50":gids.add(m.group(1))
    if not 25<=len(gids)<=40:raise RuntimeError("Unexpected women's conference count "+str(len(gids)))
    teams={};conferences=[];collisions=[]
    for gid in sorted(gids,key=int):
        group=read(BASE+"/"+gid)
        title=group.get("name") or group.get("shortName") or names.get(gid,gid)
        memberships=read(BASE+"/"+gid+"/teams?limit=500&lang=en&region=us")
        ids=[]
        for entry in memberships.get("items",[]):
            ref=entry.get("$ref","") if isinstance(entry,dict) else ""
            m=re.search(r"/teams/(\d+)(?:\?|$)",ref)
            if not m:continue
            ident=m.group(1)
            if ident not in known:continue
            if ident in teams:
                collisions.append({"id":ident,"first":teams[ident]["conference"],"second":title})
                continue
            teams[ident]={"conference":title,"group_id":gid,
                "source":"2026-27 ESPN women-specific Division I conference team membership"}
            ids.append(ident)
        conferences.append({"group_id":gid,"conference":title,"team_count":len(ids)})
        time.sleep(.05)
    covered=len(teams)
    if collisions or covered<350:
        raise RuntimeError("Women's conference audit incomplete, mapped "+str(covered)+" teams; collisions="+str(collisions[:3]))
    if "2385" not in teams:
        teams["2385"]={"conference":"Northeast Conference","group_id":None,
          "source":"Mercyhurst's official 2026-27 women's basketball NEC affiliation"}
    out={"season":"2026-27","gender":"women","source":"ESPN women's core 2027 groups + official Mercyhurst supplement",
         "conference_count":len(gids),"verified_team_count":len(teams),
         "unmatched":[t["team_id"] for t in old if str(t["team_id"]) not in teams],
         "groups":conferences,"teams":teams}
    dest=ROOT/"ncaaw-2026-27-conferences.json"
    payload=json.dumps(out,ensure_ascii=False,indent=2)+"\n"
    if not dest.exists() or dest.read_text()!=payload:dest.write_text(payload)
    print("Women's NCAA conferences:",len(gids),"groups",len(teams),"/363 program memberships; unmatched",len(out["unmatched"]))
if __name__=="__main__":main()
