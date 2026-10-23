#!/usr/bin/env python3
"""Offline tests for current NCAA men's season release source selection."""
import importlib.util,unittest
from pathlib import Path
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location("health",Path(__file__).with_name("check_ncaam_feeds.py"))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class HealthTests(unittest.TestCase):
 def test_not_released(self):
  out=mod.check(reader=lambda _:{"assets":[{"name":"ncaa_mbb_schedule_2026.csv.gz"}]})
  self.assertEqual(out["status"],"not_released")
 def test_primary_requires_registry_and_schedule(self):
  def read(url):
   stem="team_ids" if "team_ids" in url else "schedule"
   return {"assets":[{"name":f"ncaa_mbb_{stem}_2027.csv.gz","browser_download_url":"https://github.com/test"}]}
  out=mod.check(reader=read)
  self.assertEqual(out["status"],"ncaa_origin_available_for_reconciliation")
 def test_fallback_never_approves_elo(self):
  def read(url):
   if "espn_mens_college_basketball" in url:
    return {"assets":[{"name":"mbb_schedule_2027.csv.gz","browser_download_url":"https://github.com/test"}]}
   return {"assets":[]}
  out=mod.check(reader=read)
  self.assertEqual(out["status"],"fallback_available_not_authorized_for_elo")
  self.assertFalse(out["sources"]["ncaa_schedule"]["available"])
if __name__=="__main__":unittest.main()
