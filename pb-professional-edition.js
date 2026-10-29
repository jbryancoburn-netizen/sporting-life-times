/* Shared professional basketball newspaper: EuroLeague and NBL, same layout as NBA.
   Independent data sources and ratings, no shared Elo table or player statistics. */
(()=>{'use strict';
const file=location.pathname.split('/').pop()||'nba.html';
const query=new URLSearchParams(location.search),league=query.get('league');
if(file!=='nba.html'||!['euroleague','nbl'].includes(league))return;
document.body.dataset.proLeague=league;
const el=document.getElementById('app');if(!el)return;
const key=String(query.get('view')||'home').toLowerCase();
const views=['home','games','standings','rankings','players','matchups','playoffs','teams'];
const view=views.includes(key)?key:'home';
const leagueName=league==='euroleague'?'EuroLeague':'Australian NBL';
document.title=leagueName+' | The Sporting Life & Times · Basketball';
const icon=document.querySelector('link[rel=icon]');if(icon)icon.href=league==='euroleague'?'assets/euroleague-tab.svg':'https://en.wikipedia.org/wiki/Special:Redirect/file/NBL_(Australia)_logo.svg';
const tag=document.querySelector('header .topline span');if(tag)tag.textContent=leagueName+' · 2026–27';
const edition=document.querySelector('header .edition-line');if(edition)edition.textContent=league==='euroleague'?'The EuroLeague Edition':'The Australian NBL Edition';
const base='nba.html?league='+league;
const route=(v,team)=>base+(v==='home'?'':'&view='+encodeURIComponent(v))+(team?'&team='+encodeURIComponent(team):'');
const native=league==='euroleague'?'euroleague.html':'nbl.html';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const safe=s=>{try{const x=new URL(s,location.href);return /^https?:$/.test(x.protocol)?esc(x.href):''}catch{return ''}};
const stamp=t=>{const v=new Date(t);return Number.isFinite(+v)?v.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable'};
const num=(x,places=0)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(+x)?(+x).toFixed(places):'—';
const abbr=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const nav=document.querySelector('header .nav');
const tabs=[['home','Front Page'],['games','Game Center'],['standings','Standings'],['rankings','USRS Rankings'],['players','Player Leaders'],['matchups','Matchup Lab'],['playoffs','Playoff Picture'],['teams','Club Desks']];
if(nav){nav.setAttribute('aria-label',leagueName+' newspaper navigation');nav.innerHTML=tabs.map(([k,n])=>'<a href="'+route(k)+'"'+(k===view?' aria-current="page"':'')+'>'+n+'</a>').join('')+'<a href="sports.html">All Sports</a>';}
const footer=document.querySelector('.footer');if(footer)footer.innerHTML='The Sporting Life &amp; Times · '+leagueName+' · League-specific data and independent Elo · <a href="'+native+'">Original edition</a>';
const pageStamp=document.getElementById('data-stamp'),access=document.getElementById('access-stamp');if(access)access.textContent='Viewed '+stamp(new Date())+' ET';
const req=async path=>{try{const resp=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(15000)});return resp.ok?resp.json():null}catch{return null}};
const loading='<p class="nba-empty">Reading '+leagueName+' verified sources…</p>';el.innerHTML=loading;
const isEuro=league==='euroleague';
const nblPal={'Adelaide 36ers':['#c8102e','#112d52'],'Brisbane Bullets':['#0e5d9d','#d68b30'],'Cairns Taipans':['#e66d2b','#224e62'],'Illawarra Hawks':['#dc292c','#1e2430'],'Melbourne United':['#232935','#2371a0'],'New Zealand Breakers':['#0c8e9b','#262c35'],'Perth Wildcats':['#d02030','#161616'],'South East Melbourne Phoenix':['#0a7754','#172e34'],'Sydney Kings':['#5c2693','#d7a926'],'Tasmania JackJumpers':['#34714c','#c39332']};
let pal={},boxes=new Map(),forecasts=new Map();
const crest=t=>{
 const key=isEuro?String(t?.code||t||'').toUpperCase():String(t?.team||t?.name||t||'');
 const filename=(isEuro?key:abbr(key))+'.png';
 const source=(isEuro?'assets/pro-basketball-logos/euroleague/':'assets/pro-basketball-logos/nbl/')+filename;
 const fallback=(isEuro?'assets/euroleague-logos/':'assets/nbl-logos/')+filename;
 const rings=isEuro?[pal?.euroleague?.[key]?.primary||'#153a57',pal?.euroleague?.[key]?.secondary||'#c39432']:(nblPal[key]||['#153a57','#c39432']);
 const short=isEuro?key:key.split(/\s+/).map(x=>x[0]).join('').slice(0,3);
 return '<span class="pb-club-crest" style="--pb-outer:'+rings[0]+';--pb-inner:'+rings[1]+'"><img src="'+esc(source)+'" data-original="'+esc(fallback)+'" alt="" loading="lazy" onerror="if(this.dataset.pbRetried){this.hidden=true;this.parentElement.classList.add(\'pb-no-logo\')}else{this.dataset.pbRetried=\'1\';this.src=this.dataset.original}"><em>'+esc(short)+'</em></span>';
};
let ranks=[],standing=[],games=[],fixtures=[],articles=[],teamMap=new Map(),rateMap=new Map(),metadata={},approved=false;
const name=t=>isEuro?String(t?.name||teamMap.get(String(t?.code||t))?.name||t?.code||t||'Unknown'):String(t?.team||t?.name||t||'Unknown');
const id=t=>isEuro?String(t?.code||t):name(t);
const info=t=>teamMap.get(id(t))||t;
const rating=t=>rateMap.get(id(t))||null;
const rec=t=>t&&Number.isFinite(+t.wins)&&Number.isFinite(+t.losses)?t.wins+'–'+t.losses:'—';
const heading=(eyebrow,title,link='',text='Explore →')=>'<div class="panel-head"><div><div class="eyebrow">'+eyebrow+'</div><h2>'+esc(title)+'</h2></div>'+(link?'<a class="pb-see-more" href="'+link+'">'+esc(text)+'</a>':'')+'</div>';
const panel=(eyebrow,title,body,link='',label='Explore →')=>'<section class="panel">'+heading(eyebrow,title,link,label)+body+'</section>';
const empty=t=>'<p class="nba-empty">'+esc(t)+'</p>';
const teamURL=t=>isEuro?route('teams',id(t)):'nbl-team.html?team='+encodeURIComponent(id(t));
const clubLink=(t,sub='')=>'<a class="pb-team-ref" href="'+teamURL(t)+'">'+crest(t)+'<span>'+esc(name(t))+(sub?'<small>'+esc(sub)+'</small>':'')+'</span></a>';
const paperTable=(heads,body)=>'<div class="nba-table-wrap"><table class="nba-table"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
const recordRows=arr=>paperTable(['#','Club','W','L','PCT','Elo'],arr.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+clubLink(r)+'</td><td>'+num(r.wins)+'</td><td>'+num(r.losses)+'</td><td>'+num(r.win_pct,3).replace(/^0\./,'.')+'</td><td>'+num(rating(r)?.elo,1)+'</td></tr>').join(''));
const ratingRows=arr=>arr.map((r,i)=>'<div class="rank-row"><span class="rank">'+(i+1)+'</span>'+clubLink(r,rec(r))+'<strong class="rank-score">'+num(r.elo,1)+'<small>USRS Elo</small></strong></div>').join('');
const dataGame=g=>isEuro?{id:String(g.id),date:g.date,away:typeof g.away==='object'?g.away.code:g.away,home:typeof g.home==='object'?g.home.code:g.home,as:g.score?.[1]??g.away?.score,hs:g.score?.[0]??g.home?.score,state:g.status||'final'}:{id:String(g.id),date:g.played_at,away:g.away,home:g.home,as:g.away_score,hs:g.home_score,state:'final'};

