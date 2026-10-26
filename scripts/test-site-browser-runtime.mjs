import {chromium} from 'playwright';
const root=process.env.SITE_URL||'https://jbryancoburn-netizen.github.io/sporting-life-times/';
const pages=['index.html','sports.html','nba.html','nba-game-center.html','nba-players.html','epl.html','epl-club.html','match-center.html','forecast-desk.html','nbl.html'];
const browser=await chromium.launch({headless:true});
let failed=0;
try{
 for(const path of pages){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(new URL(path,root).href,{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForTimeout(2500);
  const headline=await page.title();
  const invalid=(!response||response.status()>=400||errors.length);
  if(invalid)failed++;
  console.log(JSON.stringify({page:path,status:response?.status(),title:headline,jsErrors:errors.slice(0,8),result:invalid?'FAIL':'PASS'}));
  await page.close();
 }
 // Functional NBA edition and archived Game Center acceptance checks.
 const nba=await browser.newPage({viewport:{width:390,height:844}});
 const functionalErrors=[];
 nba.on('pageerror',e=>functionalErrors.push(e.message));
 try{
  await nba.goto(new URL('nba.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
  if(!await nba.locator('.nav a[href="nba-standings.html"]').count())throw Error('NBA standing desk navigation missing');
  if(await nba.locator('#nba-page-turner').count())throw Error('Obsolete NBA page turner is still loaded');
  await nba.goto(new URL('nba-standings.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
  await nba.waitForSelector('#app .nba-table tbody tr',{timeout:18000});
  if(await nba.locator('#app .nba-table tbody tr').count()<15)throw Error('NBA standings have no club rows');
  await nba.goto(new URL('nba-team-desk.html?team=IND',root).href,{waitUntil:'domcontentloaded',timeout:35000});
  await nba.waitForSelector('.depth-club-hero',{timeout:18000});
  if(!(await nba.locator('.depth-club-hero').innerText()).includes('Indiana Pacers'))throw Error('NBA club profile unavailable');
  await nba.goto(new URL('nba-players.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
  await nba.waitForSelector('[data-stat="apg"]',{timeout:18000});
  await nba.locator('[data-stat="apg"]').click();
  if(await nba.locator('[data-stat="apg"]').getAttribute('aria-pressed')!=='true')throw Error('NBA leaderboard tabs not interactive');
  await nba.goto(new URL('nba-matchups.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
  await nba.waitForSelector('#depth-away',{timeout:18000});
  await nba.selectOption('#depth-away','IND');
  await nba.selectOption('#depth-home','BOS');
  if(!(await nba.locator('#depth-scout-preview').innerText()).includes('win probability'))throw Error('NBA scouting comparison does not update');
  const gc=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const response=await gc.goto(new URL('nba-game-center.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
   await gc.waitForFunction(()=>document.querySelectorAll('#games option').length>0&&document.querySelector('#games option')?.value?.startsWith('espn-nba-'),{timeout:20000});
   const count=await gc.locator('#games option').count();
   const detail=await gc.locator('#game').innerText();
   if(response.status()!==200||!count||!detail.includes('Complete Player Box Score'))throw Error('Game Center archive could not render a game and box score');
   console.log(JSON.stringify({functional:'NBA newspaper desks and archived Game Center',gamesAvailable:count,result:'PASS'}));
  }finally{await gc.close()}
  if(functionalErrors.length)throw Error('NBA functional JS errors: '+functionalErrors.join('; '));
 }catch(e){failed++;console.error(JSON.stringify({functional:'NBA page controls and archived Game Center',result:'FAIL',reason:e.message}))}
 finally{await nba.close()}
}finally{await browser.close()}
if(failed)throw Error(failed+' newspaper pages returned HTTP or uncaught JavaScript errors');
