const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const path=require('node:path');

test('Iowa race pages tell four distinct, readable, interactive stories', {timeout:100000}, async()=>{
 const cwd=path.resolve(__dirname,'..');
 const server=spawn('python3',['-m','http.server','8876','--bind','127.0.0.1','--directory',cwd],{stdio:'ignore'});
 let browser;
 try{
  await new Promise(r=>setTimeout(r,450));
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.route('https://**/*',route=>{
   const url=route.request().url();
   if(/\.jpg|\.png|\.svg|\/images\//i.test(url))return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"></svg>'});
   return route.abort();
  });
  const load=async id=>{
   const response=await page.goto('http://127.0.0.1:8876/politics-house-district.html?district='+id,{waitUntil:'domcontentloaded'});
   assert(response?.ok(),'HTTP failure: '+id);
   await page.waitForSelector('.race-feature-headline',{timeout:15000});
   assert.equal(await page.locator('.race-number').count(),3,id);
   assert.equal(await page.locator('.race-tab').count(),2,id);
   assert.equal(await page.locator('.race-tab[aria-selected="true"]').count(),1,id);
   assert.equal(await page.locator('.race-snapshot-panel:visible').count(),1,id);
   assert.equal(await page.locator('.race-source-link').count()>0,true,id+' lacks sources');
  };
  await load('IA-01');
  assert.match(await page.locator('.race-feature-headline').innerText(),/799 votes/);
  assert.match(await page.locator('.race-feature-deck').innerText(),/Michael Bridgford.*11\.0%/);
  assert.match(await page.locator('#race-panel-poll').innerText(),/Christina Bohannan/);
  await page.locator('#race-tab-history').click();
  assert.equal(await page.locator('#race-panel-poll').isHidden(),true);
  assert.equal(await page.locator('#race-panel-history').isVisible(),true);
  assert.match(await page.locator('#race-panel-history').innerText(),/206,955/);
  await page.locator('#race-tab-poll').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#race-tab-history').getAttribute('aria-selected'),'true');
  await load('IA-02');
  assert.match(await page.locator('.race-feature-headline').innerText(),/different directions/);
  assert.match(await page.locator('.race-number-past').innerText(),/63,600/);
  await load('IA-03');
  assert.match(await page.locator('.race-number-past').innerText(),/15,784/);
  await load('IA-04');
  assert.match(await page.locator('.race-number-survey').innerText(),/NO POLL/);
  assert.match(await page.locator('.race-feature-deck').innerText(),/Chris McGowan/);
  assert.equal(await page.locator('.front-person').count(),2);
  const desktop=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));
  assert(desktop.body<=desktop.viewport+2,'desktop overflow');
  await page.setViewportSize({width:390,height:844});
  for(const id of ['IA-01','IA-02','IA-03','IA-04']){
   await load(id);
   const measured=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,root:document.querySelector('.race-experience').getBoundingClientRect().width}));
   assert(measured.body<=measured.viewport+2,id+' mobile overflow: '+JSON.stringify(measured));
   const a=await page.locator('.front-person').nth(0).boundingBox();
   const b=await page.locator('.front-person').nth(1).boundingBox();
   assert(a&&b&&a.x+a.width<=b.x+2,id+' candidate photos overlap');
  }
  await page.goto('http://127.0.0.1:8876/politics-house-state.html?state=IA',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.state-brief-card',{timeout:15000});
  assert.equal(await page.locator('.state-brief-card').count(),4);
  assert.match(await page.locator('.state-brief-card').first().innerText(),/799 votes/);
  assert.deepEqual(errs,[],'Uncaught page errors');
 } finally {
  if(browser)await browser.close();
  server.kill();
 }
});
