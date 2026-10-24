"""Replay new NCAA soccer finals onto a pinned USRS Elo snapshot.

A credential-free newspaper-side mirror of the private USRS ratings, NOT a
direct export from the private repo. Fetches NCAA.com scoreboard data through
the ncaa-api compatibility endpoint. The baseline is immutable; an append-only
game ledger is replayed from it every run, so new late-arriving results cannot
be applied twice or in the wrong order.

Publishing fails closed on source errors, conflicts and provenance defects.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parents[1]
BASELINE = HERE / "data/college-soccer-elo-baseline.json"
LEDGER = HERE / "data/college-soccer-elo-final-ledger.json"
OUTPUT = HERE / "data/college-soccer-elo.json"
AUDIT = HERE / "data/college-soccer-elo-live-audit.json"
API = "https://ncaa-api.henrygd.me/scoreboard"
USER_AGENT = "SportingLifeTimes-CollegeSoccer-USRS-compatible/1.0"
K = 28.0
HOME_ADVANTAGE = 75.0
COHORTS = [f"{gender}-d{d}" for gender in ("men", "women") for d in (1, 2, 3)]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_digest(baseline: dict) -> str:
    return hashlib.sha256(json.dumps(baseline, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_baseline(base: dict):
    if base.get("status") != "provisional":
        raise ValueError("unexpected baseline status")
    if list(base.get("cohorts", {})) != COHORTS:
        raise ValueError("missing or reordered NCAA divisions")
    dt.date.fromisoformat(base["as_of"])
    for key, rows in base["cohorts"].items():
        if not rows or len({r["team_id"] for r in rows}) != len(rows):
            raise ValueError(f"invalid baseline team membership in {key}")
        for row in rows:
            if row.get("gender") + "-d" + str(row.get("division")) != key:
                raise ValueError("baseline cross-division mismatch")
            if not math.isfinite(float(row["elo"])) or int(row["gp"]) != int(row["w"]) + int(row["l"]) + int(row["d"]):
                raise ValueError("baseline Elo or record corrupted")


def normalized_final(raw: dict, gender: str, requested: dt.date):
    g = raw.get("game") or {}
    if g.get("gameState") != "final":
        return None
    gid = str(g.get("gameID") or "").strip()
    h, a = g.get("home") or {}, g.get("away") or {}
    home_slug = str((h.get("names") or {}).get("seo") or "").strip()
    away_slug = str((a.get("names") or {}).get("seo") or "").strip()
    hs, ass = str(h.get("score") or "").strip(), str(a.get("score") or "").strip()
    if not gid or not home_slug or not away_slug or home_slug == away_slug:
        raise ValueError("final with missing ID or team slug")
    if not hs.isdecimal() or not ass.isdecimal():
        # A 0 score is converted to "0" because str(0 or "") would be "", so
        # providers must supply a string or the explicit numeric zero.
        if type(h.get("score")) is int and h["score"] == 0: hs = "0"
        if type(a.get("score")) is int and a["score"] == 0: ass = "0"
    if not hs.isdecimal() or not ass.isdecimal() or int(hs) > 40 or int(ass) > 40:
        raise ValueError(f"invalid posted final score for {gender}-{gid}")
    date_text = str(g.get("startDate") or "").strip()
    if not date_text:
        raise ValueError(f"final has no startDate: {gender}-{gid}")
    played = dt.datetime.strptime(date_text, "%m/%d/%Y").date()
    if abs((requested - played).days) > 1:
        raise ValueError(f"scoreboard date mismatch: {gender}-{gid}")
    return {
        "match_id": f"{gender}-{gid}",
        "gender": gender,
        "date": played.isoformat(),
        "home_team": home_slug,
        "away_team": away_slug,
        "home_goals": int(hs),
        "away_goals": int(ass),
        "source_game": f"https://www.ncaa.com/game/{gid}",
    }


def scoreboard(url: str, retries: int = 4) -> dict:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=35) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or not isinstance(payload.get("games"), list):
                raise ValueError(f"unexpected NCAA proxy response: {url}")
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return {"games": []}
            if exc.code not in (408, 429, 500, 502, 503, 504) or attempt + 1 >= retries:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt + 1 >= retries:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("all scoreboard retries exhausted")


def fetch_finals(start: dt.date, end: dt.date, getter=scoreboard):
    if start > end:
        return [], {"scoreboards": 0, "fetched_finals": 0}
    incoming = {}
    checked = 0
    day = start
    while day <= end:
        for gender in ("men", "women"):
            for d in (1, 2, 3):
                url = f"{API}/soccer-{gender}/d{d}/{day:%Y/%m/%d}/all-conf"
                raw = getter(url)
                checked += 1
                for g in raw["games"]:
                    result = normalized_final(g, gender, day)
                    if result is None:
                        continue
                    key = result["match_id"]
                    if key in incoming and incoming[key] != result:
                        raise ValueError(f"conflicting division feed score for {key}")
                    incoming[key] = result
        day += dt.timedelta(days=1)
    return sorted(incoming.values(), key=lambda g: (g["date"], g["match_id"])), {
        "scoreboards": checked, "fetched_finals": len(incoming)
    }


def validate_ledger(ledger: dict, baseline: dict) -> dict:
    if ledger.get("schema_version") != 1 or ledger.get("baseline_as_of") != baseline["as_of"]:
        raise ValueError("ledger references wrong baseline")
    if ledger.get("baseline_sha256") != canonical_digest(baseline):
        raise ValueError("ledger baseline digest mismatch")
    if not isinstance(ledger.get("results"), list):
        raise ValueError("invalid final ledger rows")
    historic_cutoff = baseline["as_of"]
    seen = {}
    for game in ledger["results"]:
        if not isinstance(game, dict) or any(k not in game for k in (
            "match_id", "date", "gender", "home_team", "away_team",
            "home_goals", "away_goals", "source_game"
        )):
            raise ValueError("incomplete ledger entry")
        if game["date"] <= historic_cutoff:
            raise ValueError("ledger overlaps pinned historical baseline")
        if game["gender"] not in ("men", "women") or game["match_id"] in seen:
            raise ValueError("duplicate or invalid ledger ID")
        if game["home_team"] == game["away_team"] or any(type(game[k]) is not int or not 0 <= game[k] <= 40 for k in ("home_goals", "away_goals")):
            raise ValueError("corrupt final in ledger")
        seen[game["match_id"]] = game
    return seen


def replay(baseline: dict, ledger: dict) -> tuple[dict, dict]:
    validate_baseline(baseline)
    validate_ledger(ledger, baseline)
    output = copy.deepcopy(baseline)
    identities = {}
    for cohort, rows in output["cohorts"].items():
        for row in rows:
            identity = (row["gender"], row["team_id"])
            if identity in identities:
                raise ValueError("school appears in multiple divisions")
            identities[identity] = (cohort, row)
    accepted, excluded = 0, 0
    recent = []
    for g in sorted(ledger["results"], key=lambda x: (x["date"], x["match_id"])):
        home = identities.get((g["gender"], g["home_team"]))
        away = identities.get((g["gender"], g["away_team"]))
        if home is None or away is None or home[0] != away[0]:
            excluded += 1
            continue
        h, a = home[1], away[1]
        expected = 1. / (1. + 10 ** (-(float(h["elo"]) - float(a["elo"]) + HOME_ADVANTAGE) / 400.))
        hg, ag = g["home_goals"], g["away_goals"]
        outcome = 1. if hg > ag else .5 if hg == ag else 0.
        margin = abs(hg - ag)
        multiplier = min(1.75, 1. + .15 * (margin - 1)) if margin > 1 else 1.
        delta = K * multiplier * (outcome - expected)
        # Retain full precision *during* replay, rounding only for publication.
        h["elo"] = float(h["elo"]) + delta
        a["elo"] = float(a["elo"]) - delta
        for r, gf, ga, win, loss in (
            (h, hg, ag, hg > ag, hg < ag),
            (a, ag, hg, ag > hg, ag < hg),
        ):
            r["gp"] += 1
            r["gf"] += gf
            r["ga"] += ga
            r["gd"] = r["gf"] - r["ga"]
            r["w"] += int(win)
            r["l"] += int(loss)
            r["d"] += int(hg == ag)
            r["record"] = f"{r['w']}-{r['l']}-{r['d']}"
        accepted += 1
        recent.append({
            "match_id": g["match_id"],
            "date": g["date"],
            "cohort": home[0],
            "home": h["team"], "away": a["team"],
            "score": f"{hg}-{ag}",
            "source_game": g["source_game"],
            "home_elo_change": round(delta, 3),
        })
    for cohort, rows in output["cohorts"].items():
        rows.sort(key=lambda r: (-r["elo"], r["team_id"]))
        for i, r in enumerate(rows, 1):
            r["rank"] = i
            r["elo"] = round(r["elo"], 3)
    output["as_of"] = max([baseline["as_of"]] + [g["date"] for g in ledger["results"]])
    output["status"] = "provisional"
    output["update_method"] = "USRS-compatible replay from verified NCAA finals; pinned Elo baseline"
    output["baseline_as_of"] = baseline["as_of"]
    output["applied_finals_since_baseline"] = accepted
    output["excluded_finals_since_baseline"] = excluded
    output["latest_finals"] = recent[-40:][::-1]
    warnings = output.get("warnings") or []
    extra = "Newspaper-side USRS-compatible mirror; direct private-repository synchronization has not been configured."
    if extra not in warnings: warnings.append(extra)
    output["warnings"] = warnings
    audit = {
        "baseline_as_of": baseline["as_of"],
        "published_as_of": output["as_of"],
        "baseline_sha256": canonical_digest(baseline),
        "ledger_finals": len(ledger["results"]),
        "applied_finals": accepted,
        "excluded_finals": excluded,
        "last_game_date": max([baseline["as_of"]] + [g["date"] for g in ledger["results"]]),
        "status": "provisional",
        "model": "USRS mirror, 1500 baseline, K=28, home=75, differential multiplier capped 1.75",
    }
    if not ledger["results"]:
        # Preserve the exact original published model before the first final.
        return baseline, audit
    return output, audit


def update(baseline: dict, ledger: dict, incoming: list[dict]):
    lookup = validate_ledger(ledger, baseline)
    additions = 0
    for game in incoming:
        if game["date"] <= baseline["as_of"]:
            continue
        key = game["match_id"]
        if key in lookup:
            if lookup[key] != game:
                raise ValueError(f"FINAL_CORRECTION_REQUIRED: existing result changed for {key}")
        else:
            lookup[key] = game
            additions += 1
    result = {
        "schema_version": 1,
        "baseline_as_of": ledger["baseline_as_of"],
        "baseline_sha256": ledger["baseline_sha256"],
        "results": sorted(lookup.values(), key=lambda g: (g["date"], g["match_id"])),
    }
    model, audit = replay(baseline, result)
    audit["new_games_seen"] = additions
    return result, model, audit


def atomic_json(path: Path, content: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(content, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--now", help="Override local US Eastern date in YYYY-MM-DD")
    parser.add_argument("--lookback", type=int, default=4)
    parser.add_argument("--offline", action="store_true", help="Rebuild published ratings only from existing ledger")
    args = parser.parse_args()
    if not 1 <= args.lookback <= 120:
        raise SystemExit("--lookback must be 1 to 120")
    base = read_json(BASELINE)
    validate_baseline(base)
    ledger_existed = LEDGER.is_file()
    ledger = read_json(LEDGER) if ledger_existed else {
        "schema_version": 1,
        "baseline_as_of": base["as_of"],
        "baseline_sha256": canonical_digest(base),
        "results": [],
    }
    validate_ledger(ledger, base)
    today = dt.date.fromisoformat(args.now) if args.now else dt.datetime.now(ZoneInfo("America/New_York")).date()
    start = max(dt.date.fromisoformat(base["as_of"]) + dt.timedelta(days=1), today - dt.timedelta(days=args.lookback - 1))
    if not args.offline:
        incoming, probe = fetch_finals(start, today)
    else:
        incoming, probe = [], {"scoreboards": 0, "fetched_finals": 0}
    next_ledger, model, audit = update(base, ledger, incoming)
    audit.update({"checked_through":today.isoformat(),"scoreboard_checks":probe["scoreboards"],
                  "source_finals_in_window":probe["fetched_finals"],
                  "source":"NCAA.com scoreboards through ncaa-api compatibility transport"})
    model_needs_repair = not OUTPUT.is_file() or read_json(OUTPUT) != model
    changed = not ledger_existed or next_ledger != ledger or model_needs_repair
    if changed:
        # Write the deterministic model first; if interrupted before ledger,
        # the next invocation replays and repairs the two outputs.
        atomic_json(OUTPUT, model)
        atomic_json(LEDGER, next_ledger)
        atomic_json(AUDIT, audit)
    print(json.dumps({"changed":changed, **audit}, sort_keys=True))


if __name__ == "__main__":
    main()
