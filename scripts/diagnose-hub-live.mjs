/* Diagnostic of the ACTUAL GitHub Pages version, not a local copy. */
import {chromium} from 'playwright';
import fs from 'node:fs';
const URL='https://jbryancoburn-netizen.github.io/sporting-life-times/';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
fs.mkdirSync('test-artifacts',{recursive:true});
let mismatch=0;
try{
 for(const name of ['index.html','sports.html']){
  const requests=[];
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('response',res=>{
   if(/\.(css|js)(?:\?|$)/i.test(res.url()))requests.push({url:res.url(),status:res.status(),cache:res.headers()['cache-control'],etag:res.headers().etag});
  });
  page.on('requestfailed',r=>requests.push({failed:r.url(),error:r.failure()?.errorText}));
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=URL+name+'?diag='+Date.now();
  let resp;
  try{resp=await page.goto(url,{waitUntil:'networkidle',timeout:30000})}
  catch(e){console.log('LIVE page fetch error '+name+': '+e.message)}
  const detail=await page.evaluate(()=>{
   const info=sel=>{
     const node=document.querySelector(sel);
     if(!node)return {missing:true};
     const box=node.getBoundingClientRect(),style=getComputedStyle(node);
     return {outer:node.outerHTML.slice(0,180),width:Math.round(box.width),height:Math.round(box.height),
             fontSize:style.fontSize,display:style.display,color:style.color,
             background:style.backgroundColor,flexWrap:style.flexWrap,position:style.position};
   };
   return {title:document.title,currentHref:location.href,bodyClasses:document.body.className,
    fixCssPresent:!!document.querySelector('link[href*="slt-hub-masthead-fix.css"]'),
    cssLinks:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href),
    cssRules:[...document.styleSheets].map(x=>({url:x.href,disabled:x.disabled,rules:(()=>{try{return x.cssRules.length}catch(e){return 'blocked'}})()})),
    header:info('header.masthead'),link:info('header.masthead .slt-brand-link'),
    globe:info('header.masthead .slt-brand-globe'),
    title:info('header.masthead .slt-brand-title'),nav:info('nav.site-nav'),
    pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  await page.screenshot({path:'test-artifacts/live-hub-'+name+'.png',fullPage:false});
  const result={name,status:resp?.status(),detail,requests,errors};
  console.log('LIVE_DIAGNOSTIC '+JSON.stringify(result));
  fs.writeFileSync('test-artifacts/live-hub-'+name+'.json',JSON.stringify(result,null,2));
  if(detail.link.missing||detail.globe.width>90||detail.link.height>200||detail.link.background!=='rgb(9, 31, 61)')mismatch++;
  await page.close();
 }
}finally{await browser.close()}
console.log('LIVE_DIAGNOSTIC_DONE '+JSON.stringify({mismatch}));
