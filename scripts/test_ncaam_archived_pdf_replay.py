#!/usr/bin/env python3
"""Regression: archived roster PDFs must be parsed as PDF, not HTML."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("roster_audit",Path(__file__).with_name("audit_ncaam_preseason_roster_sources.py"))
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class DummyPage:
    def extract_text(self):
        return "2024-25 TEAM ROSTER Cooper Flagg Kon Knueppel"
class DummyReader:
    def __init__(self, payload, strict=False):
        self.pages=[DummyPage()]
class ArchivePDFTest(unittest.TestCase):
    def test_archived_pdf_is_accepted_if_two_season_anchors_match(self):
        archive={"team":"Duke","season_end_year":2025,
                 "pregame_archived_captures":[{"timestamp_utc":"20241001000000",
                    "original":"https://goduke.com/documents/roster.pdf"}]}
        fake=types.ModuleType("pypdf")
        fake.PdfReader=DummyReader
        with patch.dict(sys.modules,{"pypdf":fake}),patch.object(audit,"fetch_limited",return_value=(b"%PDF-1.4 sample","application/pdf")):
            out=audit.check_archived_roster_bytes(archive,"preseason_pdf")
        self.assertTrue(out["independently_verified_preopening_roster_content"])
        self.assertEqual(out["matched_player_evidence"],["Cooper Flagg","Kon Knueppel"])
    def test_missing_players_fails_closed(self):
        class WrongReader:
            def __init__(self,*args,**kwargs):self.pages=[types.SimpleNamespace(extract_text=lambda:"TEAM ROSTER Cooper Flagg")]
        archive={"team":"Duke","season_end_year":2025,
                 "pregame_archived_captures":[{"timestamp_utc":"20241001000000",
                     "original":"https://goduke.com/documents/roster.pdf"}]}
        fake=types.ModuleType("pypdf")
        fake.PdfReader=WrongReader
        with patch.dict(sys.modules,{"pypdf":fake}),patch.object(audit,"fetch_limited",return_value=(b"%PDF-1.4 sample","application/pdf")):
            out=audit.check_archived_roster_bytes(archive,"preseason_pdf")
        self.assertFalse(out["independently_verified_preopening_roster_content"])

if __name__=="__main__":
    unittest.main()
