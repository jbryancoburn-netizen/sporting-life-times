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
    '<div id="wbb-powerboard" class="wbb-board"><p class="note">Checking the independent women’s RETRO publication…</p></div></section>'+
    '<section class="panel" id="wbb-standings">'+head('The conference races','Women’s Standings')+
    '<div id="wbb-conferences"><p class="note">Checking women’s conference records…</p></div></section>'+
    '<section class="panel">'+head('The next games','Upcoming Women’s Matchups')+
    '<div id="wbb-upcoming">'+blank('Checking fixtures…')+'</div></section></div></div>'+
    '<section class="panel" id="wbb-teams">'+head('All Division I programs','Find Your Women’s Team')+'<div id="wbb-team-directory">Loading the verified team registry…</div></section>'+
    '<section class="panel" id="wbb-team-detail" hidden></section>'+
    '<p class="note wbb-feed-disclosure">The game panels show only the current verified source window, not complete school-by-school schedules. Missing games are not cancellations; full team calendars require a separate official-school audit.</p>';
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
  let published=[],wbbLookup=new Map(),fullCalendars=null,calendarsLoaded=false,officialBroadcasts=new Map();
  const teamLink=t=>'ncaaw-team.html?team='+encodeURIComponent(t.team_id);
  const record=t=>(t.wins||0)+'–'+(t.losses||0);
  const boardRow=(t,ranked)=>'<div class="rank-row">'+(ranked?'<span class="rank">'+esc(t.rank??'—')+'</span>':'')+
    '<a class="wbb-team-link" href="'+teamLink(t)+'">'+team({name:t.team,logo:t.logo,color:t.color})+'</a>'+
    '<span class="rank-score">'+Number(t.elo).toFixed(1)+'<small>'+record(t)+'</small></span></div>';
  function renderRatings(data){
    const board=document.getElementById('wbb-powerboard');
    const conf=document.getElementById('wbb-conferences');
    const directory=document.getElementById('wbb-team-directory');
    const details=document.getElementById('wbb-team-detail');
    const rows=data?.rankings;
    const valid=data?.season==='2026-27'&&data?.gender==='women'&&data?.model==='retro-clean-slate'&&data?.starting_elo===1500&&
      Array.isArray(rows)&&rows.length===363&&new Set(rows.map(t=>String(t.team_id))).size===rows.length&&
      rows.every(t=>t.base_elo===1500&&Number.isFinite(t.elo));
    if(!valid){
      board.innerHTML=blank('Independent women’s ratings have not passed the publication checks yet.');
      conf.innerHTML=blank('Women’s conference records are awaiting a verified team registry and game ledger.');
      directory.innerHTML=blank('The verified women’s Division I directory is not available yet.');
      details.hidden=true;
      return;
    }
    wbbLookup=new Map(rows.map(t=>[String(t.team_id),t]));
    const played=Number(data.games_played)||0;
    board.innerHTML='<p class="note">'+(played?'RETRO ratings through '+esc(data.as_of)+' · '+played+' Division I finals':
      'Preseason: every women’s Division I program is tied at 1500. No artificial power ranking.')+
      ' · No men’s ratings or previous-season carryover.</p>'+(played?rows.slice(0,25).map(t=>boardRow(t,true)).join(''):
      '<div class="wbb-preseason">ALL '+rows.length+' TEAMS · ELO 1500 · NO RANKING UNTIL THE GAMES BEGIN</div>');
    directory.innerHTML='<label class="wbb-team-search">Search '+rows.length+' women’s teams <input id="wbb-team-search" type="search" placeholder="School or conference" autocomplete="off"></label>'+
      '<div id="wbb-directory-list">'+rows.map(t=>boardRow(t,played>0)).join('')+'</div>';
    const search=document.getElementById('wbb-team-search');
    search.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      document.getElementById('wbb-directory-list').innerHTML=rows.filter(t=>(t.team+' '+(t.conference||'')).toLowerCase().includes(q)).map(t=>boardRow(t,played>0)).join('')||blank('No matching school.');
    });
    const confNames=[...new Set(rows.map(t=>t.conference).filter(Boolean))].sort();
    if(confNames.length<20){conf.innerHTML=blank('Conference affiliations are still being verified; a provisional table would mislead readers.');}
    else{
      const selected=new URLSearchParams(location.search).get('conference')||confNames[0];
      conf.innerHTML='<p class="note">Provisional conference records from verified Division I vs Division I games (currently preseason; all teams tied). Institutional conference assignments still require women-specific verification; official tiebreakers and non-D-I games are not included.</p>'+
        '<label class="wbb-team-search">Conference <select id="wbb-conference-select">'+confNames.map(c=>'<option value="'+esc(c)+'" '+(c===selected?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
        '<div id="wbb-conference-list"></div>';
      const select=document.getElementById('wbb-conference-select');
      function showConf(){
        const list=rows.filter(t=>t.conference===select.value).sort((a,b)=>{
          const pct=t=>(t.conference_wins||0)/Math.max(1,(t.conference_wins||0)+(t.conference_losses||0));
          return pct(b)-pct(a)||b.conference_wins-a.conference_wins||a.team.localeCompare(b.team);
        });
        document.getElementById('wbb-conference-list').innerHTML='<div class="wbb-conference-table"><div class="wbb-conference-heading">TEAM <span>CONFERENCE · OVERALL · ELO</span></div>'+
          list.map(t=>'<div class="wbb-conf-row"><a href="'+teamLink(t)+'">'+team({name:t.team,logo:t.logo,color:t.color})+'</a><span>'+(t.conference_wins||0)+'–'+(t.conference_losses||0)+' · '+record(t)+' · '+t.elo.toFixed(0)+'</span></div>').join('')+'</div>';
      }
      select.addEventListener('change',showConf);showConf();
    }
    const selectedId=new URLSearchParams(location.search).get('team');
    const selectedTeam=wbbLookup.get(selectedId);
    details.hidden=!selectedTeam;
    if(selectedTeam){
      const t=selectedTeam;
      details.innerHTML=head('Women’s team desk','<span>'+esc(t.team)+'</span>')+
        '<div class="wbb-team-summary">'+team({name:t.team,logo:t.logo,color:t.color})+
        '<strong>'+Number(t.elo).toFixed(1)+' ELO</strong><span>'+record(t)+' overall</span><span>'+esc(t.conference||'Conference pending verification')+'</span></div>'+
        '<p class="note">Teams start the 2026–27 season at 1500. This page currently covers the verified rolling scoreboard window, not the full university schedule.</p>'+
        '<div id="wbb-team-games"></div><a href="ncaam.html?gender=women#'+'wbb-teams'+'">← All Women’s Teams</a>';
    }
  }
  function fromVerified(g){
    const away=wbbLookup.get(String(g.away_id)),home=wbbLookup.get(String(g.home_id));
    if(!away||!home)return null;
    return {id:g.id,date:g.date,state:g.status==='final'?'post':'pre',status:g.status==='final'?'Final':'Scheduled',
      venue:g.venue,broadcast:g.broadcast,url:g.source_url,
      teams:[{...away,name:away.team,home_away:'away',score:g.away_score},{...home,name:home.team,home_away:'home',score:g.home_score}]};
  }
  async function refresh(){
    const [scores,news,verified,ratings]=await Promise.all([get('multi_scoreboards.json'),get('articles.json'),
      get('data/ncaaw-2026-27-games.json'),get('data/ncaaw-2026-27-retro-primary.json')]);
    renderRatings(ratings);
    const entry=scores?.leagues?.find(x=>x.league==="Women's College Basketball");
    published=verified?.season==='2026-27'&&ratings?.gender==='women'&&wbbLookup.size?
      [...(verified.finals||[]),...(verified.upcoming||[])].map(fromVerified).filter(Boolean):
      Array.isArray(entry?.games)?entry.games:[];
    const updated=verified?.season==='2026-27'?'2026-27 women-only source feed':scores?.updated_at;
    if(stamp)stamp.innerHTML='<span class="pulse"></span>Women’s game feed: '+esc(verified?.season==='2026-27'?'women-only verified ledger':updated?time(updated):'date unavailable')+' · Verified-source edition';
    document.getElementById('wbb-score-stamp').textContent=verified?.season==='2026-27'?
      'Verified women’s Division I scoreboard · current rolling window (not all school schedules)':
      updated?'Published game-feed snapshot: '+time(updated):'Published game-feed timestamp unavailable';
    const current=published.filter(g=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});return String(g.date||'').slice(0,10)===today;});
    const future=published.filter(g=>g.state!=='post'&&!/final/i.test(g.status||'')).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const finals=published.filter(g=>g.state==='post'||/final/i.test(g.status||'')).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
    document.getElementById('wbb-score-rail').innerHTML=(current.length?current:future.slice(0,6)).map(card).join('')||blank(entry?'No upcoming games in the current published window.':'A verified women’s game feed is not available.');
    document.getElementById('wbb-upcoming').innerHTML=future.slice(0,8).map(card).join('')||blank('No upcoming fixtures in the published window.');
    document.getElementById('wbb-recent').innerHTML=finals.slice(0,6).map(card).join('')||blank('No verified women’s finals in the current feed window.');
    const selectedId=new URLSearchParams(location.search).get('team');
    const teamGames=document.getElementById('wbb-team-games');
    if(teamGames&&selectedId){
      if(!calendarsLoaded){
        calendarsLoaded=true;
        const [schedules,evidence,scoreboardTV]=await Promise.all([
          get('data/ncaaw-schedules-2026-27.json'),
          get('data/ncaaw-2026-27-official-broadcast-overrides.json'),
          get('data/ncaaw-2026-27-scoreboard-broadcast-overlays.json')
        ]);
        fullCalendars=schedules;
        const broadcastRows=[
          ...(scoreboardTV?.season==='2026-27'&&scoreboardTV?.gender==='women'&&Array.isArray(scoreboardTV.rows)?scoreboardTV.rows:[]),
          ...(evidence?.season==='2026-27'&&evidence?.gender==='women'&&Array.isArray(evidence.rows)?evidence.rows:[])
        ];
        officialBroadcasts=new Map(broadcastRows.filter(x=>x.game_id&&x.broadcast&&x.source_url).map(x=>[String(x.game_id),x]));
      }
      const calendar=fullCalendars?.season==='2026-27'&&fullCalendars?.gender==='women'?
        fullCalendars.teams?.[selectedId]:null;
      const entries=calendar?.games||[];
      if(entries.length){
        teamGames.innerHTML='<h3>2026–27 Women’s Team Schedule · '+entries.length+' listed games</h3>'+
          '<p class="note wbb-calendar-disclosure">Source: women-specific team schedules. Official university/conference broadcasts are separately cited; other TV listings come from exact-matched ESPN women’s game feeds. Unlisted networks remain TBA. Full university schedule verification is ongoing.</p>'+
          '<div class="wbb-full-schedule"><table><thead><tr><th>Tipoff (ET)</th><th>Location</th><th>Opponent</th><th>Arena</th><th>Network</th><th>Result</th></tr></thead><tbody>'+
          entries.map(g=>{
            const t=wbbLookup.get(String(g.opponent_id));
            const official=officialBroadcasts.get(String(g.id));
            const tv=official?.broadcast||g.broadcast;
            const tvSource=official?.source_url||g.broadcast_source_url;
            const television=tv?(tvSource?'<a href="'+safeURL(tvSource)+'" target="_blank" rel="noopener noreferrer" title="Attributed TV schedule source">'+esc(tv)+' ↗</a>':esc(tv)):'TBA';
            const opponent=t?team({name:t.team,logo:t.logo,color:t.color}):esc(g.opponent||'Opponent TBA');
            const score=g.completed&&g.home_score!=null&&g.away_score!=null?
              esc(g.site==='away'?g.away_score+'–'+g.home_score:g.home_score+'–'+g.away_score):'—';
            return '<tr><td>'+time(g.date)+'</td><td>'+esc(g.site||'TBA')+'</td><td>'+opponent+'</td><td>'+esc(g.venue||'TBA')+
              '</td><td>'+television+'</td><td>'+score+'</td></tr>';
          }).join('')+'</tbody></table></div>'+
          '<a href="'+safeURL(calendar.source_url)+'" target="_blank" rel="noopener noreferrer">Season schedule source ↗</a>';
      }else{
        const all=published.filter(g=>(g.teams||[]).some(t=>String(t.team_id||t.id)===selectedId));
        teamGames.innerHTML='<h3>Recent and upcoming games</h3>'+
          (all.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).map(card).join('')||
            blank(calendar?.status==='source_error'?'University schedule retrieval is pending source recovery.':
              'No verified games are available for this team in the current feed window.'));
      }
    }
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
