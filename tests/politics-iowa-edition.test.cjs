/* Unified House newspaper: Iowa and every other state receive identical newsroom functionality. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 const dest=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!dest.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{'Content-Type':types[path.extname(dest)]||'application/octet-stream'});res.end(fs.readFileSync(dest))}
 catch(error){res.writeHead(404);res.end('Not found')}
});
test('All 435 House races: shared source-led newsroom, real maps, state emblems, candidate portraits and responsive tabs',{timeout:120000},async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1300,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort()); // No external fonts, flags or candidate image dependency.
  const visit=async(id)=>{
   const response=await page.goto(origin+'/politics-house-district.html?district='+id,{waitUntil:'domcontentloaded'});
   assert(response.ok(),id+' request failed');
   await page.locator('#race-experience .race-feature-headline').waitFor({timeout:15000}).catch(async e=>{
    const diagnostic=await page.evaluate(()=>({
      title:document.title,
      page:document.body.dataset.housePage,
      root:!!document.querySelector('#district-front'),
      story:!!document.querySelector('#race-experience'),
      headline:document.querySelector('#district-title')?.textContent,
      error:document.querySelector('.notice-error')?.textContent,
      scripts:[...document.scripts].map(x=>x.src).filter(Boolean)
    }));
    throw new Error(id+' race story did not render '+JSON.stringify(diagnostic)+'; pageerrors='+errors.join('|')+'; '+e.message);
   });
   await page.locator('.race-district-svg').waitFor({timeout:15000});
   assert.equal(await page.locator('.race-identity-strip').count(),1,id);
   assert.equal(await page.locator('.race-state-insignia').count(),1,id);
   assert.equal(await page.locator('.race-map-active').count()>0,true,id+' current district outline');
   assert.equal(await page.locator('.race-tab').count(),2,id);
   assert.equal(await page.locator('.race-snapshot-panel:visible').count(),1,id);
   assert.equal(await page.locator('.race-number').count(),3,id);
   assert.equal(await page.locator('.front-field.race-field-promoted').count(),1,id);
   assert.equal(await page.locator('.race-experience').isVisible(),true,id);
   assert.equal(await page.locator('#iowa-edition').count(),0,id+' old Iowa-only edition must be gone');
  };
  await visit('IA-01');
  assert.match(await page.locator('.race-feature-headline').innerText(),/799 votes/);
  assert.match(await page.locator('.race-feature-deck').innerText(),/Michael Bridgford.*11\.0%/);
  assert.equal(await page.locator('.front-person').count(),2);
  assert.equal(await page.locator('.race-other-candidate').count(),1);
  await page.locator('#race-tab-history').click();
  assert.match(await page.locator('#race-panel-history').innerText(),/206,955/);
  await page.locator('#race-tab-poll').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#race-tab-history').getAttribute('aria-selected'),'true');
  await visit('IA-02');
  assert.match(await page.locator('.race-feature-headline').innerText(),/different directions/);
  await visit('IA-03');
  assert.match(await page.locator('.race-number-past').innerText(),/15,784/);
  await visit('IA-04');
  assert.match(await page.locator('.race-number-survey').innerText(),/NO POLL/);
  const stateCases=['PA-10','AZ-06','FL-01','CA-12','NY-03','AK-00','VT-00','MO-02'];
  for(const id of stateCases)await visit(id);
  await page.setViewportSize({width:390,height:844});
  for(const id of ['IA-01','IA-04','PA-10','FL-01','AK-00']){
   await visit(id);
   const measure=await page.evaluate(()=>({w:innerWidth,body:document.body.scrollWidth}));
   assert(measure.body<=measure.w+3,id+' mobile viewport overflow '+JSON.stringify(measure));
  }
  await page.goto(origin+'/politics-house-state.html?state=IA',{waitUntil:'domcontentloaded'});
  await page.locator('.state-brief-card').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.state-brief-card').count(),4);
  await page.goto(origin+'/politics-house-state.html?state=PA',{waitUntil:'domcontentloaded'});
  await page.locator('.state-brief-card').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.state-brief-card').count(),6);
  await page.goto(origin+'/politics-house.html',{waitUntil:'domcontentloaded'});
  await page.locator('.national-watch-tile').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.national-watch-tile').count(),12);
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
test('Every House seat has a real Census district archive; 50 unique state styles and no fake forecast probabilities',()=>{
 const atlas=JSON.parse(fs.readFileSync(path.join(root,'politics-house-atlas.json'),'utf8'));
 const branding=fs.readFileSync(path.join(root,'politics-race-branding.js'),'utf8');
 assert.equal(atlas.districts.length,435);assert.equal(atlas.states.length,50);
 for(const state of atlas.states){
  const geo=JSON.parse(fs.readFileSync(path.join(root,'politics-geometry',state.code+'.geojson'),'utf8'));
  assert.equal(geo.meta.state,state.code);
  assert.equal(geo.features.length,state.district_count);
  assert(branding.includes(state.code+':"'+state.name+'"'),state.code+' flag identity missing');
 }
 assert(branding.includes('Special:FilePath/'));
 assert(branding.includes('race-map-active'));
 assert.equal(atlas.forecast_eligible,false);
 assert.equal(atlas.certified_2026_probabilities,0);
});
