import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync, statSync } from 'node:fs';

const manifest=JSON.parse(readFileSync('data/nba-vintage-logos.json','utf8'));
assert.equal(Object.keys(manifest.teams).length,30,'Must carry exactly thirty historic franchise marks');
for (const [code,team] of Object.entries(manifest.teams)){
 assert.equal(team.logo_url,'assets/nba-vintage-logos/'+code+'.png','No external historic image path');
 assert.equal(team.fallback_url,'assets/nba-logos/'+code+'.png','No external fallback image path');
 assert(statSync(team.logo_url).size>10000,'Logo asset too small: '+code);
}
const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 let available=false;
 for(let i=0;i<40;i++){
  try{if((await fetch('http://127.0.0.1:8766/nba-heritage-preview.html')).ok){available=true;break;}}catch{}
  await delay(300);
 }
 if(!available)throw Error('NBA test server unavailable');
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROME_CHANNEL||undefined});
 const page=await browser.newPage({viewport:{width:1220,height:900}});
 const archiveRequests=[];page.on('request',req=>{if(/(?:i|assets)\.logocdn\.com/i.test(req.url()))archiveRequests.push(req.url())});
 await page.goto('http://127.0.0.1:8766/nba-heritage-preview.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.querySelectorAll('#clubs .card img').forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>{
  const images=[...document.querySelectorAll('#clubs .card img')];
  return images.length===30&&images.every(img=>img.complete&&img.naturalWidth>=100&&!img.dataset.failed);
 },{timeout:30000});
 let evidence=await page.evaluate(()=>{
  const badge=document.querySelector('#clubs .card .crest');
  const image=badge?.querySelector('img');
  return {outer:getComputedStyle(badge).borderTopWidth,inner:getComputedStyle(badge,'::before').borderTopWidth,
   artwork:image?.naturalWidth,amount:document.querySelectorAll('#clubs .card').length,
   noOverflow:document.documentElement.scrollWidth<=innerWidth+3};
 });
 assert.equal(evidence.outer,'5px','Desktop outer ring not enlarged');
 assert.equal(evidence.inner,'5px','Desktop inner ring not enlarged');
 assert(evidence.noOverflow,'Desktop archive overflow');
 await page.setViewportSize({width:390,height:844});
 evidence=await page.evaluate(()=>{
  const badge=document.querySelector('#clubs .card .crest');
  return {outer:getComputedStyle(badge).borderTopWidth,inner:getComputedStyle(badge,'::before').borderTopWidth,
   noOverflow:document.documentElement.scrollWidth<=innerWidth+3};
 });
 assert.equal(evidence.outer,'4px','Mobile outer ring not enlarged');
 assert.equal(evidence.inner,'4px','Mobile inner ring not enlarged');
 assert(evidence.noOverflow,'Mobile archive overflow');
 await page.goto('http://127.0.0.1:8766/nba.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('slt-nba-bold-rings'),{timeout:25000});
 await page.evaluate(()=>{
  const el=document.createElement('img');el.id='heritage-test-logo';
  el.width=72;el.height=72;el.src='assets/nba-logos/CHI.png';el.alt='Bulls';
  document.body.appendChild(el);
 });
 await page.waitForFunction(()=>{
  const el=document.querySelector('#heritage-test-logo');
  return el?.getAttribute('src')==='assets/nba-vintage-logos/CHI.png'&&el.complete&&el.naturalWidth>100;
 },{timeout:20000});
 const live=await page.evaluate(()=>{
  const el=document.querySelector('#heritage-test-logo');
  return {src:el.getAttribute('src'),outer:getComputedStyle(el).boxShadow,inner:getComputedStyle(el).borderTopWidth,
    status:el.dataset.sltVintageStatus};
 });
 assert.equal(live.inner,'4px','NBA page mobile ring must be visibly wider');
 assert(live.outer!=='none','NBA page must have outer ring');
 assert.equal(live.status,'loaded','NBA page must use local authentic mark');
 assert.equal(archiveRequests.length,0,'No third-party logo requests allowed');
 console.log('PASS: 30 cached PNG images, 5px desktop and 4px mobile rings, local NBA runtime, no external logo requests.');
}finally{await browser?.close();server.kill('SIGTERM');}
