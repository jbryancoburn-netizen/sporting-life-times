"""Deterministic game reconciliation with source precedence and quarantined conflicts."""
from datetime import datetime,timezone
import re,json
from pathlib import Path
def normalize_name(s):
 return re.sub(r"[^a-z0-9]","",str(s or "").casefold().replace("&","and"))
def load_aliases(path=None):
 path=Path(path) if path else Path(__file__).resolve().parents[1]/"data/team-identity-registry.json"
 data=json.loads(path.read_text(encoding="utf-8"))
 mapping={}
 for team in data["teams"]:
  for alias in team["aliases"]:
   key=(team["league"],normalize_name(alias))
   if key in mapping and mapping[key]!=team["id"]:
    raise ValueError("Conflicting canonical aliases: "+str(key))
   mapping[key]=team["id"]
 return mapping
def canonical_team(name,league,aliases):
 return aliases.get((league,normalize_name(name)),normalize_name(name))
def identity(g,league,aliases=None):
 teams=g.get("teams") or []
 if len(teams)!=2:return ("id",league,str(g.get("id")))
 names=tuple(sorted(canonical_team(t.get("name"),league,aliases or {}) for t in teams))
 if not all(names):return ("id",league,str(g.get("id")))
 date=str(g.get("date") or "")[:10]
 # A same-day doubleheader cannot safely be resolved by names and date alone.
 if g.get("doubleHeader") or g.get("doubleheader") or g.get("gameNumber"):
  return ("id",league,str(g.get("id")))
 if not date or date=="None":return ("id",league,str(g.get("id")))
 return (league,date,names)
def score_map(g,league=None,aliases=None):
 def canonical(v):
  if v is None or str(v).strip()=="":return None
  try:return int(v)
  except (ValueError,TypeError):return str(v).strip()
 return {canonical_team(t.get("name"),league,aliases or {}):canonical(t.get("score")) for t in g.get("teams",[])}
def provider(g,block):
 return str(g.get("provider") or block.get("provider") or ("espn" if "ESPN" in block.get("source_url","") else "unknown"))
def rank(p,league):
 official={"MLB":"mlb_stats","NHL":"nhl_web"}
 if p==official.get(league):return 100
 if p in ("ncaa_stats","sidearm","presto","statbroadcast"):return 85
 if p=="espn":return 60
 return 30
def reconcile(base,official,aliases=None):
 if aliases is None:aliases=load_aliases()
 leagues={}
 conflicts=[]
 # Duplicate team/date pairings in any single feed are ambiguous: never merge by that key.
 counts={}
 for block in [*(base or []),*(official or [])]:
  for game in block.get("games") or []:
   k=identity(game,block.get("league"),aliases)
   source=provider(game,block)
   counts[(source,k)]=counts.get((source,k),0)+1
 ambiguous={k for (_,k),n in counts.items() if n>1 and k[0]!="id"}
 for block in [*(base or []),*(official or [])]:
  league=block.get("league")
  if not league:continue
  target=leagues.setdefault(league,{"league":league,"games":[],"source_url":block.get("source_url",""),"error":None})
  for game in block.get("games") or []:
   g=dict(game);p=provider(g,block);g["provider"]=p
   key=identity(g,league,aliases)
   if key in ambiguous:
    conflicts.append({"league":league,"identity":repr(key),"incoming_provider":p,"incoming_id":g.get("id"),"action":"quarantined_ambiguous_same_day"})
    continue
   idx=next((i for i,old in enumerate(target["games"]) if identity(old,league,aliases)==key),None)
   if idx is None:
    target["games"].append(g);continue
   old=target["games"][idx]
   if old.get("state")=="post" and g.get("state")=="post" and score_map(old,league,aliases)!=score_map(g,league,aliases):
    conflicts.append({"league":league,"identity":repr(key),"existing_provider":old.get("provider"),"incoming_provider":p,"existing_scores":score_map(old,league,aliases),"incoming_scores":score_map(g,league,aliases),"action":"quarantined"})
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
