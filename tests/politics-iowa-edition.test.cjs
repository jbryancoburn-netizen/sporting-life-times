/* Political Life & Times Iowa newsroom: render and source-vintage browser regression. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const target=path.resolve(root,'.'+decodeURIComponent(pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try {
  const data=fs.readFileSync(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});
  res.end(data);
 }catch(e){res.writeHead(404);res.end('Not found');}
});
test('Four Iowa races now use the same photo, source, flag and district-map newsroom as all 435 seats',{timeout:100000},async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const check=async id=>{
   await page.goto(origin+'/politics-house-district.html?district='+id,{waitUntil:'domcontentloaded'});
   await page.locator('#race-experience .race-feature-headline').waitFor({timeout:15000});
   await page.locator('.race-district-geometry .race-geographic-current').waitFor({timeout:15000});
   assert.equal(await page.locator('.race-identity-general').count(),1,id);
   assert.equal(await page.locator('.race-district-geometry .race-geographic-current').getAttribute('data-district'),id);
   assert.equal(await page.locator('.front-person').count(),2,id);
   assert.equal(await page.locator('.front-person .race-party-feature').count(),2,id);
   assert.equal(await page.locator('#race-receipts').count(),1,id);
   assert.equal(await page.locator('.race-number').count(),3,id);
   assert.equal(await page.locator('.race-tab[aria-selected="true"]').count(),1,id);
   assert.equal(await page.locator('#iowa-edition').count(),0,id);
  };
  await check('IA-01');
  assert.match(await page.locator('.race-feature-headline').innerText(),/799 votes/);
  await page.locator('#race-tab-history').click();
  assert.match(await page.locator('#race-panel-history').innerText(),/206,955/);
  await page.locator('#race-tab-poll').click();
  assert.match(await page.locator('#race-panel-poll').innerText(),/Michael Bridgford/);
  await check('IA-02');
  assert.match(await page.locator('.race-feature-headline').innerText(),/different directions/);
  await check('IA-03');
  assert.match(await page.locator('.race-number-past').innerText(),/15,784/);
  await check('IA-04');
  assert.match(await page.locator('.race-number-survey').innerText(),/NO POLL/);
  await page.setViewportSize({width:390,height:844});
  for(const id of ['IA-01','IA-02','IA-03','IA-04']){
   await check(id);
   const dim=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));
   assert(dim.body<=dim.viewport+2,id+' mobile overflow '+JSON.stringify(dim));
  }
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
