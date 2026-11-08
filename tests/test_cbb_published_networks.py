"""Regression tests for source-backed CBB television publication."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_cbb_published_networks import build, day_of, clean_network


class BroadcastPublication(unittest.TestCase):
    def write(self, data, name, value):
        path = data / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def test_dates_and_placeholders(self):
        self.assertEqual(day_of("2026-11-09T01:00:00Z"), "2026-11-08")
        self.assertEqual(day_of("2026-11-08T18:00:00-05:00"), "2026-11-08")
        for value in ("<TBD>", "TV TBA", "TBD", ""):
            self.assertEqual(clean_network(value), "")

    def test_official_network_matches_both_schools_and_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            event = {
                "id": "401920424", "date": "2026-11-08T22:00:00Z",
                "official_source": True,
                "competitions": [{
                    "competitors": [
                        {"team": {"id": "8"}},
                        {"team": {"id": "258"}}
                    ],
                    "broadcasts": [{"names": ["ESPN"], "source_url": "https://school.example/2026-27"}]
                }]
            }
            self.write(data, "mbb-schedules-2026-27/8.json", {"events": [event]})
            self.write(data, "mbb-official-conference-game-evidence.json", {
                "rows": [{"date": "2026-11-08", "visitor_id": "8",
                          "host_id": "258", "tv": "ESPN",
                          "source_url": "https://conference.example/tv"}]
            })
            self.write(data, "ncaaw-2026-27-games.json", {
                "source": "Women fixture ledger",
                "upcoming": [{"id": "401906892", "date": "2026-11-08T19:00Z",
                              "away_id": "57", "home_id": "236",
                              "broadcast": "ESPN+"}],
                "finals": []
            })
            result = build(data)
            men = [e for e in result["entries"] if e["gender"] == "men"]
            women = [e for e in result["entries"] if e["gender"] == "women"]
            self.assertEqual(len(men), 1)
            self.assertEqual(men[0]["network"], "ESPN")
            self.assertEqual(men[0]["team_ids"], ["8", "258"])
            self.assertEqual(men[0]["day"], "2026-11-08")
            self.assertEqual(women[0]["network"], "ESPN+")

    def test_conflicting_official_networks_are_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            self.write(data, "mbb-official-conference-game-evidence.json", {
                "rows": [{"date": "2026-11-08", "visitor_id": "8",
                          "host_id": "258", "tv": "ESPN",
                          "source_url": "https://conference.example/a"},
                         {"date": "2026-11-08", "visitor_id": "8",
                          "host_id": "258", "tv": "FOX",
                          "source_url": "https://conference.example/b"}]
            })
            result = build(data)
            self.assertEqual(result["men_count"], 0)
            self.assertEqual(len(result["conflicts"]), 1)

    def test_previous_confirmed_network_survives_empty_refresh(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            self.write(data, "cbb-published-networks-2026-27.json", {
                "entries": [{"gender": "men", "day": "2026-11-08",
                             "team_ids": ["8", "258"], "network": "ESPN",
                             "source": "https://conference.example/a"}]
            })
            result = build(data)
            self.assertEqual(result["men_count"], 1)
            self.assertEqual(result["entries"][0]["network"], "ESPN")


if __name__ == "__main__":
    unittest.main()
