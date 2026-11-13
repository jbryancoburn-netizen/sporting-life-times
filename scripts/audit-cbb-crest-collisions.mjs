import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync,readFileSync,statSync} from 'node:fs';

const cache=JSON.parse(readFileSync('data/cbb-local-logos.json','utf8'));
const history=JSON.parse(readFileSync('data/cbb-big-ten-1980s.json','utf8'));
assert.equal(cache.division_i_count,365,'All DI school identity PNG files required');
assert.equal(history.confirmed,10,'All 10 authentic 1980s Big Ten marks required');
for(const [id,row] of Object.entries(cache.teams)){
 assert.equal(row.path,'assets/cbb-school-logos/'+id+'.png');
 assert(statSync(row.path).size>700,'Corrupt local image: '+id);
}
for(const [id,row] of Object.entries(history.teams)){
 assert.equal(row.logo_path,'assets/cbb-big-ten-1980s/'+id+'.png');
 assert(statSync(row.logo_path).size>1400,'Corrupt historical image: '+id);
 assert(cache.teams[id],'Historical mark lacks local modern fall-back: '+id);
}
const paths=[
 ['ncaam-slate.html?date=2026-11-13','men-ledger'],
 ['ncaam-slate.html?date=2026-11-13&gender=women','women-ledger'],
 ['ncaam-team.html?team=ncaa:609574','men-team'],
 ['ncaaw-team.html?team=ncaa:609574','women-team'],
 ['ncaam-rankings.html','men-rankings'],
 ['ncaaw-rankings.html','women-rankings'],
 ['ncaam-conference.html?conference=Big%20Ten','men-conference'],
 ['ncaaw-conference.html?conference=Big%20Ten','women-conference'],
 ['ncaam.html','men-front'],
 ['college-basketball.html','cbb-front']
];
const widths=[375,430,768,1280];
const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;const findings=[];
try{
 let started=false;
 for(let i=0;i<50;i++){try{started=(await fetch('http://127.0.0.1:8768/ncaam.html')).ok;if(started)break;}catch{}await sleep(250);}
 if(!started)throw Error('Local CBB audit server unavailable');
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROME_CHANNEL||undefined});
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
 const externalLogoRequests=[];
 page.on('request',req=>{if(/https:\/\/(?:a\.espncdn\.com\/i\/teamlogos\/ncaa|www\.ncaa\.com\/sites\/default\/files\/images\/logos\/schools|sportslogohistory\.com\/wp-content\/uploads)/i.test(req.url())&&req.resourceType()==='image')externalLogoRequests.push(req.url());});
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  for(const [url,label] of paths){
   try{
    await page.goto('http://127.0.0.1:8768/'+url,{waitUntil:'domcontentloaded',timeout:27000});
    await page.waitForFunction(()=>window.MBBLogos?.ready!==undefined,{timeout:18000}).catch(()=>null);
    if(await page.evaluate(()=>!!window.MBBLogos))await page.evaluate(()=>window.MBBLogos.ready);
    await page.waitForTimeout(1200);
    const data=await page.evaluate(()=>{
      const groupSelector='.ledger26-team,.sched-matchup,.score-team,.team-name,.cbb-elo-school,.cbb-elo-power,.conf-card,.team-hero,.hero-team,.team-row,.school-row,.team-line,tr,.matchup-team,.game-team,.schedule-row,.mbb-row';
      const logos=[...document.querySelectorAll('.mbb-mark')].filter(x=>{const r=x.getBoundingClientRect();return r.width>20&&r.height>20});
      const bad=[],missing=[],unloaded=[],geometry=[];
      function intersect(a,b){return {w:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),h:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))};}
      for(const logo of logos){
        const r=logo.getBoundingClientRect(),img=logo.querySelector('img.mbb-mark__img');
        if(img&&img.complete&&!img.naturalWidth)unloaded.push({id:logo.dataset.espnId||'',source:img.getAttribute('src')});
        if(img&&!(img.getAttribute('src')||'').startsWith('assets/cbb-'))bad.push({kind:'external-runtime-img',src:img.getAttribute('src')});
        if(!img&&!logo.classList.contains('mbb-mark--missing'))bad.push({kind:'invisible-crest',id:logo.dataset.espnId});
        const outer=parseFloat(getComputedStyle(logo).borderTopWidth)||0;
        const inner=parseFloat(getComputedStyle(logo,'::before').borderTopWidth)||0;
        if(outer<2.8||inner<2.8||Math.abs(outer-inner)>.3)geometry.push({id:logo.dataset.espnId,outer,inner});
        const group=logo.closest(groupSelector)||logo.parentElement;
        if(!group)continue;
        const walker=document.createTreeWalker(group,NodeFilter.SHOW_TEXT);
        let txt;
        while((txt=walker.nextNode())){
          if(!txt.textContent?.trim())continue;
          const parent=txt.parentElement;if(!parent||parent.closest('.mbb-mark')||parent.closest('script,style,[aria-hidden="true"]'))continue;
          if(getComputedStyle(parent).display==='none'||getComputedStyle(parent).visibility==='hidden')continue;
          const range=document.createRange();range.selectNodeContents(txt);
          for(const box of range.getClientRects()){
           const hit=intersect(r,box);
           if(hit.w>=4&&hit.h>=4&&hit.w*hit.h>=28){
             bad.push({kind:'logo-text-overlap',id:logo.dataset.espnId,near:group.className,text:txt.textContent.trim().slice(0,45),px:[Math.round(hit.w),Math.round(hit.h)]});break;
           }
          }
          if(bad.length>60)break;
        }
      }
      return {page:document.body.dataset.page||'',logos:logos.length,overlaps:bad.filter(x=>x.kind==='logo-text-overlap').length,otherProblems:bad.filter(x=>x.kind!=='logo-text-overlap').length,unloaded:unloaded.length,ringErrors:geometry.length,examples:bad.slice(0,6),imageExamples:unloaded.slice(0,5),ringExamples:geometry.slice(0,3)};
    });
    findings.push({width,label,...data});
    console.log('AUDIT',JSON.stringify({width,label,logos:data.logos,overlap:data.overlaps,other:data.otherProblems,unloaded:data.unloaded,rings:data.ringErrors,samples:data.examples.slice(0,2)}));
    if((data.overlaps||data.otherProblems||data.ringErrors)&&data.logos){mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/cbb-'+label+'-'+width+'.png',fullPage:false});}
   }catch(e){findings.push({width,label,error:String(e)});console.log('AUDIT_ERROR',width,label,String(e));}
  }
 }
 mkdirSync('test-artifacts',{recursive:true});
 writeFileSync('test-artifacts/cbb-crest-audit.json',JSON.stringify({findings,externalLogoRequests},null,2));
 const bad=findings.filter(x=>x.error||x.overlaps||x.otherProblems||x.ringErrors);
 console.log('AUDIT_TOTAL',JSON.stringify({screens:findings.length,withLogos:findings.filter(x=>x.logos>0).length,problemScreens:bad.length,externalImageRequests:externalLogoRequests.length,examples:bad.slice(0,12).map(x=>({width:x.width,label:x.label,overlaps:x.overlaps,other:x.otherProblems,rings:x.ringErrors,error:x.error}))}));
 if(process.env.STRICT_LAYOUT==='1'&&(bad.length||externalLogoRequests.length))process.exitCode=1;
}finally{await browser?.close();server.kill('SIGTERM');}
