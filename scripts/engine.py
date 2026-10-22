"""Normalize and merge league game records without losing conflicts."""
def game_key(g):
 t=sorted(str(x.get("name","")).casefold() for x in g.get("teams",[]))
 return (str(g.get("date",""))[:10],tuple(t)) if len(t)==2 else ("id",g.get("id"))
def merge(base,priority):
 out=[dict(b,games=list(b.get("games") or [])) for b in base]
 byleague={b["league"]:b for b in out}
 for block in priority:
  if not block.get("games"):continue
  league=block["league"]
  if league not in byleague:
   b=dict(block,games=list(block["games"]));out.append(b);byleague[league]=b;continue
  b=byleague[league];index={game_key(g):i for i,g in enumerate(b["games"])}
  for g in block["games"]:
   k=game_key(g)
   if k in index:
    old=b["games"][index[k]]
    def scores(x):return {t.get("name"):str(t.get("score")) for t in x.get("teams",[])}
    if old.get("state")=="post" and g.get("state")=="post" and scores(old)!=scores(g):
     b.setdefault("conflicts",[]).append({"game":str(k),"old_id":old.get("id"),"new_id":g.get("id")});continue
    b["games"][index[k]]=g
   else:index[k]=len(b["games"]);b["games"].append(g)
  b["games"].sort(key=lambda g:g.get("date") or "")
  b["game_count"]=len(b["games"]);b["provider"]="multi-source"
 return out
