#!/usr/bin/env python3
"""Verified, game-specific home-court evidence for published men's forecasts.

Only exact dated matchup + independently sourced home-arena name matches earn
the established home edge. Never infer court location from the nominal host.
RETRO rankings, results and model coefficients are untouched by this module.
"""
import re
from urllib.parse import urlparse


PROVENANCE = "official_fixture_home_arena_match"


def normalized_arena(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def official_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def apply_verified_home_sites(fixtures, crosswalk, official_sites, registry):
    """Enrich forecast fixtures in-place with source-backed home-court status.

    Fail closed if a team, game, arena, date or first-party source is missing.
    Returns a non-publishing diagnostic count for audit logs.
    """
    mapping = {}
    duplicate_ids = set()
    for team in crosswalk.get("teams", []):
        canonical = str(team.get("id", ""))
        espn_id = str(team.get("espn_id", ""))
        if not canonical or not espn_id or espn_id == "None":
            continue
        if canonical in mapping and mapping[canonical] != espn_id:
            duplicate_ids.add(canonical)
        mapping[canonical] = espn_id
    for duplicate_id in duplicate_ids:
        mapping.pop(duplicate_id, None)

    sites = official_sites.get("games", {})
    arenas = registry.get("teams", {})
    conflicts = set(official_sites.get("conflict_keys", []))
    counts = {"fixtures": len(fixtures), "verified_home": 0, "unchanged_manual": 0,
              "unknown_or_unverified": 0, "conflicting_site": 0,
              "no_fixture_site": 0, "unverified_arena": 0, "neutral_site": 0,
              "old_evidence_cleared": 0}

    for fixture in fixtures:
        # Old evidence cannot survive a changed game date or opponent.
        if fixture.get("venue_evidence_method") == PROVENANCE:
            for field in ("venue_verification", "venue_source_url", "venue_evidence_method",
                          "venue_evidence_key", "venue_arena"):
                fixture.pop(field, None)
            counts["old_evidence_cleared"] += 1

        if fixture.get("venue_verification") in ("verified_home", "verified_neutral"):
            counts["unchanged_manual"] += 1
            continue

        away = mapping.get(str(fixture.get("away_id", "")))
        home = mapping.get(str(fixture.get("home_id", "")))
        date = str(fixture.get("date", ""))
        if not home or not away or not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", date):
            fixture["venue_verification"] = "unverified"
            counts["unknown_or_unverified"] += 1
            continue

        key = "|".join((date, away, home))
        if key in conflicts:
            fixture["venue_verification"] = "unverified"
            counts["conflicting_site"] += 1
            continue
        site = sites.get(key)
        if not isinstance(site, dict) or site.get("verification") != "exact_official_game_site":
            fixture["venue_verification"] = "unverified"
            counts["no_fixture_site"] += 1
            continue
        if site.get("neutral") is True:
            fixture["venue_verification"] = "unverified"
            counts["neutral_site"] += 1
            continue
        if site.get("neutral") is not False or not official_url(site.get("source")):
            fixture["venue_verification"] = "unverified"
            counts["unknown_or_unverified"] += 1
            continue
        reference = arenas.get(home, {})
        arena_name = normalized_arena(site.get("arena"))
        home_name = normalized_arena(reference.get("home_arena"))
        if (len(arena_name) < 6 or arena_name != home_name
                or not official_url(reference.get("home_arena_source"))):
            fixture["venue_verification"] = "unverified"
            counts["unverified_arena"] += 1
            continue

        fixture.update(
            venue_verification="verified_home",
            venue_source_url=site["source"],
            venue_evidence_method=PROVENANCE,
            venue_evidence_key=key,
            venue_arena=site["arena"],
        )
        counts["verified_home"] += 1
    return counts
