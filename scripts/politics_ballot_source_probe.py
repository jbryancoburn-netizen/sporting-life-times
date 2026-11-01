#!/usr/bin/env python3
"""Probe official candidate-list document availability and fingerprints, never guess ballot changes."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "politics-ballot-source-health.json"
SOURCE = ROOT / "politics-official-ballots.json"
LIMIT = 9_000_000

def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}

def read(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Political-Life-and-Times/1.0 (government-source-list-only)",
        "Accept": "application/pdf, text/csv, text/html, */*",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        blob = response.read(LIMIT + 1)
        if not blob or len(blob) > LIMIT:
            raise ValueError("Empty or oversized official source response")
        return {
            "http_status": response.status,
            "content_type": (response.headers.get("Content-Type", "").split(";")[0]).lower(),
            "content_bytes": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest(),
        }

def collect(ledger, previous=None, fetch=read, now=None):
    try:
        from scripts.politics_ballot_audit import validate
    except ImportError:
        from politics_ballot_audit import validate
    validate(ledger)  # never probe unapproved URLs
    old = {x["id"]: x for x in (previous or {}).get("sources", [])}
    now = now or dt.datetime.now(dt.timezone.utc)
    items = []
    for source in ledger["sources"]:
        sid = source["id"]
        prev = old.get(sid, {})
        entry = {
            "id": sid, "state": source["state"], "url": source["url"],
            "checked_at": now.isoformat(timespec="seconds"),
            "source_transcription_reviewed_at": ledger["reviewed_at"],
            "candidate_rows_automatically_updated": False
        }
        try:
            got = fetch(source["url"])
            if got.get("http_status") != 200 or len(got.get("sha256", "")) != 64:
                raise ValueError("Official site did not return validated content")
            entry.update(got)
            changed = bool(prev.get("last_good_sha256") and prev["last_good_sha256"] != got["sha256"])
            entry.update(status="source_accessible", changed_since_previous_probe=changed,
                         requires_candidate_review=changed,
                         last_good_sha256=got["sha256"])
        except Exception as exc:
            entry.update(status="source_unavailable", error=str(exc)[:180],
                         changed_since_previous_probe=None,
                         requires_candidate_review=True,
                         last_good_sha256=prev.get("last_good_sha256"))
        items.append(entry)
    return {
        "status": "partially_accessible" if any(x["status"] != "source_accessible" for x in items) else "sources_accessible",
        "checked_at": now.isoformat(timespec="seconds"),
        "sources": items,
        "sources_accessible": sum(x["status"] == "source_accessible" for x in items),
        "sources_unavailable": sum(x["status"] != "source_accessible" for x in items),
        "sources_changed_since_last_probe": sum(x.get("changed_since_previous_probe") is True for x in items),
        "forecast_eligible": False,
        "warning": "Changes in official source pages are flagged for candidate-level review. A changed hash, PDF, CSV or HTML page does NOT automatically modify reviewed ballot candidates; failures do not replace verified candidates with guesses."
    }

def main():
    result = collect(load_json(SOURCE), load_json(OUTPUT))
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("Official source monitoring:", result["sources_accessible"], "accessible,", result["sources_unavailable"], "unavailable,", result["sources_changed_since_last_probe"], "changed")
if __name__ == "__main__":
    main()
