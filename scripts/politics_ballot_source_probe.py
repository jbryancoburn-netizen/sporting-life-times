#!/usr/bin/env python3
"""Probe official candidate-list document availability and fingerprints, never guess ballot changes."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "politics-ballot-source-health.json"
SOURCE = ROOT / "politics-official-ballots.json"
LIMIT = 9_000_000
CALIFORNIA_CERTIFIED_PDF = "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf"
CALIFORNIA_PDF_LIMIT = 18_000_000

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
        allowed_bytes = CALIFORNIA_PDF_LIMIT if url == CALIFORNIA_CERTIFIED_PDF else LIMIT
        blob = response.read(allowed_bytes + 1)
        if not blob or len(blob) > allowed_bytes:
            raise ValueError("Empty or oversized official source response")
        if url == CALIFORNIA_CERTIFIED_PDF and not blob.startswith(b"%PDF"):
            raise ValueError("California certified-list source did not return a PDF")
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
        # A reviewed, pinned document has precedence over last week's successful
        # fetch. Otherwise retain the FIRST observed baseline permanently until
        # the candidate source is explicitly reviewed and fingerprinted.
        pinned = source.get("source_sha256") or source.get("source_pdf_sha256")
        if pinned is not None and (not isinstance(pinned,str) or re.fullmatch(r"[0-9a-f]{64}",pinned) is None):
            raise ValueError("Invalid state-government source-review fingerprint: "+sid)
        baseline = pinned or prev.get("review_baseline_sha256") or prev.get("last_good_sha256")
        if baseline and (not isinstance(baseline,str) or re.fullmatch(r"[0-9a-f]{64}",baseline) is None):
            raise ValueError("Invalid prior source review baseline: "+sid)
        entry = {
            "id": sid, "state": source["state"], "url": source["url"],
            "checked_at": now.isoformat(timespec="seconds"),
            "source_transcription_reviewed_at": source.get("reviewed_at") or ledger["reviewed_at"],
            "candidate_rows_automatically_updated": False
        }
        try:
            got = fetch(source["url"])
            digest = got.get("sha256")
            if got.get("http_status") != 200 or not isinstance(digest,str) or re.fullmatch(r"[0-9a-f]{64}",digest) is None:
                raise ValueError("Official site did not return validated source content")
            if sid == "CA_SOS_2026_GENERAL" and got.get("content_type") not in ("application/pdf","application/octet-stream"):
                raise ValueError("California official certified candidate source returned non-PDF content")
            entry.update(got)
            baseline = baseline or digest
            changed = bool(prev.get("last_good_sha256") and prev["last_good_sha256"] != digest)
            drift = digest != baseline
            entry.update(
                status="source_accessible",
                changed_since_previous_probe=changed,
                source_content_mismatch_against_review_baseline=drift,
                requires_candidate_review=drift,
                review_baseline_sha256=baseline,
                baseline_provenance="official_state_source_pinned_at_candidate_review" if pinned else (
                    "previous_monitor_observation" if prev.get("review_baseline_sha256") or prev.get("last_good_sha256")
                    else "first_monitor_observation_not_certified_candidate_snapshot"),
                last_good_sha256=digest,
            )
        except Exception as exc:
            entry.update(status="source_unavailable", error=str(exc)[:180],
                         changed_since_previous_probe=None,
                         source_content_mismatch_against_review_baseline=None,
                         requires_candidate_review=True,
                         review_baseline_sha256=baseline,
                         baseline_provenance="official_state_source_pinned_at_candidate_review" if pinned else "previous_monitor_observation",
                         last_good_sha256=prev.get("last_good_sha256"))
        items.append(entry)
    return {
        "status": "partially_accessible" if any(x["status"] != "source_accessible" for x in items) else "sources_accessible",
        "checked_at": now.isoformat(timespec="seconds"),
        "sources": items,
        "sources_accessible": sum(x["status"] == "source_accessible" for x in items),
        "sources_unavailable": sum(x["status"] != "source_accessible" for x in items),
        "sources_requiring_candidate_review": sum(x.get("requires_candidate_review") is True for x in items),
        "sources_out_of_sync_with_reviewed_snapshot": sum(x.get("source_content_mismatch_against_review_baseline") is True for x in items),
        "sources_changed_since_last_probe": sum(x.get("changed_since_previous_probe") is True for x in items),
        "forecast_eligible": False,
        "warning": "A government source that changes after its reviewed fingerprint stays flagged on every run until explicitly reviewed; comparing only with the previous run is not sufficient. Where no source fingerprint was certified, an initial monitor hash is operational only, NOT proof it matches the original ballot transcription. Candidate rows are never changed automatically and source failures never cause guessing."
    }

def main():
    result = collect(load_json(SOURCE), load_json(OUTPUT))
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("Official source monitoring:", result["sources_accessible"], "accessible,", result["sources_unavailable"], "unavailable,", result["sources_changed_since_last_probe"], "changed")
if __name__ == "__main__":
    main()
