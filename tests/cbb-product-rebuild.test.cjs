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
 assert.match(s,/THE NATIONAL PICTURE/);
 assert.match(s,/class="cbb-front-statline"/);
 assert.doesNotMatch(s,/COLLEGE BASKETBALL\.<br>EVERY NIGHT\./);
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
  assert.match(html,/cbb-product-v1\.js\?v=20261102-(?:mobile2|courtside2)/);
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
 assert.match(css,/\.cbb-front-brief\{/);
});



test('the approved newspaper puts live games above editorial branding and uses one existing game feed',()=>{
 const m=read('mbb-newspaper.js'),c=read('cbb-live-center.js'),css=read('cbb-product-v1.css');
 assert.match(m,/class="cbb-front-brief"/);
 assert.match(m,/class="cbb-front-statline"/);
 assert.match(m,/id="score-rail"/);
 assert.doesNotMatch(m,/COLLEGE BASKETBALL\.<br>EVERY NIGHT\./);
 assert.match(c,/nationalBrief=document\.querySelector\('#app > \.cbb-front-brief'\)/);
 assert.match(c,/otherGames\.before\(nationalBrief\)/);
 assert.match(c,/isStandalone\?'COURTSIDE \/ THE LIVE DESK':'THE SLT SCOREBOARD'/);
 assert.match(c,/state\.games/);
 assert.match(c,/rest\.map\(scorebug\)/);
 assert.match(css,/SCOREBOARD-FIRST NEWSPAPER/);
 assert.match(css,/\.cbb-front-brief\{/);
 assert.match(css,/\.cbb-featured \.cbb-match-rows\{/);
 assert.doesNotMatch(css,/SCREENSHOT-DRIVEN FRONT PAGE REPAIR/);
 for(const path of ['ncaam.html','college-basketball.html']){
  const src=read(path);
  assert.match(src,/cbb-product-v1\.css\?v=20261102-courtside2/);
  assert.match(src,/mbb-newspaper\.js\?v=20261102-courtside2/);
  assert.match(src,/cbb-live-center\.js\?v=20261102-courtside2/);
 }
});
test('real Chromium screenshot-layout contract: cream scorebug ahead of compact editorial on phone and desktop',async()=>{
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const markup=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body class="cbb-product cbb-header-v2" data-page="home"><div class="wrap"><main id="app">
  <section class="cbb-live-desk" id="cbb-live-desk">
    <div class="cbb-desk-header"><div><div class="cbb-kicker">MEN’S DIVISION I</div><h2>THE SLT SCOREBOARD</h2></div><a class="cbb-center-link" href="#">ALL GAMES →</a></div>
    <div class="cbb-date-controls"><button data-cbb-date="-1">‹</button><label class="cbb-date-label"><span>Date</span><input type="date" value="2026-11-02"></label><button data-cbb-date="1">›</button><button data-cbb-today>TODAY</button><button data-cbb-refresh>↻</button></div>
    <div class="cbb-filter-bar"><button>All 189</button><button>Live 84</button><button>Final 79</button><button>Upcoming 26</button></div>
    <p class="cbb-source-stamp">Source-backed games · NCAA origin checked · ESPN secondary verification</p>
    <div id="cbb-feature-host" class="cbb-featured"><div class="cbb-feature-marker">FEATURED GAME</div>
      <article class="cbb-game-card" style="--cbb-away:#a71930;--cbb-home:#1958ae">
        <div class="cbb-bug-top"><span><b class="slt-cbb-signature">SLT</b>LIVE · 2ND 4:17</span><span class="cbb-bug-network">ESPN</span></div>
        <div class="cbb-match-rows">
          <div class="cbb-scorebug-row"><span class="cbb-team-identity"><span class="cbb-name"><b>INDIANA</b><small>5–1 · TO —</small></span></span><span class="cbb-points">62</span></div>
          <div class="cbb-scorebug-row"><span class="cbb-team-identity"><span class="cbb-name"><b>KENTUCKY</b><small>6–0 · TO —</small></span></span><span class="cbb-points">58</span></div>
        </div>
        <div class="cbb-bug-bottom"><span>Source-confirmed game venue</span><a href="#">GAMEFILE →</a></div>
      </article></div>
    <section class="cbb-front-brief" aria-label="National picture"><div class="cbb-front-brief-copy">
      <span class="cbb-front-brief-kicker">THE NATIONAL DESK · 2026–27</span>
      <h2>THE NATIONAL PICTURE</h2><p>Scores, standings and independent ratings.</p>
      <div class="cbb-front-brief-links"><a href="#">RANKINGS →</a></div></div>
      <div class="cbb-front-statline"><span><b>365</b><small>DIVISION I SCHOOLS</small></span><span><b>59</b><small>VERIFIED FINALS</small></span><span><b>32</b><small>CONFERENCES</small></span><span><b>68</b><small>FIELD SIZE</small></span></div>
    </section>
    <div id="cbb-cards"></div>
  </section><div id="score-rail"></div></main></div></body></html>`;
  for(const width of [375,390,430,768,1280]){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
   try{
    await page.setContent(markup);
    await page.addStyleTag({content:read('mbb-newspaper.css')});
    await page.addStyleTag({content:read('cbb-live-center.css')});
    await page.addStyleTag({content:read('cbb-product-v1.css')});
    const v=await page.evaluate(()=>{
     const box=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
     const board=document.querySelector('#cbb-live-desk'),score=document.querySelector('.cbb-featured .cbb-game-card'),
     first=document.querySelector('.cbb-featured .cbb-scorebug-row:first-child'),
     second=document.querySelector('.cbb-featured .cbb-scorebug-row:nth-child(2)'),
     brief=document.querySelector('.cbb-front-brief'),
     stamp=document.querySelector('.cbb-source-stamp');
     const color=e=>getComputedStyle(e).backgroundColor;
     return {board:box(board),score:box(score),first:box(first),second:box(second),brief:box(brief),
       scroll:document.documentElement.scrollWidth,
       teamColor:color(first),titleColor:getComputedStyle(first.querySelector('b')).color,
       statusColor:color(document.querySelector('.cbb-bug-top')),stamp:box(stamp)};
    });
    assert.equal(v.teamColor,'rgb(255, 247, 229)',width+'px cream score panels');
    assert.equal(v.titleColor,'rgb(9, 31, 61)',width+'px ink text on cream');
    assert.equal(v.statusColor,'rgb(9, 31, 61)',width+'px navy status header');
    assert(v.score.top<v.brief.top,width+'px games must appear ahead of editorial');
    assert(v.score.top<=300,width+'px game scorebug appears without giant billboard');
    assert(v.brief.height<=210,width+'px compact national context');
    assert(v.scroll<=width+1,width+'px no full-page horizontal overflow');
    if(width<760)assert(v.first.bottom<=v.second.top+1,width+'px stack team rows');
    else assert(v.first.right<=v.second.left+1,width+'px share broadcast row on desktop');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
