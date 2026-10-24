import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){try{const r=await fetch('http://127.0.0.1:8765/nba.html');if(r.ok){ready=true;break}}catch{}await delay(350)}
 if(!ready)throw Error('NBA test server did not start');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-artifacts',{recursive:true});
 for(const width of [375,390,430,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/nba.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  const info=await page.evaluate(()=>{
   const grid=document.querySelector('#nba-news-grid'),root=document.documentElement;
   const el=document.querySelector('.nba-paper-layout');
   const news=document.querySelector('#nba-news-grid .nba-news-item');
   return {
    viewport:window.innerWidth,scrollWidth:root.scrollWidth,
    newspaperWidth:el?.getBoundingClientRect().width,
    newsWidth:grid?.getBoundingClientRect().width,
    articleWidth:news?.getBoundingClientRect().width,
    articleCount:grid?.querySelectorAll('.nba-news-item').length||0,
    bodyScrollWidth:document.body.scrollWidth
   };
  });
  await page.screenshot({path:'test-artifacts/nba-'+width+'.png',fullPage:false});
  console.log(width,JSON.stringify(info),errors.slice(0,3));
  if(info.scrollWidth>width+3||info.bodyScrollWidth>width+3)throw Error('Horizontal overflow at '+width+' px');
  if(!info.newspaperWidth||info.newspaperWidth<width*.72)throw Error('Newspaper layout collapsed at '+width+' px');
  if(width<500&&info.newsWidth<width*.7)throw Error('News rail collapsed at '+width+' px');
  if(width<500&&info.articleCount&&info.articleWidth<width*.7)throw Error('One-character-width news columns at '+width+' px');
  if(errors.some(e=>/SyntaxError|ReferenceError/.test(e)))throw Error('JavaScript runtime errors: '+errors.join('; '));
  await page.close();
 }
 console.log('PASS: NBA mobile and desktop layout widths');
}finally{if(browser)await browser.close();server.kill();}
