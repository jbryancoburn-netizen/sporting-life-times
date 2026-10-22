"""Deterministic game reconciliation with source precedence and quarantined conflicts."""
from datetime import datetime,timezone
import re
def normalize_name(s):
 return re.sub(r"[^a-z0-9]","",str(s or "").casefold().replace("&","and"))
def identity(g,league):
 teams=g.get("teams") or []
 if len(teams)!=2:return ("id",league,str(g.get("id")))
 names=tuple(sorted(normalize_name(t.get("name")) for t in teams))
 if not all(names):return ("id",league,str(g.get("id")))
 date=str(g.get("date") or "")[:10]
 # A same-day doubleheader cannot safely be resolved by names and date alone.
 if g.get("doubleHeader") or g.get("doubleheader") or g.get("gameNumber"):
  return ("id",league,str(g.get("id")))
 if not date or date=="None":return ("id",league,str(g.get("id")))
 return (league,date,names)
def score_map(g):
 def canonical(v):
  if v is None or str(v).strip()=="":return None
  try:return int(v)
  except (ValueError,TypeError):return str(v).strip()
 return {normalize_name(t.get("name")):canonical(t.get("score")) for t in g.get("teams",[])}
def provider(g,block):
 return str(g.get("provider") or block.get("provider") or ("espn" if "ESPN" in block.get("source_url","") else "unknown"))
def rank(p,league):
 official={"MLB":"mlb_stats","NHL":"nhl_web"}
 if p==official.get(league):return 100
 if p in ("ncaa_stats","sidearm","presto","statbroadcast"):return 85
 if p=="espn":return 60
 return 30
def reconcile(base,official):
 leagues={}
 conflicts=[]
 # Duplicate team/date pairings in any single feed are ambiguous: never merge by that key.
 counts={}
 for block in [*(base or []),*(official or [])]:
  for game in block.get("games") or []:
   k=identity(game,block.get("league"))
   source=provider(game,block)
   counts[(source,k)]=counts.get((source,k),0)+1
 ambiguous={k for (_,k),n in counts.items() if n>1 and k[0]!="id"}
 for block in [*(base or []),*(official or [])]:
  league=block.get("league")
  if not league:continue
  target=leagues.setdefault(league,{"league":league,"games":[],"source_url":block.get("source_url",""),"error":None})
  for game in block.get("games") or []:
   g=dict(game);p=provider(g,block);g["provider"]=p
   key=identity(g,league)
   if key in ambiguous:
    g["identity_warning"]="ambiguous_same_day_matchup"
    target["games"].append(g)
    continue
   idx=next((i for i,old in enumerate(target["games"]) if identity(old,league)==key),None)
   if idx is None:
    target["games"].append(g);continue
   old=target["games"][idx]
   if old.get("state")=="post" and g.get("state")=="post" and score_map(old)!=score_map(g):
    conflicts.append({"league":league,"identity":repr(key),"existing_provider":old.get("provider"),"incoming_provider":p,"existing_scores":score_map(old),"incoming_scores":score_map(g),"action":"quarantined"})
    # Do not silently select either disputed result for public display.
    old["disputed"]=True
    continue
   if rank(p,league)>rank(old.get("provider"),league) or (rank(p,league)==rank(old.get("provider"),league) and g.get("state")=="post" and old.get("state")!="post"):
    target["games"][idx]=g
 for league,block in leagues.items():
  block["games"]=[g for g in block["games"] if not g.get("disputed")]
  block["games"].sort(key=lambda g:g.get("date") or "")
  block["game_count"]=len(block["games"])
  block["provider"]="reconciled"
 return list(leagues.values()),conflicts
