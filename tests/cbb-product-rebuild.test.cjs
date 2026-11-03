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
 assert.match(s,/metric\(68,'Tournament field'\)/);
 assert.ok(!s.includes("metric(76,'Projected field')"));
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
