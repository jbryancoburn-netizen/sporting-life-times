"""Apply verified official school corrections to women's imported calendars."""
import json
from pathlib import Path

def apply(doc, finals, names, data_dir):
    path=Path(data_dir)/"wbb-official-fixture-replacements-2026-27.json"
    if not path.exists():
        return 0
    rules=json.loads(path.read_text(encoding="utf-8"))
    if rules.get("season")!="2026-27" or rules.get("gender")!="women":
        raise ValueError("Wrong-season women's fixture correction")
    by_id={str(g["id"]):g for g in finals.get("games",[])}
    changes=0
    for old in rules.get("canceled",[]):
        tid=str(old["team_id"])
        for row in doc["teams"][tid]["games"]:
            if str(row.get("id"))!=str(old["game_id"]) or str(row.get("opponent_id"))!=str(old["opponent_id"]):
                continue
            fields={"id":"cancelled-"+str(old["game_id"])+"-"+tid,
                    "cancelled":True,"cancellation_source_url":old["source_url"],
                    "cancellation_reason":old["reason"],"reassigned_event_id":str(old["game_id"])}
            for field,val in fields.items():
                if row.get(field)!=val:row[field]=val;changes+=1
    for replacement in rules.get("replacements",[]):
        game_id=str(replacement["game_id"])
        final=by_id.get(game_id)
        if not final or any(str(final[key])!=str(replacement[key]) for key in
                            ("home_id","away_id","home_score","away_score")):
            raise ValueError("Official replacement disagrees with verified final: "+game_id)
        for tid,opp,site in ((str(replacement["home_id"]),str(replacement["away_id"]),"home"),
                              (str(replacement["away_id"]),str(replacement["home_id"]),"away")):
            rows=[g for g in doc["teams"][tid]["games"] if str(g.get("id"))==game_id]
            if len(rows)>1:raise ValueError("Duplicate official replacement "+game_id)
            if not rows:continue
            row=rows[0]
            fields={
                "date":replacement["date"],"opponent_id":opp,"opponent":names[opp],
                "home_id":str(replacement["home_id"]),"away_id":str(replacement["away_id"]),
                "site":site,"venue":replacement["venue"],"city":replacement["city"],
                "broadcast":replacement["broadcast"],"completed":True,
                "home_score":replacement["home_score"],"away_score":replacement["away_score"],
                "official_venue_verified":True,"official_venue_name":replacement["venue"],
                "official_venue_source_url":replacement["source_url"],
                "official_schedule_source_url":replacement["source_url"],
                "official_location_as_printed":replacement["city"]+" ("+replacement["venue"]+")",
                "official_location_source_url":replacement["source_url"],
                "official_time_as_printed":"1 p.m. ET",
                "official_time_source_url":replacement["source_url"],
                "result_source_url":replacement["source_url"],
                "original_fixture_replaced":True,
            }
            for field,val in fields.items():
                if row.get(field)!=val:row[field]=val;changes+=1
    return changes
