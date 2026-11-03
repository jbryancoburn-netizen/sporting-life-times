/* SLT hub masthead real Chromium/iPhone-width layout regression.
 * Run against local files served as a site. No paid API or external screenshots. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const BASE=process.env.SLT_HUB_BASE||'http://127.0.0.1:8765';
const channel=process.env.PLAYWRIGHT_CHROME_CHANNEL||undefined;
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
fs.mkdirSync('test-artifacts',{recursive:true});
const summary=[];
try{
 for(const file of ['index.html','sports.html']){
  for(const width of [390,1280]){
   const mobile=width<700;
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
   const response=await page.goto(BASE+'/'+file,{waitUntil:'domcontentloaded',timeout:25000});
   assert.equal(response?.status(),200,file+' is not available');
   await page.waitForFunction(()=>document.querySelector('header.masthead .slt-brand-globe svg')!==null,
      {timeout:12000});
   const metrics=await page.evaluate(()=>{
     const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;
      const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),
      width:Math.round(r.width),height:Math.round(r.height)}};
     const link=document.querySelector('header.masthead .slt-brand-link');
     const brand=document.querySelector('header.masthead .slt-brand-title');
     const nav=document.querySelector('nav.site-nav');
     const globe=document.querySelector('header.masthead .slt-brand-globe');
     return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       link:rect('header.masthead .slt-brand-link'),
       masthead:rect('header.masthead'),
       globe:rect('header.masthead .slt-brand-globe'),
       svg:rect('header.masthead .slt-brand-globe svg'),
       title:rect('header.masthead .slt-brand-title'),
       nav:rect('nav.site-nav'),
       titleColor:getComputedStyle(brand).color,
       linkDisplay:getComputedStyle(link).display,
       linkBackground:getComputedStyle(link).backgroundColor,
       navWrap:getComputedStyle(nav).flexWrap,
       globeDisplay:getComputedStyle(globe).display,
       titleText:brand.textContent.trim()};
   });
   assert.equal(metrics.linkDisplay,'flex',file+' '+width+' must use a flex masthead');
   assert.equal(metrics.linkBackground,'rgb(9, 31, 61)',file+' '+width+' navy not applied');
   assert.equal(metrics.titleColor,'rgb(255, 246, 224)',file+' '+width+' lettering unreadable');
   assert(metrics.globe.width<=72&&metrics.globe.width>=25,
     file+' '+width+' globe overflows: '+JSON.stringify(metrics.globe));
   assert(metrics.svg.width<=72&&metrics.svg.height<=72,file+' '+width+' SVG escaped size cap');
   assert(metrics.masthead.height<=150,file+' '+width+' masthead is towering');
   assert(metrics.title.height<=110,file+' '+width+' title overflows');
   assert(metrics.nav.height<=62,file+' '+width+' navigation wraps');
   assert.equal(metrics.navWrap,'nowrap',file+' '+width+' navigation not single-row');
   assert(metrics.link.width<=width,file+' '+width+' masthead overflows viewport');
   assert(metrics.scrollWidth<=width+2,file+' '+width+' horizontal document overflow');
   assert(metrics.titleText.includes('SPORTING LIFE AND TIMES'),file+' title absent');
   const label=file.replace('.html','')+'-'+width;
   await page.screenshot({path:'test-artifacts/'+label+'.png',fullPage:false,animations:'disabled'});
   summary.push({file,width,...metrics});
   await page.close();
  }
 }
 fs.writeFileSync('test-artifacts/slt-hub-mobile-metrics.json',JSON.stringify(summary,null,2));
 console.log('PASSED: 4 browser-rendered hub viewport checks. Metrics:\n'+JSON.stringify(summary,null,2));
}finally{await browser.close();}
