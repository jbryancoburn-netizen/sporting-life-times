/* The Political Life & Times state flag, party identity and 435 district outlines. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const atlas=JSON.parse(read('politics-house-atlas.json'));
const map=new Map(atlas.states.map(s=>[s.code,s]));
const files={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const buffer=fs.readFileSync(p);res.writeHead(200,{'Content-Type':files[path.extname(p)]||'application/octet-stream'});res.end(buffer);}
 catch(e){res.writeHead(404);res.end('Unavailable');}
});
test('every 2026 House district gets its own Census polygon, not a generic shape',()=>{
 const pseudoDom={createElementNS:(ns,name)=>({
  tag:name,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},
  append(...args){this.children.push(...args)},getAttribute(k){return this.attrs[k]},textContent:''
 })};
 const context={document:pseudoDom,window:{},console};vm.runInNewContext(read('politics-race-branding.js'),context);
 const create=context.window.PoliticsRaceBranding.buildCartography;
 assert.equal(typeof create,'function');
 let count=0;
 for(const state of atlas.states){
  const geo=JSON.parse(read('politics-geometry/'+state.code+'.geojson'));
  const districts=atlas.districts.filter(r=>r.state===state.code);
  assert.equal(districts.length,state.district_count);
  for(const r of districts){
   const svg=create(geo,state,r.id,true);
   assert.equal(svg.attrs.role,'img',r.id);
   assert.match(svg.attrs['aria-label'],/not an election forecast/i,r.id);
   const paths=svg.children.filter(x=>x.tag==='path');
   assert.equal(paths.filter(x=>x.attrs.class==='race-geographic-current').length,1,r.id);
   assert.equal(paths.find(x=>x.attrs.class==='race-geographic-current').attrs['data-district'],r.id);
   assert.equal(paths.length,state.district_count,r.id);
   count++;
  }
 }
 assert.equal(count,435);
});
test('Iowa and other states display flag, real district outline, and party identification on mobile', {timeout:90000},async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1240,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin+'/politics-house-district.html?district=IA-01',{waitUntil:'domcontentloaded'});
  await page.locator('body.iowa-edition-active .race-identity-iowa').waitFor({timeout:15000});
  assert.equal(await page.locator('body.iowa-edition-active .race-place-badge img').getAttribute('alt'),'Iowa state flag');
  assert.equal(await page.locator('.ia-candidate .race-party-feature').count(),2);
  assert.equal(await page.locator('.ia-candidate .race-party-blue').count(),1);
  assert.equal(await page.locator('.ia-candidate .race-party-red').count(),1);
  assert.equal(await page.locator('.ia-map-seat').count(),4);
  assert.equal(await page.locator('.race-local-map-id').innerText(),'IA-01 / SELECTED');
  await page.goto(origin+'/politics-house-district.html?district=NE-02',{waitUntil:'domcontentloaded'});
  await page.locator('.race-identity-general').waitFor({timeout:15000});
  await page.locator('.race-district-geometry .race-geographic-current').waitFor({timeout:15000});
  assert.equal(await page.locator('.race-flag-frame img').getAttribute('alt'),'Nebraska state flag');
  assert.equal(await page.locator('.race-district-geometry .race-geographic-current').getAttribute('data-district'),'NE-02');
  assert.equal(await page.locator('.front-person .race-party-feature').count(),2);
  assert.equal(await page.locator('.race-number').count(),3);
  await page.goto(origin+'/politics-house-state.html?state=IA',{waitUntil:'domcontentloaded'});
  await page.locator('.race-state-signature').waitFor({timeout:15000});
  await page.locator('.state-brief-card .race-district-geometry').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.state-brief-card .race-district-geometry').count(),4);
  assert.equal(await page.locator('.state-brief-card .race-geographic-current').count(),4);
  await page.setViewportSize({width:390,height:844});
  for(const url of [
   '/politics-house-district.html?district=IA-01',
   '/politics-house-district.html?district=NE-02',
   '/politics-house-state.html?state=IA']){
   await page.goto(origin+url,{waitUntil:'domcontentloaded'});
   await page.locator(url.includes('state=')?'.race-state-signature':url.includes('IA-01')?'.race-identity-iowa':'.race-identity-general').waitFor({timeout:15000});
   const dim=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));
   assert(dim.body<=dim.viewport+2,url+' horizontal overflow '+JSON.stringify(dim));
  }
  assert.deepEqual(errors,[],'unexpected browser errors');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
