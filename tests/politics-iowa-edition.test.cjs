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
test('Four Iowa race files show live data-derived stories and responsive evidence switcher',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/*',route=>{
   if(route.request().url().startsWith(origin+'/'))return route.continue();
   return route.abort(); // External portraits/fonts do not determine our data correctness.
  });
  const check=async(id)=>{
   await page.goto(origin+'/politics-house-district.html?district='+id,{waitUntil:'domcontentloaded'});
   await page.locator('body.iowa-edition-active').waitFor({timeout:15000});
   assert.equal(await page.locator('.ia-race-link').count(),4,id+' district navigator');
   await page.locator('.ia-map-seat').first().waitFor({timeout:15000});
   assert.equal(await page.locator('.ia-map-seat').count(),4,id+' true Census map');
   assert.equal(await page.locator('.ia-map-seat.current').count(),1);
   assert.equal(await page.locator('.ia-candidate').count(),2);
   assert.equal(await page.locator('.iowa-edition-active #district-front').isVisible(),false);
   assert.equal(await page.locator('.ia-full-dossier').count(),1);
   const label=await page.locator('.ia-measurement').innerText();
   assert.doesNotMatch(label,/win probability|chance of victory/i,id+' cannot invent odds');
  };
  await check('IA-01');
  assert.match(await page.locator('.ia-feature-headline').innerText(),/799 votes/);
  await page.getByRole('tab',{name:/2024/}).click();
  assert.match(await page.locator('.ia-measurement').innerText(),/799 votes/);
  await page.getByRole('tab',{name:/2026/}).click();
  assert.match(await page.locator('.ia-measurement').innerText(),/Michael Bridgford/);
  assert.match(await page.locator('.ia-measurement').innerText(),/Other \/ unreported/);
  await check('IA-02');
  assert.match(await page.locator('.ia-feature-headline').innerText(),/past says one thing/);
  await page.getByRole('tab',{name:/2024/}).click();
  assert.match(await page.locator('.ia-measurement').innerText(),/63,600 votes/);
  await page.getByRole('tab',{name:/2026/}).click();
  assert.match(await page.locator('.ia-measurement').innerText(),/3.0 points/);
  await check('IA-03');
  assert.match(await page.locator('.ia-feature-headline').innerText(),/old poll/i);
  assert.match(await page.locator('.ia-measurement').innerText(),/2026-03-14/);
  await check('IA-04');
  assert.match(await page.locator('.ia-feature-headline').innerText(),/unanswered 2026 question/i);
  assert.match(await page.locator('.ia-measurement').innerText(),/128,347 votes/);
  await page.getByRole('tab',{name:/2026/}).click();
  assert.match(await page.locator('.ia-measurement').innerText(),/No eligible 2026 named-candidate poll/);
  await page.setViewportSize({width:390,height:844});
  await check('IA-01');
  const mobile=await page.evaluate(()=>({
    page:document.documentElement.scrollWidth,viewport:window.innerWidth,
    title:document.querySelector('.ia-feature-headline')?.getBoundingClientRect().width,
    first:document.querySelector('.ia-candidate')?.getBoundingClientRect().width,
  }));
  assert.ok(mobile.page<=mobile.viewport+2,JSON.stringify(mobile));
  assert.ok(mobile.title>200&&mobile.first>110,JSON.stringify(mobile));
  await page.locator('.ia-full-dossier > summary').click();
  assert.equal(await page.locator('#result-panel').isVisible(),true);
 } finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
