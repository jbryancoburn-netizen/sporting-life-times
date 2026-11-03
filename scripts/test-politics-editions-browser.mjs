import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const base = process.env.POLITICS_TEST_BASE || 'http://127.0.0.1:8765/';
const atlas = JSON.parse(readFileSync(new URL('../politics-house-atlas.json', import.meta.url), 'utf8'));
const all = atlas.districts.map(d=>d.id);
const browser=await chromium.launch({headless:true});
let failures=[];
const fail=(label,reason)=>{failures.push({label,reason:String(reason)});console.error('FAIL',label,String(reason));};
const pageFor=()=>browser.newPage({viewport:{width:1440,height:900}});
async function smoke(target,viewport,label){
 const page=await browser.newPage({viewport});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.goto(new URL(target,base).href,{waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw Error('HTTP '+response?.status());
  const isState=target.includes('state.html');
  const selector=isState?'#state-title':'#district-title';
  await page.waitForFunction(sel=>{const t=document.querySelector(sel)?.textContent||'';return t.length>3&&!/State House districts|Individual U.S. House District/i.test(t)},selector,{timeout:60000});
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+12);
  if(horizontalOverflow)throw Error('Horizontal page overflow');
  if(errors.length)throw Error('Uncaught JS: '+errors.join(' | '));
  if(isState){
   await page.waitForSelector('#map-shading-controls button',{timeout:30000});
   const modes=page.locator('#map-shading-controls button');
   if(await modes.count()!==2)throw Error('Geographic and election evidence controls missing');
   await modes.nth(1).click();
   if(await modes.nth(1).getAttribute('aria-pressed')!=='true')throw Error('Evidence mode failed');
   await modes.nth(0).click();
   if(await modes.nth(0).getAttribute('aria-pressed')!=='true')throw Error('Geographic mode failed');
  }else{
   if(!await page.locator('#dossier-map').count())throw Error('District geographic panel missing');
   if(!await page.locator('#next-district').getAttribute('href'))throw Error('Next district navigation missing');
  }
  const screenshot='artifacts/'+label.replace(/[^a-z0-9_-]/gi,'_')+'.png';
  await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});
  console.log('PASS',label,target);
 }catch(e){
  const title=await page.locator(isState?'#state-title':'#district-title').textContent().catch(()=>null);
  const status=await page.locator('#district-map-status').textContent().catch(()=>null);
  fail(label,e.message+'; title='+JSON.stringify(title)+'; status='+JSON.stringify(status)+'; JS='+JSON.stringify(errors.slice(0,4)));
 }finally{await page.close()}
}
// Real full-page layouts at desktop and phone dimensions.
for(const state of ['IA','IL','CA','MO']){
 for(const [device,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  await smoke('politics-house-state.html?state='+state,viewport,'state-'+state+'-'+device);
 }
}
for(const district of ['IA-01','IL-07','CA-12','MO-01','AK-00']){
 for(const [device,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  await smoke('politics-house-district.html?district='+district,viewport,'district-'+district+'-'+device);
 }
}
// Navigate to EVERY state edition, then EVERY district route.\nfor(const state of atlas.states){\n const page=await pageFor();\n try{\n  const response=await page.goto(new URL('politics-house-state.html?state='+state.code,base).href,{waitUntil:'domcontentloaded',timeout:30000});\n  if(response?.status()!==200)throw Error('HTTP '+response?.status());\n  await page.waitForFunction(expected=>document.querySelector('#state-title')?.textContent?.includes(expected),state.name,{timeout:25000});\n }catch(e){fail('state route '+state.code,e.message)}finally{await page.close()}\n}\n// Navigate to EVERY existing route and verify the correct edition materializes.
const routePage=await pageFor();
try{
 for(let i=0;i<all.length;i++){
  const id=all[i];const url=new URL('politics-house-district.html?district='+id,base).href;
  try{
   const response=await routePage.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   if(response?.status()!==200)throw Error('HTTP '+response?.status());
   await routePage.waitForFunction(expected=>{
    const t=document.querySelector('#district-subtitle')?.textContent||'';
    return t.includes(expected) && !!document.querySelector('#next-district')?.getAttribute('href')
  },id,{timeout:25000});
   if((i+1)%25===0)console.log('ROUTES',i+1,'/',all.length);
  }catch(e){fail('route '+id,e.message)}
 }
}finally{await routePage.close();await browser.close()}
console.log(JSON.stringify({totalStateRoutes:atlas.states.length,totalDistrictRoutes:all.length,checkedScreenshots:18,failures:failures.length,details:failures.slice(0,30)},null,2));
if(failures.length)process.exitCode=1;
