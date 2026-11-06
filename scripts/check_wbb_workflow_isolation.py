#!/usr/bin/env python3
"""Reject cross-sport trigger regressions in the women's RETRO publisher.

Standard-library only: validate the on.push.paths section without YAML parsers,
and ensure men's newsroom data cannot silently become a women's publish trigger.
"""
from pathlib import Path
import re
import sys

WORKFLOW = Path(".github/workflows/wbb-retro-live.yml")
PROHIBITED = (
    "data/mbb-live.json",
    "data/mbb-",
    "data/ncaam-",
    "scripts/refresh_mbb",
    ".github/workflows/mbb-",
)
REQUIRED = (
    ".github/workflows/wbb-retro-live.yml",
    "scripts/wbb-season.py",
    "scripts/publish-wbb-retro.js",
    "tests/test_wbb_live_pipeline.py",
)

def main():
    content = WORKFLOW.read_text(encoding="utf-8")
    match = re.search(r"(?ms)^  push:\s*\n(?P<section>.*?)(?=^  [a-zA-Z_][\w-]*:\s*(?:\n|$)|^permissions:|\Z)", content)
    if not match:
        raise AssertionError("Women publisher missing push section")
    section = match.group("section")
    if not re.search(r"(?m)^    paths:\s*$", section):
        raise AssertionError("Women publisher must use an explicit push paths allowlist")
    paths = re.findall(r"(?m)^\s{6}-\s*['\"]([^'\"]+)['\"]\s*(?:#.*)?$", section)
    if not paths:
        raise AssertionError("Women's push paths allowlist is empty or unparsable")
    if any(any(p.startswith(x) for x in PROHIBITED) for p in paths):
        raise AssertionError("Men's basketball paths must not trigger women's RETRO: " + repr(paths))
    missing = sorted(set(REQUIRED) - set(paths))
    if missing:
        raise AssertionError("Required independent women's triggers missing: " + repr(missing))
    if not re.search(r"(?m)^  schedule:\s*$", content) or "workflow_dispatch:" not in content:
        raise AssertionError("Independent scheduled and manual women's refreshes must be preserved")
    print("PASS: women's RETRO triggers are independent of men's basketball data")

if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError) as err:
        print("FAIL:", err, file=sys.stderr)
        sys.exit(1)
