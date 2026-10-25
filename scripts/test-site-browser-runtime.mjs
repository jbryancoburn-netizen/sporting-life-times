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
}finally{await browser.close()}
if(failed)throw Error(failed+' newspaper pages returned HTTP or uncaught JavaScript errors');
