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
  if(women&&params.has('team')){location.replace('ncaaw-team.html?team='+encodeURIComponent(params.get('team')));return;}
  const nav=document.querySelector('header .nav')||document.querySelector('main .nav')||document.querySelector('nav')||document.querySelector('main');
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
  document.body.dataset.gender='women';
  document.title='Women’s College Basketball | The Sporting Life & Times';
  const top=document.querySelector('header .topline span');
  if(top)top.textContent='Women’s Division I · 2026–27';
  nav.innerHTML='<a href="'+womenURL+'" aria-current="page">Front Page</a><a href="#wbb-games">Game Center</a><a href="#wbb-news">Top Stories</a><a href="#wbb-standings">Conference Standings</a><a href="#wbb-rankings">USRS Rankings</a><a href="#wbb-teams">All 363 Teams</a><a href="sports.html">All Sports</a>';
  const footer=document.querySelector('.footer');if(footer)footer.textContent='The Sporting Life & Times · Women’s Division I basketball · Independent 1500-start ratings and sourced women’s results.';
  const app=document.getElementById('app');if(!app)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?esc(u.href):'';}catch{return '';}};
  const get=async p=>{try{const r=await fetch(p,{cache:'no-store',signal:AbortSignal.timeout(15000)});return r.ok?await r.json():null;}catch{return null;}};
  const empty=s=>'<p class="empty">'+esc(s)+'</p>';
  const localDay=s=>{const d=new Date(s);return Number.isFinite(+d)?d.toLocaleDateString('en-CA',{timeZone:'America/New_York'}):'';};
  const today=()=>localDay(new Date());
  const fmt=s=>{const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Time TBA';};
  const dayLabel=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric'});
  const head=(k,h)=>'<div class="panel-head"><div><div class="eyebrow">'+k+'</div><h2>'+h+'</h2></div></div>';
  const link=id=>'ncaaw-team.html?team='+encodeURIComponent(id);
  let ratings=null,teams=new Map(),games=new Map(),live=new Map(),selected='',manualDate=false,busy=false;
  app.innerHTML='<section class="wbb-edition-lead"><div><div class="eyebrow">Women’s Division I · The national desk</div><h1>The women’s college game.</h1><p>363 programs. Every conference. A clean slate at 1500, and the season’s story as it unfolds.</p></div><div id="wbb-summary" class="wbb-edition-summary">Opening the season ledger…</div></section>'+
    '<section class="panel" id="wbb-games">'+head('Around the country','The Game Center')+'<div class="wbb-game-controls"><button id="wbb-prev" aria-label="Previous game date">←</button><label>Date <select id="wbb-date"></select></label><button id="wbb-next" aria-label="Next game date">→</button><label>Conference <select id="wbb-game-conf"><option value="">All conferences</option></select></label><label>Team <input id="wbb-game-search" type="search" placeholder="Find a matchup"></label></div><p class="note" id="wbb-score-stamp" role="status">Loading the full women’s season calendar…</p><div id="wbb-score-rail" class="wbb-game-grid"></div></section>'+
    '<div class="grid two"><div class="column"><section class="panel" id="wbb-news">'+head('The national conversation','Across the Women’s Game')+'<div id="wbb-stories">Loading attributed reporting…</div></section><section class="panel" id="wbb-standings">'+head('The conference races','Conference Standings')+'<label class="wbb-team-search">Conference <select id="wbb-conference-select"></select></label><div id="wbb-conference-list"></div></section></div>'+
    '<div class="column"><section class="panel teal" id="wbb-rankings">'+head('Independent ratings · 1500 to start','USRS Women’s Power Board')+'<p class="note" id="wbb-rating-note"></p><div id="wbb-powerboard"></div></section><section class="panel" id="wbb-finals">'+head('The game book','Latest Finals')+'<div id="wbb-recent"></div></section></div></div>'+
    '<section class="panel" id="wbb-teams">'+head('The complete Division I directory','Find Your Women’s Team')+'<label class="wbb-team-search">Search all 363 programs <input id="wbb-team-search" type="search" placeholder="School or conference"></label><div id="wbb-directory-list"></div></section><p class="note wbb-feed-disclosure">Schedules combine women-specific source calendars and cited university checks. Unannounced networks remain TBA; unresolved source discrepancies remain provisional. Scores refresh every minute while this page is open. Elo uses the latest published women-only results.</p>';
  const badge=(t,size='small')=>window.MBBLogos.byESPN(String(t.team_id),size,t.team);
  const teamName=id=>{const t=teams.get(String(id));return t?'<a class="wbb-linked-name" href="'+link(id)+'">'+badge(t)+'<span>'+esc(t.team)+'</span></a>':'<span>Opponent outside Division I</span>';};
  const record=t=>(t.wins||0)+'–'+(t.losses||0);
  const pct=t=>(t.wins||0)+(t.losses||0)?((t.wins||0)/((t.wins||0)+(t.losses||0))).toFixed(3).replace(/^0/,''):'—';
  const score=g=>g.completed||g.status==='final'||g.status==='live';
  function card(g){
    const h=teams.get(String(g.home_id)),a=teams.get(String(g.away_id));
    const row=(id,name,n)=>'<div class="score-team">'+(teams.has(String(id))?teamName(id):'<span>'+esc(name||'Opponent TBA')+'</span>')+'<b>'+(score(g)?esc(n??'—'):'')+'</b></div>';
    let forecast='';
    if(!score(g)&&h&&a){const edge=g.neutral?0:Number(ratings.parameters.home_edge)||0,p=100/(1+10**(-((a.elo-h.elo-edge)/400)));forecast='<div class="wbb-game-forecast">Win forecast · '+esc(a.team)+' '+p.toFixed(0)+'% · '+esc(h.team)+' '+(100-p).toFixed(0)+'%</div>';}
    const status=g.status==='final'?'Final':g.status==='live'?(g.detail||'Live'):'Scheduled';
    return '<article class="score-card wbb-score-card"><small>'+esc(status)+' · '+fmt(g.date)+'</small>'+row(g.away_id,g.away_name,g.away_score)+row(g.home_id,g.home_name,g.home_score)+'<div class="wbb-game-detail">'+esc(g.venue||'Arena TBA')+(g.city?' · '+esc(g.city):'')+'</div><div class="wbb-game-detail">'+esc(g.broadcast||'Network TBA')+(g.neutral?' · Neutral site':'')+'</div>'+forecast+'<a class="wbb-game-source" href="https://www.espn.com/womens-college-basketball/game/_/gameId/'+encodeURIComponent(g.id)+'" target="_blank" rel="noopener noreferrer">Game details ↗</a></article>';
  }
  function allGames(){const result=new Map(games);for(const [id,g] of live)result.set(id,{...result.get(id),...g});return [...result.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function drawGames(){
    const all=allGames(),dates=[...new Set(all.map(g=>localDay(g.date)).filter(Boolean))].sort(),dateSelect=document.getElementById('wbb-date');
    if(!manualDate||!dates.includes(selected))selected=dates.find(d=>d>=today())||dates.at(-1)||today();
    dateSelect.innerHTML=dates.map(d=>'<option value="'+d+'" '+(d===selected?'selected':'')+'>'+dayLabel(d)+'</option>').join('');
    const cf=document.getElementById('wbb-game-conf').value,q=document.getElementById('wbb-game-search').value.trim().toLowerCase();
    const filtered=all.filter(g=>localDay(g.date)===selected&&(!cf||[g.home_id,g.away_id].some(id=>teams.get(String(id))?.conference===cf))&&(!q||[g.home_id,g.away_id].map(id=>teams.get(String(id))?.team||'').join(' ').concat(' '+(g.home_name||'')+' '+(g.away_name||'')).toLowerCase().includes(q)));
    document.getElementById('wbb-score-rail').innerHTML=filtered.map(card).join('')||empty('No games match these filters.');
    document.getElementById('wbb-prev').disabled=dates.indexOf(selected)<=0;document.getElementById('wbb-next').disabled=dates.indexOf(selected)>=dates.length-1;
    document.getElementById('wbb-recent').innerHTML=all.filter(g=>g.status==='final'||g.completed).slice(-6).reverse().map(card).join('')||empty('No completed 2026–27 games have been published yet.');
  }
  const boardRow=t=>'<div class="rank-row"><span class="rank">'+esc(t.rank??'—')+'</span>'+teamName(t.team_id)+'<span class="rank-score">'+Number(t.elo).toFixed(1)+'<small>'+record(t)+' · Δ '+(t.daily_change>0?'+':'')+Number(t.daily_change||0).toFixed(1)+'</small></span></div>';
  function drawDirectory(){const q=document.getElementById('wbb-team-search').value.trim().toLowerCase();document.getElementById('wbb-directory-list').innerHTML=ratings.rankings.filter(t=>(t.team+' '+t.conference).toLowerCase().includes(q)).map(boardRow).join('')||empty('No matching school.');}
  function drawStandings(){
    const c=document.getElementById('wbb-conference-select').value;
    const rows=ratings.rankings.filter(t=>t.conference===c).sort((a,b)=>((b.conference_wins||0)/Math.max(1,(b.conference_wins||0)+(b.conference_losses||0)))-((a.conference_wins||0)/Math.max(1,(a.conference_wins||0)+(a.conference_losses||0)))||b.wins-a.wins||a.team.localeCompare(b.team));
    document.getElementById('wbb-conference-list').innerHTML='<div class="table-wrap"><table class="wbb-standings-table"><thead><tr><th>Team</th><th>Conf.</th><th>W–L</th><th>PCT</th><th>Elo</th></tr></thead><tbody>'+rows.map(t=>'<tr><td>'+teamName(t.team_id)+'</td><td>'+(t.conference_wins||0)+'–'+(t.conference_losses||0)+'</td><td>'+record(t)+'</td><td>'+pct(t)+'</td><td>'+Number(t.elo).toFixed(0)+'</td></tr>').join('')+'</tbody></table></div><p class="note">Women-specific conference affiliations. Records currently cover published Division I finals; non-Division I results are excluded. Teams tied in conference percentage are displayed by overall wins, then name; this is not an official tournament seeding.</p>';
  }
  async function refresh(){
    if(busy)return;busy=true;
    try{
      const [r,master,ledger,news]=await Promise.all([get('data/ncaaw-2026-27-retro-primary.json'),get('data/ncaaw-schedules-2026-27.json'),get('data/ncaaw-2026-27-games.json'),get('articles.json')]);
      if(r?.gender!=='women'||r.season!=='2026-27'||r.model!=='retro-clean-slate'||r.starting_elo!==1500||r.rankings?.length!==363||new Set(r.rankings.map(t=>String(t.team_id))).size!==363||!r.rankings.every(t=>t.base_elo===1500&&Number.isFinite(t.elo)))throw Error('Women’s rating registry failed validation');
      if(master?.gender!=='women'||master.season!=='2026-27'||Object.keys(master.teams||{}).length!==363)throw Error('Women’s season calendar failed validation');
      await window.MBBLogos.ready;ratings=r;teams=new Map(r.rankings.map(t=>[String(t.team_id),t]));games=new Map();
      for(const [tid,t] of Object.entries(master.teams))for(const g of t.games||[]){if(games.has(String(g.id))){const old=games.get(String(g.id));if(!old.city)old.city=g.city||g.city_state||g.official_location_as_printed;if(g.broadcast_verified){old.broadcast=g.broadcast;old.broadcast_verified=true;}continue;}games.set(String(g.id),{...g,status:g.completed?'final':'scheduled',neutral:g.site==='neutral',home_name:tid===String(g.home_id)?t.team:g.opponent,away_name:tid===String(g.away_id)?t.team:g.opponent,city:g.city||g.city_state||g.official_location_as_printed});}
      if(ledger?.season==='2026-27')for(const g of [...ledger.finals||[],...ledger.upcoming||[]]){const old=games.get(String(g.id));games.set(String(g.id),{...old,...g,broadcast:old?.broadcast_verified?old.broadcast:g.broadcast||old?.broadcast,completed:g.status==='final'});}
      const conferences=[...new Set(r.rankings.map(t=>t.conference).filter(Boolean))].sort();
      for(const id of ['wbb-conference-select','wbb-game-conf']){const select=document.getElementById(id),old=select.value;select.innerHTML=(id==='wbb-game-conf'?'<option value="">All conferences</option>':'')+conferences.map(c=>'<option>'+esc(c)+'</option>').join('');if(conferences.includes(old))select.value=old;else if(id==='wbb-conference-select')select.value=conferences.includes('Big Ten Conference')?'Big Ten Conference':conferences[0];}
      document.getElementById('wbb-summary').innerHTML='<strong>363 <small>programs</small></strong><strong>'+conferences.length+' <small>conferences</small></strong><strong>'+games.size.toLocaleString()+' <small>season games</small></strong>';
      document.getElementById('wbb-rating-note').textContent=r.games_played?'1500-start RETRO · '+r.games_played+' Division I finals · through '+r.as_of:'Preseason · All 363 programs begin tied at 1500. Rankings take shape after verified results arrive.';
      document.getElementById('wbb-powerboard').innerHTML=r.games_played?r.rankings.slice(0,25).map(boardRow).join(''):'<div class="wbb-preseason">363 TEAMS · ELO 1500</div><p class="note">Home advantage: '+Number(r.parameters.home_edge)+' Elo points, calibrated on women’s historical results. No prior-season rating carryover.</p><a class="cta" href="#wbb-teams">Browse every program →</a>';
      const stories=(news?.articles||[]).filter(a=>/women.s.{0,28}basketball|ncaaw|women.s march madness/i.test([a.title,a.summary,a.category,a.league].join(' '))).filter(a=>a.title&&safe(a.url));
      const seen=new Set();document.getElementById('wbb-stories').innerHTML=stories.filter(a=>!seen.has(a.url)&&seen.add(a.url)).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0)).slice(0,10).map((a,i)=>'<article class="story'+(!i?' lead':'')+'"><div class="source">'+esc(a.source||'Reporting')+' · '+fmt(a.published_at)+'</div><h3><a href="'+safe(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3>'+(a.summary?'<p>'+esc(String(a.summary).slice(0,240))+'</p>':'')+'</article>').join('')||empty('No women’s basketball headlines in the current feed.');
      drawDirectory();drawStandings();drawGames();
      const stamp=document.getElementById('data-stamp');if(stamp)stamp.textContent='Women’s edition · '+games.size.toLocaleString()+' season games · Elo '+(r.as_of?'through '+r.as_of:'preseason');
      await refreshLive();
    }catch(e){document.getElementById('wbb-score-stamp').textContent=e.message+'. Please reload to retry.';}finally{busy=false;}
  }
  async function refreshLive(){
    if(!ratings)return;
    const day=today(),data=await get('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?groups=50&limit=500&dates='+day.replaceAll('-',''));
    if(Array.isArray(data?.events)){
      live=new Map();
      for(const e of data.events){const c=e.competitions?.[0],h=c?.competitors?.find(t=>t.homeAway==='home'),a=c?.competitors?.find(t=>t.homeAway==='away');if(!h||!a||!teams.has(String(h.id))&&!teams.has(String(a.id)))continue;const state=e.status?.type?.state;live.set(String(e.id),{id:String(e.id),date:e.date,home_id:String(h.id),away_id:String(a.id),home_name:h.team?.displayName,away_name:a.team?.displayName,home_score:h.score,away_score:a.score,status:state==='post'?'final':state==='in'?'live':'scheduled',completed:state==='post',detail:e.status?.type?.shortDetail,neutral:!!c.neutralSite,venue:c.venue?.fullName,city:[c.venue?.address?.city,c.venue?.address?.state].filter(Boolean).join(', '),broadcast:(c.broadcasts||[]).flatMap(b=>b.names||[]).join(' / ')});}
      drawGames();document.getElementById('wbb-score-stamp').textContent='Live scoreboard checked '+fmt(new Date())+' · '+live.size+' games today · season calendar '+games.size.toLocaleString()+' games';
    }else document.getElementById('wbb-score-stamp').textContent='Showing published season calendar · live scoreboard unavailable; retrying in one minute.';
    const access=document.getElementById('access-stamp');if(access)access.textContent='Viewed '+fmt(new Date());
  }
  document.getElementById('wbb-date').addEventListener('change',e=>{selected=e.target.value;manualDate=true;drawGames();});
  for(const [id,step] of [['wbb-prev',-1],['wbb-next',1]])document.getElementById(id).addEventListener('click',()=>{const select=document.getElementById('wbb-date'),option=select.options[select.selectedIndex+step];if(option){selected=option.value;manualDate=true;drawGames();}});
  document.getElementById('wbb-game-conf').addEventListener('change',drawGames);
  document.getElementById('wbb-game-search').addEventListener('input',drawGames);
  document.getElementById('wbb-team-search').addEventListener('input',drawDirectory);
  document.getElementById('wbb-conference-select').addEventListener('change',drawStandings);
  refresh();setInterval(refresh,300000);setInterval(refreshLive,60000);
})();
