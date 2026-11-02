/* All 431 non-Iowa House reports use the shared interactive evidence desk.
 * Iowa's four custom race files are tested separately by politics-iowa-edition.test.cjs.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const rel=new URL(req.url,'http://localhost').pathname;
 const p=path.resolve(root,'.'+decodeURIComponent(rel));
 if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const buf=fs.readFileSync(p);res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(buf);}
 catch(e){res.writeHead(404);res.end();}
});
test('Other House districts have source-matched stories and accessible comparison tabs', {timeout:100000}, async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const visit=async id=>{
   const response=await page.goto(origin+'/politics-house-district.html?district='+id,{waitUntil:'domcontentloaded'});
   assert(response.ok(),id+' HTTP failure');
   await page.locator('#race-experience .race-feature-headline').waitFor({timeout:20000});
   assert.equal(await page.locator('.race-number').count(),3,id);
   assert.equal(await page.locator('#race-panel-poll').count(),1,id);
   assert.equal(await page.locator('#race-panel-history').count(),1,id);
   assert.equal(await page.locator('#race-receipts').count(),1,id+' missing collapsible source details');
   assert.equal(await page.locator('.race-tab[aria-selected=true]').count(),1,id);
   const width=await page.evaluate(()=>[innerWidth,document.body.scrollWidth]);
   assert(width[1]<=width[0]+2,id+' horizontal overflow '+width);
  };
  await visit('NE-02');
  assert.match(await page.locator('.race-number-past').innerText(),/5,829/);
  await page.locator('#race-tab-history').click();
  assert.equal(await page.locator('#race-panel-history').isVisible(),true);
  assert.equal(await page.locator('#race-panel-poll').isHidden(),true);
  await page.locator('#race-tab-poll').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#race-tab-history').getAttribute('aria-selected'),'true');
  await visit('NJ-07');
  assert.match(await page.locator('.race-number-past').innerText(),/23,306/);
  await visit('VA-02');
  assert.match(await page.locator('.race-number-past').innerText(),/15,702/);
  await visit('RI-01');
  assert.match(await page.locator('.race-number-past').innerText(),/68,610/);
  await page.setViewportSize({width:390,height:844});
  for(const id of ['NE-02','NJ-07','VA-02','RI-01'])await visit(id);
  await page.goto(origin+'/politics-house-state.html?state=IA',{waitUntil:'domcontentloaded'});
  await page.locator('.state-brief-card').first().waitFor({timeout:20000});
  assert.equal(await page.locator('.state-brief-card').count(),4);
  assert.match(await page.locator('.state-editorial-stories').innerText(),/799 votes/);
  const storyAbove=await page.evaluate(()=>document.querySelector('.state-editorial-briefing').compareDocumentPosition(document.querySelector('.state-metrics'))&Node.DOCUMENT_POSITION_FOLLOWING);
  assert(storyAbove,'state race stories should appear before generic coverage metrics');
  assert.deepEqual(pageErrors,[],'uncaught JavaScript errors in the House race desk');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
