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
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROME_CHANNEL||undefined});
 mkdirSync('test-artifacts',{recursive:true});
 for(const width of [375,390,430,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/nba.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app h1',{timeout:15000});
  await page.waitForSelector('.slt-mark',{timeout:15000});
  const crestGeometry=await page.evaluate(()=>[...document.querySelectorAll('.slt-mark')].slice(0,15).map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,hasImg:!!el.querySelector('img')})));
  if(!crestGeometry.length||crestGeometry.some(x=>x.width>90||x.width<15||x.height!==x.width||!x.hasImg))throw Error('Shared college soccer crest sizing is broken: '+JSON.stringify(crestGeometry));
  const ringAudit=await page.evaluate(()=>{
    const marks=[...document.querySelectorAll('.slt-mark')],results=[];
    for(const el of marks){
      const img=el.querySelector('img'),source=img?.getAttribute('src')||'';
      const match=/\/nba\/(?:\d+\/)?(bos|lal|chi|ny|nyk|gs|gsw)\.(?:png|svg|webp)/i.exec(source);
      if(match)results.push({team:match[1],color:getComputedStyle(el).borderTopColor,width:getComputedStyle(el).borderTopWidth,source:el.dataset.sltColorSource});
    }
    return results;
  });
  if(ringAudit.some(x=>x.width!=='3px'||x.source!=='brand'))throw Error('Known NBA crests do not carry their actual 3px team-color ring: '+JSON.stringify(ringAudit));
  // Assert actual primary colors, not neutral framing, across distinct sports.
  await page.evaluate(()=>{
    const host=document.createElement('div');host.id='brand-test';document.body.append(host);
    const logos=[
      ['Boston Celtics','https://a.espncdn.com/i/teamlogos/nba/500/bos.png'],
      ['Buffalo Bills','https://a.espncdn.com/i/teamlogos/nfl/500/buf.png'],
      ['Boston Red Sox','https://a.espncdn.com/i/teamlogos/mlb/500/bos.png'],
      ['Toronto Maple Leafs','https://a.espncdn.com/i/teamlogos/nhl/500/tor.png'],
      ['Arsenal','/assets/does-not-exist-arsenal.svg']
    ];
    for(const [label,src] of logos){
      const link=document.createElement('a');link.className='team-link';link.dataset.brand=label;
      const image=document.createElement('img');image.className='team-logo';image.src=src;
      const name=document.createElement('span');name.textContent=label;
      link.append(image,name);host.append(link);
    }
  });
  await page.waitForFunction(()=>document.querySelectorAll('#brand-test .slt-mark').length===5,{timeout:6000});
  const colors=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#brand-test a')].map(a=>[a.dataset.brand,{
    border:getComputedStyle(a.querySelector('.slt-mark')).borderTopColor,
    source:a.querySelector('.slt-mark').dataset.sltColorSource,
    weight:getComputedStyle(a.querySelector('.slt-mark')).borderTopWidth
  }])));
  const expected={'Boston Celtics':'rgb(0, 122, 51)','Buffalo Bills':'rgb(0, 51, 141)','Boston Red Sox':'rgb(189, 48, 57)','Toronto Maple Leafs':'rgb(0, 32, 91)','Arsenal':'rgb(239, 1, 7)'};
  for(const [club,color] of Object.entries(expected)){
    if(colors[club]?.border!==color||colors[club]?.source!=='brand'||colors[club]?.weight!=='3px')throw Error('Cross-sport logo ring has wrong team-primary color for '+club+': '+JSON.stringify(colors[club]));
  }
  await page.evaluate(()=>document.querySelector('#brand-test')?.remove());



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
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});
  for(const [dest,selector] of [['nba-team-desk.html?team=IND','.depth-team-upgrade .depth-club-hero'],['nba-players.html','#nba-visual-players .depth-star-grid'],['nba-matchups.html','.depth-matchroom #depth-scout-preview']]){
   const errors=[],onError=err=>errors.push(err.message);
   page.on('pageerror',onError);
   await page.goto('http://127.0.0.1:8765/'+dest,{waitUntil:'domcontentloaded'});
   await page.waitForSelector(selector,{timeout:15000});
   const metrics=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   if(metrics.html>width+3||metrics.body>width+3){
    const offenders=await page.evaluate(()=>[...document.querySelectorAll('#app *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,cls:String(el.className).slice(0,70),right:Math.round(r.right),left:Math.round(r.left),w:Math.round(r.width),text:(el.textContent||'').trim().slice(0,42)}}).filter(x=>x.right>innerWidth+4||x.left< -4).sort((a,b)=>b.right-a.right).slice(0,22));
    throw Error('NBA depth overflow on '+dest+' at '+width+'px: '+JSON.stringify(metrics)+' offenders='+JSON.stringify(offenders));
   }
   if(errors.some(x=>/SyntaxError|ReferenceError|TypeError/.test(x)))throw Error('NBA browser errors on '+dest+': '+errors.join('; '));
   await page.screenshot({path:'test-artifacts/nba-depth-'+dest.split('?')[0].replace('.html','')+'-'+width+'.png',fullPage:false});
   page.off('pageerror',onError);
  }
  await page.goto('http://127.0.0.1:8765/nba-players.html');
  await page.waitForSelector('[data-stat="apg"]',{timeout:15000});
  await page.click('[data-stat="apg"]');
  if(await page.locator('[data-stat="apg"]').getAttribute('aria-pressed')!=='true')throw Error('NBA player chart selection not working');
  await page.goto('http://127.0.0.1:8765/nba-matchups.html');
  await page.waitForSelector('#depth-away',{timeout:15000});
  await page.selectOption('#depth-away','IND');
  await page.selectOption('#depth-home','BOS');
  const scouting=await page.locator('#depth-scout-preview').innerText();
  if(!scouting.includes('Indiana Pacers')||!scouting.includes('Boston Celtics')||!scouting.includes('win probability'))throw Error('NBA team matchup interaction failed');
 }
 await page.goto('http://127.0.0.1:8765/nba-rankings.html');
 await page.waitForSelector('#app .nba-table tbody tr',{timeout:15000});
 if(await page.locator('#app .nba-table tbody tr').count()<30)throw Error('Thirty-team Elo rankings missing');
  const tableShape=await page.evaluate(()=>({columns:document.querySelectorAll('.nba-power-table thead th').length,rows:document.querySelectorAll('.nba-power-table tbody tr').length,heights:[...document.querySelectorAll('.nba-power-table tbody tr')].slice(0,5).map(el=>Math.round(el.getBoundingClientRect().height)),form:!!document.querySelector('.nba-power-recent'),streak:!!document.querySelector('.nba-power-streak'),margin:!!document.querySelector('.nba-power-difference')}));
  if(tableShape.columns!==11||tableShape.rows!==30||!tableShape.form||!tableShape.streak||!tableShape.margin)throw Error('Power rankings analytical data missing: '+JSON.stringify(tableShape));
  if(tableShape.heights.some(h=>h>62))throw Error('Power rankings rows still excessively tall: '+JSON.stringify(tableShape.heights));

 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});
  await page.goto('http://127.0.0.1:8765/nba-rankings.html');
  await page.waitForSelector('.nba-table tbody tr:nth-child(10) td:nth-child(2) .team-link span',{timeout:15000});
  const clubPos=await page.evaluate(()=>[...document.querySelectorAll('.nba-table tbody tr td:nth-child(2) .team-link > span:not(.slt-mark)')].slice(0,15).map(el=>({x:el.getBoundingClientRect().x,center:el.getBoundingClientRect().y+el.getBoundingClientRect().height/2,row:el.closest('tr').getBoundingClientRect().y+el.closest('tr').getBoundingClientRect().height/2})));
  if(Math.max(...clubPos.map(x=>x.x))-Math.min(...clubPos.map(x=>x.x))>1.5)throw Error('NBA power ranking names are horizontally misaligned at '+width+'px: '+JSON.stringify(clubPos));
  if(clubPos.some(p=>Math.abs(p.center-p.row)>5))throw Error('NBA power ranking names are not vertically centered at '+width+'px');
  await page.goto('http://127.0.0.1:8765/nba-players.html');
  await page.waitForSelector('.depth-bar-row',{timeout:15000});
  const playerPos=await page.evaluate(()=>({header:document.querySelector('.depth-bars-guide>span:nth-child(2)')?.getBoundingClientRect().x,items:[...document.querySelectorAll('.depth-bar-row>a')].slice(0,10).map(el=>({x:el.getBoundingClientRect().x,center:el.getBoundingClientRect().y+el.getBoundingClientRect().height/2,row:el.closest('.depth-bar-row').getBoundingClientRect().y+el.closest('.depth-bar-row').getBoundingClientRect().height/2}))}));
  if(!playerPos.header||playerPos.items.length<8)throw Error('NBA player stat chart incomplete at '+width+'px');
  if(Math.max(...playerPos.items.map(x=>x.x))-Math.min(...playerPos.items.map(x=>x.x))>1.5||playerPos.items.some(x=>Math.abs(x.x-playerPos.header)>1.5))throw Error('NBA player names are misaligned with their column header at '+width+'px: '+JSON.stringify(playerPos));
  if(playerPos.items.some(x=>Math.abs(x.center-x.row)>5))throw Error('NBA player names are not vertically centered at '+width+'px');
 }


 // EUROLEAGUE: real hashed CDN logos must be detected by data-euroleague-code,
 // and each team must have a visible, correct primary-color ring in every desk.
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});
  await page.goto('http://127.0.0.1:8765/euroleague.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#el-elo-table .el-club .slt-mark',{timeout:15000});
  await page.waitForSelector('#el-standings .el-club .slt-mark',{timeout:15000});
  const euro=await page.evaluate(()=>{
   const arr=sel=>[...document.querySelectorAll(sel)].map(el=>{
    const mark=el.closest('.slt-mark');
    const rect=mark?.getBoundingClientRect();
    return {code:el.dataset.euroleagueCode,marked:!!mark,source:mark?.dataset.sltColorSource,
      color:mark?getComputedStyle(mark).borderTopColor:'',weight:mark?getComputedStyle(mark).borderTopWidth:'',
      width:rect?.width,height:rect?.height};
   });
   return {rankings:arr('#el-elo-table img[data-euroleague-code]'),
    standings:arr('#el-standings img[data-euroleague-code]'),
    results:arr('#el-recent-results-list img[data-euroleague-code]'),
    fixtures:arr('#el-forecasts img[data-euroleague-code]'),
    live:arr('#el-live-scorebugs img[data-euroleague-code]')};
  });
  if(euro.rankings.length!==20||euro.standings.length!==20)throw Error('EuroLeague missing 20 real club crest wrappers at '+width+': '+JSON.stringify(euro));

  await page.evaluate(()=>{
   document.querySelectorAll('#el-elo-table img[data-euroleague-code]').forEach(im=>im.loading='eager');
   document.querySelectorAll('#el-recent-results-list img[data-euroleague-code]').forEach(im=>im.loading='eager');
  });
  await page.waitForFunction(()=>{
   const imgs=[...document.querySelectorAll('#el-elo-table img[data-euroleague-code]')];
   return imgs.length===20&&imgs.every(im=>im.complete&&im.naturalWidth>=100&&!im.hidden);
  },undefined,{timeout:16000});
  await page.waitForFunction(()=>{
   const imgs=[...document.querySelectorAll('#el-recent-results-list img[data-euroleague-code]')];
   return imgs.length>=16&&imgs.every(im=>im.complete&&im.naturalWidth>=100&&!im.hidden);
  },undefined,{timeout:16000});
  const images=await page.evaluate(()=>{
   const imgs=[...document.querySelectorAll('#el-recent-results-list img[data-euroleague-code]')];
   return {count:imgs.length,real:imgs.filter(im=>im.complete&&im.naturalWidth>=100&&!im.hidden).length,local:imgs.every(im=>im.getAttribute('src').startsWith('assets/euroleague-logos/'))};
  });
  if(images.count<16||images.real!==images.count||!images.local)throw Error('EuroLeague final cards show fallback initials instead of original club art: '+JSON.stringify(images));
  const all=Object.values(euro).flat();
  if(all.some(x=>!x.marked||x.source!=='brand'||x.weight!=='3px'||!x.code||!x.width||Math.abs(x.width-x.height)>1))
   throw Error('EuroLeague color crest failure at '+width+': '+JSON.stringify(euro));
  const sectionSizes=[
    ['rankings',euro.rankings,width<681?34:38],
    ['standings',euro.standings,width<681?27:31],
    ['recent results',euro.results,width<681?30:34],
    ['upcoming matchups',euro.fixtures,width<681?36:42],
    ['live game rail',euro.live,width<681?32:36]
  ];
  for(const [section,items,expectedSize] of sectionSizes){
    if(items.length&&items.some(x=>Math.abs(x.width-expectedSize)>1))
      throw Error('EuroLeague '+section+' crests wrong size at '+width+'px. Expected '+expectedSize+': '+JSON.stringify(items));
  }
  const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  if(layout.document>layout.viewport+3)
    throw Error('Enlarged EuroLeague logos cause horizontal page overflow: '+JSON.stringify(layout));
  const expected={OLY:'rgb(207, 16, 45)',PAN:'rgb(0, 122, 61)',MAD:'rgb(0, 82, 159)'};
  for(const [code,color] of Object.entries(expected))
   if(euro.rankings.find(x=>x.code===code)?.color!==color)throw Error('EuroLeague '+code+' has incorrect primary color at '+width+': '+JSON.stringify(euro.rankings));
  await page.screenshot({path:'test-artifacts/euroleague-crests-'+width+'.png',fullPage:false});
 }
 await page.close();
 console.log('PASS: NBA phone/tablet/desktop newspaper, permanent navigation, 30-team Elo, team deep links and player search');
}finally{if(browser)await browser.close();server.kill();}
