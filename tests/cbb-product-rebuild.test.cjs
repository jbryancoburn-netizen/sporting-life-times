const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['ncaam.html','ncaam-slate.html','cbb-game-center.html','cbb-gamefile.html'];
test('four college court pages share exactly one new design identity',()=>{
 for(const p of pages){const s=read(p);
 assert.equal((s.match(/cbb-product-v1\.css/g)||[]).length,1,p+' css');
 assert.equal((s.match(/cbb-product-v1\.js/g)||[]).length,1,p+' js');
 assert.match(s,/slt-retro-identity\.js/,p+' original identity');
 }
});
test('existing engines remain on each page, without modifying live workflow',()=>{
 const engines={
 'ncaam.html':'mbb-newspaper.js',
 'ncaam-slate.html':'ncaam-slate.js',
 'cbb-game-center.html':'cbb-live-center.js',
 'cbb-gamefile.html':'cbb-live-center.js'
 };
 for(const [p,script] of Object.entries(engines))assert.ok(read(p).includes(script),p);
 assert.match(read('ncaam-slate.html'),/slt-basketball-indicators\.js/);
});
test('front page now includes sourced national features and correct field size',()=>{
 const s=read('mbb-newspaper.js');
 assert.match(s,/COLLEGE BASKETBALL\.<br>EVERY NIGHT\./);
 assert.match(s,/class="cbb-front-numbers"/);
 assert.match(s,/teams\.length/);
 assert.match(s,/metric\(76,'Experimental scenario field'\)/);
 assert.ok(s.includes('not the official 68-team NCAA'));
});
test('slate presents phase groups with two-line school data and source-safe dots',()=>{
 const s=read('ncaam-slate.js');
 assert.match(s,/ON THE FLOOR/);assert.match(s,/COMING UP/);assert.match(s,/FINAL SCORES/);
 assert.match(s,/class="sl-broadcast-secondary"/);
 assert.match(s,/window\.SLTCollegeIndicators\?\.fromGame/);
 assert.match(s,/RECORD '\+esc\(r\)/);
 assert.match(s,/:'—'/);
 assert.doesNotMatch(s,/SL<span class="sl-mark-amp">&<\/span>T/);
});
test('live desk and Gamefile have source-identified rows and no italic VS',()=>{
 const s=read('cbb-live-center.js');
 assert.match(s,/COURTSIDE \/ THE LIVE DESK/);
 assert.match(s,/cbb-gamefile-ledger/);
 assert.match(s,/SPORTING LIFE AND TIMES · /);
 assert.match(s,/class="cbb-gamefile-versus"/);
 assert.match(s,/SLTCollegeIndicators\.fromGame/);
});
test('new scripts compile and core pages keep mobile-safe rules',()=>{
 for(const p of ['mbb-newspaper.js','ncaam-slate.js','cbb-live-center.js','cbb-product-v1.js'])
   assert.doesNotThrow(()=>new vm.Script(read(p),{filename:p}),p);
 const css=read('cbb-product-v1.css');
 assert.ok(css.includes('@media(max-width:700px)'));
 assert.ok(css.includes('sl-game-section-cards'));
 assert.ok(css.includes('cbb-gamefile-score'));
 assert.ok(css.includes('slt-brand-title'));
 assert.ok(css.includes('--cbb-crimson:#9e1930'));
});


test('mobile repair removes duplicate Hardwood and competing broadcast headers',()=>{
 const pages=['ncaam.html','college-basketball.html','ncaam-slate.html','cbb-game-center.html','cbb-gamefile.html'];
 for(const p of pages){
  const html=read(p);
  assert.equal((html.match(/cbb-product-v1\.js/g)||[]).length,1,p+' script count');
  assert.equal((html.match(/cbb-product-v1\.css/g)||[]).length,1,p+' css count');
  assert.match(html,/cbb-product-v1\.js\?v=20261102-mobile2/);
  assert.doesNotMatch(html,/slt-courtside-network\.(js|css)/,p+' duplicated Hardwood nav');
  assert.doesNotMatch(html,/slt-broadcast-overhaul\.(js|css)/,p+' competing broadcast bar');
 }
 const shared=read('slt-retro-identity.js');
 assert.match(shared,/ncaam-slate\|college-basketball\|cbb-game-center\|cbb-gamefile/);
 const script=read('cbb-product-v1.js');
 assert.match(script,/nav\.replaceChildren\(\)/);
 assert.match(script,/mk\('nav','cbb-compact-editions'\)/);
 assert.match(script,/mk\('div','cbb-navigation'\)/);
 assert.match(script,/mk\('details','cbb-nav-more'\)/);
 assert.match(script,/header\.querySelectorAll\('\.slt-courtside-network/);
 assert.doesNotMatch(script,/nav\.appendChild\(a\).*for \(const \[title,url\] of extras/);
});
test('mobile NCAA header uses horizontal-only navigation, bounded MORE dropdown and one edition row',()=>{
 const css=read('cbb-product-v1.css');
 assert.match(css,/nav\.cbb-main-nav\{[\s\S]*?flex-flow:row nowrap!important/);
 assert.match(css,/nav\.cbb-main-nav\{[\s\S]*?overflow-x:auto!important/);
 assert.match(css,/\.cbb-compact-editions\{[\s\S]*?flex-flow:row nowrap!important/);
 assert.match(css,/\.cbb-nav-dropdown\{[\s\S]*?position:absolute/);
 assert.match(css,/\.slt-courtside-network,[\s\S]*?display:none!important/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.cbb-front-lead \.cbb-front-headline h1/);
});
