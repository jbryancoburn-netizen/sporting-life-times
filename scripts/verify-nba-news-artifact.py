#!/usr/bin/env python3
"""Assert that the publicly deployed NBA headlines equal the build's news artifact."""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-nba-news-artifact.py public-news.json")
local = json.loads(Path("data/nba-top-stories.json").read_text(encoding="utf-8"))
published = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert len(local.get("articles", [])) >= 3, "NBA headline artifact is incomplete"
fresh = datetime.fromisoformat(local["updated_at"].replace("Z", "+00:00"))
age = (datetime.now(timezone.utc) - fresh).total_seconds()
assert -300 <= age <= 7200, f"NBA headlines are stale: {age / 60:.0f} minutes"
assert published["updated_at"] == local["updated_at"], "Public NBA news timestamp differs from deployment"
assert [a["url"] for a in published["articles"]] == [a["url"] for a in local["articles"]], "Public NBA headline URLs differ"
print("PASS: NBA news feed fresh and exact public deployment match")
