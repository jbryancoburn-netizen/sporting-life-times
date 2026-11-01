/* SLT College Basketball live scorebugs and game center. Men and women isolated by sport. */
(function () {
  'use strict';
  const here=new URLSearchParams(location.search);
  const isStandalone=!!document.getElementById('cbb-center-root');
  const women=here.get('gender')==='women';
  const sport=women?'womens-college-basketball':'mens-college-basketball';
  const season='2026-27';
  const api='https://site.api.espn.com/apis/site/v2/sports/basketball/'+sport+'/';
  const root=document.getElementById('cbb-center-root');
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanURL=v=>{try{const u=new URL(v,location.href);return /^https?:$/.test(u.protocol)?esc(u.href):'';}catch{return '';}};
  const q=s=>document.querySelector(s);
  const etParts=d=>{const o={};for(const p of new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)){if(p.type!=='literal')o[p.type]=p.value;}return o.year+'-'+o.month+'-'+o.day;};
  const today=()=>etParts(new Date());
  function plusDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function localDate(s){const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Time TBA';}
  function dateLabel(s){return new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'});}
  const state={day:today(),games:[],selected:null,pending:false,source:'',lastUpdate:null,fallback:false,summaryCache:new Map(),crosswalk:new Map()};
  const tag=women?'Women':'Men';
  let mounted=false,interval=null;
  const fetchJSON=async path=>{try{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(10500)});return r.ok?await r.json():null;}catch{return null;}};
  const code=t=>String(t?.team?.abbreviation||t?.abbreviation||t?.team?.shortDisplayName||t?.name||'TEAM').slice(0,15);
  const image=t=>cleanURL(t?.team?.logos?.[0]?.href||t?.team?.logo||t?.logo||'');
  const teamName=t=>t?.team?.displayName||t?.team?.name||t?.name||'Team';
  const score=t=>{const v=t?.score;if(v==null)return null;const n=typeof v==='object'?(v.displayValue??v.value):v;return n===''?null:String(n);};
  function normalizeEvent(e){
    const c=e.competitions?.[0]||{};
    const teams=c.competitors||[];
    const away=teams.find(x=>x.homeAway==='away');
    const home=teams.find(x=>x.homeAway==='home');
    if(!away||!home||!e.id)return null;
    const status=e.status||{},st=status.type||{};
    const phase=st.state==='in'?'live':st.state==='post'?'final':'upcoming';
    return {id:String(e.id),date:e.date||c.date,away,home,phase,headline:st.shortDetail||st.detail||status.displayClock||'',
      clock:status.displayClock||'',period:status.period||0,venue:c.venue?.fullName||'',
      broadcast:(c.broadcasts||[]).flatMap(x=>x.names||[]).join(', '),
      url:cleanURL(e.links?.[0]?.href||''),neutral:!!c.neutralSite,source:'ESPN live',linescores:true};
  }
  function normalizeSnapshot(g){
    const teams=g.teams||[];
    const away=teams.find(t=>t.home_away==='away')||teams[0];
    const home=teams.find(t=>t.home_away==='home')||teams[1];
    if(!away||!home||!g.id)return null;
    function team(t){return {team:{id:String(t.id||''),displayName:t.name,abbreviation:t.name?.slice(0,3).toUpperCase(),logo:t.logo},score:t.score,homeAway:t.home_away};}
    const phase=g.state==='in'?'live':g.state==='post'?'final':'upcoming';
    // A published snapshot does not verify that a game is currently live.
    return {id:String(g.id),date:g.date,away:team(away),home:team(home),phase,headline:g.status||'Published fixture',venue:g.venue||'',broadcast:g.broadcast||'',url:cleanURL(g.url),source:'Published snapshot',linescores:false};
  }
  function fallbackEvents(data){
    const league=(data?.leagues||[]).find(x=>x.league===(women?"Women's College Basketball":"Men's College Basketball"));
    return (league?.games||[]).filter(g=>etParts(new Date(g.date))===state.day).map(normalizeSnapshot).filter(Boolean);
  }
  function currentView(g){
    if(g.phase==='live')return '<span class="cbb-live-pill"><span class="cbb-live-dot"></span>LIVE</span> '+esc(g.headline||('Period '+g.period));
    if(g.phase==='final')return '<strong class="cbb-final">FINAL</strong> '+esc(g.headline||'');
    return 'UPCOMING · '+esc(localDate(g.date));
  }
  function schoolLink(t){
    const id=String(t?.team?.id||'');
    if(!id)return '';
    const canonical=state.crosswalk.get(id);
    if(women)return 'ncaaw-team.html?team='+encodeURIComponent(id);
    return canonical?'ncaam-team.html?team='+encodeURIComponent(canonical):'';
  }
  function crest(t){
    const id=String(t?.team?.id||'');
    const n=teamName(t);
    // Use the exact shared NCAA school artwork and existing two-color ring contract.
    if(id&&window.MBBLogos?.byESPN)return window.MBBLogos.byESPN(id,'score',n);
    const src=image(t);
    return '<span class="cbb-fallback-crest">'+(src?'<img src="'+src+'" alt="" loading="lazy">':'<span>'+esc(code(t).slice(0,2))+'</span>')+'</span>';
  }
  function row(t,phase,winning){
    const s=phase==='upcoming'?'—':score(t)??'—';
    const link=schoolLink(t);
    const mark='<span class="cbb-team-identity">'+crest(t)+'<span class="cbb-name"><b>'+esc(code(t))+'</b><small>'+esc(teamName(t))+'</small></span></span>';
    return '<div class="cbb-scorebug-row'+(winning?' cbb-winner':'')+'">'+(link?'<a href="'+link+'" class="cbb-team-link">'+mark+'</a>':mark)+
      '<strong class="cbb-points" aria-label="'+esc(teamName(t))+' score">'+esc(s)+'</strong></div>';
  }
  function scorebug(g){
    const as=Number(score(g.away)),hs=Number(score(g.home));
    const winner=g.phase==='final'&&score(g.away)!=null&&score(g.home)!=null&&as!==hs;
    const awayWin=winner&&as>hs,homeWin=winner&&hs>as;
    return '<article class="cbb-game-card cbb-'+g.phase+'">'+
      '<div class="cbb-bug-top">'+currentView(g)+'</div>'+
      row(g.away,g.phase,awayWin)+row(g.home,g.phase,homeWin)+
      '<div class="cbb-bug-bottom"><span>'+esc(g.broadcast||g.venue||'College basketball')+'</span>'+
      '<button type="button" class="cbb-box-btn" data-cbb-open="'+esc(g.id)+'">STATS & BOX SCORE ↗</button></div>'+
      '</article>';
  }
  function centerURL(){return 'cbb-game-center.html'+(women?'?gender=women':'');}
  function createShell(){
    if(mounted)return true;
    const old=isStandalone?root:q(women?'#wbb-score-rail':'#score-rail');
    if(!old)return false;
    const host=document.createElement('section');host.id='cbb-live-desk';host.className='cbb-live-desk';
    host.innerHTML='<div class="cbb-desk-header"><div><div class="cbb-kicker">THE SPORTING LIFE & TIMES · '+tag.toUpperCase()+'’S DIVISION I</div>'+
      '<h2>Game Center <span class="cbb-desk-sub">Scorebugs · Live Scores · Box Scores</span></h2></div>'+
      '<a class="cbb-center-link" href="'+centerURL()+'">FULL GAME CENTER ↗</a></div>'+
      '<div class="cbb-date-controls"><button type="button" data-cbb-date="-1" aria-label="Previous day">‹</button>'+
      '<label class="cbb-date-label" for="cbb-day-picker">Games for <input id="cbb-day-picker" type="date" value="'+esc(state.day)+'"></label>'+
      '<button type="button" data-cbb-date="1" aria-label="Next day">›</button>'+
      '<button type="button" class="cbb-today-btn" data-cbb-today>Today</button>'+
      '<button type="button" class="cbb-refresh-btn" data-cbb-refresh>↻ Refresh</button></div>'+
      '<p class="cbb-source-stamp" id="cbb-source-stamp" aria-live="polite">Checking ESPN’s current game feed…</p>'+
      '<div class="cbb-cards" id="cbb-cards"><p class="cbb-loading">Checking game data…</p></div>'+
      '<section class="cbb-detail" id="cbb-detail" hidden aria-live="polite"></section>';
    if(isStandalone)old.appendChild(host);
    else old.parentNode.insertBefore(host,old);
    host.addEventListener('click',function(e){
      const open=e.target.closest('[data-cbb-open]');
      if(open){openDetails(open.dataset.cbbOpen);return;}
      const shift=e.target.closest('[data-cbb-date]');
      if(shift){state.day=plusDays(state.day,Number(shift.dataset.cbbDate));syncPicker();refresh();return;}
      if(e.target.closest('[data-cbb-today]')){state.day=today();syncPicker();refresh();return;}
      if(e.target.closest('[data-cbb-refresh]')){refresh();return;}
      if(e.target.closest('[data-cbb-close]')){state.selected=null;q('#cbb-detail').hidden=true;return;}
    });
    host.querySelector('#cbb-day-picker').addEventListener('change',function(){if(/^\d{4}-\d{2}-\d{2}$/.test(this.value)){state.day=this.value;refresh();}});
    mounted=true;return true;
  }
  function syncPicker(){if(q('#cbb-day-picker'))q('#cbb-day-picker').value=state.day;}
  async function fallback(){
    const [snap,live,verified,registry]=await Promise.all([
      fetchJSON('multi_scoreboards.json'),
      !women?fetchJSON('data/mbb-live.json'):Promise.resolve(null),
      women?fetchJSON('data/ncaaw-2026-27-games.json'):Promise.resolve(null),
      women?fetchJSON('data/ncaaw-2026-27-retro-primary.json'):Promise.resolve(null)
    ]);
    const found=fallbackEvents(snap);
    if(found.length)return found;
    if(women&&verified?.season===season&&registry?.season===season&&registry.gender==='women'){
      const teams=new Map((registry.rankings||[]).map(t=>[String(t.team_id),t]));
      return [...(verified.finals||[]),...(verified.upcoming||[])].filter(g=>etParts(new Date(g.date))===state.day).map(g=>{
        const a=teams.get(String(g.away_id)),h=teams.get(String(g.home_id));
        if(!a||!h)return null;
        const convert=(t,side,score)=>({team:{id:String(t.team_id),displayName:t.team,abbreviation:t.team.split(' ').slice(0,2).map(x=>x[0]).join(''),logo:t.logo},homeAway:side,score});
        return {id:String(g.id),date:g.date,away:convert(a,'away',g.away_score),home:convert(h,'home',g.home_score),
          phase:g.status==='final'?'final':'upcoming',headline:g.status==='final'?'Final':'Scheduled',
          venue:g.venue||'',broadcast:g.broadcast||'',url:cleanURL(g.source_url||''),source:'Verified women-only schedule'};
      }).filter(Boolean);
    }
    if(!women&&Array.isArray(live?.games)){
      return live.games.filter(x=>etParts(new Date(x.date))===state.day).map(g=>{
        const match=(snap?.leagues||[]).flatMap(x=>x.games||[]).find(x=>String(x.id)===String(g.id));
        return normalizeSnapshot(match||g);
      }).filter(Boolean);
    }
    return [];
  }
  async function refresh(){
    if(!createShell()||state.pending)return;
    state.pending=true;
    const active=state.selected;
    const date=state.day.replaceAll('-','');
    const data=await fetchJSON(api+'scoreboard?groups=50&limit=1000&dates='+date);
    let games=Array.isArray(data?.events)?data.events.map(normalizeEvent).filter(Boolean):null;
    if(games?.length){state.source='ESPN current scoreboard';state.fallback=false;}
    else{games=await fallback();state.source='Local published scoreboard snapshot · not confirmed live';state.fallback=true;}
    if(!mounted){state.pending=false;return;}
    state.games=games.sort((a,b)=>{
      const order={live:0,upcoming:1,final:2};
      return order[a.phase]-order[b.phase]||Date.parse(a.date)-Date.parse(b.date);
    });
    state.lastUpdate=new Date();
    const result=q('#cbb-cards'),stamp=q('#cbb-source-stamp');
    if(result)result.innerHTML=games.length?state.games.map(scorebug).join(''):
      '<p class="cbb-empty">No '+tag.toLowerCase()+'’s Division I games are listed for '+esc(dateLabel(state.day))+'. Try another date.</p>';
    if(stamp)stamp.textContent=(state.fallback?'SNAPSHOT — not live. ':'')+state.source+' · '+dateLabel(state.day)+
      ' · checked '+state.lastUpdate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET'+
      (state.fallback?' · Live stats require ESPN connectivity.':' · Auto-refresh every 30 seconds.');
    // Do not hide the original until this desk has a real scoreboard or a valid fallback.
    const original=q(women?'#wbb-score-rail':'#score-rail');
    if(original&&games.length)original.hidden=true;
    else if(original)original.hidden=false;
    if(active&&state.games.some(g=>g.id===active))await openDetails(active,true);
    else if(active){state.selected=null;const detail=q('#cbb-detail');if(detail)detail.hidden=true;}
    state.pending=false;
  }
  function statsPairs(g,summary){
    const sections=summary?.boxscore?.teams||[];
    const list=['fieldGoalPct','threePointFieldGoalPct','freeThrowPct','totalRebounds','assists','turnovers','steals','blocks'];
    const wanted=[['fieldGoalPct','FG%'],['threePointFieldGoalPct','3PT%'],['freeThrowPct','FT%'],['totalRebounds','REB'],['assists','AST'],['turnovers','TO'],['steals','STL'],['blocks','BLK']];
    const findTeam=id=>sections.find(x=>String(x.team?.id)===String(id));
    const a=findTeam(g.away.team?.id),h=findTeam(g.home.team?.id);
    if(!a||!h)return '';
    const toMap=x=>new Map((x?.statistics||[]).map(s=>[s.name||s.abbreviation,s.displayValue??s.value]));
    const am=toMap(a),hm=toMap(h);
    const rows=wanted.map(([key,label])=>{
      const one=am.get(key),two=hm.get(key);
      if(one==null||two==null)return '';
      return '<div class="cbb-stat-line"><span>'+esc(one)+'</span><b>'+label+'</b><span>'+esc(two)+'</span></div>';
    }).filter(Boolean);
    return rows.length?'<div class="cbb-box-section"><h4>Team Statistics</h4><div class="cbb-stat-head"><span>'+esc(code(g.away))+'</span><span>'+esc(code(g.home))+'</span></div>'+rows.join('')+'</div>':'';
  }
  function periodTable(g,summary){
    const competitors=summary?.header?.competitions?.[0]?.competitors||[];
    const find=id=>competitors.find(x=>String(x.id||x.team?.id)===String(id));
    const away=find(g.away.team?.id),home=find(g.home.team?.id);
    const ap=away?.linescores||[],hp=home?.linescores||[];
    if(!ap.length||!hp.length)return '';
    const count=Math.max(ap.length,hp.length);
    const cols=Array.from({length:count},(_,i)=>'<th>'+(i<2?'H'+(i+1):'OT'+(i-1))+'</th>').join('');
    const cells=team=>Array.from({length:count},(_,i)=>'<td>'+esc(team?.linescores?.[i]?.displayValue??team?.linescores?.[i]?.value??'—')+'</td>').join('');
    return '<div class="cbb-box-section"><h4>Period by Period</h4><div class="cbb-scroll"><table class="cbb-box-table"><thead><tr><th>Team</th>'+cols+'<th>TOT</th></tr></thead><tbody>'+
      '<tr><th>'+esc(code(g.away))+'</th>'+cells(away)+'<td>'+esc(score(g.away)??'—')+'</td></tr>'+
      '<tr><th>'+esc(code(g.home))+'</th>'+cells(home)+'<td>'+esc(score(g.home)??'—')+'</td></tr></tbody></table></div></div>';
  }
  function players(summary){
    const blocks=summary?.boxscore?.players||[];
    return blocks.map(b=>{
      const label=b.team?.displayName||'Player statistics';
      const source=b.statistics?.[0];
      const labels=source?.labels||[];
      const rows=source?.athletes||[];
      if(!rows.length||!labels.length)return '';
      // ESPN statistics are returned as a label array matched to each athlete's stats array.
      const displayLabels=labels.slice(0,14);
      const eligible=rows.filter(x=>Array.isArray(x.stats)&&x.athlete?.displayName);
      const pts=labels.findIndex(x=>x==='PTS'),reb=labels.findIndex(x=>x==='REB'),ast=labels.findIndex(x=>x==='AST');
      eligible.sort((a,b)=>Number(b.stats?.[pts]||0)-Number(a.stats?.[pts]||0));
      const allCols=labels.map((x,i)=>({x,i})).filter(({x})=>['MIN','PTS','REB','AST','FG','3PT','FT','STL','BLK','TO'].includes(x));
      const cols=allCols.length?allCols:displayLabels.map((x,i)=>({x,i}));
      const heading=cols.map(c=>'<th>'+esc(c.x)+'</th>').join('');
      const body=eligible.slice(0,12).map(p=>'<tr><th>'+esc(p.athlete.displayName)+'</th>'+cols.map(c=>'<td>'+esc(p.stats[c.i]??'—')+'</td>').join('')+'</tr>').join('');
      const leaders=eligible.slice(0,3).map(p=>esc(p.athlete.displayName)+' '+(pts<0?'':esc(p.stats[pts]??'—')+' PTS')+
        (reb<0?'':' · '+esc(p.stats[reb]??'—')+' REB')+(ast<0?'':' · '+esc(p.stats[ast]??'—')+' AST')).join('<br>');
      return '<div class="cbb-box-section"><h4>'+esc(label)+' · Player Box Score</h4>'+
        (leaders?'<p class="cbb-leaders">'+leaders+'</p>':'')+
        '<div class="cbb-scroll"><table class="cbb-box-table"><thead><tr><th>Player</th>'+heading+'</tr></thead><tbody>'+body+'</tbody></table></div></div>';
    }).filter(Boolean).join('');
  }
  async function openDetails(id,silent){
    const g=state.games.find(x=>x.id===String(id));
    if(!g)return;
    state.selected=g.id;
    const node=q('#cbb-detail');
    if(!node)return;
    node.hidden=false;
    node.innerHTML='<div class="cbb-detail-head"><div class="cbb-kicker">GAME BOOK · '+tag.toUpperCase()+'’S DIVISION I</div><button type="button" data-cbb-close aria-label="Close box score">✕ Close</button></div>'+
      '<h3>'+esc(teamName(g.away))+' at '+esc(teamName(g.home))+'</h3>'+
      '<p class="cbb-detail-meta">'+currentView(g)+' · '+esc(g.venue||'Venue not available')+
      (g.broadcast?' · '+esc(g.broadcast):'')+'</p><p class="cbb-loading">Checking verified game statistics…</p>';
    if(!silent)node.scrollIntoView({behavior:'smooth',block:'nearest'});
    let s=state.summaryCache.get(g.id);
    // Live games always request fresh box scores. Cache only finals/pregame briefly.
    if(!s||g.phase==='live'||Date.now()-s.at>180000){
      const data=await fetchJSON(api+'summary?event='+encodeURIComponent(g.id));
      s={at:Date.now(),data};
      state.summaryCache.set(g.id,s);
    }
    if(state.selected!==g.id)return;
    const details=s?.data;
    const parts=[periodTable(g,details),statsPairs(g,details),players(details)].filter(Boolean);
    const external=g.url||'https://www.espn.com/'+sport+'/game/_/gameId/'+encodeURIComponent(g.id);
    const link='<p class="cbb-provider-link"><a href="'+cleanURL(external)+'" target="_blank" rel="noopener noreferrer">Official game feed at ESPN ↗</a></p>';
    node.innerHTML='<div class="cbb-detail-head"><div class="cbb-kicker">GAME BOOK · '+tag.toUpperCase()+'’S DIVISION I</div>'+
      '<button type="button" data-cbb-close aria-label="Close box score">✕ Close</button></div>'+
      '<h3>'+esc(teamName(g.away))+' at '+esc(teamName(g.home))+'</h3>'+
      '<p class="cbb-detail-meta">'+currentView(g)+' · '+esc(g.venue||'Venue not available')+
      (g.broadcast?' · '+esc(g.broadcast):'')+'</p>'+
      '<div class="cbb-detail-score">'+row(g.away,g.phase,false)+row(g.home,g.phase,false)+'</div>'+
      (parts.length?'<div class="cbb-stats-grid">'+parts.join('')+'</div>':
      '<p class="cbb-empty">'+(g.phase==='upcoming'?'The game has not started. Live player and team statistics will appear when the provider posts them.':
      'The provider has not supplied an accessible statistical box score for this game yet. No figures have been estimated.')+'</p>')+
      link;
  }
  async function boot(){
    if(window.MBBLogos?.ready)await Promise.race([window.MBBLogos.ready,new Promise(ok=>setTimeout(ok,4500))]);
    if(!women){const d=await fetchJSON('data/ncaam-2026-27-espn-team-crosswalk.json');
      for(const t of d?.teams||[])state.crosswalk.set(String(t.espn_id),String(t.id));}
    let tries=0;
    const start=()=>{
      if(createShell()){refresh();interval=setInterval(()=>{if(!document.hidden)refresh();},30000);return;}
      if(tries++<30)setTimeout(start,400);
    };
    start();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mounted)refresh();});
  }
  boot();
})();