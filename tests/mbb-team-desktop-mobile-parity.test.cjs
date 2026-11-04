/* Regression smoke test for the shared 365-school men’s team desk.
   Run when Playwright/Chromium are available: node tests/mbb-team-desktop-mobile-parity.test.cjs
   This is a representative visual-layout check; the full 365-school data check is separate. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const schools=[
 ['Indiana','ncaa:609574'],['Duke','ncaa:609720'],['Kentucky','ncaa:609584'],
 ['Gonzaga','ncaa:609744'],['Harvard','ncaa:609746'],['Cal Poly','ncaa:609644'],
 ['Vermont','ncaa:609564'],['Hawaii','ncaa:609747'],
 ['Tennessee Tech','ncaa:609485'],['Longwood','ncaa:609538']
];
(async()=>{
 const server=spawn('python',['-m','http.server','8769','--directory',path.resolve(__dirname,'..')],{stdio:'ignore'});
 let browser;
 try{
  await new Promise(r=>setTimeout(r,700));
  browser=await chromium.launch({headless:true,executablePath:process.env.MBB_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote']});
  const page=await browser.newPage();
  await page.route('https://**/*',r=>r.abort()); // Only repository-published files are required for the page contract.
  for(const [viewport,width] of [['desktop',1440],['mobile',390]]){
   await page.setViewportSize({width,height:850});
   for(const [name,id] of schools){
    const u='http://127.0.0.1:8769/ncaam-team.html?team='+encodeURIComponent(id);
    const response=await page.goto(u,{waitUntil:'domcontentloaded'});
    assert(response?.ok(),name+' page missing');
    await page.locator('#app .team-hero h1').waitFor({timeout:18000});
    await page.locator('#full-season-schedule.victorian-team-calendar .mbb-schedule-table tbody tr[data-game-site]').first().waitFor({timeout:18000});
    const info=await page.evaluate(()=>{
     const heading=document.querySelector('#app .team-hero h1');
     const scheduled=document.querySelector('#full-season-schedule');
     const rows=[...scheduled.querySelectorAll('tr[data-game-site]')];
     const marks=document.querySelectorAll('#app .team-hero .mbb-mark').length;
     const conf=scheduled.querySelector('.victorian-conference-game');
     const team=conf?.closest('.victorian-opponent-heading')?.querySelector('.victorian-heading-school');
     const aligned=conf&&team?Math.abs(conf.getBoundingClientRect().top-team.getBoundingClientRect().top)<6:null;
     return {title:heading?.textContent||'',schedule:scheduled.querySelector('h2')?.textContent||'',
       rows:rows.length,teamLogo:marks,overflow:document.documentElement.scrollWidth>innerWidth+2,
       roster:!!document.querySelector('#app .roster-table-wrap'),
       stats:!!document.querySelector('#team-player-production'),
       history:!!document.querySelector('#opponent'),
       mobileMenu:!!document.querySelector('.cbb-mobile-nav-toggle'),
       aligned,hasLink:rows.some(r=>!!r.querySelector('.victorian-heading-school a'))};
    });
    assert(info.title.toLowerCase().includes(name.toLowerCase()),viewport+' wrong school on '+name+': '+info.title);
    assert.equal(info.schedule,'2026–2027 Schedule',viewport+' schedule heading '+name);
    assert(info.rows>=1,viewport+' no games for '+name);
    assert(info.teamLogo>=1,viewport+' missing main double-ring emblem for '+name);
    assert(info.stats,viewport+' missing player production '+name);
    assert(info.history,viewport+' missing head-to-head section '+name);
    assert(info.mobileMenu,viewport+' missing shared mobile menu element '+name);
    assert.equal(info.overflow,false,viewport+' page overflows viewport: '+name);
    if(info.aligned!==null)assert(info.aligned,viewport+' ranking/team/conference not on one line: '+name);
    if(name==='Indiana')assert(info.hasLink,viewport+' school links missing from Indiana schedule');
   }
  }
  console.log('PASS: 10 schools in 8+ conferences, desktop/mobile template parity, logos, calendar, stats and navigation.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
