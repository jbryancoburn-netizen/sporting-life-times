"""Offline official SIDEARM school calendar importer test suite for 2026-27 DII."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_d2_basketball import (
    apply_official_school_grid_snapshots,
    fetch_dii_live_school_grids,
    parse_dii_live_school_grid,
)

SOURCE = {
    "gender": "men", "owner_id": "elizabeth-city-state",
    "source_url": "https://ecsuvikings.com/sports/mens-basketball/schedule/2026-27?grid=true",
    "time_zone": "America/New_York", "school_identity": "Elizabeth City State",
}
WEST = {
    "gender": "men", "owner_id": "seattle-pacific",
    "source_url": "https://spufalcons.com/sports/mens-basketball/schedule/2026-27?grid=true",
    "time_zone": "America/Los_Angeles", "school_identity": "SPU",
}


def page(source, gender="Men's", season="2026-27", home_role="Home",
         time="7:30 PM", title_school=None, dates=12):
    title = f"{season} {gender} Basketball Schedule - " + (
        title_school or source["school_identity"]) + " Athletics"
    headings = ["Date", "Time", "At", "Opponent", "Location",
                "TV", "Radio", "Tournament", "Result"]
    values = []
    for i in range(dates):
        date = dt.date(2026, 11, 9) + dt.timedelta(days=i)
        date_label = date.strftime("%B %-d, %Y (%A)")
        values.append(
            "<tr>" + "".join(f"<td>{v}</td>" for v in [
                date_label, time, home_role, "Shaw University",
                "Elizabeth City, NC / R. L. Vaughan Center", "", "", "", "",
            ]) + "</tr>"
        )
    header = "<tr>" + "".join(f"<th>{c}</th>" for c in headings) + "</tr>"
    return ("<html><head><title>" + title + "</title></head>"
            "<body><h2>" + title + "</h2><table>" + header
            + "".join(values) + "</table></body></html>")


class ThinSchoolSourceTests(unittest.TestCase):
    def test_sources_cover_13_original_men_6_new_men_and_msub_women(self):
        path = Path(__file__).resolve().parents[1] / "data" / "d2-official-school-grids-2026-27.json"
        entries = json.loads(path.read_text())["live_school_sources"]
        men = [s for s in entries if s["gender"] == "men"]
        women = [s for s in entries if s["gender"] == "women"]
        self.assertEqual(len(men), 19)
        self.assertEqual(len(women), 1)
        self.assertEqual(len({(s["gender"], s["owner_id"]) for s in entries}), 20)
        for entry in entries:
            self.assertTrue(entry["source_url"].startswith("https://"))
            self.assertTrue(entry["time_zone"].startswith("America/"))
            self.assertRegex(entry["source_url"], r"/2026-(?:27|2027)")

    def test_own_university_grid_accepted_and_dates_verified(self):
        result = parse_dii_live_school_grid(page(SOURCE), SOURCE)
        self.assertEqual(len(result["fixtures"]), 12)
        self.assertEqual(result["owner_id"], "elizabeth-city-state")
        self.assertEqual(result["fixtures"][0]["date"], "2026-11-09")
        self.assertEqual(result["fixtures"][0]["start_time"], "7:30 PM ET")
        self.assertIn("Vaughan Center", result["fixtures"][0]["venue"])
        self.assertNotIn("home_score", result["fixtures"][0])

    def test_fake_gender_year_and_institution_do_not_pass(self):
        for bad in (
            page(SOURCE, gender="Women's"),
            page(SOURCE, season="2025-26"),
            page(SOURCE, title_school="Completely Different University"),
        ):
            with self.subTest(bad=bad[:120]):
                with self.assertRaises(ValueError):
                    parse_dii_live_school_grid(bad, SOURCE)

    def test_undocumented_short_or_placeholder_schedule_quarantined(self):
        with self.assertRaises(ValueError):
            parse_dii_live_school_grid(page(SOURCE, dates=2), SOURCE)
        template = page(SOURCE).replace("Shaw University", "CIAA Tournament")
        with self.assertRaises(ValueError):
            parse_dii_live_school_grid(template, SOURCE)

    def test_west_coast_campus_time_is_converted_with_date_timezone(self):
        result = parse_dii_live_school_grid(
            page(WEST, time="7:30 PM", title_school="SPU"), WEST)
        self.assertEqual(result["fixtures"][0]["start_time"], "10:30 PM ET")
        # Never mistakenly attribute a West Coast 11:30 PM game to
        # 11:30 PM Eastern on the same date.
        late = parse_dii_live_school_grid(
            page(WEST, time="11:30 PM", title_school="SPU"), WEST)
        self.assertEqual(late["fixtures"][0]["start_time"], "")

    def test_source_failure_quarantined_without_crashing_other_calendars(self):
        good, bad = dict(SOURCE), dict(WEST)
        entries, audit = fetch_dii_live_school_grids(
            "men", [good, bad],
            fetcher=lambda url: (
                page(good) if url == good["source_url"]
                else "<html><title>2025-26 Women's Basketball</title></html>"
            ))
        self.assertEqual(len(entries), 1)
        self.assertEqual(audit["attempted"], 2)
        self.assertEqual(audit["parsed"], 1)
        self.assertEqual(audit["source_rows"], 12)
        self.assertEqual(len(audit["failed"]), 1)
        self.assertEqual(audit["failed"][0]["owner"], "seattle-pacific")

    def test_existing_importer_gets_live_sources_without_fake_finals(self):
        data = {"schema": 1, "season": "2026-27",
                "schools": [], "live_school_sources": [SOURCE]}
        teams = {
            "elizabeth-city-state": {
                "id": "elizabeth-city-state", "name": "Elizabeth City State"},
            "shaw": {"id": "shaw", "name": "Shaw University"},
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data.json"
            path.write_text(json.dumps(data))
            games = {}
            args = ("men", games, teams)
            kwargs = {
                "today": dt.date(2026, 11, 2),
                "registry_file": path, "live_sources": True,
                "live_fetcher": lambda url: page(SOURCE),
            }
            first = apply_official_school_grid_snapshots(*args, **kwargs)
            self.assertEqual(first["created"], 12)
            self.assertEqual(first["live_school_sources"]["parsed"], 1)
            self.assertEqual(first["captured_school_count"], 1)
            self.assertEqual(first["captured_source_rows"], 12)
            self.assertEqual(first["live_calendar_captures"][0]["capture_scope"],
                             "partial_verified_dated_rows")
            self.assertEqual(len(first["live_calendar_captures"][0]["fixtures"]), 12)
            self.assertEqual(len(games), 12)
            self.assertTrue(all(g["status"] == "scheduled" and
                                g["home_score"] is None and
                                g["away_score"] is None for g in games.values()))
            second = apply_official_school_grid_snapshots(*args, **kwargs)
            self.assertEqual(second["created"], 0)
            self.assertEqual(second["matched"], 12)
            self.assertEqual(len(games), 12)


    def test_2026_2027_school_slug_is_valid_without_accepting_last_year(self):
        other = dict(SOURCE)
        other["source_url"] = (
            "https://ecsuvikings.com/sports/mens-basketball/schedule/2026-2027?grid=true")
        self.assertEqual(
            len(parse_dii_live_school_grid(page(other, season="2026-2027"),
                                           other)["fixtures"]), 12)
        other["source_url"] = other["source_url"].replace("2026-2027", "2025-2026")
        with self.assertRaises(ValueError):
            parse_dii_live_school_grid(page(other, season="2026-2027"), other)

    def test_live_captures_survive_network_failure_and_fast_refresh(self):
        source = dict(SOURCE)
        evidence = {"schema": 1, "season": "2026-27",
                    "schools": [], "live_school_sources": [source]}
        teams = {"elizabeth-city-state": {"id": "elizabeth-city-state",
                                           "name": "Elizabeth City State"},
                 "shaw": {"id": "shaw", "name": "Shaw University"}}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.json"
            path.write_text(json.dumps(evidence))
            games = {}
            kwargs = {"registry_file": path, "today": dt.date(2026, 11, 2)}
            live = apply_official_school_grid_snapshots(
                "men", games, teams, live_sources=True,
                live_fetcher=lambda url: page(source), **kwargs)
            self.assertEqual(live["created"], 12)
            captures = live["live_calendar_captures"]
            # Exact source fixture evidence is still present when a rapid
            # game-day pass deliberately does not access university sites.
            lean = apply_official_school_grid_snapshots(
                "men", games, teams, live_sources=False,
                previous_live_captures=captures, **kwargs)
            self.assertEqual(lean["captured_source_rows"], 12)
            self.assertEqual(lean["captured_school_count"], 1)
            self.assertEqual(lean["live_calendar_captures"], captures)
            self.assertEqual(lean["created"], 0)
            # A transient upstream timeout is NOT an instruction to erase
            # a previously sourced university schedule.
            def timeout(url):
                raise TimeoutError("temporary school outage")
            failed = apply_official_school_grid_snapshots(
                "men", games, teams, live_sources=True,
                live_fetcher=timeout,
                previous_live_captures=captures, **kwargs)
            self.assertEqual(failed["live_school_sources"]["parsed"], 0)
            self.assertEqual(failed["captured_school_count"], 1)
            self.assertEqual(failed["live_calendar_captures"], captures)
            self.assertEqual(len(games), 12)
            self.assertTrue(all(g["status"] == "scheduled" for g in games.values()))

    def test_wrong_owner_source_cannot_be_cached_as_another_school(self):
        source = dict(SOURCE)
        registry = {"schema": 1, "season": "2026-27",
                    "schools": [], "live_school_sources": [source]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.json"
            path.write_text(json.dumps(registry))
            forgery = {"owner_id": "elizabeth-city-state", "gender": "men",
                       "source_url": WEST["source_url"],
                       "capture_scope": "partial_verified_dated_rows",
                       "fixtures": [{"date": "2026-11-10",
                                     "opponent": "Shaw University"}]}
            x = apply_official_school_grid_snapshots(
                "men", {}, {"elizabeth-city-state": {
                    "id": "elizabeth-city-state", "name": "Elizabeth City State"}},
                registry_file=path, today=dt.date(2026, 11, 2),
                live_sources=False, previous_live_captures=[forgery])
            self.assertEqual(x["captured_school_count"], 0)
            self.assertEqual(x["captured_source_rows"], 0)


if __name__ == "__main__":
    unittest.main()
