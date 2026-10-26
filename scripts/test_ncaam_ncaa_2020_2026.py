#!/usr/bin/env python3
"""Offline NCAA result parser contract test; does not claim remote API availability."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path("scripts").resolve()))
from acquire_ncaam_ncaa_2020_2026 import game_fields
import datetime
day=datetime.date(2025,3,1)
sample={"game":{"gameID":"123","gameState":"final","home":{"names":{"short":"Indiana","full":"Indiana Hoosiers"},"score":"77"},"away":{"names":{"short":"Purdue"},"score":"65"}}}
row,error=game_fields(sample,day)
assert error is None,(row,error)
assert row["homeTeam"]=="Indiana" and row["awayTeam"]=="Purdue"
assert (row["homePoints"],row["awayPoints"])==(77,65)
assert row["season"]==2025
sample["game"]["gameState"]="live"
assert game_fields(sample,day)[1]=="not_final"
sample["game"]["gameState"]="final"
sample["game"]["away"]["score"]="77"
assert game_fields(sample,day)[1]=="score_or_team_invalid"
print("PASS NCAA sample final, live, invalid-tie parsing")
