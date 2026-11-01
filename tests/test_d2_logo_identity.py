import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "d2_builder", Path(__file__).resolve().parents[1] / "scripts" / "build_d2_basketball.py"
)
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class D2OfficialLogoTests(unittest.TestCase):
    def test_cross_gender_institution_normalization(self):
        self.assertEqual(builder.normalize_school_name("University of Alaska Anchorage"),
                         builder.normalize_school_name("Alaska Anchorage"))
        self.assertEqual(builder.normalize_school_name("Hawaiʻi Pacific University"),
                         builder.normalize_school_name("Hawaii Pacific"))

    def test_exact_ncaa_logo_matching_and_unverified_rejection(self):
        source = [
            {"slug": f"school-{i}", "name": f"Sample University {i}", "long_name": ""}
            for i in range(800)
        ]
        source += [
            {"slug": "hawaii-pacific", "name": "Hawaii Pacific", "long_name": "Hawaii Pacific University"},
            {"slug": "alaska-anchorage", "name": "Alaska Anchorage", "long_name": "University of Alaska Anchorage"}
        ]
        teams = {
            "hp": {"id": "hp", "name": "Hawaiʻi Pacific University", "slug": ""},
            "uaa": {"id": "uaa", "name": "University of Alaska Anchorage", "slug": ""},
            "other": {"id": "other", "name": "Imaginary Tech", "slug": ""},
        }
        with patch.object(builder, "get_json", return_value=source):
            result = builder.seed_official_logos(teams)
        self.assertEqual(result["matched"], 2)
        self.assertEqual(teams["hp"]["slug"], "hawaii-pacific")
        self.assertEqual(teams["uaa"]["slug"], "alaska-anchorage")
        self.assertEqual(teams["other"]["slug"], "")

    def test_reuse_across_genders_only_when_same_city_and_unambiguous_name(self):
        import json
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            partner = {
                "teams": [
                    {"name": "University of Alaska Anchorage", "city": "Anchorage",
                     "slug": "alas-anchorage", "logo_source": "NCAA schools index"},
                    {"name": "Same Name College", "city": "Elsewhere",
                     "slug": "other", "logo_source": "NCAA schools index"}
                ]
            }
            (source / "d2-men-2026-27.json").write_text(json.dumps(partner))
            candidates = {
                "real": {"name": "Alaska Anchorage", "city": "Anchorage", "slug": ""},
                "wrong_city": {"name": "Same Name College", "city": "Anchorage", "slug": ""}
            }
            with patch.object(builder, "DATA", source):
                report = builder.seed_cross_gender_logos("women", candidates)
            self.assertEqual(report["added"], 1)
            self.assertEqual(candidates["real"]["slug"], "alas-anchorage")
            self.assertEqual(candidates["wrong_city"]["slug"], "")

    def test_no_invented_logos_when_school_index_unavailable(self):
        teams = {"x": {"name": "Unrecognized College", "slug": ""}}
        with patch.object(builder, "get_json", side_effect=OSError("source unavailable")):
            result = builder.seed_official_logos(teams)
        self.assertEqual(result["matched"], 0)
        self.assertEqual(teams["x"]["slug"], "")


if __name__ == "__main__":
    unittest.main()
