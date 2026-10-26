import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:8765/nba.html')).ok){ready=true;break;}}catch{}await delay(350);}
 if(!ready)throw Error('NBA test server did not start');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-artifacts',{recursive:true});
 for(const width of [375,390,430,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/nba.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app h1',{timeout:15000});
  // A long headline must wrap properly even if the live news feed is unavailable.
  await page.evaluate(()=>{
   const panel=document.querySelector('#app .column .panel.orange');
   if(!panel)throw Error('NBA editorial news column missing');
   if(!panel.querySelector('.nba-story'))panel.insertAdjacentHTML('beforeend','<article class="nba-story lead"><div class="byline">WRAPPING TEST</div><h3><a href="#">NBA trade deadline market moves and a remarkably long basketball headline that should naturally wrap across a small mobile screen</a></h3><p>Realistic feature text tests mobile line wrapping.</p></article>');
  });
  const info=await page.evaluate(()=>{
   const root=document.documentElement;
   const layout=document.querySelector('#app .grid');
   const story=document.querySelector('#app .column .nba-story');
   const news=document.querySelector('#app .column .panel.orange');
   const title=story?.querySelector('h3');
   const hero=document.querySelector('#app .hero');
   return {viewport:innerWidth,scrollWidth:root.scrollWidth,bodyScrollWidth:document.body.scrollWidth,
    layoutWidth:layout?.getBoundingClientRect().width||0,newsWidth:news?.getBoundingClientRect().width||0,
    storyWidth:story?.getBoundingClientRect().width||0,
    headingWidth:title?.getBoundingClientRect().width||0,
    headingHeight:title?.getBoundingClientRect().height||0,
    headingFont:title?parseFloat(getComputedStyle(title).fontSize):0,
    heroWidth:hero?.getBoundingClientRect().width||0,
    navPresent:!!document.querySelector('.nav[aria-label="NBA newspaper navigation"]'),
    pageTurner:!!document.querySelector('#nba-page-turner,.edition-page-turner')
   };
  });
  await page.screenshot({path:'test-artifacts/nba-'+width+'.png',fullPage:false});
  console.log(width,JSON.stringify(info),errors.slice(0,3));
  if(info.scrollWidth>width+3||info.bodyScrollWidth>width+3)throw Error('Horizontal overflow at '+width+'px');
  if(!info.layoutWidth||info.layoutWidth<width*.72)throw Error('Editorial grid collapsed at '+width+'px');
  if(!info.heroWidth||info.heroWidth<width*.72)throw Error('NBA hero collapsed at '+width+'px');
  if(width<500&&info.newsWidth<width*.7)throw Error('News panel crushed at '+width+'px');
  if(width<500&&info.storyWidth<width*.7)throw Error('One-character-width article at '+width+'px');
  if(width<500&&info.headingWidth<width*.65)throw Error('Narrow news headline at '+width+'px');
  if(info.headingHeight>info.headingFont*20)throw Error('News headline wraps one character per line');
  if(info.pageTurner||!info.navPresent)throw Error('NBA must have permanent navigation with no page turner');
  if(errors.some(e=>/SyntaxError|ReferenceError|TypeError/.test(e)))throw Error('NBA browser error: '+errors.join('; '));
  await page.close();
 }
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8765/nba-team-desk.html?team=IND');
 await page.waitForSelector('.nba-team-identity h1',{timeout:15000});
 if(!(await page.locator('.nba-team-identity h1').innerText()).includes('Indiana Pacers'))throw Error('Indiana team deep-link missing');
 await page.goto('http://127.0.0.1:8765/nba-players.html');
 await page.waitForSelector('#app h1',{timeout:15000});
 if(!await page.locator('#nba-player-search').count())throw Error('Player search missing');
 await page.goto('http://127.0.0.1:8765/nba-rankings.html');
 await page.waitForSelector('#app .nba-table tbody tr',{timeout:15000});
 if(await page.locator('#app .nba-table tbody tr').count()<30)throw Error('Thirty-team Elo rankings missing');
 await page.close();
 console.log('PASS: NBA phone/tablet/desktop newspaper, permanent navigation, 30-team Elo, team deep links and player search');
}finally{if(browser)await browser.close();server.kill();}
