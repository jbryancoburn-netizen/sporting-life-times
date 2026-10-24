"""Verify GitHub Pages actually serves the latest NCAA college soccer Elo edition.

This checks exact bytes of the published JSON AND browser JS, rather than
assuming a GitHub commit implies successful public deployment.
"""
import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "data/college-soccer-elo.json",
    "college-soccer-elo.js",
    "college-soccer.html",
    "college-soccer-elo.css",
]
DEFAULT_ROOT = "https://jbryancoburn-netizen.github.io/sporting-life-times"


def fingerprint(value: bytes):
    return hashlib.sha256(value).hexdigest()


def inspect(source_root: str, reader=None):
    if reader is None:
        def reader(url):
            req = urllib.request.Request(url, headers={
                "User-Agent": "SportingLifeTimes-CollegeSoccer-ReleaseCheck/1.0",
                "Cache-Control": "no-cache",
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read()
    outcomes = {}
    for file in FILES:
        expected = (ROOT / file).read_bytes()
        actual = reader(source_root.rstrip("/") + "/" + file + "?nocache=" + str(int(time.time())))
        if fingerprint(expected) != fingerprint(actual):
            raise AssertionError("Published page is not serving current source file: " + file)
        outcomes[file] = len(expected)
    report = json.loads((ROOT / FILES[0]).read_text())
    assert report["status"] == "provisional"
    assert len(report["cohorts"]) == 6
    assert "college-soccer-elo.js" in (ROOT / "college-soccer.html").read_text()
    assert 'id="college-soccer-elo"' in (ROOT / "college-soccer.html").read_text()
    return {"result": "PASS", "as_of": report["as_of"],
            "finals_since_baseline": report.get("applied_finals_since_baseline", 0),
            "files_verified": outcomes}


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--url", default=DEFAULT_ROOT)
    cli.add_argument("--attempts", type=int, default=15)
    cli.add_argument("--delay", type=int, default=10)
    args = cli.parse_args()
    for attempt in range(1, args.attempts + 1):
        try:
            print(json.dumps(inspect(args.url), sort_keys=True))
            return
        except (AssertionError, urllib.error.URLError, TimeoutError) as error:
            print(f"public Pages not current, attempt {attempt}/{args.attempts}: {error}", flush=True)
            if attempt == args.attempts:
                raise SystemExit("FAIL: newspaper public dataset not current")
            time.sleep(args.delay)


if __name__ == "__main__":
    main()
