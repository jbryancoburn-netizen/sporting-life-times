#!/usr/bin/env python3
"""Render all men's team identities at mobile and desktop sizes from the published assets.

Runs against a local HTTP server in Actions: no paid APIs, no live-site mutation.
This checks layout parity, not the truth of underlying scores or historic records.
"""
import argparse, asyncio, json, math, re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data/ncaam-2026-27-espn-team-crosswalk.json"
SIZES={"mobile":(390,844),"desktop":(1366,900)}
URL="http://127.0.0.1:8765/ncaam-team.html?team="
SELECTOR="#full-season-schedule .mbb-schedule-table tbody tr[data-calendar-state]"
JS="""() => {
 const q=s=>document.querySelector(s);
 const viewport=document.documentElement.clientWidth;
 const schedule=q('#full-season-schedule');
 const hero=q('#app .team-hero h1');
 const root=q('#app');
 const logo=q('#app .team-hero .mbb-mark');
 const table=q('#team-player-production-table .slt-sortable-production');
 const roster=q('#mbb-roster-live');
 const menu=q('.cbb-mobile-nav-toggle');
 const mobile=innerWidth<=700;
 const overflow=document.documentElement.scrollWidth-viewport;
 const children=[...document.querySelectorAll('#full-season-schedule .sched-matchup-cell')];
 const badHeading=children.filter(cell=>{
  const h=cell.querySelector('.victorian-opponent-heading');
  const link=h?.querySelector('.victorian-heading-school');
  const league=h?.querySelector('.victorian-heading-conference');
  if(!h||!link||!league)return false;
  const a=link.getBoundingClientRect(),b=league.getBoundingClientRect();
  return !!league.textContent.trim()&&(
    Math.abs(a.top-b.top)>8 || a.right>b.left+1
  );
 }).length;
 return {
  pageTitle: document.title,
  hero: hero?.textContent.trim()||'',
  schedule:!!schedule,
  calendarClass:schedule?.classList.contains('victorian-team-calendar')||false,
  gameRows:document.querySelectorAll('#full-season-schedule tbody tr[data-calendar-state]').length,
  teamLogo:!!logo,
  logoWidth:logo?.getBoundingClientRect().width||0,
  roster:!!roster,
  rosterPlayers:roster?.querySelectorAll('tbody tr').length||0,
  playerProduction:!!table,
  playerProductionWidth:table?.getBoundingClientRect().width||0,
  menu: mobile?!!menu:false,
  bodyOverflowPx:Math.max(0,overflow),
  scheduleOverflowPx:schedule?Math.max(0,schedule.getBoundingClientRect().right-viewport):0,
  rankConferenceAlignmentIssues:badHeading
 };
}"""
async def audit(browser, gate, team, size_name, photo):
 async with gate:
  viewport=SIZES[size_name]
  page=await browser.new_page(viewport={"width":viewport[0],"height":viewport[1]},device_scale_factor=1)
  tid=team["id"]
  url=URL+__import__('urllib.parse',fromlist=['quote']).quote(tid,safe='')
  def block(route):return route.abort()
  await page.route("https://**/*",block)
  error=None; info={}
  try:
   await page.goto(url,wait_until="domcontentloaded",timeout=20000)
   await page.locator(SELECTOR).first.wait_for(state="attached",timeout=17000)
   await page.locator("#app .team-hero h1").first.wait_for(state="visible",timeout=14000)
   await page.wait_for_timeout(150)
   info=await page.evaluate(JS)
   issues=[]
   if not info["calendarClass"] or not info["schedule"] or not info["gameRows"]:
    issues.append("missing canonical Victorian schedule")
   if not info["hero"]:issues.append("team heading not rendered")
   if not info["teamLogo"] or info["logoWidth"]<24:issues.append("missing/undersized team crest")
   if size_name=="mobile" and (info["bodyOverflowPx"]>3 or info["scheduleOverflowPx"]>3):
    issues.append("horizontal viewport overflow")
   if size_name=="mobile" and not info["menu"]:issues.append("mobile sections menu absent")
   if info["rankConferenceAlignmentIssues"]:issues.append("rank/team/league overlap or vertical misalignment")
   if not info["roster"]:issues.append("current roster panel not present")
   if issues:error="; ".join(issues)
  except Exception as e:
   error=type(e).__name__+": "+str(e).split("\n")[0][:180]
  if error and photo:
   try:
    dest=ROOT/"artifacts/mbb-365-screenshots";dest.mkdir(parents=True,exist_ok=True)
    fn=re.sub("[^A-Za-z0-9_-]","_",team["name"])+"-"+size_name+".png"
    await page.screenshot(path=str(dest/fn),full_page=False,timeout=5000)
   except Exception:pass
  await page.close()
  return {"school":team["name"],"id":tid,"viewport":size_name,**info,"error":error}
async def main(args):
 cross=json.loads(DATA.read_text())["teams"]
 assert len(cross)==365 and len({t["id"] for t in cross})==365
 gate=asyncio.Semaphore(args.concurrency)
 results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=["--disable-dev-shm-usage","--no-sandbox"])
  # Both viewports for all teams: the unique shared template is tested on every identity.
  tasks=[asyncio.create_task(audit(browser,gate,team,size,photo=i<args.max_screenshots))
         for i,team in enumerate(cross) for size in SIZES]
  for fut in asyncio.as_completed(tasks):
   entry=await fut;results.append(entry)
   if len(results)%100==0:print("Rendered",len(results),"of",len(tasks),"team/viewport pages",flush=True)
  await browser.close()
 summary={"audited_at":datetime.now(timezone.utc).isoformat(),"total_teams":len(cross),
  "expected_page_checks":len(cross)*len(SIZES),"checks_completed":len(results),
  "failures":sum(bool(x["error"]) for x in results),
  "failure_by_type":dict(Counter(x["error"] for x in results if x["error"])),
  "details":[x for x in results if x["error"]]}
 output=ROOT/"artifacts/mbb-365-layout-audit.json";output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n")
 print(json.dumps({k:v for k,v in summary.items() if k!="details"},indent=2))
 return 1 if summary["failures"] else 0
if __name__=="__main__":
 parser=argparse.ArgumentParser()
 parser.add_argument("--concurrency",type=int,default=6)
 parser.add_argument("--max-screenshots",type=int,default=12)
 raise SystemExit(asyncio.run(main(parser.parse_args())))
