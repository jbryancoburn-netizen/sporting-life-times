/* Shared men's/women's College Basketball Edition. Women's records stay isolated. */
(function () {
  'use strict';
  const params=new URLSearchParams(location.search);
  const women=params.get('gender')==='women';
  const file=location.pathname.split('/').pop()||'ncaam.html';
  const isFront=file==='ncaam.html'||file==='college-basketball.html';
  const menURL='ncaam.html';
  const womenURL='ncaam.html?gender=women';
  if(women&&!isFront){location.replace(womenURL);return;}
  const nav=document.querySelector('header .nav')||document.querySelector('main .nav');
  const edition=document.querySelector('header .edition-line');
  if(!nav)return;
  const toggle=document.createElement('div');
  toggle.className='cbb-gender-bar';
  toggle.setAttribute('role','group');
  toggle.setAttribute('aria-label','College basketball competition');
  toggle.innerHTML='<span class="cbb-gender-label">COLLEGE BASKETBALL</span>'+
    '<a class="cbb-gender-option'+(!women?' is-active':'')+'" href="'+menURL+'" '+(!women?'aria-current="page"':'')+'>Men</a>'+
    '<a class="cbb-gender-option'+(women?' is-active':'')+'" href="'+womenURL+'" '+(women?'aria-current="page"':'')+'>Women</a>';
  if(edition)edition.insertAdjacentElement('afterend',toggle);
  else nav.parentNode.insertBefore(toggle,nav);
  if(!women)return;
  // The men's renderer exits for ?gender=women; never reuse its ratings or ledger.
  document.body.dataset.gender='women';
  document.title="Women's College Basketball | The Sporting Life & Times";
  const top=document.querySelector('header .topline span');
  if(top)top.textContent="Women's Division I · 2026–27";
  if(edition)edition.textContent='The College Basketball Edition';
  nav.innerHTML='<a href="'+womenURL+'" aria-current="page">Front Page</a>'+
    '<a href="#wbb-games">Games & Schedules</a><a href="#wbb-news">Top Stories</a>'+
    '<a href="#wbb-standings">Conference Standings</a><a href="#wbb-rankings">USRS Rankings</a>'+
    '<a href="sports.html">All Sports</a>';
  const footer=document.querySelector('.footer');
  if(footer)footer.textContent='The Sporting Life & Times · Women’s Division I college basketball · Verified source feeds only. Rankings, conference tables and forecasts appear only when independently validated.';
  const app=document.getElementById('app');
  if(!app)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=s=>{try{const u=new URL(s,location.href);return /^https?:$/.test(u.protocol)?esc(u.href):'';}catch{return '';}};
  const time=s=>{const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Time not reported'};
  const get=async p=>{try{const r=await fetch(p,{cache:'no-store',signal:AbortSignal.timeout(12000)});return r.ok?await r.json():null;}catch{return null;}};
  const blank=s=>'<div class="empty">'+esc(s)+'</div>';
  const head=(k,h)=>'<div class="panel-head"><div><div class="eyebrow">'+k+'</div><h2>'+h+'</h2></div></div>';
  app.innerHTML='<section class="hero wbb-hero"><div><div class="eyebrow">Women’s Division I · 2026–27</div>'+
    '<h1>The whole<br>college game.</h1><p>Every story deserves its own scoreboard. Follow the women’s game, the next tipoffs and the road to March.</p>'+
    '<a class="cta" href="#wbb-games">OPEN THE WOMEN’S GAME CENTER ↗</a></div>'+
    '<div class="wbb-hero-identity"><span>THE COLLEGE BASKETBALL EDITION</span><strong>WOMEN</strong><small>Independent reporting · Clearly sourced results</small></div></section>'+
    '<section id="wbb-games"><div class="eyebrow">On the hardwood · Women’s Division I</div>'+
    '<p class="muted" id="wbb-score-stamp">Checking the published women’s game feed…</p>'+
    '<div id="wbb-score-rail" class="score-rail">'+blank('Loading verified women’s games…')+'</div></section>'+
    '<div class="grid two"><div class="column"><section class="panel" id="wbb-news">'+head('The national conversation','Across the Women’s Game')+
    '<div id="wbb-stories">'+blank('Reading the women’s news desk…')+'</div></section>'+
    '<section class="panel orange" id="wbb-finals">'+head('The game book','Recent Finals')+'<div id="wbb-recent">'+blank('Checking results…')+'</div></section></div>'+
    '<div class="column"><section class="panel teal" id="wbb-rankings">'+head('Independent strength ratings','USRS Women’s Power Board')+
    '<p class="note">A verified women’s RETRO Elo publication has not been connected yet. We will not substitute the men’s ratings or publish untested projections.</p></section>'+
    '<section class="panel" id="wbb-standings">'+head('The conference races','Women’s Standings')+
    '<p class="note">A verified, complete Division I women’s conference-standings feed has not yet been connected. No estimated table is shown.</p></section>'+
    '<section class="panel">'+head('The next games','Upcoming Women’s Matchups')+
    '<div id="wbb-upcoming">'+blank('Checking fixtures…')+'</div></section></div></div>'+
    '<p class="note wbb-feed-disclosure">The schedule panels display the verified games currently in the published source window, not a complete 2026–27 schedule. Missing games are not treated as cancellations.</p>';
  const stamp=document.getElementById('data-stamp');
  const access=document.getElementById('access-stamp');
  if(access)access.textContent='Viewed '+time(new Date().toISOString());
  function team(t){
    const img=safeURL(t.logo);
    const color=/^[0-9a-fA-F]{6}$/.test(String(t.color||'').replace(/^#/,''))?'#'+String(t.color).replace(/^#/,''):'#0b686d';
    return '<span class="team-name wbb-team-name"><span class="wbb-logo" style="--wbb-team:'+color+'">'+
      (img?'<img src="'+img+'" alt="" loading="lazy">':'<span class="wbb-logo-fallback">●</span>')+
      '</span><span>'+esc(t.name||'Team')+'</span></span>';
  }
  function card(g){
    const sorted=(g.teams||[]).slice().sort((a,b)=>(a.home_away==='away'?-1:1)-(b.home_away==='away'?-1:1));
    const final=g.state==='post'||/final/i.test(g.status||'');
    const live=g.state==='in'||g.state==='live';
    const link=safeURL(g.url);
    return '<div class="score-card wbb-score-card"><small>'+esc(g.status|| (final?'Final':live?'Live':'Scheduled'))+' · '+time(g.date)+'</small>'+
      sorted.map(t=>'<div class="score-team">'+team(t)+'<b>'+(final||live?esc(t.score??'—'):'')+'</b></div>').join('')+
      (g.venue?'<div class="wbb-game-detail">'+esc(g.venue)+'</div>':'')+
      (g.broadcast?'<div class="wbb-game-detail">'+esc(g.broadcast)+'</div>':'')+
      (link?'<a class="wbb-game-source" href="'+link+'" target="_blank" rel="noopener noreferrer">Game details ↗</a>':'')+'</div>';
  }
  let published=[];
  async function refresh(){
    const [scores,news]=await Promise.all([get('multi_scoreboards.json'),get('articles.json')]);
    const entry=scores?.leagues?.find(x=>x.league==="Women's College Basketball");
    published=Array.isArray(entry?.games)?entry.games:[];
    const updated=scores?.updated_at;
    if(stamp)stamp.innerHTML='<span class="pulse"></span>Women’s game feed: '+esc(updated?time(updated):'date unavailable')+' · Verified-source edition';
    document.getElementById('wbb-score-stamp').textContent=updated?'Published game-feed snapshot: '+time(updated):'Published game-feed timestamp unavailable';
    const current=published.filter(g=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});return String(g.date||'').slice(0,10)===today;});
    const future=published.filter(g=>g.state!=='post'&&!/final/i.test(g.status||'')).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const finals=published.filter(g=>g.state==='post'||/final/i.test(g.status||'')).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
    document.getElementById('wbb-score-rail').innerHTML=(current.length?current:future.slice(0,6)).map(card).join('')||blank(entry?'No upcoming games in the current published window.':'A verified women’s game feed is not available.');
    document.getElementById('wbb-upcoming').innerHTML=future.slice(0,8).map(card).join('')||blank('No upcoming fixtures in the published window.');
    document.getElementById('wbb-recent').innerHTML=finals.slice(0,6).map(card).join('')||blank('No verified women’s finals in the current feed window.');
    const stories=(news?.articles||[]).filter(a=>/women.s (college |ncaa |division i )?basketball|ncaaw|women.s march madness/i.test([a.title,a.summary,a.category].join(' ')))
      .filter(a=>a.title&&safeURL(a.url)).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));
    const seen=new Set();
    document.getElementById('wbb-stories').innerHTML=stories.filter(a=>!seen.has(a.url)&&seen.add(a.url)).slice(0,12).map((a,i)=>
      '<article class="story'+(i===0?' lead':'')+'"><div class="source">'+esc(a.source||'Reporting')+' · '+time(a.published_at)+'</div>'+
      '<h3><a href="'+safeURL(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3>'+
      (a.summary?'<p>'+esc(String(a.summary).slice(0,220))+'</p>':'')+'</article>').join('')||
      blank('No recent attributed women’s college basketball articles are in the current feed.');
  }
  refresh();
  setInterval(refresh,300000);
})();
