#!/usr/bin/env python3
"""Local browser preview and screenshot audit for the Heritage Sporting Press.

Runs only against a local checkout/server. Does not rewrite public newspaper data.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("SLT_PREVIEW_BASE", "http://127.0.0.1:8765").rstrip("/")
OUT = Path("artifacts/cbb-heritage-preview")
OUT.mkdir(parents=True, exist_ok=True)

CASES = (
    ("men-team", "ncaam-team.html?team=84", ".team-hero"),
    ("women-team", "ncaaw-team.html?team=84", ".wbb-identity"),
    ("men-ledger", "ncaam-slate.html?date=2026-11-11&gender=men", ".ledger26-scorebug"),
    ("women-ledger", "ncaam-slate.html?date=2026-11-11&gender=women", ".ledger26-scorebug"),
)
WIDTHS = (1366, 1024, 768, 390, 320)
results = []
failures = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, path, selector in CASES:
        for width in WIDTHS:
            label = f"{name}-{width}"
            page = browser.new_page(viewport={"width": width, "height": 860}, device_scale_factor=1)
            entry = {"case": name, "viewport_width": width, "url": path, "errors": []}
            try:
                response = page.goto(f"{BASE}/{path}", wait_until="domcontentloaded", timeout=45000)
                if response is None or response.status >= 400:
                    raise RuntimeError(f"Local page HTTP {response.status if response else 'no response'}")
                page.wait_for_selector(selector, state="visible", timeout=45000)
                # Give asynchronous crest images and dynamic page furniture a chance to settle.
                page.wait_for_timeout(1300)
                evidence = page.evaluate("""() => {
                  const root = document.documentElement;
                  const sheet = [...document.styleSheets].some(s => (s.href || '').includes('slt-cbb-heritage.css'));
                  const press = getComputedStyle(document.body);
                  const first = document.querySelector('.ledger26-scorebug');
                  const logo = document.querySelector('.team-hero .mbb-mark, .wbb-identity .mbb-mark');
                  const stage = document.querySelector('.team-hero, .wbb-identity, .ledger26-scorebug');
                  return {
                    scoped: document.body.classList.contains('slt-cbb-heritage'),
                    sheetLoaded: sheet,
                    paper: press.getPropertyValue('--press-paper').trim(),
                    scrollWidth: root.scrollWidth,
                    viewportWidth: window.innerWidth,
                    foundMain: !!stage,
                    scorebugCrestSize: first ? getComputedStyle(first).getPropertyValue('--ledger26-crest-size').trim() : null,
                    teamCrestWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
                    teamCrestHeight: logo ? Math.round(logo.getBoundingClientRect().height) : null
                  };
                }""")
                entry.update(evidence)
                if not evidence["scoped"] or not evidence["sheetLoaded"]:
                    entry["errors"].append("Shared design opt-in or stylesheet missing")
                if evidence["paper"].lower() != "#f2e8d6":
                    entry["errors"].append("Unexpected paper token")
                if evidence["scrollWidth"] > evidence["viewportWidth"] + 2:
                    entry["errors"].append("Unexpected horizontal page overflow")
                if "ledger" in name:
                    expected = "40px" if width <= 390 else "56px"
                    if evidence["scorebugCrestSize"] != expected:
                        entry["errors"].append(f"Ledger crest token differs from {expected}")
                    if page.locator(".ledger26-scorebug").first.locator(".ledger26-team").count() < 2:
                        entry["errors"].append("Expected away/home pair not present")
                else:
                    if evidence["teamCrestWidth"] is None or evidence["teamCrestHeight"] is None:
                        entry["errors"].append("Official crest wrapper missing")
                    if not page.locator(".cbb-team-form").count():
                        entry["errors"].append("The Form Book not mounted")
                page.screenshot(path=str(OUT / f"{label}.png"), full_page=True, animations="disabled")
            except Exception as exc:
                entry["errors"].append(str(exc)[:500])
                try:
                    page.screenshot(path=str(OUT / f"{label}-error.png"), full_page=True)
                except Exception:
                    pass
            finally:
                results.append(entry)
                if entry["errors"]:
                    failures.append(label)
                print(json.dumps(entry, ensure_ascii=False))
                page.close()
    browser.close()

(OUT / "report.json").write_text(
    json.dumps({"cases": len(results), "failures": failures, "results": results}, indent=2),
    encoding="utf-8",
)
if failures:
    raise SystemExit(f"Heritage browser preview FAIL: {len(failures)}/{len(results)} cases: {', '.join(failures)}")
print(f"Heritage browser preview PASS: {len(results)} page/viewport cases")
