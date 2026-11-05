/* SLT College Basketball live scorebugs and game center. Men and women isolated by sport. */
(function () {
  'use strict';
  const here=new URLSearchParams(location.search);
  const isStandalone=!!document.getElementById('cbb-center-root');
  const isGamefile=!!document.getElementById('cbb-gamefile-root');
  const women=here.get('gender')==='women';
  const sport=women?'womens-college-basketball':'mens-college-basketball';
  const season='2026-27';
  const api='https://site.api.espn.com/apis/site/v2/sports/basketball/'+sport+'/';
  const root=document.getElementById('cbb-center-root');
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Keep provider metadata for internal reconciliation, but make the newspaper
  // source language provider-neutral at its rendering boundary.
  const publicSource=v=>String(v||'').replace(/\bESPN\b/gi,'secondary feed');
  const cleanURL=v=>{if(typeof v!=='string'||!v.trim())return '';try{const u=new URL(v,location.href);return /^https?:$/.test(u.protocol)?esc(u.href):'';}catch{return '';}};
  const q=s=>document.querySelector(s);
  const etParts=d=>{const o={};for(const p of new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)){if(p.type!=='literal')o[p.type]=p.value;}return o.year+'-'+o.month+'-'+o.day;};
  const today=()=>etParts(new Date());
  function plusDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function localDate(s){if(!s)return 'Tipoff TBA';const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Time TBA';}
  function dateLabel(s){return new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'});}
  const state={day:(/^\d{4}-\d{2}-\d{2}$/.test(here.get('day')||'')?here.get('day'):today()),games:[],section:'summary',selected:(/^\d+$/.test(here.get('game')||'')?here.get('game'):null),pending:false,source:'',lastUpdate:null,fallback:false,summaryCache:new Map(),crosswalk:new Map(),schoolNames:new Map(),filter:'all',generation:0,ratings:new Map(),forecast:new Map(),ratingsReady:false,modelDate:null,preseason:false,forecastDate:null,poll:new Map(),pollDate:null,expanded:new Set(),expandedDay:null,inlineTabs:new Map(),inlineRequests:new Map(),rankTies:new Map()};
  const tag=women?'Women':'Men';
  const display=women?'WOMEN’S DIVISION I':'MEN’S DIVISION I';
  const gameLink=(g)=>'cbb-gamefile.html?'+(women?'gender=women&':'')+'day='+encodeURIComponent(state.day)+'&game='+encodeURIComponent(g.id);
  const backLink=()=> 'cbb-game-center.html'+(women?'?gender=women&day='+encodeURIComponent(state.day):'?day='+encodeURIComponent(state.day));
  let mounted=false,interval=null;
  const fetchJSON=async path=>{try{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(10500)});return r.ok?await r.json():null;}catch{return null;}};
  // School-first identity: the curated NCAA/ESPN crosswalk is keyed by exact
  // ESPN school ID. Never create first-letter abbreviations from a fixture.
  const fullSchool=s=>String(s||'').trim().replace(/\bSt\.$/,'State');
  const schoolLabel=t=>{
    const id=String(t?.team?.id||'');
    const canonical=state.schoolNames.get(id);
    if(canonical)return canonical;
    const fromLogo=!women?window.MBBLogos?.schoolNameForESPN?.(id):'';
    if(fromLogo)return fullSchool(fromLogo);
    const short=String(t?.team?.shortDisplayName||t?.team?.location||'').trim();
    if(short.length>2&&!/^[A-Z]{1,2}$/.test(short))return fullSchool(short);
    return fullSchool(t?.team?.displayName||t?.team?.name||t?.name||'School not listed');
  };
  const code=t=>schoolLabel(t);
  const mascotLabel=t=>{
    const full=String(t?.team?.displayName||t?.team?.name||'').trim();
    const school=schoolLabel(t),id=String(t?.team?.id||'');
    if(school==='Queens (NC)'&&/^Queens University Royals$/i.test(full))return 'Royals';
    const nickname=full.toLowerCase().startsWith(school.toLowerCase())?
      full.slice(school.length).trim():'';
    return nickname||(!full.toLowerCase().includes(school.toLowerCase())?full:'');
  };
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
    return {id:String(e.id),espnId:String(e.id),date:e.date||c.date,away,home,phase,headline:st.shortDetail||st.detail||status.displayClock||'',
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
    const phase=g.state==='post'?'final':'upcoming';
    // A stale published snapshot must never be presented as a verified live score.
    return {id:String(g.id),date:g.date,away:team(away),home:team(home),phase,headline:g.status||'Published fixture',venue:g.venue||'',broadcast:g.broadcast||'',url:cleanURL(g.url),source:'Published snapshot',linescores:false};
  }
  function fallbackEvents(data){
    const league=(data?.leagues||[]).find(x=>x.league===(women?"Women's College Basketball":"Men's College Basketball"));
    return (league?.games||[]).filter(g=>etParts(new Date(g.date))===state.day).map(normalizeSnapshot).filter(Boolean);
  }
  function currentView(g){
    if(g.phase==='live')return '<span class="cbb-live-pill">LIVE</span> '+esc(g.headline||('Period '+g.period));
    if(g.phase==='final')return '<strong class="cbb-final">FINAL</strong>';
    if(!g.date)return 'Tipoff time TBA';
    return esc(localDate(g.date));
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
    if(id&&window.MBBLogos?.byESPN){
      const standard=window.MBBLogos.byESPN(id,'score',n);
      if(standard&&!standard.includes('mbb-mark--missing'))return standard;
    }
    const src=image(t);
    const valid=x=>/^[0-9a-fA-F]{6}$/.test(String(x||'').replace(/^#/,''));
    const primary=valid(t?.team?.color)?'#'+t.team.color.replace(/^#/,''):'#194854';
    let secondary=valid(t?.team?.alternateColor)?'#'+t.team.alternateColor.replace(/^#/,''):'#5c8395';
    if(secondary.toLowerCase()===primary.toLowerCase()||secondary.toLowerCase()==='#ffffff')secondary='#5c8395';
    // Outsider/exhibition opponents use the same bounded two-ring component as D-I.
    // Never render an unstyled, intrinsic-size source image inside a scorebug.
    return '<span class="mbb-mark mbb-mark--score'+(src?'':' mbb-mark--missing')+'" style="--mbb-primary:'+esc(primary)+';--mbb-secondary:'+esc(secondary)+'" data-ring-count="2" role="img" aria-label="'+esc(n)+' logo">'+
      '<span class="mbb-mark__initials" aria-hidden="true">'+esc(code(t).slice(0,2))+'</span>'+
      (src?'<img class="mbb-mark__img" src="'+esc(src)+'" alt="" loading="lazy" decoding="async" onerror="window.MBBLogos&&window.MBBLogos.fail(this)">':'')+'</span>';
  }
  const safeTeamColor=t=>{
    const raw=String(t?.team?.color||'').replace(/^#/,'');
    const branded=window.MBBLogos?.colorForESPN?.(t?.team?.id);
    if(/^#[0-9a-fA-F]{6}$/.test(branded?.primary||''))return branded.primary;
    if(/^[a-f\d]{6}$/i.test(raw)&&raw.toLowerCase()!=='ffffff')return '#'+raw;
    return '#294650';
  };
  function summaryStats(g){
    const raw=state.summaryCache.get(g.id)?.data;
    if(!raw||g.phase==='upcoming'||g.disputed||g.statsDisputed)return '';
    const teams=raw.boxscore?.teams||[];
    const teamStats=id=>{
      const t=teams.find(x=>String(x.team?.id)===String(id));
      return new Map((t?.statistics||[]).flatMap(st=>[
        [String(st.name||'').toLowerCase(),st.displayValue??st.value],
        [String(st.abbreviation||'').toLowerCase(),st.displayValue??st.value]
      ]));
    };
    const a=teamStats(g.away.team?.id),h=teamStats(g.home.team?.id);
    const selections=[
      ['FG%', ['fieldgoalpct','fg%','fg pct','field goal percentage']],
      ['3PT', ['threepointfieldgoalpct','3p%','3pt%','three point percentage']],
      ['REB', ['totalrebounds','reb','rebounds']]
    ];
    function pick(map,aliases){for(const k of aliases){if(map.has(k)&&map.get(k)!=null)return String(map.get(k));}return null;}
    const metrics=selections.flatMap(([label,aliases])=>{
      const one=pick(a,aliases),two=pick(h,aliases);
      return one===null||two===null?[]:['<span class="cbb-micro-stat"><b>'+esc(one)+'</b><small>'+label+'</small><b>'+esc(two)+'</b></span>'];
    });
    const ptsLeaders=(raw.boxscore?.players||[]).flatMap(group=>{
      const source=(group.statistics||[]).find(x=>x.labels?.includes('PTS'));
      if(!source)return [];
      const index=source.labels.indexOf('PTS');
      const rows=(source.athletes||[]).filter(x=>Array.isArray(x.stats)&&x.athlete?.displayName&&Number.isFinite(Number(x.stats[index])));
      if(!rows.length)return [];
      const lead=rows.reduce((best,x)=>Number(x.stats[index])>Number(best.stats[index])?x:best);
      return [{id:String(group.team?.id||''),name:lead.athlete.displayName,pts:lead.stats[index]}];
    });
    const leaders=ptsLeaders.filter(p=>p.id===String(g.away.team?.id)||p.id===String(g.home.team?.id))
      .sort((p,z)=>Number(z.pts)-Number(p.pts)).slice(0,2);
    if(!metrics.length&&!leaders.length)return '';
    return '<div class="cbb-micro-wrap">'+
      (metrics.length?'<div class="cbb-micro-statline" aria-label="Team stats, away then home">'+metrics.join('')+'</div>':'')+
      (leaders.length?'<div class="cbb-leader-ticker"><span>TOP SCORERS</span>'+
      leaders.map(p=>'<b>'+esc(p.name)+' <em>'+esc(p.pts)+' PTS</em></b>').join('<i aria-hidden="true">·</i>')+'</div>':'')+
      '</div>';
  }
  function teamRating(t){return state.ratings.get(String(t?.team?.id||''))||null;}
  function apRank(t){return women?null:state.poll.get(String(t?.team?.id||''))?.ap||null;}
  function modelFor(g){
    const a=teamRating(g.away),h=teamRating(g.home);
    if(!a||!h||!state.ratingsReady)return null;
    const base={away:a,home:h,available:!state.preseason,asOf:state.modelDate};
    // A 1500 clean slate is a tie, not a preseason rating-derived favorite.
    if(state.preseason&&women)return {...base,available:false,reason:'Both schools start at 1500 Elo'};
    // Men's equal-start ratings yield 50/50 on neutral courts; venue adjustments remain provisional.
    if(women)return base; // Women's independently calibrated forecast probabilities are not yet published.
    // Men's Game Center uses current published RETRO ratings, never a stale
    // separately calculated fixture-feed probability. Neutral court is explicit.
    const prediction=window.RETROForecast?.predict(h,a,{site:g.neutral?'neutral':'home'});
    if(!prediction)return base;
    return {...base,probability:prediction.homeProbability,asOf:state.modelDate,
      forecastModel:prediction.model,venueStatus:g.neutral?'neutral':'listed-home'};
  }
  function usrsLine(g){
    const m=modelFor(g);
    if(!m)return '';
    const a=Math.round(Number(m.away.elo)),h=Math.round(Number(m.home.elo));
    if(!Number.isFinite(a)||!Number.isFinite(h))return '';
    let pct='';
    if(Number.isFinite(m.probability)){
      const favor=m.probability>=.5?g.home:g.away;
      const prob=m.probability>=.5?m.probability:1-m.probability;
      pct='<strong class="cbb-model-favorite">'+esc(code(favor))+' '+Math.round(prob*100)+'% pregame</strong>';
    }
    return '<div class="cbb-usrs-module"><div class="cbb-usrs-title"><b>RETRO</b><span>INDEPENDENT ELO'+(state.preseason?' · CLEAN SLATE':' · MODEL')+'</span></div>'+
      '<div class="cbb-usrs-values"><span>'+esc(code(g.away))+' <strong>'+a+'</strong></span>'+
      '<i aria-hidden="true">↔</i><span>'+esc(code(g.home))+' <strong>'+h+'</strong></span></div>'+
      (pct?'<div class="cbb-usrs-odds">'+pct+'<small>PRE-GAME PROJECTION · NOT LIVE ODDS</small></div>':
        '<div class="cbb-usrs-odds"><small>'+(state.preseason?'NO POWER EDGE UNTIL VERIFIED FINALS':'NO VERIFIED GAME PROBABILITY')+'</small></div>')+'</div>';
  }
  function gameEditorial(g){
    if(g.disputed)return 'Independent source feeds report different final scores. The score is withheld pending reconciliation.';
    const as=score(g.away),hs=score(g.home);
    const away=teamName(g.away),home=teamName(g.home),when=localDate(g.date);
    const p=g.phase;
    if(p==='upcoming'){
      if(g.neutral&&g.venue)return 'Neutral court · '+g.venue+' · '+when+'.';
      if(g.broadcast)return 'Next tipoff: '+away+' at '+home+' · '+when+' · '+g.broadcast+'.';
      return 'Matchup file: '+away+' at '+home+' · '+when+'.';
    }
    if(as==null||hs==null)return p==='final'?'Final reported; verified scores are pending.':'Live game in progress. Awaiting verified score data.';
    const x=Number(as),y=Number(hs);
    if(!Number.isFinite(x)||!Number.isFinite(y))return 'Game in progress; a validated score is not available.';
    const margin=Math.abs(x-y),leader=x>y?away:y>x?home:'';
    if(p==='final')return leader?leader+' wins by '+margin+' · '+Math.max(x,y)+'–'+Math.min(x,y)+'.':
      away+' and '+home+' finish level in the provider feed; final outcome under review.';
    if(x===y)return 'Level at '+x+'–'+y+' · '+(g.headline||'live period')+'.';
    return leader+' leads by '+margin+' · '+Math.max(x,y)+'–'+Math.min(x,y)+(g.headline?' · '+g.headline:'')+'.';
  }
  function statEditorial(g){
    if(g.disputed)return '';
    const raw=state.summaryCache.get(g.id)?.data;
    const a=raw?.boxscore?.teams?.find(x=>String(x.team?.id)===String(g.away.team?.id));
    const h=raw?.boxscore?.teams?.find(x=>String(x.team?.id)===String(g.home.team?.id));
    function metric(team,names){
      const rows=team?.statistics||[];
      for(const name of names){const s=rows.find(x=>String(x.name||x.abbreviation||'').toLowerCase()===name);
        if(s){const v=Number(String(s.displayValue??s.value??'').replaceAll(',',''));if(Number.isFinite(v))return v;}
      }
      return null;
    }
    const ar=metric(a,['totalrebounds','reb']),hr=metric(h,['totalrebounds','reb']);
    if(ar!==null&&hr!==null&&Math.abs(ar-hr)>=4){
      const side=ar>hr?g.away:g.home;
      return teamName(side)+' leads the rebounding battle '+Math.max(ar,hr)+'–'+Math.min(ar,hr)+
        ' ('+Math.abs(ar-hr)+' more boards).';
    }
    return '';
  }
  // Display only corroborated, source-reported box totals; never fabricate
  // percentages or fill absent categories with zero.
  function gamefileStatStrip(g,raw){
    if(g.disputed||g.statsDisputed||g.phase==='upcoming')return '';
    const official=g.certifiedTeamBox;
    const teams=raw?.boxscore?.teams||[];
    const lookup=(id)=>teams.find(x=>String(x.team?.id)===String(id));
    const get=(t,names)=>{if(!t)return null;for(const name of names){
      const row=(t.statistics||[]).find(x=>String(x.name||x.abbreviation||'').toLowerCase()===name);
      if(row){const value=String(row.displayValue??row.value??'').trim();if(value&&value!=='--')return value;}
    }return null;};
    const items=[
      ['REB','reb',['totalrebounds','reb','rebounds']],
      ['FG%','fgPct',['fieldgoalpct','fg%','field goal percentage']],
      ['3PT%','threePct',['threepointfieldgoalpct','3p%','3pt%']],
      ['TO','tov',['turnovers','to']],
      ['AST','ast',['assists','ast']],
      ['FOULS','pf',['fouls','personal fouls','pf']]
    ];
    const metrics=items.flatMap(([label,key,aliases])=>{
      let a=null,h=null;
      if(official?.away&&official?.home){
        const format=(side)=>{
          if(key==='fgPct'&&side.fgm!=null&&Number(side.fga)>0)return (100*Number(side.fgm)/Number(side.fga)).toFixed(1)+'%';
          if(key==='threePct'&&side.tpm!=null&&Number(side.tpa)>0)return (100*Number(side.tpm)/Number(side.tpa)).toFixed(1)+'%';
          return side[key]==null?null:String(side[key]);
        };
        a=format(official.away);h=format(official.home);
      }else{
        a=get(lookup(g.away.team?.id),aliases);h=get(lookup(g.home.team?.id),aliases);
      }
      if(a===null||h===null||!a||!h)return [];
      if(key==='fgPct'||key==='threePct'){
        if(/^\d+(?:\.\d+)?$/.test(a))a+='%';
        if(/^\d+(?:\.\d+)?$/.test(h))h+='%';
      }
      return ['<div class="cbb-gamefile-stat"><span class="cbb-gamefile-stat-label">'+label+'</span>'+
        '<span class="cbb-gamefile-stat-values"><b>'+esc(a)+'</b><i>–</i><b>'+esc(h)+'</b></span></div>'];
    });
    if(!metrics.length)return '';
    return '<section class="cbb-gamefile-stats" aria-label="Verified game statistics"><div class="cbb-gamefile-stats-key">'+
      '<span>'+esc(code(g.away))+'</span><strong>GAME NUMBERS</strong><span>'+esc(code(g.home))+'</span></div>'+
      '<div class="cbb-gamefile-stats-grid">'+metrics.join('')+'</div>'+
      '<p>Team totals: '+(official?'NCAA-origin verified data':'attributed game box score')+'. Values in '+esc(code(g.away))+'–'+esc(code(g.home))+' order.</p></section>';
  }
  function storyNote(g){
    const note=statEditorial(g)||gameEditorial(g);
    const label=g.phase==='upcoming'?'THE MATCHUP FILE':g.phase==='final'?'FINAL LEDGER':'LIVE NOTEBOOK';
    return '<div class="cbb-story-note"><span>'+label+'</span><p>'+esc(note)+'</p></div>';
  }
  function radarBar(games){
    const live=games.filter(x=>x.phase==='live'),final=games.filter(x=>x.phase==='final');
    const close=live.filter(x=>score(x.away)!=null&&score(x.home)!=null&&Math.abs(Number(score(x.away))-Number(score(x.home)))<=5);
    const ranked=women?[]:games.filter(x=>apRank(x.away)||apRank(x.home));
    const conference=games.filter(x=>{
      const a=teamRating(x.away),h=teamRating(x.home);
      return a?.conference&&h?.conference&&a.conference===h.conference&&x.away.team.id!==x.home.team.id;
    });
    const upset=live.filter(x=>{
      const m=modelFor(x);
      if(!Number.isFinite(m?.probability)||score(x.away)==null||score(x.home)==null)return false;
      const favorHome=m.probability>.65,favorAway=m.probability<.35;
      return favorHome?Number(score(x.home))<Number(score(x.away)):
             favorAway?Number(score(x.away))<Number(score(x.home)):false;
    });
    return '<div class="cbb-radar" aria-label="The Courtside Desk watchlist">'+
      '<div class="cbb-radar-title">ON THE RADAR <span>LIVE DESK SIGNALS</span></div>'+
      '<div class="cbb-radar-metrics">'+
      '<div><strong>'+live.length+'</strong><span>ON THE FLOOR</span></div>'+
      '<div><strong>'+close.length+'</strong><span>LIVE · ≤5 PTS</span></div>'+
      '<div><strong>'+conference.length+'</strong><span>CONFERENCE GAMES</span></div>'+
      '<div><strong>'+upset.length+'</strong><span>RETRO UPSET WATCH</span></div>'+      (women?'':'<div><strong>'+ranked.length+'</strong><span>AP TOP 25 GAMES</span></div>')+
      '</div><p>Watch counts use current sourced scores and identified conference memberships. Upset watch requires a valid pregame model forecast.</p></div>';
  }
  function toLetterpressTeam(t,g){
    const profile=teamRating(t),id=String(t.team?.id||'');
    const record=profile&&Number.isInteger(Number(profile.wins))&&Number.isInteger(Number(profile.losses))?
      Number(profile.wins)+'–'+Number(profile.losses):'0–0';
    const elo=window.SLTBasketballScorebug?.formatRetro(profile,state.rankTies,women?363:365)||'RETRO —';
    return {name:schoolLabel(t),score:g.phase==='upcoming'?null:score(t),
      crest:crest(t),color:safeTeamColor(t),record,retro:elo,poll:state.poll.get(id)||null};
  }
  function letterpressMarkup(g){
    return window.SLTBasketballScorebug?.render({
      phase:g.phase,status:g.phase==='live'?(g.headline||'LIVE'):
       g.phase==='final'?'FINAL':'UPCOMING',
      away:toLetterpressTeam(g.away,g),home:toLetterpressTeam(g.home,g)
    })||'<p class="cbb-empty">Scorebug unavailable. Refresh the page.</p>';
  }
  // The Courtside Desk and Daily Ledger share the same Victorian scorebug
  // renderer, rating terminology, logo system, and original source component.
  function scorebug(g){
    const expanded=state.expanded.has(String(g.id));
    const scoreHTML=letterpressMarkup(g);
    const metadata=g.phase==='upcoming'?localDate(g.date):(g.venue||'COLLEGE BASKETBALL');
    return '<article class="ledger26-card cbb-ledger-card cbb-'+esc(g.phase)+
      (expanded?' cbb-expanded':'')+'" data-cbb-game="'+esc(g.id)+'">'+
      '<div class="ledger26-meta"><span class="ledger26-venue">'+esc(metadata)+'</span>'+
      (g.broadcast?'<span class="ledger26-network">'+esc(g.broadcast)+'</span>':'')+'</div>'+
      '<div class="ledger26-summary cbb-ledger-toggle" role="button" tabindex="0" data-cbb-toggle aria-expanded="'+expanded+
      '" aria-controls="cbb-inline-'+esc(g.id)+'" aria-label="Toggle '+esc(schoolLabel(g.away))+' at '+esc(schoolLabel(g.home))+' game details">'+
      scoreHTML+'<span class="ledger26-instruction" data-cbb-instruction>'+
      (expanded?'CLOSE DETAILS −':'OPEN GAME DETAILS +')+'</span></div>'+
      '<div class="cbb-inline-detail" id="cbb-inline-'+esc(g.id)+'" data-cbb-details '+
      (expanded?'':'hidden')+'><p class="cbb-loading">Loading this game’s report…</p></div>'+
      '</article>';
  }
  function updateStatsPreview(g){
    const target=document.getElementById('cbb-preview-'+g.id);
    if(!target)return;
    const result=summaryStats(g);
    if(result){target.innerHTML=result;target.classList.remove('cbb-preview-empty');}
    else{target.innerHTML='';target.classList.add('cbb-preview-empty');}

  }
  async function preloadVisibleStats(games,generation,day){
    // Limit provider traffic: use cached final boxes and short-lived live updates.
    const candidates=games.filter(g=>g.phase==='live'&&!g.disputed&&/^\d+$/.test(String(g.espnId||g.id))).slice(0,6)
      .concat(games.filter(g=>g.phase==='final'&&!g.disputed&&/^\d+$/.test(String(g.espnId||g.id))).slice(0,3));
    await Promise.allSettled(candidates.map(async g=>{
      const previous=state.summaryCache.get(g.id);
      const fresh=previous&&Date.now()-previous.at<(g.phase==='live'?45000:300000);
      if(!fresh){
        const data=await fetchJSON(api+'summary?event='+encodeURIComponent(g.espnId||g.id));
        if(data?.boxscore)state.summaryCache.set(g.id,{at:Date.now(),data});
        else if(previous)state.summaryCache.set(g.id,{...previous,at:Date.now()});
      }
      if(state.generation===generation&&state.day===day)updateStatsPreview(g);
    }));
  }
  function centerURL(){return 'cbb-game-center.html'+(women?'?gender=women':'');}
  function createShell(){
    // The main newspaper occasionally rebuilds its #app DOM after ratings refresh.
    // Reattach instead of assuming the original mounted element still exists.
    if(mounted&&document.getElementById('cbb-live-desk'))return true;
    if(mounted)mounted=false;
    const old=isStandalone?root:q(women?'#wbb-score-rail':'#score-rail');
    if(!old)return false;
    const host=document.createElement('section');host.id='cbb-live-desk';host.className='cbb-live-desk'+(women?' cbb-women':'');
    host.innerHTML='<div class="cbb-desk-header"><div><div class="cbb-kicker">'+(women?'WOMEN’S':'MEN’S')+' DIVISION I</div>'+
      '<h2>The Courtside Desk</h2></div>'+
      (isStandalone?'':'<a class="cbb-center-link" href="'+centerURL()+'">All games →</a>')+'</div>'+
      '<div class="cbb-date-controls"><button type="button" data-cbb-date="-1" aria-label="Previous day">‹</button>'+
      '<label class="cbb-date-label" for="cbb-day-picker"><span>Date</span><input id="cbb-day-picker" type="date" value="'+esc(state.day)+'"></label>'+
      '<button type="button" data-cbb-date="1" aria-label="Next day">›</button>'+
      '<button type="button" class="cbb-today-btn" data-cbb-today>Today</button>'+
      '<button type="button" class="cbb-refresh-btn" data-cbb-refresh aria-label="Refresh scores">↻</button></div>'+
      '<div class="cbb-filter-bar" role="group" aria-label="Filter college basketball games">'+
      '<button type="button" data-cbb-filter="all" aria-pressed="true">All <span id="cbb-count-all">0</span></button>'+
      '<button type="button" data-cbb-filter="live" aria-pressed="false">Live <span id="cbb-count-live">0</span></button>'+
      '<button type="button" data-cbb-filter="final" aria-pressed="false">Final <span id="cbb-count-final">0</span></button>'+
      '<button type="button" data-cbb-filter="upcoming" aria-pressed="false">Upcoming <span id="cbb-count-upcoming">0</span></button></div>'+
      '<p class="cbb-source-stamp" id="cbb-source-stamp" aria-live="polite">Loading current scores…</p>'+

      '<div class="cbb-cards" id="cbb-cards"><p class="cbb-loading">Checking game data…</p></div>';
    if(isStandalone)old.appendChild(host);
    else old.parentNode.insertBefore(host,old);
    host.addEventListener('click',function(e){
      const shift=e.target.closest('[data-cbb-date]');
      if(shift){state.day=plusDays(state.day,Number(shift.dataset.cbbDate));syncPicker();refresh();return;}
      if(e.target.closest('[data-cbb-today]')){state.day=today();syncPicker();refresh();return;}
      if(e.target.closest('[data-cbb-refresh]')){refresh();return;}
      const filter=e.target.closest('[data-cbb-filter]');
      if(filter){state.filter=filter.dataset.cbbFilter;renderCards();return;}
      const tab=e.target.closest('[data-cbb-inline-tab]');
      if(tab){state.inlineTabs.set(tab.closest('[data-cbb-game]').dataset.cbbGame,tab.dataset.cbbInlineTab);
        selectInlineTab(tab.closest('[data-cbb-details]'),tab.dataset.cbbInlineTab);return;}
      // Interacting with the report must never collapse the scorebug.
      if(e.target.closest('[data-cbb-details]'))return;
      const card=e.target.closest('[data-cbb-game]');
      if(!card||!host.contains(card)||e.target.closest('[data-cbb-details]')||(!e.target.closest('[data-cbb-toggle]')&&e.target.closest('a,button,input,select,label')))return;
      const id=card.dataset.cbbGame,open=!state.expanded.has(id);
      if(open)state.expanded.add(id);else state.expanded.delete(id);
      card.classList.toggle('cbb-expanded',open);
      const detail=card.querySelector('[data-cbb-details]');
      detail.hidden=!open;
      const button=card.querySelector('[data-cbb-toggle]');
      button.setAttribute('aria-expanded',String(open));
      const caption=button.querySelector('[data-cbb-instruction]');
      if(caption)caption.textContent=open?'CLOSE DETAILS −':'OPEN GAME DETAILS +';
      if(open)void loadInlineDetails(id,detail);
    });
    host.addEventListener('keydown',function(e){
      const b=e.target.closest('[data-cbb-toggle]');
      if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();b.click();}
    });
    host.querySelector('#cbb-day-picker').addEventListener('change',function(){if(/^\d{4}-\d{2}-\d{2}$/.test(this.value)){state.day=this.value;refresh();}});
    mounted=true;return true;
  }
  function syncPicker(){if(q('#cbb-day-picker'))q('#cbb-day-picker').value=state.day;}
  function normalizeOfficial(row){
    if(!row||!row.id||!row.away_id||!row.home_id||row.phase==='unconfirmed')return null;
    const team=(id,name,side,points)=>({team:{id:String(id),displayName:name||'Unidentified school',
      abbreviation:String(name||'TEAM').split(' ').map(x=>x[0]).join('').slice(0,5)},
      homeAway:side,score:points});
    const id=String(row.espn_id||row.id);
    return {id,espnId:row.espn_id?String(row.espn_id):null,ncaaId:row.ncaa_id,
      date:row.date||null,away:team(row.away_id,row.away_name,'away',row.away_score),
      home:team(row.home_id,row.home_name,'home',row.home_score),
      phase:row.phase,headline:row.phase==='final'?'NCAA final':'NCAA scoreboard',
      venue:'',broadcast:'',url:cleanURL(row.source_url||''),neutral:false,
      source:row.source||'NCAA-origin score report',verifiedOfficial:true,linescores:false};
  }
  function certifiedArchivedFinals(day,ledger){
    // The published RETRO final ledger is authoritative for already completed
    // men’s games. Never convert it into a live feed or infer school identities.
    if(women||ledger?.season!==season||!Array.isArray(ledger.games))return [];
    const reverse=new Map([...state.crosswalk].map(([espn,ncaa])=>[String(ncaa),String(espn)]));
    const official=[];
    for(const event of ledger.games){
      if(event.date!==day||!/^espn:\d+$/.test(String(event.id))||
         !(/NCAA-origin|ESPN completed D-I scoreboard/.test(String(event.source||''))))continue;
      const id=String(event.id).slice(5);
      if(String(event.source_event_id||id)!==id)continue;
      const aid=reverse.get(String(event.away_id)),hid=reverse.get(String(event.home_id));
      const a=Number(event.away_score),h=Number(event.home_score);
      if(!aid||!hid||aid===hid||!Number.isSafeInteger(a)||!Number.isSafeInteger(h)||
         a<0||h<0||a>500||h>500||a===h)continue;
      const ar=state.ratings.get(aid),hr=state.ratings.get(hid);
      const record=normalizeOfficial({
        id:event.id,espn_id:id,phase:'final',away_id:aid,home_id:hid,
        away_name:ar?.team||'Away team',home_name:hr?.team||'Home team',
        away_score:a,home_score:h,date:day,
        source:'Verified RETRO final archive'
      });
      if(record)official.push({...record,neutral:event.neutral===true,
        archivedFinal:true,source:'Verified final · RETRO archive'});
    }
    return official;
  }
  function courtDayFeed(day,espn,newsroom,ledger){
    // NCAA score evidence is independent of ESPN. Only uniquely resolved
    // school identities may enter this published display.
    const fromEspn=Array.isArray(espn?.events)?espn.events.map(normalizeEvent).filter(Boolean):[];
    const raw=new Map(fromEspn.map(g=>[g.id,g]));
    const cross=women?newsroom?.ncaa_women_crosscheck:newsroom?.ncaa_crosscheck;
    const time=Date.parse(cross?.checked_at||'');
    const fresh=!!cross&&cross.day===day&&Number.isFinite(time)&&
      time<=Date.now()+60000&&Date.now()-time<=90*60000&&Array.isArray(cross.games);
    // Archived *finals* remain valid after a live crosscheck goes stale;
    // stale live events must never be treated as current scores.
    const dated=cross?.day===day&&Number.isFinite(time)&&time<=Date.now()+60000&&Array.isArray(cross.games);
    const current=dated?cross.games
      .filter(row=>fresh||row.phase==='final')
      .map(row=>normalizeOfficial({...row,source:cross.provider||'NCAA-origin score report'})).filter(Boolean):[];
    const archived=certifiedArchivedFinals(day,ledger);
    const byId=new Map(current.map(g=>[g.id,g]));
    for(const proof of archived){
      const previous=byId.get(proof.id);
      if(previous&&previous.phase==='final'&&
          (String(score(previous.away))!==String(score(proof.away))||
           String(score(previous.home))!==String(score(proof.home)))){
        byId.set(proof.id,{...proof,disputed:true,
          source:'NCAA crosscheck conflicts with certified RETRO archive'});
      }else if(!previous||previous.phase!=='final'){
        byId.set(proof.id,proof);
      }else{
        byId.set(proof.id,{...previous,archivedFinal:true,neutral:proof.neutral,
          source:'Verified final · RETRO archive'});
      }
    }
    const official=[...byId.values()];
    const games=[];
    for(const ncaa of official){
      let secondary=raw.get(ncaa.id);
      if(!secondary&&ncaa.espnId)secondary=raw.get(ncaa.espnId);
      if(secondary)raw.delete(secondary.id);
      if(!secondary){
        games.push(ncaa);
        continue;
      }
      if(String(secondary.away.team?.id)!==String(ncaa.away.team?.id)||
         String(secondary.home.team?.id)!==String(ncaa.home.team?.id)){
        // Never combine providers when the participant identities disagree.
        games.push({...ncaa,disputed:true,phase:'final',away:{...ncaa.away,score:null},
          home:{...ncaa.home,score:null},source:'NCAA-origin/ESPN identity conflict · score withheld'});
        continue;
      }
      if(ncaa.phase==='final'){
        const a=score(secondary.away),h=score(secondary.home);
        const conflict=secondary.phase==='final'&&a!==null&&h!==null&&
          (Number(a)!==Number(score(ncaa.away))||Number(h)!==Number(score(ncaa.home)));
        if(ncaa.disputed){
          games.push({...ncaa,phase:'final',disputed:true,away:{...ncaa.away,score:null},
            home:{...ncaa.home,score:null},source:'Independent official-final sources disagree · scores withheld'});
          continue;
        }
        // A verified NCAA-origin final outranks a stale ESPN score snapshot.
        // Keep the correct result, but WITHHOLD ESPN box and play statistics
        // when ESPN still reports a different total.
        games.push({...secondary,ncaaId:ncaa.ncaaId,phase:'final',
          away:{...secondary.away,score:score(ncaa.away)},
          home:{...secondary.home,score:score(ncaa.home)},
          neutral:ncaa.archivedFinal?ncaa.neutral:secondary.neutral,
          verifiedOfficial:true,statsDisputed:conflict,
          source:conflict?'NCAA verified final · ESPN score mismatch, secondary stats withheld':
            'NCAA-origin final · ESPN statistics secondary'});
      }else if(secondary.phase==='live'||secondary.phase==='final'){
        games.push({...secondary,ncaaId:ncaa.ncaaId,source:secondary.phase==='live'?
          'ESPN live scores · NCAA fixture identified':'ESPN final · awaiting NCAA confirmation'});
      }else if(ncaa.phase==='live'){
        games.push({...secondary,ncaaId:ncaa.ncaaId,phase:'live',away:{...secondary.away,score:score(ncaa.away)},
          home:{...secondary.home,score:score(ncaa.home)},verifiedOfficial:true,
          source:'NCAA-origin live snapshot · updated on newsroom cycle'});
      }else{
        games.push({...secondary,ncaaId:ncaa.ncaaId,source:'NCAA-origin fixture · ESPN scheduled tipoff',verifiedOfficial:true});
      }
    }
    // Verified university athletics schedules are independent fixture
    // evidence. They never independently confirm live/final scores.
    const school=women?newsroom?.women_school_fixtures:newsroom?.school_fixtures;
    const schoolTime=Date.parse(school?.checked_at||'');
    const schoolFresh=school?.day===day&&Number.isFinite(schoolTime)&&
      schoolTime<=Date.now()+60000&&Date.now()-schoolTime<90*60000&&Array.isArray(school?.games);
    const schoolIndex=new Map();
    if(schoolFresh)for(const item of school.games){
      const key=women?String(item.espn_id||''):
        (item.team_ids||[]).map(String).sort((a,b)=>Number(a)-Number(b)).join(':');
      if(key)schoolIndex.set(key,item);
    }
    let schoolConfirmed=0;
    for(const g of raw.values()){
      const key=women?String(g.id):[String(g.away.team?.id),String(g.home.team?.id)]
        .sort((a,b)=>Number(a)-Number(b)).join(':');
      const proof=schoolIndex.get(key);
      const participantIds=[String(g.away.team?.id||''),String(g.home.team?.id||'')]
        .sort((a,b)=>Number(a)-Number(b)).join(':');
      const schoolPair=(proof?.team_ids||[]).map(String)
        .sort((a,b)=>Number(a)-Number(b)).join(':');
      if(proof&&(!women||!schoolPair||schoolPair===participantIds)){
        schoolConfirmed++;
        const status=g.phase==='live'?'ESPN live score (secondary)':
          g.phase==='final'?'ESPN reported final (NCAA not confirmed)':'ESPN tipoff listing';
        games.push({...g,schoolVerified:true,schoolSource:(proof.source_urls||[])[0]||'',
          source:'Official university fixture · '+status});
      }else{
        games.push({...g,source:'ESPN secondary · official fixture not independently matched'});
      }
    }
    // Apply university fixture evidence to NCAA-matched entries as well;
    // they were removed from the raw ESPN map above and otherwise missed.
    for(let i=0;i<games.length;i++){
      const g=games[i];
      if(g.schoolVerified)continue;
      const ids=[String(g.away.team?.id||''),String(g.home.team?.id||'')];
      const pair=ids.sort((a,b)=>Number(a)-Number(b)).join(':');
      const key=women?String(g.id):pair;
      const proof=schoolIndex.get(key);
      const schoolPair=(proof?.team_ids||[]).map(String)
        .sort((a,b)=>Number(a)-Number(b)).join(':');
      if(!proof||(women&&schoolPair&&schoolPair!==pair))continue;
      schoolConfirmed++;
      games[i]={...g,schoolVerified:true,
        schoolSource:(proof.source_urls||[])[0]||'',
        source:String(g.source||'Source pending')+' · university fixture corroborated'};
    }
    // Conference office announcements independently corroborate MATCHUPS and
    // broadcast announcements, but never certify scores or updated tipoffs.
    // Only join evidence for this date and exactly matching school IDs.
    const archive=!women?newsroom?.conference_fixtures:null;
    const archivedAt=Date.parse(archive?.indexed_at||'');
    const archiveFresh=archive?.day===day&&Number.isFinite(archivedAt)&&
      archivedAt<=Date.now()+60000&&Date.now()-archivedAt<=90*60000&&
      Array.isArray(archive?.games);
    const conferenceIndex=new Map();
    if(archiveFresh)for(const item of archive.games){
      const ids=(item.team_ids||[]).map(String);
      if(ids.length!==2||ids[0]===ids[1]||!ids.every(x=>/^\d+$/.test(x)))continue;
      const key=ids.sort((a,b)=>Number(a)-Number(b)).join(':');
      conferenceIndex.set(key,item);
    }
    let conferenceConfirmed=0,networkDisagreements=0;
    const enriched=games.map(g=>{
      const aid=String(g.away.team?.id||''),hid=String(g.home.team?.id||'');
      const key=[aid,hid].sort((a,b)=>Number(a)-Number(b)).join(':');
      const proof=conferenceIndex.get(key);
      if(!proof)return g;
      conferenceConfirmed++;
      const officialNetwork=proof.network_announced||'';
      const advertised=String(g.broadcast||'');
      const simplify=x=>x.toUpperCase().replace(/[^A-Z0-9]+/g,'');
      const mismatch=!!(proof.network_conflict||
        (officialNetwork&&advertised&&simplify(officialNetwork)!==simplify(advertised)));
      if(mismatch)networkDisagreements++;
      return {...g,conferenceSource:(proof.source_urls||[])[0]||'',
        conferenceNetwork:officialNetwork,
        conferenceNetworkDisagreement:mismatch,
        broadcast:(!mismatch&&!advertised&&officialNetwork)?officialNetwork:g.broadcast,
        source:String(g.source||'Source pending')+' · conference fixture'+
          (mismatch?' (network listings differ)':'')};
    });
    // A certified NCAA player box is accepted only for the identical game
    // and exact scoreboard totals. Verified NCAA stats remain independent
    // of the ESPN player-stat aggregates.
    const certified=new Map(Object.values(newsroom?.ncaa_player_boxscores?.games||{})
      .filter(b=>b&&b.gender===(women?'women':'men')&&b.away&&b.home)
      .map(b=>[String(b.espn_id||'ncaa:'+b.ncaa_id),b]));
    const certifiedTeam=new Map(Object.values(newsroom?.ncaa_team_boxscores?.games||{})
      .filter(b=>b&&b.gender===(women?'women':'men')&&b.away&&b.home)
      .map(b=>[String(b.espn_id||'ncaa:'+b.ncaa_id),b]));
    const safeGames=enriched.map(g=>{
      const id=String(g.espnId||g.id);
      const a=score(g.away),h=score(g.home);
      const ok=box=>g.phase==='final'&&box&&a!=null&&h!=null&&!g.disputed&&
        Number(a)===Number(box.away.pts??box.away.score)&&
        Number(h)===Number(box.home.pts??box.home.score);
      const box=certified.get(id),teamBox=certifiedTeam.get(id);
      return {...g,...(ok(box)?{certifiedBox:box}:{}),
        ...(ok(teamBox)?{certifiedTeamBox:teamBox}:{})};
    });
    return {games:safeGames,officialCount:official.length,espnCount:fromEspn.length,
      schoolConfirmed,schoolAvailable:!!schoolFresh,conferenceConfirmed,
      networkDisagreements,conferenceAvailable:!!archiveFresh,
      officialAsOf:fresh?cross.checked_at:null,officialUnresolved:fresh?cross.unresolved_games:null,
      archivedFinals:archived.length,
      espnLive:fromEspn.length>0};
  }
  async function getCourtGames(day){
    const date=day.replaceAll('-','');
    const [data,newsroom,ledger]=await Promise.all([
      fetchJSON(api+'scoreboard?groups=50&limit=1000&dates='+date),
      fetchJSON('data/mbb-live.json'),
      women?Promise.resolve(null):fetchJSON('data/mbb-retro-live-finals.json')
    ]);
    const result=courtDayFeed(day,data,newsroom,ledger);
    if(result.games.length)return {...result,snapshot:false};
    const saved=await fallback();
    return {...result,games:saved,snapshot:true};
  }
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
          venue:g.venue||'',broadcast:g.broadcast||'',url:cleanURL(g.source_url||''),source:'ESPN-derived women’s fixture snapshot · not live'};
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
// One native game report, rendered inside the selected scorebug. Never an iframe or linked Gamefile.
  function selectInlineTab(panel,section){
    if(!panel)return;
    panel.querySelectorAll('[data-cbb-inline-tab]').forEach(b=>{
      const active=b.dataset.cbbInlineTab===section;
      b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
    });
    panel.querySelectorAll('[data-cbb-inline-panel]').forEach(p=>{p.hidden=p.dataset.cbbInlinePanel!==section;});
  }
  function renderInlineDetails(g,panel,entry){
    if(!panel?.isConnected||panel.hidden||!state.expanded.has(String(g.id)))return;
    const raw=(g.disputed||g.statsDisputed)?null:entry?.data;
    const currentFlow=g.phase!=='live'||(()=>{
      const snap=verifiedPeriodSnapshot(g,raw);
      return !!snap&&!snap.behind&&score(g.away)===String(snap.awayTotal)&&
        score(g.home)===String(snap.homeTotal);
    })();
    const unavailable='<p class="cbb-empty">No confirmed statistics for this section. Nothing has been estimated.</p>';
    const periods=periodTable(g,raw);
    const teams=g.certifiedTeamBox?ncaaTeamStats(g,g.certifiedTeamBox):statsPairs(g,raw);
    const people=g.certifiedBox?ncaaPlayerBox({
      ...g.certifiedBox,away_name:teamName(g.away),home_name:teamName(g.home)
    }):players(raw);
    const plays=raw&&window.SLTCourt?.parsePlays?window.SLTCourt.parsePlays(raw):[];
    const periodName=n=>!n?'GAME':women?(n<=4?'QUARTER '+n:'OT '+(n-4)):(n<=2?'HALF '+n:'OT '+(n-2));
    const chronology=plays.length?'<div class="cbb-plays-count">'+plays.length+' reported events · newest first · source-reported, not simulated</div>'+
      '<ol class="cbb-all-plays">'+plays.slice().reverse().map(p=>
        '<li><span>'+esc(periodName(p.period))+' · '+esc(p.clock||'Time unavailable')+'</span>'+
        '<strong>'+esc(p.text)+'</strong>'+
        (p.awayScore!=null&&p.homeScore!=null?'<small>'+esc(p.awayScore)+'–'+esc(p.homeScore)+'</small>':'')+'</li>').join('')+'</ol>':
      '<p class="cbb-empty">Possession-by-possession events are not supplied for this matchup. A box score does not establish possession order.</p>';
    const sections=[['summary','Summary'],['box','Player Box Score'],['team','Team Statistics'],['plays','Every Play']];
    panel.innerHTML='<div class="cbb-inline-heading"><strong>THE GAME REPORT</strong><span>'+
      esc(g.neutral?'Neutral site':g.venue||'Venue not listed')+'</span></div>'+
      '<div class="cbb-inline-tabs" role="tablist" aria-label="Match details">'+
      sections.map(([key,label])=>'<button type="button" role="tab" data-cbb-inline-tab="'+key+
        '" aria-selected="false">'+label+'</button>').join('')+'</div>'+
      '<section data-cbb-inline-panel="summary">'+
      '<div class="cbb-inline-summary">'+(periods||unavailable)+usrsLine(g)+'</div>'+
      '<div data-cbb-courtcast></div></section>'+
      '<section data-cbb-inline-panel="box" hidden>'+(people||unavailable)+'</section>'+
      '<section data-cbb-inline-panel="team" hidden>'+(teams||unavailable)+'</section>'+
      '<section data-cbb-inline-panel="plays" hidden>'+chronology+'</section>'+
      '<p class="cbb-inline-source">Data: '+esc(publicSource(g.source||'Game provider not confirmed'))+
      (raw?.boxscore?' · supplemental statistical feed':' · No live box-score feed')+
      (g.disputed||g.statsDisputed?' · Conflicting statistics withheld':'')+
      (entry?.at?' · Checked '+new Date(entry.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'')+'</p>';
    selectInlineTab(panel,state.inlineTabs.get(String(g.id))||'summary');
    const court=panel.querySelector('[data-cbb-courtcast]');
    if(window.SLTCourt&&court)window.SLTCourt.mount(court,g,currentFlow?raw:null,{updatedAt:entry?.at||0,inline:true});
  }
  async function loadInlineDetails(id,panel){
    const g=state.games.find(x=>String(x.id)===String(id));
    if(!g||!panel?.isConnected||!state.expanded.has(String(id)))return;
    let entry=state.summaryCache.get(id);
    const maxAge=g.phase==='live'?15000:180000;
    if(!entry||Date.now()-entry.at>maxAge){
      if(!entry)panel.innerHTML='<p class="cbb-loading">Retrieving the box score and play-by-play…</p>';
      const eid=String(g.espnId||g.id);
      if(!state.inlineRequests.has(id)){
        state.inlineRequests.set(id,(!g.disputed&&!g.statsDisputed&&/^\d+$/.test(eid)?
          fetchJSON(api+'summary?event='+encodeURIComponent(eid)):Promise.resolve(null))
          .finally(()=>state.inlineRequests.delete(id)));
      }
      const raw=await state.inlineRequests.get(id);
      if(raw){entry={at:Date.now(),data:raw};state.summaryCache.set(id,entry);}
      else if(!entry){entry={at:0,data:null};}
    }
    // A refresh may have replaced this exact card while the fetch was in flight.
    const current=document.querySelector('[data-cbb-game="'+id+'"] [data-cbb-details]');
    if(current&&state.expanded.has(id))renderInlineDetails(state.games.find(x=>String(x.id)===id)||g,current,entry);
  }
    function renderCards(){
    const countBy=phase=>state.games.filter(g=>g.phase===phase).length;
    const all=state.games.length;
    for(const [k,n] of Object.entries({all,live:countBy('live'),final:countBy('final'),upcoming:countBy('upcoming')})){
      const num=document.getElementById('cbb-count-'+k);if(num)num.textContent=String(n);
    }
    document.querySelectorAll('#cbb-live-desk [data-cbb-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cbbFilter===state.filter)));
    const matching=state.filter==='all'?state.games:state.games.filter(g=>g.phase===state.filter);
    // No oversized featured variant; every game uses the identical letterpress
    // scorebug and expands in place. Homepage shows four, standalone shows all.
    const shown=isStandalone?matching:matching.slice(0,4);
    const result=q('#cbb-cards');
    if(result)result.innerHTML=shown.length?shown.map(scorebug).join('')+
      (!isStandalone&&matching.length>shown.length?
        '<a class="cbb-more-games" href="'+centerURL()+'">VIEW ALL '+matching.length+' GAMES ↗</a>':''):
      '<p class="cbb-empty">'+(all?'No '+state.filter+' games on '+dateLabel(state.day)+'. Choose another filter.':
      'No '+tag.toLowerCase()+'’s Division I games listed for '+dateLabel(state.day)+'. Try another date.')+'</p>';
    // Preserve open games and the chosen tab during live score updates.
    for(const id of state.expanded){
      const card=[...document.querySelectorAll('#cbb-live-desk [data-cbb-game]')].find(x=>x.dataset.cbbGame===id);
      if(card)void loadInlineDetails(id,card.querySelector('[data-cbb-details]'));
    }
  }
  async function refresh(){
    if(!createShell()||state.pending)return;
    state.pending=true;
    const day=state.day, generation=++state.generation;
    if(state.expandedDay!==day){state.expanded.clear();state.inlineTabs.clear();state.expandedDay=day;}
    const feed=await getCourtGames(day);
    let games=feed.games;
    state.source=feed.officialAsOf?'NCAA-origin + cross-checked live coverage':
      'Secondary feed / published fallback; NCAA crosscheck unavailable';
    state.fallback=feed.snapshot;
    if(!mounted){state.pending=false;return;}
    // Avoid race conditions when the reader changes dates while a prior fetch is still in flight.
    if(state.day!==day){state.pending=false;queueMicrotask(refresh);return;}
    state.games=games.sort((a,b)=>{
      const order={live:0,upcoming:1,final:2};
      return order[a.phase]-order[b.phase]||((Date.parse(a.date)||0)-(Date.parse(b.date)||0));
    });
    state.lastUpdate=new Date();
    const result=q('#cbb-cards'),stamp=q('#cbb-source-stamp');
    renderCards();
    if(stamp){
      const checked=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(state.lastUpdate);
      const retroDate=state.modelDate?new Intl.DateTimeFormat('en-US',{
        timeZone:'UTC',month:'short',day:'numeric',year:'numeric'
      }).format(new Date(state.modelDate+'T12:00:00Z')):'not yet certified';
      stamp.textContent='SCORES CHECKED '+checked+' ET · '+
        state.games.filter(g=>g.phase==='live').length+' LIVE · '+state.games.filter(g=>g.phase==='final').length+' FINAL · '+
        'RETRO RATINGS AS OF '+retroDate+
        (state.fallback?' · published scoreboard fallback':' · live scores checked every 30s');
    }
    // Do not hide the original until this desk has a real scoreboard or a valid fallback.
    const original=q(women?'#wbb-score-rail':'#score-rail');
    if(original&&games.length)original.hidden=true;
    else if(original)original.hidden=false;
    state.pending=false;
    if(!state.fallback)preloadVisibleStats(state.games,generation,day).catch(console.warn);
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
    return rows.length?'<div class="cbb-box-section"><h4>Team Statistics · supplemental live feed</h4><div class="cbb-stat-head"><span>'+esc(code(g.away))+'</span><span>'+esc(code(g.home))+'</span></div>'+rows.join('')+'</div>':'';
  }
  function ncaaTeamStats(g,box){
    if(!box?.away||!box?.home)return '';
    const rows=[['pts','PTS'],['fg','FG'],['threes','3PT'],['ft','FT'],
      ['reb','REB'],['oreb','OREB'],['ast','AST'],['tov','TO'],
      ['stl','STL'],['blk','BLK'],['pf','FOULS']];
    const format=(stats,key)=>{
      if(key==='fg')return stats.fgm==null||stats.fga==null?'—':stats.fgm+'–'+stats.fga;
      if(key==='threes')return stats.tpm==null||stats.tpa==null?'—':stats.tpm+'–'+stats.tpa;
      if(key==='ft')return stats.ftm==null||stats.fta==null?'—':stats.ftm+'–'+stats.fta;
      return stats[key]??'—';
    };
    return '<div class="cbb-box-section"><h4>Team Statistics · NCAA-origin verified totals</h4>'+
      '<p class="cbb-provider-link">Shooting totals reconcile with the NCAA-origin final; not a second independent publisher. '+
      '<a href="'+cleanURL(box.source_url)+'" rel="noopener noreferrer" target="_blank">NCAA-data relay ↗</a></p>'+
      '<div class="cbb-stat-head"><span>'+esc(code(g.away))+'</span><span>'+esc(code(g.home))+'</span></div>'+
      rows.map(([key,label])=>'<div class="cbb-stat-line"><span>'+esc(format(box.away,key))+'</span>'+
        '<b>'+label+'</b><span>'+esc(format(box.home,key))+'</span></div>').join('')+'</div>';
  }
  // This alternate Game Center uses the same independently verified
  // snapshot as the Daily Ledger. Never mix stale scoreboard points with
  // a different provider-update period breakdown.
  function verifiedPeriodSnapshot(g,summary){
    const validator=window.SLTInlineGamefile?.periodScoreSnapshot;
    if(typeof validator!=='function'||!summary||g.disputed||g.statsDisputed)return null;
    return validator({id:g.id,phase:g.phase,
      away:{id:String(g.away.team?.id||''),score:score(g.away)},
      home:{id:String(g.home.team?.id||''),score:score(g.home)}},summary);
  }
  function periodTable(g,summary){
    if(!summary)return '';
    const snapshot=verifiedPeriodSnapshot(g,summary);
    if(!snapshot||snapshot.behind)
      return '<p class="cbb-empty">Period totals are temporarily unavailable while live sources reconcile.</p>';
    // Withhold a newer period snapshot until the displayed scorebug catches
    // up; a single Gamefile must never contradict itself.
    if(g.phase==='live'&&
       (score(g.away)!==String(snapshot.awayTotal)||score(g.home)!==String(snapshot.homeTotal)))
      return '<p class="cbb-empty">The scorebug and period breakdown are refreshing to the same verified score.</p>';
    const away=snapshot.awayPeriods,home=snapshot.homePeriods;
    const cols=Array.from({length:away.length},(_,i)=>'<th>'+
      (women?(i<4?'Q'+(i+1):'OT'+(i-3)):(i<2?'H'+(i+1):'OT'+(i-1)))+'</th>').join('');
    const cells=arr=>arr.map(n=>'<td>'+n+'</td>').join('');
    return '<div class="cbb-box-section"><h4>Period by Period</h4><div class="cbb-scroll"><table class="cbb-box-table"><thead><tr><th>Team</th>'+cols+'<th>TOT</th></tr></thead><tbody>'+
      '<tr><th>'+esc(code(g.away))+'</th>'+cells(away)+'<td>'+snapshot.awayTotal+'</td></tr>'+
      '<tr><th>'+esc(code(g.home))+'</th>'+cells(home)+'<td>'+snapshot.homeTotal+'</td></tr></tbody></table></div></div>';
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
      // Keep every source-supplied column: minutes, shooting, offensive boards, fouls and more.
      const allCols=labels.map((x,i)=>({x,i}));
      const cols=allCols.length?allCols:displayLabels.map((x,i)=>({x,i}));
      const heading=cols.map(c=>'<th>'+esc(c.x)+'</th>').join('');
      const body=eligible.map(p=>'<tr><th>'+esc(p.athlete.displayName)+'</th>'+cols.map(c=>'<td>'+esc(p.stats[c.i]??'—')+'</td>').join('')+'</tr>').join('');
      const leaders=eligible.slice(0,3).map(p=>esc(p.athlete.displayName)+' '+(pts<0?'':esc(p.stats[pts]??'—')+' PTS')+
        (reb<0?'':' · '+esc(p.stats[reb]??'—')+' REB')+(ast<0?'':' · '+esc(p.stats[ast]??'—')+' AST')).join('<br>');
      return '<div class="cbb-box-section"><h4>'+esc(label)+' · sourced player box score</h4>'+
        (leaders?'<p class="cbb-leaders">'+leaders+'</p>':'')+
        '<div class="cbb-scroll"><table class="cbb-box-table"><thead><tr><th>Player</th>'+heading+'</tr></thead><tbody>'+body+'</tbody></table></div></div>';
    }).filter(Boolean).join('');
  }
  function ncaaPlayerBox(box){
    if(!box?.away?.players?.length||!box?.home?.players?.length)return '';
    const cols=[['min','MIN'],['pts','PTS'],['reb','REB'],['oreb','OREB'],['dreb','DREB'],
      ['ast','AST'],['stl','STL'],['blk','BLK'],['tov','TO'],['pf','PF'],
      ['fgm','FGM'],['fga','FGA'],['tpm','3PM'],['tpa','3PA'],['ftm','FTM'],['fta','FTA']];
    const section=(side,name)=>{
      const rows=box[side].players;
      const available=cols.filter(([key])=>rows.some(p=>p[key]!=null));
      return '<div class="cbb-box-section"><h4>'+esc(name)+' · NCAA-origin Player Box</h4>'+
        '<div class="cbb-scroll"><table class="cbb-box-table"><thead><tr><th>Player</th>'+
        available.map(([k,label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+
        rows.map(p=>'<tr><th>'+esc(p.name)+'</th>'+
          available.map(([key])=>'<td>'+esc(p[key]??'—')+'</td>').join('')+'</tr>').join('')+
        '</tbody></table></div></div>';
    };
    return '<p class="cbb-provider-link">NCAA-origin individual totals: game '+esc(box.ncaa_id)+
      ' · Compared against NCAA final scores · <a href="'+cleanURL(box.source_url)+
      '" target="_blank" rel="noopener noreferrer">NCAA-data relay source ↗</a></p>'+
      section('away',box.away_name||'Away')+section('home',box.home_name||'Home');
  }
  function selectGameTab(tab){
    state.section=tab;
    document.querySelectorAll('#cbb-gamefile-root [data-gamefile-tab]').forEach(b=>{
      const active=b.dataset.gamefileTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
    });
    document.querySelectorAll('#cbb-gamefile-root [data-gamefile-panel]').forEach(p=>{p.hidden=p.dataset.gamefilePanel!==tab;});
  }
  async function openDetails(id){
    if(!isGamefile)return;
    const g=state.games.find(x=>x.id===String(id));if(!g)return;
    state.selected=g.id;
    const node=q('#cbb-detail');if(!node)return;
    let entry=state.summaryCache.get(g.id);
    if(!entry)node.innerHTML='<p class="cbb-loading">Checking available attributed box-score information…</p>';
    if(!entry||g.phase==='live'||Date.now()-entry.at>180000){
      const data=(!g.disputed&&!g.statsDisputed&&/^\d+$/.test(String(g.espnId||g.id)))?
        await fetchJSON(api+'summary?event='+encodeURIComponent(g.espnId||g.id)):null;
      if(data){
        entry={at:Date.now(),data};state.summaryCache.set(g.id,entry);
      }else if(!entry?.data){
        // No older verified feed to preserve. Don't claim fresh statistics.
        entry={at:0,data:null};state.summaryCache.set(g.id,entry);
      }
      // A transient provider error must not erase a previously fetched play log.
      // Keep its original timestamp so CourtCast can label it stale.
    }
    if(state.selected!==g.id)return;
    const raw=(g.disputed||g.statsDisputed)?null:entry?.data;
    const periods=periodTable(g,raw),
      team=g.certifiedTeamBox?ncaaTeamStats(g,g.certifiedTeamBox):statsPairs(g,raw),
      playersHTML=g.certifiedBox?ncaaPlayerBox({
        ...g.certifiedBox,away_name:teamName(g.away),home_name:teamName(g.home)
      }):players(raw);
    const missing='<p class="cbb-empty">Detailed game statistics are not available from a confirmed provider. No values have been estimated.</p>';
    const hasStats=!!raw?.boxscore;
    const espnId=/^\d+$/.test(String(g.espnId||g.id))?String(g.espnId||g.id):null;
    const ext=(hasStats&&espnId)?'https://www.espn.com/'+sport+'/game/_/gameId/'+encodeURIComponent(espnId):
      (g.url||('https://www.ncaa.com/scoreboard/'+(women?'basketball-women':'basketball-men')+'/d1'));
    node.innerHTML='<header class="cbb-gamefile-hero" style="--cbb-away:'+safeTeamColor(g.away)+';--cbb-home:'+safeTeamColor(g.home)+'"><div class="cbb-gamefile-eyebrow">THE SPORTING LIFE & TIMES · '+(women?'WOMEN’S':'MEN’S')+' D-I · GAMEFILE '+esc(g.id)+'</div>'+
      '<h1>'+esc(schoolLabel(g.away))+' <em>'+(g.neutral?'vs.':'at')+'</em> '+esc(schoolLabel(g.home))+'</h1>'+
      '<p class="cbb-gamefile-status">'+currentView(g)+' · '+esc(g.venue||'Venue not listed')+(g.broadcast?' · '+esc(g.broadcast):'')+'</p>'+
      '<div class="cbb-gamefile-letterpress">'+letterpressMarkup(g)+'</div></header>'+
      gamefileStatStrip(g,raw)+
      '<nav class="cbb-gamefile-tabs" role="tablist" aria-label="Gamefile statistics">'+
      '<button role="tab" type="button" id="gf-tab-summary" aria-controls="gf-panel-summary" data-gamefile-tab="summary">Game Summary</button>'+
      '<button role="tab" type="button" id="gf-tab-team" aria-controls="gf-panel-team" data-gamefile-tab="team">Team Statistics</button>'+
      '<button role="tab" type="button" id="gf-tab-players" aria-controls="gf-panel-players" data-gamefile-tab="players">Player Box Score</button></nav>'+
      '<section role="tabpanel" id="gf-panel-summary" aria-labelledby="gf-tab-summary" data-gamefile-panel="summary">'+
      '<div class="cbb-gamefile-note"><span>'+(g.phase==='live'?'LIVE NOTEBOOK':g.phase==='final'?'FINAL LEDGER':'MATCHUP FILE')+'</span><p>'+
      esc(statEditorial(g)||gameEditorial(g))+'</p></div>'+
      '<div id="cbb-courtcast-root"></div>'+(periods||missing)+usrsLine(g)+'</section>'+
      '<section role="tabpanel" id="gf-panel-team" aria-labelledby="gf-tab-team" data-gamefile-panel="team">'+(team||missing)+'</section>'+
      '<section role="tabpanel" id="gf-panel-players" aria-labelledby="gf-tab-players" data-gamefile-panel="players">'+(playersHTML||missing)+'</section>'+
      '<p class="cbb-provider-link">'+esc(publicSource(g.source||'Source pending'))+
      (g.schoolSource?' · <a href="'+cleanURL(g.schoolSource)+'" rel="noopener noreferrer" target="_blank">Verified school schedule ↗</a>':'')+
       (g.conferenceSource?' · <a href="'+cleanURL(g.conferenceSource)+'" rel="noopener noreferrer" target="_blank">Conference schedule ↗</a>':'')+
       (g.conferenceNetworkDisagreement?' · Network listings differ: conference '+esc(g.conferenceNetwork||'disputed')+'; other provider '+esc(g.broadcast||'unlisted'):'')+
      ' · <a href="'+cleanURL(ext)+'" rel="noopener noreferrer" target="_blank">'+
      (hasStats?'Live box statistics ↗':'Source scoreboard ↗')+'</a>'+
       (g.certifiedBox?' · NCAA-origin individual totals available under Player Box Score':'')+
       (g.certifiedTeamBox?' · NCAA-origin verified team totals available under Team Statistics':'')+'</p>';
    selectGameTab(state.section);
    const snap=g.phase==='live'?verifiedPeriodSnapshot(g,raw):null;
    const flowMatches=g.phase!=='live'||(snap&&!snap.behind&&
      score(g.away)===String(snap.awayTotal)&&score(g.home)===String(snap.homeTotal));
    if(window.SLTCourt)window.SLTCourt.mount(document.getElementById('cbb-courtcast-root'),g,flowMatches?raw:null,{updatedAt:entry?.at||0});
    if(window.SLTRadio)window.SLTRadio.mount(document.getElementById('cbb-radio-companion-root'),g,women?'women':'men');
  }
  async function openGamefile(){
    const host=document.getElementById('cbb-gamefile-root');if(!host)return;
    const id=here.get('game')||'';
    host.innerHTML='<div class="cbb-gamefile-back"><a href="'+backLink()+'">← RETURN TO THE COURTSIDE DESK</a></div>'+
      '<div id="cbb-radio-companion-root" aria-label="Official radio listening options"></div>'+
      '<article id="cbb-detail" class="cbb-gamefile-detail" aria-live="polite"><p class="cbb-loading">Connecting to the game feed…</p></article>';
    host.addEventListener('click',e=>{const button=e.target.closest('[data-gamefile-tab]');if(button)selectGameTab(button.dataset.gamefileTab);});
    if(!/^(?:\d+|ncaa:\d+)$/.test(id)){q('#cbb-detail').innerHTML='<p class="cbb-empty">Choose a matchup from the Courtside Desk to open its Gamefile.</p>';return;}
    let busy=false;
    async function update(){
      if(busy)return;busy=true;
      try{
        const feed=await getCourtGames(state.day);
        state.games=feed.games;
        if(!state.games.some(g=>g.id===id)){
          q('#cbb-detail').innerHTML='<p class="cbb-empty">This game was not found in the '+esc(dateLabel(state.day))+' feed. Return to the Courtside Desk and choose another matchup.</p>';return;
        }
        await openDetails(id);
      }finally{busy=false;}
    }
    await update();
    // Poll only an active or not-yet-final game every 15 seconds. Final Gamefiles
    // stay stable; there is no value in repeatedly re-requesting a completed game.
    setInterval(()=>{if(document.hidden)return;
      const phase=state.games.find(g=>g.id===id)?.phase;
      if(phase!=='final')update();
    },15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  }
  async function boot(){
    if(window.MBBLogos?.ready)await Promise.race([window.MBBLogos.ready,new Promise(ok=>setTimeout(ok,4500))]);
    const [xref,ratings,forecast,polls]=await Promise.all([
      !women?fetchJSON('data/ncaam-2026-27-espn-team-crosswalk.json'):Promise.resolve(null),
      fetchJSON(women?'data/ncaaw-2026-27-retro-primary.json':'data/ncaam-2026-27-retro-primary.json'),
      !women?fetchJSON('data/ncaam-2026-27-upcoming-forecasts.json'):Promise.resolve(null),
      !women?fetchJSON('data/ncaam-2026-27-national-polls.json'):Promise.resolve(null)
    ]);
    const menRegistry=new Map((xref?.teams||[]).map(t=>[String(t.id),String(t.espn_id)]));
    for(const t of xref?.teams||[]){
      state.crosswalk.set(String(t.espn_id),String(t.id));
      if(t.name){
        state.schoolNames.set(String(t.espn_id),fullSchool(t.name));
        state.schoolNames.set(String(t.id),fullSchool(t.name));
      }
    }
    const expected=women?363:365;
    const validRatings=ratings?.season===season&&ratings?.model==='retro-clean-slate'&&ratings?.starting_elo===1500&&
      (women?ratings.gender==='women':true)&&ratings.rankings?.length===expected&&
      new Set(ratings.rankings.map(t=>String(t.team_id))).size===expected&&
      ratings.rankings.every(t=>t.base_elo===1500&&Number.isFinite(Number(t.elo)));
    if(validRatings){
      for(const t of ratings.rankings){
        const id=women?String(t.team_id):menRegistry.get(String(t.team_id));
        if(id)state.ratings.set(id,t);
      }
      state.ratingsReady=state.ratings.size===expected;
      state.rankTies=new Map();
      for(const row of state.ratings.values()){
        const position=Number(row.rank);
        if(Number.isInteger(position))state.rankTies.set(position,(state.rankTies.get(position)||0)+1);
      }
      state.modelDate=ratings.as_of;
      state.preseason=Number(ratings.games_played)===0;
      if(!state.ratingsReady){state.ratings.clear();state.rankTies.clear();}
    }
    if(!women&&polls?.season===season&&['coaches','ap'].every(k=>
      Array.isArray(polls?.polls?.[k]?.rankings)&&polls.polls[k].rankings.length===25)){
      const schools=new Map((xref?.teams||[]).map(t=>[String(t.name).toLowerCase(),String(t.espn_id)]));
      const aliases={'Michigan State':'Michigan St.',"St. John's":"St. John's (NY)",
        'Iowa State':'Iowa St.','USC':'Southern California'};
      state.poll.clear();
      for(const kind of ['coaches','ap']){
        for(const row of polls.polls[kind].rankings){
          const name=String(aliases[row.team]||row.team||'').toLowerCase();
          const id=schools.get(name);
          if(!id||!Number.isInteger(row.rank)||row.rank<1||row.rank>25)continue;
          const ranking=state.poll.get(id)||{coaches:null,ap:null};
          ranking[kind]=row.rank;state.poll.set(id,ranking);
        }
      }
      state.pollDate=polls.as_of;
    }
    if(!women&&forecast?.season===season&&Array.isArray(forecast.games)){
      state.forecastDate=forecast.as_of;
      for(const f of forecast.games){
        if(!/^espn:\d+$/.test(String(f.id)))continue;
        state.forecast.set(String(f.id).split(':')[1],f);
      }
    }
    if(isGamefile){await openGamefile();return;}
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