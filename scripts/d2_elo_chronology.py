"""Chronological, Eastern-time ordering of independently verified DII games.

The public ledger formats times as '2:00 PM ET'; lexical sorting incorrectly
places '10:00 PM ET' ahead of afternoon finals. Unknown tipoffs sort last,
and the original game ID breaks ties deterministically.
"""
import re

_TIP = re.compile(r"^\s*(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)\s*ET\s*$", re.I)

def tipoff_minute(raw):
    match = _TIP.fullmatch(str(raw or ""))
    if not match:
        return 24 * 60
    hour = int(match.group(1)) % 12
    if match.group(3).upper() == "PM":
        hour += 12
    return 60 * hour + int(match.group(2))

def game_sort_key(game):
    return (str(game.get("date", "")),
            tipoff_minute(game.get("start_time")),
            str(game.get("id", "")))
