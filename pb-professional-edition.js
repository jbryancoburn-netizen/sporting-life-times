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
const crest=t=>{const identifier=isEuro?String(t?.code||t||'').toUpperCase():abbr(t?.team||t?.name||t||'');
const src=isEuro?'assets/euroleague-logos/'+identifier+'.png':'assets/nbl-logos/'+identifier+'.png';
return '<span class="pb-club-crest"><img src="'+esc(src)+'" loading="lazy" alt=""></span>';};
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
const gameCard=g=>{const v=dataGame(g),a=teamMap.get(v.away)||{code:v.away,name:v.away,team:v.away},h=teamMap.get(v.home)||{code:v.home,name:v.home,team:v.home};const complete=v.state==='final'||v.state==='post';const hasScores=v.as!=null&&v.hs!=null;
return '<article class="score-card pb-score-card"><small>'+esc(complete?'FINAL':v.state==='live'?'LIVE':'UPCOMING')+' · '+esc(stamp(v.date))+' ET</small><div class="score-team">'+crest(a)+'<span>'+esc(name(a))+'</span><strong>'+(hasScores?esc(v.as):'—')+'</strong></div><div class="score-team">'+crest(h)+'<span>'+esc(name(h))+'</span><strong>'+(hasScores?esc(v.hs):'—')+'</strong></div><a class="score-link" href="'+route('games')+'">Game Center →</a></article>';};
const gameRail=arr=>arr.length?'<div class="nba-score-rail pb-game-rail">'+arr.map(gameCard).join('')+'</div>':empty('No game results in the currently verified feed window.');
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
}else if(view==='games')body+=panel('The scoreboard','Games and recent finals',gameRail([...games].slice(0,24)))+panel('Upcoming','Verified future matchups',isEuro?forecast():empty('NBL upcoming game details are not available in the independent verified feed.')) ;
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
}
Promise.all(isEuro?[
 req('data/euroleague-model.json'),req('data/euroleague-live.json'),req('articles.json')
]:[
 req('data/nbl-standings.json'),req('data/nbl-elo-research.json'),req('data/nbl-research-current-ledger.json'),req('nbl-articles.json')
]).then(d=>{
if(isEuro){
 const [model,feed,raw]=d;
 if(!model||!Array.isArray(model.rankings)||model.rankings.length<18||!Array.isArray(model.standings))throw Error('EuroLeague source publication not available');
 ranks=model.rankings;standing=model.standings;fixtures=model.fixtures||[];metadata=model;approved=true;
 teamMap=new Map(ranks.map(r=>[r.code,r]));rateMap=new Map(ranks.map(r=>[r.code,r]));
 games=(feed?.games||[]).filter(g=>['live','scheduled','final','awaiting_final'].includes(g.status)).map(g=>({...g})).sort((a,b)=>a.status==='live'?-1:b.status==='live'?1:(a.status==='scheduled'?0:1)-(b.status==='scheduled'?0:1)||Date.parse(a.date)-Date.parse(b.date));
 if(!games.length)games=(model.recent_results||[]).map(g=>({...g,status:'final'}));
 articles=(raw?.articles||[]).filter(a=>/euroleague/i.test([a.category,a.title,a.summary].join(' ')));
 // The public news wire can have no EuroLeague-specific headlines; retain direct league source navigation without inventing stories.
}else{
 const [stand,model,ledger,news]=d;
 if(!stand||stand.rows?.length!==10||!model||model.ratings?.length!==10)throw Error('NBL current-season datasets not available');
 ranks=model.ratings;standing=stand.rows;metadata=stand;approved=Boolean(model.production_approved);
 rateMap=new Map(ranks.map(r=>[r.team,r]));teamMap=new Map(standing.map(r=>[r.team,r]));
 games=[...(stand.recent_finals||ledger?.games||[])].sort((a,b)=>Date.parse(b.played_at)-Date.parse(a.played_at));
 articles=(news?.articles||[]).filter(x=>!/(?:betting tips|same game multi|sportsbook|odds|best bets|predictions|fre[e]?tips)/i.test(x.title||''));
}
if(pageStamp)pageStamp.textContent=leagueName+' · '+standing.length+' clubs · Updated '+stamp(metadata.updated_at||metadata.calculated_at)+' ET';
render();
}).catch(e=>{console.warn('Professional basketball edition:',e);el.innerHTML=panel('Edition unavailable','Unable to load source-backed data',empty('This league edition is awaiting a valid data publication. No other league’s ratings or scores have been substituted.')+'<a href="'+native+'">Open the original league newspaper →</a>');});
})();