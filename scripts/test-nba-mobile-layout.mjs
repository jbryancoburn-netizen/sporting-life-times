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
  // Always exercise the exact failure users saw: a long article headline.
  // An unavailable news feed must never let the visual regression pass vacuously.
  await page.evaluate(()=>{
    const grid=document.querySelector('#nba-news-grid');
    if(!grid)throw Error('NBA news grid missing');
    if(!grid.querySelector('.nba-news-item')){
      grid.insertAdjacentHTML('beforeend','<article class="nba-news-item nba-news-lead"><p class="nba-news-source">LIVE FEED FALLBACK TEST</p><h3><a href="#">US Bet-MGM bonus code CBS-SPORTS to get a long basketball headline wrapping naturally at phone width</a></h3><p class="nba-news-summary">An attributed source summary with enough words to exercise a realistic news card.</p></article>');
    }
  });
  const info=await page.evaluate(()=>{
   const grid=document.querySelector('#nba-news-grid'),root=document.documentElement;
   const el=document.querySelector('.nba-paper-layout');
   const news=document.querySelector('#nba-news-grid .nba-news-item');
   const headline=news?.querySelector('h3');
   const headlineBox=headline?.getBoundingClientRect();
   return {
    viewport:window.innerWidth,scrollWidth:root.scrollWidth,
    newspaperWidth:el?.getBoundingClientRect().width,
    newsWidth:grid?.getBoundingClientRect().width,
    articleWidth:news?.getBoundingClientRect().width,
    articleCount:grid?.querySelectorAll('.nba-news-item').length||0,
    headlineWidth:headlineBox?.width||0,
    headlineHeight:headlineBox?.height||0,
    headlineFont:headline?parseFloat(getComputedStyle(headline).fontSize):0,
    bodyScrollWidth:document.body.scrollWidth
   };
  });
  await page.screenshot({path:'test-artifacts/nba-'+width+'.png',fullPage:false});
  console.log(width,JSON.stringify(info),errors.slice(0,3));
  if(info.scrollWidth>width+3||info.bodyScrollWidth>width+3)throw Error('Horizontal overflow at '+width+' px');
  if(!info.newspaperWidth||info.newspaperWidth<width*.72)throw Error('Newspaper layout collapsed at '+width+' px');
  if(width<500&&info.newsWidth<width*.7)throw Error('News rail collapsed at '+width+' px');
  if(!info.articleCount)throw Error('No article exercised at '+width+' px');
  if(width<500&&info.articleWidth<width*.7)throw Error('One-character-width news columns at '+width+' px');
  if(width<500&&info.headlineWidth<width*.65)throw Error('Headline crushed to a narrow mobile column at '+width+' px');
  if(info.headlineHeight>info.headlineFont*20)throw Error('Headline appears to wrap a character per line at '+width+' px');
  if(errors.some(e=>/SyntaxError|ReferenceError/.test(e)))throw Error('JavaScript runtime errors: '+errors.join('; '));
  await page.close();
 }
 console.log('PASS: NBA mobile and desktop layout widths');
}finally{if(browser)await browser.close();server.kill();}
