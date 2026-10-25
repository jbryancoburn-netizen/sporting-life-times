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
  await nba.locator('#nba-page-turner a[href="#page-3"]').click();
  await nba.waitForTimeout(300);
  const page3=await nba.locator('#nba-page-turner .edition-page-count').innerText();
  const visibleStandings=await nba.locator('#nba-conference-standings').isVisible();
  if(!page3.includes('PAGE 3')||!visibleStandings)throw Error('NBA page-3 navigation did not reveal standings');
  await nba.locator('#nba-page-turner a[href="#page-2"]').click();
  if(!await nba.locator('#nba-boxscores').isVisible())throw Error('NBA page-2 navigation did not reveal box scores');
  const gc=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const response=await gc.goto(new URL('nba-game-center.html',root).href,{waitUntil:'domcontentloaded',timeout:35000});
   await gc.waitForFunction(()=>document.querySelectorAll('#games option').length>0&&document.querySelector('#games option')?.value?.startsWith('espn-nba-'),{timeout:20000});
   const count=await gc.locator('#games option').count();
   const detail=await gc.locator('#game').innerText();
   if(response.status()!==200||!count||!detail.includes('Complete Player Box Score'))throw Error('Game Center archive could not render a game and box score');
   console.log(JSON.stringify({functional:'NBA page controls and archived Game Center',gamesAvailable:count,result:'PASS'}));
  }finally{await gc.close()}
  if(functionalErrors.length)throw Error('NBA functional JS errors: '+functionalErrors.join('; '));
 }catch(e){failed++;console.error(JSON.stringify({functional:'NBA page controls and archived Game Center',result:'FAIL',reason:e.message}))}
 finally{await nba.close()}
}finally{await browser.close()}
if(failed)throw Error(failed+' newspaper pages returned HTTP or uncaught JavaScript errors');
