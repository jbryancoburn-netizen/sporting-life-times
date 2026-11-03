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


test('iPhone homepage hero uses cream-on-navy colors and a single-column two-row stats layout',()=>{
 const legacy=read('mbb-newspaper.css'),css=read('cbb-product-v1.css');
 assert(!legacy.includes('body[data-page="home"]:not([data-gender="women"]) .hero{'),'legacy men-only selector must not override rebuilt hero');
 assert.match(legacy,/not\(\.cbb-product\) \.hero\{/);
 assert.match(css,/SCREENSHOT-DRIVEN FRONT PAGE REPAIR/);
 assert.match(css,/\.cbb-front-headline h1\{[\s\S]*?color:#fff7e5!important/);
 assert.match(css,/\.cbb-front-headline \.cta\{[\s\S]*?background:#edbd46!important/);
 assert.match(css,/@media\(max-width:820px\)\{/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/grid-template-rows:repeat\(2,minmax\(59px,auto\)\)!important/);
 assert.match(css,/\.cbb-desk-header h2\{/);
 for(const name of ['ncaam.html','college-basketball.html','ncaam-slate.html','cbb-game-center.html','cbb-gamefile.html']){
  assert.match(read(name),/cbb-product-v1\.css\?v=20261102-hero3/);
 }
});


test('real Chromium viewport: NCAA headline and CTA stay readable and stats stack below at 390px',async()=>{
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const markup='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
  '<body class="cbb-product cbb-header-v2" data-page="home"><div class="wrap"><main id="app">'+
  '<section class="hero cbb-front-lead"><div class="cbb-front-headline">'+
  '<div class="eyebrow">SPORTING LIFE AND TIMES · NATIONAL COLLEGE COURT</div>'+
  '<h1>COLLEGE BASKETBALL.<br>EVERY NIGHT.</h1>'+
  '<p>Scores, standings and independent ratings for every Division I program.</p>'+
  '<a class="cta" href="#">OPEN TODAY’S GAMES →</a>'+
  '<a class="cta" href="#">GO COURTSIDE →</a></div>'+
  '<div class="cbb-front-numbers"><div><strong>365</strong><span>DIVISION I SCHOOLS IN REGISTRY</span></div>'+
  '<div><strong>9</strong><span>VERIFIED RETRO FINALS</span></div>'+
  '<div><strong>32</strong><span>CONFERENCES INDEXED</span></div>'+
  '<div><strong>68</strong><span>NCAA TOURNAMENT FIELD SIZE</span></div></div></section>'+
  '</main></div></body></html>';
  for(const width of [375,390,430,768,1280]){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
   try{
    await page.setContent(markup);
    await page.addStyleTag({content:read('mbb-newspaper.css')});
    await page.addStyleTag({content:read('cbb-product-v1.css')});
    const x=await page.evaluate(()=>{
     const b=el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
     const h=document.querySelector('.cbb-front-headline'),stats=document.querySelector('.cbb-front-numbers');
     const headline=document.querySelector('.cbb-front-headline h1');
     const paragraph=document.querySelector('.cbb-front-headline p');
     const cta=document.querySelector('.cbb-front-headline .cta');
     const hero=document.querySelector('.hero');
     const st=el=>getComputedStyle(el);
     return {hero:b(hero),intro:b(h),stats:b(stats),scrollWidth:document.documentElement.scrollWidth,
      headlineColor:st(headline).color,textColor:st(paragraph).color,ctaColor:st(cta).color,
      ctaBackground:st(cta).backgroundColor,heroBackground:st(hero).backgroundColor,display:st(hero).display};
    });
    assert.equal(x.display,'grid',width+'px must use grid, not legacy flex');
    assert.equal(x.headlineColor,'rgb(255, 247, 229)',width+'px headline must be cream');
    assert.equal(x.textColor,'rgb(230, 236, 241)',width+'px copy must be readable');
    assert.equal(x.ctaBackground,'rgb(237, 189, 70)',width+'px CTA must be gold');
    assert.equal(x.ctaColor,'rgb(8, 28, 56)',width+'px CTA must be navy');
    assert.equal(x.heroBackground,'rgb(9, 31, 64)',width+'px navy background expected');
    assert(x.hero.right<=width+1,width+'px hero must fit viewport');
    assert(x.scrollWidth<=width+1,width+'px document must not overflow');
    if(width<=768){
      assert(x.intro.bottom<=x.stats.top+1,width+'px statistics must be BELOW headline, not beside it');
      assert(Math.abs(x.intro.left-x.stats.left)<2,width+'px stats should be aligned full-width');
      assert(x.stats.width>=x.intro.width-2,width+'px stats must not be squeezed into sidebar');
    }else assert(x.intro.right<=x.stats.left+1,'desktop hero should be balanced columns');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
