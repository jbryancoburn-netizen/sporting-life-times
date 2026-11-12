#!/usr/bin/env python3
"""Independent browser evidence for CBB reader-facing artwork and layouts.

Does NOT claim that the 365+674 logo identities have been visually certified.
Screenshots and itemized errors remain attached to each GitHub Actions run.
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright

BASE = os.environ.get(
    "SLT_PUBLIC_SITE", "https://jbryancoburn-netizen.github.io/sporting-life-times/"
).rstrip("/") + "/"
OUT = Path(os.environ.get("CBB_VISUAL_DIR", "artifacts/cbb-visual"))
OUT.mkdir(parents=True, exist_ok=True)

SAMPLES = [
    ("men-indiana", "ncaam-team.html?team=ncaa%3A609574", "#full-season-schedule tbody tr"),
    ("men-sample-609554", "ncaam-team.html?team=ncaa%3A609554", "#full-season-schedule tbody tr"),
    ("men-sample-609758", "ncaam-team.html?team=ncaa%3A609758", "#full-season-schedule tbody tr"),
    ("women-indiana", "ncaaw-team.html?team=84", ".wbb-schedule-table tbody tr"),
    ("women-notre-dame", "ncaaw-team.html?team=87", ".wbb-schedule-table tbody tr"),
    ("women-villanova", "ncaaw-team.html?team=222", ".wbb-schedule-table tbody tr"),
]
VIEWPORTS = [("mobile", 390, 844), ("desktop", 1366, 900)]

PROBE = r"""() => {
  const images = [...document.images];
  const logos = [...document.querySelectorAll('.mbb-mark')];
  const broken = images.filter(i => i.complete && !i.naturalWidth).map(i=>({
    src: i.currentSrc || i.src || '', 
    label: i.closest('.mbb-mark')?.getAttribute('aria-label') || i.alt || '',
    context: i.closest('.mbb-mark') ? 'shared-school-crest' : 'other-image'
  }));
  const pending = images.filter(i => !i.complete).map(i => i.currentSrc || i.src || '');
  const outOfBounds = [];
  const badRings = [];
  const lowResolution = [];
  for (const mark of logos) {
    const box = mark.getBoundingClientRect();
    const style = getComputedStyle(mark);
    const inner = getComputedStyle(mark, '::before');
    const img = mark.querySelector('img.mbb-mark__img');
    const name = mark.getAttribute('aria-label') || mark.getAttribute('data-espn-id') || '';
    if (mark.dataset.ringCount !== '2' || parseFloat(style.borderTopWidth) <= 0 ||
        parseFloat(inner.borderTopWidth) <= 0 || Math.abs(box.width-box.height)>2)
      badRings.push(name);
    if (img) {
      const r = img.getBoundingClientRect();
      if (r.left < box.left-2 || r.right > box.right+2 ||
          r.top < box.top-2 || r.bottom > box.bottom+2 ||
          getComputedStyle(img).objectFit !== 'contain')
        outOfBounds.push(name);
      if (img.naturalWidth && r.width>0 && img.naturalWidth < r.width*devicePixelRatio)
        lowResolution.push({name, sourceWidth:img.naturalWidth, renderedWidth:Math.round(r.width),
          dpr:devicePixelRatio});
    }
  }
  return {
    images: images.length,
    logoFrames: logos.length,
    broken, pending, badRings, outOfBounds, lowResolution,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth+2,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    title: document.title,
  };
}"""

def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for name, path, selector in SAMPLES:
            for device, width, height in VIEWPORTS:
                page = browser.new_page(
                    viewport={"width": width, "height": height}, device_scale_factor=1
                )
                entry = {"page": name, "device": device, "url": BASE + path}
                try:
                    page.goto(entry["url"], wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_selector(selector, timeout=18000)
                    # Scroll once to activate lazily loaded schedule artwork.
                    page.evaluate("""async () => {
                      const step = Math.max(350, innerHeight-80);
                      for(let y=0; y<document.body.scrollHeight; y+=step) {
                        scrollTo(0,y);
                        await new Promise(done => setTimeout(done, 35));
                      }
                      scrollTo(0,0);
                      [...document.images].forEach(i => i.loading='eager');
                      await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));
                    }""")
                    entry.update(page.evaluate(PROBE))
                    entry["schedule_rows"] = page.locator(selector).count()
                    entry["screenshot"] = name + "-" + device + ".png"
                    page.screenshot(path=str(OUT / entry["screenshot"]), full_page=True)
                    entry["problems"] = []
                    if entry["schedule_rows"] < 5:
                        entry["problems"].append("Insufficient visible schedule rows")
                    if entry["logoFrames"] < 1:
                        entry["problems"].append("Shared college crest not rendered")
                    for key in ("broken", "pending", "badRings", "outOfBounds"):
                        if entry[key]:
                            entry["problems"].append(key + ": " + str(len(entry[key])))
                    if entry["horizontalOverflow"]:
                        entry["problems"].append("Horizontal overflow")
                    if entry["lowResolution"]:
                        entry["problems"].append(
                            "Raster lower than rendered pixel budget: " +
                            str(len(entry["lowResolution"]))
                        )
                except Exception as exc:
                    entry["problems"] = [type(exc).__name__ + ": " + str(exc)[:350]]
                    try:
                        entry["screenshot"] = name + "-" + device + "-error.png"
                        page.screenshot(path=str(OUT / entry["screenshot"]), full_page=True)
                    except Exception:
                        pass
                finally:
                    page.close()
                print(
                    name, device, "PASS" if not entry["problems"] else "FAIL",
                    json.dumps(entry["problems"]), flush=True
                )
                results.append(entry)
        browser.close()
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "site": BASE,
        "method": "Real Chromium, full-page screenshots, real rendered crest and image checks",
        "scope": "Representative 3 men's + 3 women's teams at desktop/mobile; NOT full 365/674 certification",
        "samples": len(results),
        "failures": sum(bool(x["problems"]) for x in results),
        "results": results,
    }
    (OUT / "report.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(json.dumps({
        "samples": summary["samples"], "failed": summary["failures"],
        "report": str(OUT / "report.json")
    }))
    return 1 if summary["failures"] else 0

if __name__ == "__main__":
    sys.exit(main())
