/* NBA crest geometry: detect actual rendered text/crest intersections.
 * Runs against the real static newspaper in Chrome, across desktop/tablet/mobile.
 * Default mode records findings, STRICT_LAYOUT=1 fails on significant collisions.
 */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
const PAGES=[
 ['nba.html','front'],
 ['nba-game-center.html','ledger'],
 ['nba-team-desk.html?team=CHI','team'],
 ['nba-standings.html','standings'],
 ['nba-conference.html','conference'],
 ['nba-rankings.html','rankings'],
 ['nba-playoffs.html','playoffs'],
 ['nba-matchups.html','matchups'],
 ['nba-players.html','players'],
 ['nba-cup.html','cup'],
 ['nba-predictions.html','predictions'],
 ['nba-live-game.html','game']
];
const WIDTHS=[375,430,768,1280];
const host=spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],{stdio:'ignore'});
let browser; const results=[];
try{
 let ready=false;
 for(let i=0;i<35;i++){try{ready=(await fetch('http://127.0.0.1:8767/nba.html')).ok;if(ready)break;}catch{}await delay(300)}
 if(!ready)throw Error('Failed to start local preview');
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROME_CHANNEL||undefined});
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
 for(const width of WIDTHS){
  await page.setViewportSize({width,height:900});
  for(const [file,label] of PAGES){
   try{
    await page.goto('http://127.0.0.1:8767/'+file,{waitUntil:'domcontentloaded',timeout:23000});
    await page.waitForTimeout(2050);
    const detail=await page.evaluate(()=>{
     const selector='.nba-live-team img,.score-team img,.nba-team-tile img,.nba-standings-identity img,.nba-div-team img,.nba-race-team img,.nba-brand-link img,.nba-team-identity img,.depth-series-item img,.nba-retro-board-row img,.slt-scorebug-team img,.nba-team-logo.slt-dual-image,.nba-power-logo.slt-dual-image,.nba-game-row-crest.slt-dual-image,.nba-series-crest.slt-dual-image';
     const groupSelector='.nba-live-team,.score-team,.nba-team-tile,.nba-standings-identity,.nba-div-team,.nba-race-team,.nba-brand-link,.nba-team-identity,.depth-series-item,.slt-scorebug-team,.nba-retro-board-row,.nba-register-row,.nba-player-team';
     const actual=[...document.querySelectorAll(selector)].filter(x=>x.getBoundingClientRect().width>8&&x.getBoundingClientRect().height>8);
     const conflicts=[],overflow=[];
     const intersect=(a,b)=>({w:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),h:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))});
     const label=el=>el?.className?.baseVal||el?.className||el?.tagName||'';
     for(const img of actual){
      const group=img.closest(groupSelector)||img.parentElement;
      if(!group)continue;
      const root=img.closest('.slt-dual-shell')||img;
      const r=root.getBoundingClientRect();
      if(r.width<5||r.height<5)continue;
      const walker=document.createTreeWalker(group,NodeFilter.SHOW_TEXT);
      let txt;
      while((txt=walker.nextNode())){
       if(!(txt.textContent||'').trim())continue;
       const el=txt.parentElement;if(!el||el.closest('script,style,noscript,[aria-hidden="true"]'))continue;
       const cs=getComputedStyle(el);
       if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)continue;
       const range=document.createRange();range.selectNodeContents(txt);
       for(const t of range.getClientRects()){
        const v=intersect(r,t);if(v.w>=5&&v.h>=4&&v.w*v.h>=24){
         conflicts.push({group:String(label(group)).slice(0,65),img:img.src.split('/').at(-1),text:(txt.textContent||'').trim().slice(0,52),overlap:[Math.round(v.w),Math.round(v.h)],logo:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],textRect:[Math.round(t.x),Math.round(t.y),Math.round(t.width),Math.round(t.height)]});break;
        }
       }
       if(conflicts.length>=50)break;
      }
      if(conflicts.length>=50)break;
     }
     for(const el of document.querySelectorAll('.nba-standings-identity,.nba-brand-link,.nba-live-team,.score-team,.nba-race-team,.nba-team-tile,.nba-div-team,.nba-team-identity')){
      const r=el.getBoundingClientRect();if(r.width>20&&r.height>15&&el.scrollWidth>el.clientWidth+10){
        overflow.push({group:String(label(el)).slice(0,60),width:r.width,excess:el.scrollWidth-el.clientWidth,text:(el.textContent||'').trim().slice(0,70)});
      }
     }
     return {logos:actual.length,conflicts:conflicts.slice(0,18),conflictCount:conflicts.length,overflow:overflow.slice(0,12),overflowCount:overflow.length,
      bodyOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),page:document.body.dataset.page||''};
    });
    results.push({width,label,...detail});
    console.log(JSON.stringify({width,label,logos:detail.logos,conflicts:detail.conflictCount,overflow:detail.overflowCount,bodyOverflow:detail.bodyOverflow,examples:detail.conflicts.slice(0,3),overs:detail.overflow.slice(0,2)}));
    if(detail.conflictCount||detail.bodyOverflow>12){mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:`test-artifacts/nba-crest-${label}-${width}.png`,fullPage:false});}
   }catch(e){results.push({width,label,error:String(e)});console.log('AUDIT_ERROR',width,label,String(e));}
  }
 }
 mkdirSync('test-artifacts',{recursive:true});
 writeFileSync('test-artifacts/nba-crest-collision-audit.json',JSON.stringify(results,null,2));
 const problems=results.filter(x=>x.error||(x.conflictCount>0&&x.logos>=1)||x.bodyOverflow>16);
 console.log('AUDIT_TOTAL',JSON.stringify({screens:results.length,withLogos:results.filter(x=>x.logos>0).length,problemScreens:problems.length,problemExamples:problems.map(x=>({page:x.label,width:x.width,collisions:x.conflictCount,overflow:x.bodyOverflow,logos:x.logos})).slice(0,35)}));
 if(process.env.STRICT_LAYOUT==='1'&&problems.length)process.exitCode=1;
}finally{await browser?.close();host.kill('SIGTERM');}
