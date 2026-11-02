#!/usr/bin/env python3
"""Release audit for the two independent NCAA Division II basketball editions.

This is deliberately offline: the publisher verifies the *actual* JSON that
would go live, rather than trusting a successful network request or an old
full-season-scan marker. No Division I files or ratings are read or written.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SEASON_START = dt.date(2026, 10, 1)
SEASON_END = dt.date(2027, 4, 15)


def school_schedule_coverage(teams: list[dict], games: list[dict]) -> dict:
    """An evidence-only triage queue; fixture counts do NOT certify schedules.

    Counts each fixture once per participating school, including neutral-site
    games, and never infers unreported games from conference opponents.
    """
    school = {
        str(t["id"]): {
            "id": str(t["id"]),
            "name": t.get("name") or str(t["id"]),
            "conference": t.get("conference") or "Conference unverified",
            "membership_pending": bool(t.get("not_eligible_for_dii_elo")),
            "published_fixtures": 0,
            "finals": 0,
            "with_tipoff": 0,
            "with_venue": 0,
            "with_network": 0,
        }
        for t in teams if t.get("id")
    }
    for game in games:
        # Set prevents accidentally counting the same school twice.
        for team_id in {str(game.get("away", "")), str(game.get("home", ""))}:
            row = school.get(team_id)
            if not row:
                continue
            row["published_fixtures"] += 1
            row["finals"] += int(game.get("status") == "final")
            row["with_tipoff"] += int(bool(game.get("start_time")))
            row["with_venue"] += int(bool(game.get("venue")))
            row["with_network"] += int(bool(game.get("network")))
    ordered = sorted(school.values(), key=lambda x: (
        x["published_fixtures"], x["name"].casefold(), x["id"]))
    zero = [s for s in ordered if s["published_fixtures"] == 0]
    thin = [s for s in ordered if 1 <= s["published_fixtures"] <= 6]
    # Eligibility changes recovery priority but does not erase membership review
    # records. Keep legacy totals for historical comparisons and existing UI.
    eligible_zero = [s for s in zero if not s["membership_pending"]]
    excluded_zero = [s for s in zero if s["membership_pending"]]
    eligible_thin = [s for s in thin if not s["membership_pending"]]
    conf = {}
    for row in ordered:
        c = conf.setdefault(row["conference"], {
            "programs": 0, "without_games": 0,
            "with_1_to_6_games": 0, "fixture_appearances": 0,
            "eligible_without_games": 0, "excluded_without_games": 0,
            "eligible_with_1_to_6_games": 0})
        c["programs"] += 1
        c["without_games"] += int(row["published_fixtures"] == 0)
        c["with_1_to_6_games"] += int(1 <= row["published_fixtures"] <= 6)
        c["fixture_appearances"] += row["published_fixtures"]
        c["eligible_without_games"] += int(row["published_fixtures"] == 0 and not row["membership_pending"])
        c["excluded_without_games"] += int(row["published_fixtures"] == 0 and row["membership_pending"])
        c["eligible_with_1_to_6_games"] += int(1 <= row["published_fixtures"] <= 6 and not row["membership_pending"])
    return {
        "disclaimer": "These are published ledger entries, not full-school schedule certifications. NCAA scoreboard and university schedules may be incomplete.",
        "programs_with_published_games": len(ordered) - len(zero),
        "without_games": len(zero),
        "with_1_to_6_games": len(thin),
        "eligible_without_games": len(eligible_zero),
        "excluded_without_games": len(excluded_zero),
        "eligible_with_1_to_6_games": len(eligible_thin),
        "eligible_zero_game_schools": eligible_zero,
        "zero_game_schools": zero,
        "thin_schedule_priority": thin[:40],
        "conference_gaps": dict(sorted(conf.items())),
    }



def full_season_school_certification(gender: str, teams: list[dict],
                                     games: list[dict], data_dir: Path,
                                     live_captures: list[dict] | None = None) -> dict:
    """Fail-closed, every-school 2026-27 certification ledger.

    Official-source observations are NOT an attestation of a complete season.
    Explicitly signed/dated per-school review plus reconciled source fixtures
    is required. A minimum fixture count can never produce CERTIFIED status.
    """
    from urllib.parse import urlparse
    try:
        from scripts.build_d2_basketball import (
            build_dii_team_lookup, resolve_dii_team_id)
    except ModuleNotFoundError:  # python scripts/audit_d2_publication.py
        from build_d2_basketball import (
            build_dii_team_lookup, resolve_dii_team_id)

    evidence_file = data_dir / "d2-official-school-grids-2026-27.json"
    if evidence_file.exists():
        evidence = json.loads(evidence_file.read_text(encoding="utf-8"))
        if evidence.get("season") != "2026-27" or evidence.get("schema") != 1:
            raise ValueError("Wrong school-grid certification season/schema")
    else:
        evidence = {"schools": [], "live_school_sources": [],
                    "certification_assertions": []}

    schools = {str(t["id"]): t for t in teams if t.get("id")}
    lookup = build_dii_team_lookup(schools)
    snapshots = defaultdict(list)
    live_pins = defaultdict(list)
    assertions = {}
    for rec in evidence.get("schools", []):
        if rec.get("gender") == gender:
            snapshots[str(rec.get("owner_id"))].append(rec)
    # Verified date-by-date live university grids already captured by the
    # existing publisher survive its fast refresh path in ledger quality.
    # Treat them as PARTIAL official source evidence, not a complete
    # school-season calendar. Never let an automated capture stand in for
    # a manually reviewed, independently verified full-season attestation.
    captured_owners = set()
    for rec in live_captures or []:
        if (not isinstance(rec, dict) or
            rec.get("gender") != gender or
            rec.get("capture_scope") != "partial_verified_dated_rows" or
            not isinstance(rec.get("fixtures"), list)):
            continue
        owner = str(rec.get("owner_id") or "")
        if (owner in schools and not snapshots.get(owner) and
            str(rec.get("source_url") or "").startswith("https://")):
            snapshots[owner].append({**rec, "scope": (
                "Machine-captured dated official university grid rows; "
                "Not a complete independently reviewed school calendar.")})
            captured_owners.add(owner)
    for rec in evidence.get("live_school_sources", []):
        if rec.get("gender") == gender:
            live_pins[str(rec.get("owner_id"))].append(rec)
    for assertion in evidence.get("certification_assertions", []):
        if assertion.get("gender") != gender:
            continue
        owner = str(assertion.get("owner_id", ""))
        if owner in assertions:
            raise ValueError("Duplicate full-season certification assertion: " + owner)
        assertions[owner] = assertion

    by_team_games = defaultdict(list)
    game_index = defaultdict(list)
    for game in games:
        if not game.get("date"):
            continue
        for ident in {game.get("away"), game.get("home")}:
            if ident in schools:
                by_team_games[ident].append(game)
        if game.get("away") and game.get("home"):
            game_index[(game["date"], frozenset(
                (game["away"], game["home"])))].append(game)

    rows = []
    stage_counts = Counter()
    for ident, t in sorted(schools.items(), key=lambda item:
                           (str(item[1].get("name", "")).casefold(), item[0])):
        excluded = bool(t.get("not_eligible_for_dii_elo"))
        own = snapshots.get(ident, [])
        pinned = live_pins.get(ident, [])
        assertion = assertions.get(ident)
        # A one-/two-game opponent snippet is never an exhaustive calendar,
        # even when every saved row already exists in the published ledger.
        partial_snapshot = any(
            source.get("capture_scope") == "partial_verified_dated_rows" or
            any(term in str(source.get("scope") or "").lower() for term in (
                "not a complete", "no full", "one exact",
                "two dated", "only one", "individually confirmed"))
            for source in own)
        evidence_rows = 0
        eligible_rows = 0
        corroborated = 0
        unidentified_opponents = 0
        unclassified_source_rows = []
        unresolved_tournament_rows = []
        role_conflicts = 0
        disputed_times = 0
        missing_games = []
        evidence_pairs = set()
        source_links = sorted({
            str(x.get("source_url")) for x in own + pinned
            if str(x.get("source_url", "")).startswith("https://")
        })
        for source in own:
            for fixture in source.get("fixtures", []):
                evidence_rows += 1
                # A published postseason tournament with no opponent is
                # neither a genuine DII-vs-DII fixture nor a non-DII opponent.
                # Preserve the TBD as unresolved certification work; never
                # manufacture a tournament game or misclassify it as NAIA.
                if fixture.get("unresolved_tournament_placeholder"):
                    unresolved_tournament_rows.append({
                        "date": fixture.get("date"),
                        "tournament": fixture.get("opponent"),
                        "source_url": source.get("source_url")})
                    continue
                other = resolve_dii_team_id(
                    {"name": fixture.get("opponent", "")}, lookup)
                if (not other or other == ident or
                        schools.get(other, {}).get("not_eligible_for_dii_elo")):
                    # Explicitly unclassified until all cross-division
                    # opponents have been reviewed for true NCAA membership.
                    unidentified_opponents += 1
                    unclassified_source_rows.append({"date": fixture.get("date"),
                        "opponent": fixture.get("opponent"),
                        "source_url": source.get("source_url")})
                    continue
                eligible_rows += 1
                key = (fixture.get("date"), frozenset((ident, other)))
                evidence_pairs.add(key)
                matches = game_index.get(key, [])
                if len(matches) != 1:
                    missing_games.append({
                        "date": fixture.get("date"),
                        "opponent": fixture.get("opponent"),
                        "resolved_id": other,
                        "source_url": source.get("source_url"),
                        "reason": ("missing from ledger" if not matches
                                   else "duplicate same-day matchup")})
                    continue
                game = matches[0]
                role = fixture.get("role")
                if ((role == "home" and game.get("home") != ident) or
                    (role == "away" and game.get("away") != ident) or
                    (role == "neutral" and not game.get("neutral"))):
                    role_conflicts += 1
                clock = fixture.get("start_time")
                if clock and game.get("start_time") and clock != game["start_time"]:
                    disputed_times += 1
                corroborated += 1

        outside_snapshot = [
            {"date": g["date"], "opponent_id":
                (g["home"] if g.get("away") == ident else g.get("away"))}
            for g in by_team_games[ident]
            if (g["date"], frozenset((g.get("away"), g.get("home"))))
            not in evidence_pairs
        ]
        # No inference of total game count from 20, 25 or 30 fixtures.
        attested = False
        attestation_errors = []
        if assertion:
            if not own or len(own) != 1:
                attestation_errors.append("Must attach exactly one authoritative full-season snapshot")
            if partial_snapshot:
                attestation_errors.append("Source snapshot expressly documents only partial game coverage")
            if assertion.get("complete_calendar") is not True:
                attestation_errors.append("Complete calendar not explicitly attested")
            if assertion.get("all_eligible_games_checked") is not True:
                attestation_errors.append("All eligible DII matchups not checked")
            if assertion.get("other_division_games_reviewed") is not True:
                attestation_errors.append("Excluded other-division games not independently reviewed")
            if assertion.get("independent_crosscheck_completed") is not True:
                attestation_errors.append("Independent crosscheck not completed")
            if assertion.get("unresolved_tbd_count") != 0 or unresolved_tournament_rows:
                attestation_errors.append("Unresolved TBD opponents/tournament placeholders")
            if assertion.get("snapshot_rows") != evidence_rows:
                attestation_errors.append("Attested row count differs from captured source")
            try:
                checked = dt.date.fromisoformat(str(assertion.get("checked_on", "")))
                if checked < dt.date(2026, 8, 1):
                    attestation_errors.append("Attestation predates 2026-27 schedule release")
            except ValueError:
                attestation_errors.append("Missing valid reviewed date")
            primary = str(assertion.get("source_url") or "")
            independent = str(assertion.get("independent_source_url") or "")
            if primary not in source_links or not primary.startswith("https://"):
                attestation_errors.append("Source URL must match the saved official source")
            if (not independent.startswith("https://") or
                    urlparse(primary).netloc == urlparse(independent).netloc):
                attestation_errors.append("Independent official secondary domain required")
            if not assertion.get("reviewed_by"):
                attestation_errors.append("Named accountable reviewer required")
            # A complete university calendar often contains NAIA, DI, DIII
            # or exhibition games. These belong in the *source* inventory,
            # but not in DII Elo. Require a separate dated, corroborated
            # classification of every such row; never silently discard it.
            classifications = assertion.get("other_division_classifications") or []
            actual = {(r["date"], r["opponent"]) for r in unclassified_source_rows}
            declared = set()
            for classified in classifications:
                key = (classified.get("date"), classified.get("opponent"))
                if key in declared or key not in actual:
                    attestation_errors.append("Duplicate or unfounded other-division source classification")
                declared.add(key)
                if (classified.get("classification") not in
                        ("not_dii_2026_27", "exhibition", "unresolved_identity")):
                    attestation_errors.append("Invalid non-DII source game classification")
                if not str(classified.get("membership_source_url") or "").startswith("https://"):
                    attestation_errors.append("Missing independent other-division membership evidence URL")
            if declared != actual or any(
                    r.get("classification") == "unresolved_identity"
                    for r in classifications):
                attestation_errors.append("Non-DII/unidentified source opponents not fully classified")
            if missing_games or outside_snapshot or role_conflicts or disputed_times:
                attestation_errors.append("School calendar and ledger differ")
            attested = not attestation_errors and not excluded

        if excluded:
            stage = "MEMBERSHIP_EXCLUDED"
            next_action = "Review 2026-27 membership; do not assign DII Elo."
        elif attested:
            stage = "CERTIFIED"
            next_action = "Revalidate on subsequent official schedule changes."
        elif not own and pinned:
            stage = "OFFICIAL_PINNED_CALENDAR_SNAPSHOT_REQUIRED"
            next_action = ("Persist all dated games from the already identified"
                           " official 2026-27 school calendar; independently"
                           " verify the complete source, not the URL alone.")
        elif not own:
            stage = "OFFICIAL_FULL_CALENDAR_REQUIRED"
            next_action = ("Find and independently verify the school's full"
                           " official 2026-27 calendar, including non-DII games.")
        elif partial_snapshot:
            stage = "PARTIAL_SOURCE_CAPTURE"
            next_action = ("Replace the explicitly partial university fixture"
                           " excerpt with the complete dated season calendar.")
        elif missing_games or role_conflicts or disputed_times or outside_snapshot:
            stage = "SOURCE_LEDGER_RECONCILIATION"
            next_action = "Reconcile exact date/opponent/role/time conflicts without inventing games."
        elif unresolved_tournament_rows:
            stage = "POSTSEASON_TBD_REVIEW_REQUIRED"
            next_action = ("Identify and verify each future tournament opponent"
                           " after official bracket publication; keep the TBD"
                           " outside the DII Elo fixture ledger until named.")
        elif not assertion:
            stage = "COMPLETE_SEASON_ATTESTATION_REQUIRED"
            next_action = ("Verify the stored calendar includes every regular-season"
                           " game and postseason TBD, classify non-DII opponents,"
                           " and record independent crosscheck.")
        else:
            stage = "ATTESTATION_FAILED"
            next_action = "Resolve listed attestation errors and source/ledger coverage."
        stage_counts[stage] += 1
        rows.append({
            "id": ident, "name": t.get("name") or ident,
            "conference": t.get("conference") or "Unverified",
            "eligible": not excluded,
            "status": stage,
            "certified": attested,
            "published_games": len(by_team_games[ident]),
            "official_source_urls": source_links,
            "official_snapshot_count": len(own),
            "live_source_rows_persisted": ident in captured_owners,
            "explicitly_partial_source": partial_snapshot,
            "official_source_rows": evidence_rows,
            "eligible_source_games": eligible_rows,
            "matched_source_games": corroborated,
            "unidentified_or_other_division_rows": unidentified_opponents,
            "other_division_source_examples": unclassified_source_rows[:12],
            "unresolved_tournament_placeholders": len(unresolved_tournament_rows),
            "tournament_placeholder_examples": unresolved_tournament_rows[:8],
            "missing_source_games_count": len(missing_games),
            "missing_source_games": missing_games[:12],
            "role_conflicts": role_conflicts,
            "tipoff_disagreements": disputed_times,
            "published_games_not_in_source_snapshot": len(outside_snapshot),
            "outside_snapshot_examples": outside_snapshot[:6],
            "attestation_errors": attestation_errors,
            "next_action": next_action,
        })
    eligible = [s for s in rows if s["eligible"]]
    certified = [s for s in eligible if s["certified"]]
    with_source = [s for s in eligible if s["official_snapshot_count"]]
    return {
        "milestone": "Every eligible 2026-27 NCAA Division II school independently full-season certified",
        "completion_rule": ("Only a complete reviewed official fixture snapshot, an independent"
                            " corroborating university/conference source, documented"
                            " non-DII exclusions and zero ledger discrepancies"
                            " can certify a school. Game count NEVER certifies."),
        "eligible_schools": len(eligible),
        "certified_schools": len(certified),
        "uncertified_schools": len(eligible) - len(certified),
        "excluded_membership_schools": len(rows) - len(eligible),
        "eligible_with_saved_official_snapshots": len(with_source),
        "eligible_without_saved_official_snapshots": len(eligible) - len(with_source),
        "eligible_with_auto_captured_unreviewed_dates": sum(
            s["live_source_rows_persisted"] for s in eligible),
        "auto_capture_certification_policy": (
            "Live grid date captures are partial source evidence only;"
            " never school-season certifications or independent checks."),
        "unresolved_official_source_games": sum(s["missing_source_games_count"] for s in eligible),
        "role_conflicts": sum(s["role_conflicts"] for s in eligible),
        "tipoff_disagreements": sum(s["tipoff_disagreements"] for s in eligible),
        "outside_source_snapshot_games": sum(
            s["published_games_not_in_source_snapshot"] for s in eligible
            if s["official_snapshot_count"]),
        "unclassified_other_division_source_rows": sum(
            s["unidentified_or_other_division_rows"] for s in eligible),
        "unresolved_tournament_placeholders": sum(
            s["unresolved_tournament_placeholders"] for s in eligible),
        "stage_counts": dict(sorted(stage_counts.items())),
        "schools": rows,
    }

def audit_one(gender: str, data_dir: Path) -> tuple[dict, list[str]]:
    path = data_dir / f"d2-{gender}-2026-27.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if data.get("gender") != gender or data.get("season") != "2026-27":
        errors.append("wrong gender/season in source ledger")
    if data.get("division") != "II" or data.get("starting_elo") != 1500:
        errors.append("division or independent 1500 baseline changed")

    teams = data.get("teams") or []
    games = data.get("games") or []
    if not teams or not games:
        errors.append("team directory or scoreboard is empty")
    ids = [t.get("id") for t in teams]
    if len(ids) != len(set(ids)):
        errors.append("duplicate school identity")
    by_team = {t.get("id"): t for t in teams}
    game_ids: set[str] = set()
    pair_ids: dict[tuple, str] = {}
    expected_wins = Counter()
    expected_losses = Counter()
    finals = 0
    missing_venue = 0
    missing_network = 0
    missing_time = 0
    missing_source = 0
    source_categories = Counter()
    dates = set()
    warnings = []
    for game in games:
        gid = str(game.get("id", ""))
        if not gid or gid in game_ids:
            errors.append(f"empty/duplicate game ID {gid!r}")
        game_ids.add(gid)
        away, home = game.get("away"), game.get("home")
        if not away or not home or away == home or away not in by_team or home not in by_team:
            errors.append(f"{gid}: missing, identical or unknown school")
            continue
        try:
            when = dt.date.fromisoformat(str(game.get("date", "")))
            if not SEASON_START <= when <= SEASON_END:
                errors.append(f"{gid}: outside the 2026-27 season")
            dates.add(when.isoformat())
        except ValueError:
            errors.append(f"{gid}: invalid calendar date")
            continue
        key = (when.isoformat(), *sorted((away, home)))
        if key in pair_ids:
            errors.append(f"{gid}: matchup also published under {pair_ids[key]}")
        pair_ids[key] = gid
        if not game.get("venue"):
            missing_venue += 1
        if not game.get("network"):
            missing_network += 1
        if not game.get("start_time"):
            missing_time += 1
        if not game.get("source_url"):
            missing_source += 1
        source_categories[str(game.get("source", "unknown"))] += 1
        if game.get("status") != "final":
            continue
        scores = (game.get("away_score"), game.get("home_score"))
        if any(type(s) is not int or s < 0 for s in scores) or scores[0] == scores[1]:
            errors.append(f"{gid}: invalid final basketball score")
            continue
        if not game.get("elo_eligible"):
            continue
        if by_team[away].get("not_eligible_for_dii_elo") or by_team[home].get("not_eligible_for_dii_elo"):
            errors.append(f"{gid}: ineligible member counted in DII ratings")
            continue
        if not game.get("verified"):
            errors.append(f"{gid}: unrverified final counted in independent Elo")
            continue
        if not all(isinstance(game.get(k), (int, float)) for k in
                   ("pregame_elo_away", "pregame_elo_home", "pred_home_pct",
                    "elo_change_away", "elo_change_home")):
            errors.append(f"{gid}: Elo forecast/change not calculated")
            continue
        if abs(game["elo_change_away"] + game["elo_change_home"]) > 0.11:
            errors.append(f"{gid}: non-zero-sum Elo movement")
        if not 0 <= game["pred_home_pct"] <= 100:
            errors.append(f"{gid}: impossible game probability")
        if scores[0] > scores[1]:
            expected_wins[away] += 1
            expected_losses[home] += 1
        else:
            expected_wins[home] += 1
            expected_losses[away] += 1
        finals += 1

    for ident, team in by_team.items():
        if team.get("w", 0) != expected_wins[ident] or team.get("l", 0) != expected_losses[ident]:
            errors.append(f"{ident}: published W-L does not reconcile with finals")
        if not isinstance(team.get("elo"), (float, int)):
            errors.append(f"{ident}: missing current Elo")
    stored_finals = (data.get("quality") or {}).get("verified_dii_finals")
    if stored_finals != finals:
        errors.append(f"finals summary ({stored_finals}) != replayed count ({finals})")

    q = data.get("quality") or {}
    scan = q.get("full_season_scan") or {}
    # Date scan alone never certifies an institution's entire fixture list.
    complete_school_schedules = False
    if missing_source:
        warnings.append(f"{missing_source} fixtures have no traceable source URL")
    coverage = q.get("field_coverage") or {}
    school_gaps = school_schedule_coverage(teams, games)
    school_certification = full_season_school_certification(
        gender, teams, games, data_dir,
        live_captures=((q.get("official_school_grid_recovery") or {})
                       .get("live_calendar_captures") or []))
    complete_school_schedules = (
        school_certification["eligible_schools"] > 0 and
        school_certification["uncertified_schools"] == 0)
    if not complete_school_schedules:
        warnings.append("A completed date scan is NOT a certified set of school schedules")
    reported_zero = coverage.get("schools_with_no_published_fixtures")
    if reported_zero is not None and reported_zero != school_gaps["without_games"]:
        warnings.append("Stored school coverage differs from the live ledger; school-by-school report is authoritative")
    # The 1–2 MB game files contain detailed evidence; export a small,
    # independently readable source audit for site operators. A verified
    # match count is NOT a certified entire-conference season.
    official_sources = {}
    for source_name, quality_name in (
        ("GSC fixtures", "official_gsc_schedule_reconciliation"),
        ("GSC arenas", "official_gsc_venue_evidence"),
        ("CACC fixtures", "official_cacc_schedule_reconciliation"),
        ("RMAC fixtures", "official_rmac_schedule_reconciliation"),
        ("NSIC fixtures", "official_nsic_schedule_reconciliation"),
        ("Carolinas fixtures", "official_carolinas_schedule_reconciliation"),
        ("GAC fixtures", "official_gac_schedule_reconciliation"),
        ("PBC fixtures", "official_pbc_schedule_reconciliation"),
        ("NE10 fixtures", "official_ne10_schedule_reconciliation"),
        ("SIAC fixtures", "official_siac_schedule_reconciliation"),
        ("SAC fixtures", "official_sac_schedule_reconciliation"),
        ("GLVC fixtures", "official_glvc_schedule_reconciliation"),
        ("ECC fixtures", "official_ecc_schedule_reconciliation"),
        ("GMAC fixtures", "official_gmac_schedule_reconciliation"),
        ("MIAA fixtures", "official_miaa_schedule_reconciliation"),
        ("CCAA men fixtures", "official_ccaa_men_schedule_reconciliation"),
        ("MEC men fixtures", "official_mec_men_schedule_reconciliation"),
        ("SSC fixtures", "official_ssc_schedule_reconciliation"),
        ("PacWest fixtures", "official_pwc_schedule_reconciliation"),
        ("Lone Star men fixtures", "official_lsc_men_schedule_reconciliation"),
        ("East Coast men fixtures", "official_ecc_men_schedule_reconciliation"),
    ):
        source = q.get(quality_name) or {}
        if not source:
            continue
        keys = (
            "status", "gender", "school_schedules", "calendars_read",
            "schools_read", "confirmed_matchups", "two_school_matches",
            "new_games", "added", "games_added", "existing_games_enriched",
            "games_enriched", "enriched", "evidence_rows", "matched",
            "unmatched", "conflicted", "quarantined", "time_conflicts",
            "time_disagreements", "unreciprocated", "single_school_only",
            "official_tipoffs", "reciprocal_matchups", "reciprocal", "one_sided",
            "official_tipoffs_added", "official_arenas_added",
            "conflicts", "mutually_verified_eastern_tipoffs", "school_grids_read",
            "source",
        )
        small = {k: source[k] for k in keys if k in source and
                 isinstance(source[k], (str, int, float, bool))}
        for k in ("errors", "unavailable_calendars", "unavailable", "school_grid_errors", "missing_school_ids", "missing_teams"):
            if isinstance(source.get(k), list):
                small[k + "_count"] = len(source[k])
        official_sources[source_name] = small
    output = {
        "gender": gender,
        "teams": len(teams),
        "games": len(games),
        "verified_elo_finals": finals,
        "dated_game_days": len(dates),
        "no_venue": missing_venue,
        "no_network": missing_network,
        "no_tipoff": missing_time,
        "no_source_url": missing_source,
        "schools_without_a_published_game": school_gaps["without_games"],
        "eligible_schools_without_a_published_game": school_gaps["eligible_without_games"],
        "excluded_elo_schools_without_a_published_game": school_gaps["excluded_without_games"],
        "school_schedule_recovery": school_gaps,
        "full_school_schedule_certification": school_certification,
        "full_season_date_scan": bool(scan.get("completed")),
        "school_schedule_certified": complete_school_schedules,
        "source_categories": dict(sorted(source_categories.items())),
        "official_conference_source_audit": official_sources,
        "warnings": warnings,
        "release_errors": errors[:50],
        "release_error_count": len(errors),
    }
    return output, errors


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="Refuse release if school identity, scores or Elo are invalid")
    ap.add_argument("--data-dir", type=Path, default=DATA)
    args = ap.parse_args()
    men, men_errors = audit_one("men", args.data_dir)
    women, women_errors = audit_one("women", args.data_dir)

    # Institutional crests can be shared between the two editions; ratings,
    # game ledgers and athletes must never be shared. Report any colors that
    # disagree for one *exact* NCAA artwork slug, without guessing a winner.
    datasets = [json.loads((args.data_dir / f"d2-{g}-2026-27.json").read_text())
                for g in ("men", "women")]
    palettes: dict[str, dict] = {}
    for team in datasets[0]["teams"]:
        if team.get("slug"):
            palettes[team["slug"]] = team
    mismatch = []
    for team in datasets[1]["teams"]:
        other = palettes.get(team.get("slug"))
        if other and team.get("primary") and other.get("primary"):
            if (other.get("primary"), other.get("secondary")) != (team.get("primary"), team.get("secondary")):
                mismatch.append({"ncaa_logo": team["slug"],
                                 "men": other.get("id"), "women": team.get("id")})
    report = {
        "schema": 1,
        "season": "2026-27",
        "independent_elo_start": 1500,
        "status": ("BLOCKED" if men_errors or women_errors else
                   ("PASS — all eligible full school schedules independently certified"
                    if men["school_schedule_certified"] and women["school_schedule_certified"]
                    else "PASS — school schedules remain uncertified")),
        "men": men,
        "women": women,
        "cross_gender_logo_palette_conflicts": mismatch[:30],
        "cross_gender_logo_palette_conflict_count": len(mismatch),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    outfile = args.data_dir / "d2-publishing-audit.json"
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if not outfile.exists() or outfile.read_text(encoding="utf-8") != serialized:
        outfile.write_text(serialized, encoding="utf-8")
    if args.strict and (men_errors or women_errors):
        raise SystemExit(f"BLOCKED DII publication: men {len(men_errors)} errors, women {len(women_errors)} errors")


if __name__ == "__main__":
    main()