const present=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const gameRow=(title,away,home)=>'<div class="pb-stat-row"><span>'+esc(title)+'</span><b>'+esc(away??'—')+'</b><b>'+esc(home??'—')+'</b></div>';
const gameHead=(away,home)=>'<div class="pb-stat-row pb-stat-heading"><span>Statistic</span><b>'+esc(isEuro?away.code:away.team)+'</b><b>'+esc(isEuro?home.code:home.team)+'</b></div>';
const seasonRate=(team,key)=>{const st=teamMap.get(id(team)),rate=rateMap.get(id(team));const gp=Number(isEuro?rate?.played:st?.played);
 const number=isEuro?rate?.[key]:st?.[key==='for'?'points_for':'points_against'];
 return present(number)&&gp>0?num(Number(number)/gp,1):'—';
};
const boxTotals=players=>{
 if(!Array.isArray(players)||!players.length)return null;
 const result={};
 for(const prop of ['points','rebounds','assists','turnovers','steals','blocks','fouls'])result[prop]=players.reduce((acc,p)=>acc+(present(p.stats?.[prop])?Number(p.stats[prop]):0),0);
 for(const [field,source] of [['fg','fieldGoalsMade-fieldGoalsAttempted'],['three','threePointFieldGoalsMade-threePointFieldGoalsAttempted'],['ft','freeThrowsMade-freeThrowsAttempted']]){
  let made=0,att=0;
  for(const p of players){const pair=String(p.stats?.[source]||'').split('-');if(pair.length===2&&pair.every(present)){made+=Number(pair[0]);att+=Number(pair[1]);}}
  result[field]=made+'-'+att+(att?' ('+num(100*made/att,1)+'%)':'');
 }
 return result;
};
const gameCard=g=>{
 const x=dataGame(g),away=teamMap.get(x.away)||{code:x.away,name:x.away,team:x.away},
 home=teamMap.get(x.home)||{code:x.home,name:x.home,team:x.home};
 const score=g.status!=='scheduled'&&present(x.as)&&present(x.hs),isLive=g.status==='live',age=Date.now()-Date.parse(g.score_updated_at||'');
 const fresh=isLive&&Number.isFinite(age)&&age<900000;
 const status=isLive?(fresh?'LIVE':'LAST REPORTED'):g.status==='scheduled'?(Date.parse(x.date)<Date.now()?'STATUS PENDING':'UPCOMING'):g.status==='awaiting_final'?'AWAITING FINAL':'FINAL';
 const periods=Array.isArray(g.period_scores)?g.period_scores.filter(p=>present(p.away)&&present(p.home)):[];
 const forecast=forecasts.get(String(x.id)),win=Number(forecast?.home_win_probability),projection=forecast?.projection;
 const box=boxes.get(String(x.id));
 const record=t=>rec(teamMap.get(id(t)));
 const rating=t=>rateMap.get(id(t))?.elo;
 const current=t=>[record(t)!=='—'?record(t):null,present(rating(t))?'Elo '+num(rating(t),0):null].filter(Boolean).join(' · ');
 const side=(t,s)=>'<div class="pb-game-team">'+crest(t)+'<div class="pb-game-club"><a href="'+teamURL(t)+'">'+esc(name(t))+'</a><small>'+esc(current(t))+'</small></div><strong class="pb-game-points">'+(score?esc(s):'—')+'</strong></div>';
 const badge=fresh&&periods.length?'Q'+(periods.at(-1).period||periods.length)+' · '+String(g.status_detail||''):g.status_detail&&isLive?String(g.status_detail):'';
 const quick=[];
 if(score)quick.push(['Combined points',Number(x.as)+Number(x.hs)]);
 if(score)quick.push(['Score margin',Number(x.as)===Number(x.hs)?'Tied':name(Number(x.as)>Number(x.hs)?away:home)+' +'+Math.abs(Number(x.as)-Number(x.hs))]);
 if(forecast&&present(projection?.away)&&present(projection?.home))quick.push(['Pregame projected score',num(projection.away)+'–'+num(projection.home)]);
 if(forecast&&present(forecast.home_win_probability)&&win>=0&&win<=1)quick.push([name(home)+' pregame win chance',num(win*100,1)+'%']);
 let detail=gameHead(away,home)+gameRow('Current-season record',record(away),record(home))+
 gameRow('Current USRS Elo',present(rating(away))?num(rating(away),1):null,present(rating(home))?num(rating(home),1):null)+
 gameRow('Season PPG',seasonRate(away,'for'),seasonRate(home,'for'))+
 gameRow('Season points allowed / game',seasonRate(away,'against'),seasonRate(home,'against'));
 if(periods.length){
  detail+='<h4>Quarter scoring · published feed</h4>'+gameHead(away,home)+periods.map((p,i)=>gameRow('Q'+(p.period||i+1),p.away,p.home)).join('');
 }else detail+='<p class="pb-game-disclosure">Quarter scoring was not provided for this game.</p>';
 if(forecast){
  detail+='<h4>Pregame model · not live</h4>'+gameHead(away,home);
  if(present(projection?.away)&&present(projection?.home))detail+=gameRow('Projected points',num(projection.away),num(projection.home));
  if(present(forecast.home_win_probability)&&win>=0&&win<=1)detail+=gameRow('Pregame win probability',num((1-win)*100,1)+'%',num(win*100,1)+'%');
  if(present(projection?.total))detail+=gameRow('Projected total',num(projection.total),num(projection.total));
 }
 if(box?.teams?.length){
  const at=box.teams.find(t=>t.team===name(away)),ht=box.teams.find(t=>t.team===name(home));
  const al=at?.players||[],hl=ht?.players||[],a=boxTotals(al),h=boxTotals(hl);
  if(a&&h){
   detail+='<h4>Reported game box-score totals</h4>'+gameHead(away,home);
   for(const [label,key] of [['Points','points'],['Rebounds','rebounds'],['Assists','assists'],['Turnovers','turnovers'],['Steals','steals'],['Blocks','blocks'],['Personal fouls','fouls'],['Field goals','fg'],['Three-pointers','three'],['Free throws','ft']])detail+=gameRow(label,a[key],h[key]);
  }
  const leaders=(rows,club)=>rows.filter(p=>present(p.stats?.points)).sort((a,b)=>Number(b.stats.points)-Number(a.stats.points)).slice(0,2).map(p=>'<div class="pb-game-leader"><b>'+esc(p.name)+'</b><small>'+esc(club)+' · '+esc(p.stats.points)+' PTS · '+esc(p.stats.rebounds??'—')+' REB · '+esc(p.stats.assists??'—')+' AST · '+esc(p.stats.steals??'—')+' STL</small></div>').join('');
  detail+='<h4>Top scorers</h4>'+leaders(al,name(away))+leaders(hl,name(home))+
  '<p class="pb-game-disclosure">Player and team numbers are derived from published game reports; official NBL reconciliation is pending.</p>';
 }else detail+='<p class="pb-game-disclosure">'+(isLive?'The current live feed does not provide verified individual or shooting statistics.':'Complete team and player box-score statistics are not in the current published feed.')+'</p>';
 if(g.source_url){const link=safe(g.source_url);if(link)detail+='<a class="pb-game-external" href="'+link+'" target="_blank" rel="noopener noreferrer">Original game report ↗</a>';}
 if(isEuro)detail+='<a class="pb-game-external" href="euroleague.html#el-live-desk">EuroLeague live desk →</a>';
 return '<article class="score-card pb-score-card pb-expanded-game'+(fresh?' pb-is-live':'')+'" data-pb-status="'+(isLive?'live':g.status==='scheduled'?'upcoming':'final')+'" data-pb-clubs="'+esc((name(away)+' '+name(home)).toLowerCase())+'" data-pb-id="'+esc(x.id)+'">'+
 '<div class="pb-game-kicker"><b>'+esc(status)+'</b><time>'+esc(stamp(x.date))+' ET</time>'+(badge?'<span>'+esc(badge)+'</span>':'')+'</div>'+
 side(away,x.as)+side(home,x.hs)+
 (periods.length?'<div class="pb-period-line">'+periods.map((p,i)=>'<span>Q'+esc(p.period||i+1)+' <b>'+esc(p.away)+'–'+esc(p.home)+'</b></span>').join('')+'</div>':'')+
 (quick.length?'<div class="pb-quick-grid">'+quick.slice(0,4).map(([name,value])=>'<div><small>'+esc(name)+'</small><b>'+esc(value)+'</b></div>').join('')+'</div>':'')+
 '<details class="pb-game-detail"><summary>Game statistics, players &amp; sources ▾</summary><div class="pb-game-detail-body">'+detail+'</div></details>'+
 '<p class="pb-game-foot">'+(isEuro?'EuroLeague published scores': 'NBL reported results')+(g.score_updated_at?' · Updated '+esc(stamp(g.score_updated_at))+' ET':'')+'</p></article>';
};
const gameRail=arr=>arr.length?'<div class="nba-score-rail pb-game-rail" id="pb-game-list">'+arr.map(gameCard).join('')+'</div>':empty('No games in the published source window.');
const gameToolbar=()=>'<div class="pb-game-toolbar"><label>Status <select id="pb-game-status"><option value="all">All games</option><option value="live">Live</option><option value="upcoming">Upcoming</option><option value="final">Final</option></select></label><label>Team <input type="search" id="pb-game-team-filter" placeholder="Find a club"></label><b id="pb-game-count"></b></div>';
const applyFilters=()=>{const status=document.getElementById('pb-game-status'),search=document.getElementById('pb-game-team-filter');
 if(!status||!search||typeof document.querySelectorAll!=='function')return;
 let count=0;document.querySelectorAll('#pb-game-list [data-pb-id]').forEach(card=>{card.hidden=!(status.value==='all'||status.value===card.dataset.pbStatus)||!card.dataset.pbClubs.includes(search.value.trim().toLowerCase());if(!card.hidden)count++;});
 const el=document.getElementById('pb-game-count');if(el)el.textContent=count+' games';
};
const sortedGames=data=>data.slice().sort((a,b)=>{
 const status=g=>g.status==='live'?0:g.status==='awaiting_final'?1:g.status==='scheduled'?2:3;
 const sa=status(a),sb=status(b);if(sa!==sb)return sa-sb;
 return sa===3?Date.parse(b.date||b.played_at)-Date.parse(a.date||a.played_at):Date.parse(a.date||a.played_at)-Date.parse(b.date||b.played_at);
});
const stories=(n=7)=>articles.length?articles.slice(0,n).map((a,i)=>'<article class="nba-story'+(i===0?' lead':'')+'">'+(safe(a.url)?'<a href="'+safe(a.url)+'" target="_blank" rel="noopener noreferrer">':'')+'<h3>'+esc(a.title||'Basketball story')+'</h3>'+(safe(a.url)?'</a>':'')+'<p>'+esc(String(a.summary||'').replace(/<[^>]*>/g,'').slice(0,225))+'</p><div class="byline">'+esc(a.source||leagueName)+' · '+esc(stamp(a.published_at||a.date))+'</div></article>').join(''):empty('No source-confirmed headlines currently available.');
const clubs=arr=>'<div class="nba-team-grid pb-club-grid">'+arr.map(t=>'<a class="nba-team-tile" href="'+teamURL(t)+'">'+crest(t)+'<b>'+esc(name(t))+'</b><small>'+rec(t)+' · Elo '+num(rating(t)?.elo,1)+'</small></a>').join('')+'</div>';
const race=()=>isEuro?panel('The postseason race','Direct playoff places and play-in', '<p class="nba-note">Places 1–6 qualify directly; places 7–10 enter the play-in. Current positions are provisional and may change under official tiebreakers.</p>'+paperTable(['Position','Club','W–L'],standing.slice(0,10).map((t,i)=>'<tr><td>'+(i+1)+' · '+(i<6?'Direct':'Play-in')+'</td><td>'+clubLink(t)+'</td><td>'+rec(t)+'</td></tr>').join(''))):panel('The Finals race','Australian NBL ladder', '<p class="nba-note">This ladder is reconstructed from reported results and is not yet officially reconciled. The playoff format and seeds will not be inferred from incomplete data.</p>'+recordRows(standing));
const nextGames=()=>isEuro?fixtures.slice().filter(g=>Date.parse(g.date)>Date.now()).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,12):[];
const forecast=()=>{const upcoming=nextGames();if(!upcoming.length)return empty(isEuro?'No verified future fixtures in the current source window.':'No verified NBL future-fixture and forecast feed has been connected.');return upcoming.map(g=>{
const p=Number(g.home_win_probability);return '<article class="pb-fixture"><small>'+esc(stamp(g.date))+' ET</small><div>'+clubLink(g.away)+'<span class="pb-at">at</span>'+clubLink(g.home)+'</div><p class="nba-note">'+(Number.isFinite(p)?esc(name(g.home))+' pregame win probability '+num(p*100,1)+'%':'Win probability unavailable')+(g.projection?' · Projected score '+num(g.projection.away)+'–'+num(g.projection.home):'')+'</p></article>';
}).join('');};
const bodyStats=()=>panel('The numbers','Scoring and defense',paperTable(['#','Club','Points / game','Allowed / game','Net / game'],standing.map((r,i)=>{const gp=Number(r.played)||1;const scored=isEuro?Number(r.for):Number(r.points_for);const conceded=isEuro?Number(r.against):Number(r.points_against);return '<tr><td>'+(i+1)+'</td><td>'+clubLink(r)+'</td><td>'+num(scored/gp,1)+'</td><td>'+num(conceded/gp,1)+'</td><td>'+num((scored-conceded)/gp,1)+'</td></tr>';}).join('')));
const sectionHeroes={home:['THE GAME<br>GOES GLOBAL.','Independent ratings, results, news and analysis. Three leagues, one professional basketball newspaper.'],games:['THE GAME<br>BOOK.','Source-verified scores, recent finals and upcoming fixtures.'],standings:['THE TABLE<br>MATTERS.','Every club, every result and an independent Elo rating.'],rankings:['THE POWER<br>BOARD.','Independent team-only ratings. Each league starts its season at 1500.'],players:['THE GAME’S<br>PERFORMERS.','Player leaders are shown only where verified box-score coverage exists.'],matchups:['MATCHUP<br>INTELLIGENCE.','Team profiles and source-backed pregame projections.'],playoffs:['THE ROAD<br>TO THE TITLE.','Follow the postseason races, league-specific qualification and standings.'],teams:['EVERY CITY.<br>EVERY CLUB.','Club-by-club results, records and independent ratings.']};
const hero=()=>{const [title,description]=sectionHeroes[view];return '<section class="hero pb-shared-hero"><div><div class="eyebrow">2026–27 · '+esc(leagueName.toUpperCase())+' EDITION</div><h1>'+title+'</h1><p>'+description+'</p><a class="cta" href="'+route('rankings')+'">Explore USRS Rankings ↗</a></div><div class="hero-art">'+ranks.slice(0,4).map((r,i)=>'<div class="hero-team">'+crest(r)+'<strong>'+num(r.elo,0)+'</strong><small>'+esc(name(r))+' · #'+(i+1)+'</small></div>').join('')+'</div></section>';};
const introNote=()=>'<p class="nba-note">Source: '+esc(metadata.source||metadata.model||'Published league feed')+' · Updated '+esc(stamp(metadata.updated_at||metadata.calculated_at))+' ET'+(!approved&&league==='nbl'?' · NBL Elo is research-only and forecasting is not certified.':'')+'</p>';
function render(){
let body=hero()+introNote();
if(view==='home'){
body+=panel('Today and latest','The Basketball Scoreboard',gameRail([...games].slice(0,12)),route('games'),'Full game center →');
body+='<div class="grid pb-editorial-grid"><div class="column">'+panel('The news desk','Around '+(isEuro?'Europe':'Australasia'),stories(8))+panel('The league','Club Directory',clubs(standing.slice(0,10)),route('teams'),'All clubs →')+'</div>';
body+='<div class="column">'+panel('Independent ratings','USRS Power 10',ratingRows(ranks.slice(0,10)),route('rankings'),'Full rankings →')+panel('Team statistics','Scoring and Defense',recordRows(standing.slice(0,6)),route('standings'),'Standings →')+'</div>';
body+='<div class="column">'+race()+panel('On the calendar','Next Matchups',forecast(),route('matchups'),'Matchup Lab →')+'</div></div>';
}else if(view==='games')body+=panel('Game Center','Live · upcoming · season results',gameToolbar()+gameRail(games));
else if(view==='standings')body+=panel('The table','Full '+leagueName+' standings',recordRows(standing))+bodyStats();
else if(view==='rankings')body+=panel('Independent model','The USRS Power Rankings',ratingRows(ranks))+panel('Research note','The Elo model',empty(isEuro?'Each EuroLeague club started at 1500 this season. Ratings update from verified completed games.':'NBL clubs started at 1500; the retro model is in research status, and predictive probabilities have not passed certification.'));
else if(view==='players')body+=panel('Player leaders','Individual performances',isEuro?empty('Official player statistics have not passed verification. No estimated player leaderboard is displayed.'):'<p class="nba-note">Individual numbers are calculated from sourced player box scores; games without complete player data are excluded.</p><a class="pb-feature-link" href="nbl-players.html">Open verified NBL player leaders →</a><a class="pb-feature-link" href="nbl-boxscores.html">Browse sourced NBL box scores →</a>');
else if(view==='matchups')body+=panel('Game intelligence','Pregame matchups',isEuro?forecast():'<p class="nba-note">NBL prediction certification is incomplete; team comparisons remain descriptive.</p><a class="pb-feature-link" href="nbl-matchups.html">Open NBL Matchup Lab →</a>');
else if(view==='playoffs')body+=race();
else if(view==='teams'){
 const selected=query.get('team');const t=selected?teamMap.get(selected)||standing.find(x=>id(x)===selected):null;
 body+=t?panel('Club file',name(t),'<div class="pb-club-profile">'+crest(t)+'<div><h2>'+esc(name(t))+'</h2><p>Record: '+rec(t)+' · USRS Elo '+num(rating(t)?.elo,1)+'</p><p>Independent current-season research · Games and fixtures are sourced separately.</p>'+(isEuro?'':'<a href="'+teamURL(t)+'">Full NBL club roster, results and history →</a>')+'</div></div>'):panel('Club directory','Every club',clubs(standing));
 if(t&&isEuro)body+=panel('Coming up',name(t)+' fixtures',forecast());
 if(!t)body+=bodyStats();
}
el.innerHTML=body;
if(view==='games'){
 const statusNode=document.getElementById('pb-game-status'),teamNode=document.getElementById('pb-game-team-filter');
 if(typeof statusNode?.addEventListener==='function')statusNode.addEventListener('change',applyFilters);
 if(typeof teamNode?.addEventListener==='function')teamNode.addEventListener('input',applyFilters);
 applyFilters();
}
}
Promise.all(isEuro?[
 req('data/euroleague-model.json'),req('data/euroleague-live.json'),req('articles.json'),req('data/dual-ring-team-palette.json')
]:[
 req('data/nbl-standings.json'),req('data/nbl-elo-research.json'),req('data/nbl-research-current-ledger.json'),req('nbl-articles.json'),req('data/nbl-player-boxscores.json')
]).then(d=>{
if(isEuro){
 const [model,feed,raw,palette]=d;pal=palette||{};
 if(!model||!Array.isArray(model.rankings)||model.rankings.length<18||!Array.isArray(model.standings))throw Error('EuroLeague source publication not available');
 ranks=model.rankings;standing=model.standings;fixtures=model.fixtures||[];metadata=model;approved=true;
 teamMap=new Map(ranks.map(r=>[r.code,r]));rateMap=new Map(ranks.map(r=>[r.code,r]));
 forecasts=new Map((model.fixtures||[]).map(g=>[String(g.id),g]));
 games=sortedGames([...new Map([
 ...(model.completed_game_ledger||[]).map(g=>[String(g.id),{...g,status:'final'}]),
 ...(model.fixtures||[]).filter(g=>Date.parse(g.date)>Date.now()).slice(0,24).map(g=>[String(g.id),{...g,status:'scheduled'}]),
 ...(feed?.games||[]).filter(g=>['live','final','scheduled','awaiting_final'].includes(g.status)).map(g=>[String(g.id),g])
 ]).values()]);
 articles=(raw?.articles||[]).filter(a=>/euroleague/i.test([a.category,a.title,a.summary].join(' ')));
 // The public news wire can have no EuroLeague-specific headlines; retain direct league source navigation without inventing stories.
}else{
 const [stand,model,ledger,news,playerBoxes]=d;
 boxes=new Map((playerBoxes?.games||[]).map(g=>[String(g.id),g]));
 if(!stand||stand.rows?.length!==10||!model||model.ratings?.length!==10)throw Error('NBL current-season datasets not available');
 ranks=model.ratings;standing=stand.rows;metadata=stand;approved=Boolean(model.production_approved);
 rateMap=new Map(ranks.map(r=>[r.team,r]));teamMap=new Map(standing.map(r=>[r.team,r]));
 games=sortedGames((ledger?.games||stand.recent_finals||[]).map(g=>({...g,status:'final'})));
 articles=(news?.articles||[]).filter(x=>!/(?:betting tips|same game multi|sportsbook|odds|best bets|predictions|fre[e]?tips)/i.test(x.title||''));
}
if(pageStamp)pageStamp.textContent=leagueName+' · '+standing.length+' clubs · Updated '+stamp(metadata.updated_at||metadata.calculated_at)+' ET';
render();
if(isEuro&&typeof setInterval==='function')setInterval(async()=>{
 if(document.hidden)return;
 const feed=await req('data/euroleague-live.json?refresh='+Date.now());
 if(!Array.isArray(feed?.games))return;
 const map=new Map(games.map(g=>[String(g.id),g]));
 for(const g of feed.games)if(g?.id)map.set(String(g.id),g);
 games=sortedGames([...map.values()]);
 const rail=document.getElementById('pb-game-list');if(!rail)return;
 const open=new Set([...rail.querySelectorAll('[data-pb-id]')].filter(e=>e.querySelector('details[open]')).map(e=>e.dataset.pbId));
 rail.innerHTML=(view==='games'?games:games.slice(0,12)).map(gameCard).join('');
 rail.querySelectorAll('[data-pb-id]').forEach(e=>{if(open.has(e.dataset.pbId))e.querySelector('details').open=true;});
 if(view==='games')applyFilters();
},60000);
}).catch(e=>{console.warn('Professional basketball edition:',e);el.innerHTML=panel('Edition unavailable','Unable to load source-backed data',empty('This league edition is awaiting a valid data publication. No other league’s ratings or scores have been substituted.')+'<a href="'+native+'">Open the original league newspaper →</a>');});
})();