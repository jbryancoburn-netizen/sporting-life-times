#!/usr/bin/env python3
"""Stage reader-facing static pages without development or research payloads.

Never rewrite the repository's verified source data. A Pages deployment is a
read-only view of the current checkout, including the latest MBB forecasts
rebuilt earlier in the publication job.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_pages_site"

EXCLUDED_DIRS = {
    ".git", ".github", "scripts", "tests", "docs", "historical-report",
    "public_ratings", "_pages_site", "__pycache__", "node_modules",
    "data/mbb-official-source-cache", "data/mbb-official-game-evidence",
    "data/ncaam-historical-bulk-discovery",
    "data/ncaam-historical-roster-extraction", "data/research",
}
EXCLUDED_EXTENSIONS = {".py", ".pyc", ".md", ".pdf", ".ipynb", ".log"}
RESEARCH_TOKENS = (
    "audit", "research", "backtest", "bootstrap", "sensitivity",
    "reconciliation", "review-queue", "unlinked", "source-evidence",
    "bulk-evidence", "shadow", "priority-queue", "quality-gate",
    "official-school-verification", "roster-extraction",
)

# Preserve all explicitly used public data, including historical team matchups,
# schedule files, archives and non-Division-I competition desks. Prune only large
# generated research objects absent from any of the published page source files.
reader_code = "\n".join(
    p.read_text(encoding="utf-8", errors="replace")
    for p in ROOT.iterdir()
    if p.is_file() and p.suffix in {".html", ".js", ".css"}
)

skipped = []
copied = 0
bytes_copied = 0

def visit(source: Path) -> None:
    global copied, bytes_copied
    relative = source.relative_to(ROOT)
    rel = relative.as_posix()
    if source.is_dir():
        if rel in EXCLUDED_DIRS or source.name == "__pycache__":
            skipped.append((rel, 0))
            return
        for item in source.iterdir():
            visit(item)
        return
    if not source.is_file():
        return
    if source.suffix.lower() in EXCLUDED_EXTENSIONS:
        skipped.append((rel, source.stat().st_size))
        return
    if relative.parent.as_posix() == "data":
        name = source.name.lower()
        if (source.stat().st_size >= 1_000_000
            and any(token in name for token in RESEARCH_TOKENS)
            and source.name not in reader_code):
            skipped.append((rel, source.stat().st_size))
            return
    target = OUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    copied += 1
    bytes_copied += source.stat().st_size

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for child in ROOT.iterdir():
    if child != OUT:
        visit(child)

required = [
    "index.html", "college-basketball.html", "ncaam-slate.js",
    "data/mbb-live.json", "data/mbb-retro-live-finals.json",
    "data/ncaam-2026-27-retro-primary.json",
    "data/ncaam-2026-27-upcoming-forecasts.json",
    "data/ncaaw-2026-27-games.json",
    "data/ncaaw-2026-27-retro-primary.json",
    "data/d2-men-2026-27.json", "data/d2-women-2026-27.json",
]
missing = [p for p in required if not (OUT / p).is_file()]
if missing:
    raise SystemExit("Missing site-critical publication inputs: " + ", ".join(missing))
for folder in ["data/mbb-head-to-head-1985", "data/mbb-schedules-2026-27",
               "data/mbb-rosters-2026-27", "data/mbb-team-news"]:
    if not (OUT / folder).is_dir():
        raise SystemExit("Missing active archive directory: " + folder)

print(f"Pages static artifact: {copied} reader-facing files, "
      f"{bytes_copied / 1048576:.1f} MiB unpacked")
print(f"Excluded {len(skipped)} development/research items "
      f"({sum(size for _, size in skipped) / 1048576:.1f} MiB of direct files).")
