(()=>{'use strict';
const root=document.querySelector('#epl-visual-desk');
const status=document.getElementById('epl-viewed')||root;
// These registers live on separate newspaper pages; the legacy visual-desk mount is optional.
const mounts=['epl-table-board','epl-power-board','epl-attack-board','epl-defense-board','epl-score-rail','epl-hero-clubs','epl-club-directory','epl-pulse-leader','epl-pulse-finals','epl-pulse-power'];
if(!status&&!mounts.some(id=>document.getElementById(id)))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS={'Arsenal':'#ef0107','Aston Villa':'#670e36','Bournemouth':'#d71920','Brentford':'#e30613','Brighton':'#0057b8','Chelsea':'#034694','Coventry':'#77c8e8','Crystal Palace':'#1b458f','Everton':'#003399','Fulham':'#252525','Hull':'#f18a00','Ipswich':'#0044a9','Leeds United':'#ffcd00','Liverpool':'#c8102e','Manchester City':'#6cabdd','Manchester United':'#da291c','Newcastle United':'#242424',"Nott'm Forest":'#dd0000','Sunderland':'#eb172b','Tottenham':'#132257'};
const FIXED_IDS={"Arsenal":"359","Aston Villa":"362","Bournemouth":"349","Brentford":"337","Brighton":"331","Chelsea":"363","Coventry":"388","Crystal Palace":"384","Everton":"368","Fulham":"370","Hull":"306","Ipswich":"373","Leeds United":"357","Liverpool":"364","Manchester City":"382","Manchester United":"360","Newcastle United":"361","Nott'm Forest":"393","Sunderland":"366","Tottenham":"367"};
const crest=(name,id)=>{const n=id||FIXED_IDS[name];return n&&/^\d+$/.test(String(n))?'<img class="epl-crest" src="https://a.espncdn.com/i/teamlogos/soccer/500/'+n+'.png" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\'"><span class="epl-fallback" style="display:none">'+esc(name.slice(0,2).toUpperCase())+'</span>':'<span class="epl-fallback">'+esc(name.slice(0,2).toUpperCase())+'</span>'};
const team=(name,id)=>'<a class="epl-team" href="epl-club.html?club='+encodeURIComponent(id||FIXED_IDS[name]||'')+'" style="--club:'+esc(COLORS[name]||'#777')+'">'+crest(name,id)+'<span>'+esc(name)+'</span></a>';
const num=n=>Number(n).toFixed(1);
const date=s=>new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
const section=(name,tag,content)=>'<section class="epl-data-section"><div class="epl-section-label"><h2>'+name+'</h2><span>'+tag+'</span></div>'+content+'</section>';
async function load(){
try{
const readJson=async p=>{const x=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!x.ok)throw Error(p+' HTTP '+x.status);return x.json();};
const r=await readJson('data/epl-ratings.json');
if(!Array.isArray(r.standings)||r.standings.length!==20||!r.ratings||Object.keys(r.ratings).length!==20)throw Error('Incomplete EPL standings data');
// Standings and RETRO rankings must still render if the separate forecast feed fails.
const forecastData=await readJson('data/epl-match-center.json').catch(e=>{console.warn('EPL forecasts unavailable; displaying verified standings:',e);return null;});
const f={fixtures:Array.isArray(forecastData?.fixtures)?forecastData.fixtures:[],recent_results:Array.isArray(forecastData?.recent_results)?forecastData.recent_results:[]};
// Forecast exports may omit finals. The verified season ledger owns results.
const resultSource=Array.isArray(r.season_results)?r.season_results:f.recent_results;
if(!Array.isArray(resultSource)||(!resultSource.length&&r.completed_matches>0))throw Error('Verified EPL results unavailable');
const recentResults=[...resultSource].sort((a,b)=>Date.parse(b.kickoff_utc)-Date.parse(a.kickoff_utc)).slice(0,18);
// Forecast providers use full club names; reconcile identities by stable club ID.
const nameById=Object.fromEntries(Object.entries(FIXED_IDS).map(([name,id])=>[id,name]));
const fixtures=f.fixtures.map(g=>({...g,home:{...g.home,name:nameById[String(g.home?.id)]||g.home?.name},away:{...g.away,name:nameById[String(g.away?.id)]||g.away?.name}}));
const idByTeam={};for(const g of fixtures){idByTeam[g.home.name]=g.home.id;idByTeam[g.away.name]=g.away.id}
const upcomingGames=fixtures.filter(g=>g.home&&g.away&&Number.isFinite(Date.parse(g.kickoff_utc))&&Date.parse(g.kickoff_utc)>Date.now()).sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc));
const ratingOrder=Object.entries(r.ratings).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const rankFor=new Map(ratingOrder.map(([name,value],i)=>{
 const tie=ratingOrder.findIndex(x=>x[1]===value)+1;
 const tied=ratingOrder.filter(x=>x[1]===value).length>1;
 return [name,(tied?'T-':'#')+tie];
}));
const standingByName=new Map(r.standings.map(t=>[t.club,t]));
const resultHistory=[...resultSource].sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc));
const forecastById=new Map(fixtures.map(g=>[String(g.fixture_id),g]));
const crestUrl=id=>/^\d+$/.test(id||'')?'https://a.espncdn.com/i/teamlogos/soccer/500/'+id+'.png':'';
const report=id=>'epl-match-report.html?game='+encodeURIComponent(id);
function dispatch(id,phase){
 if(!/^\d+$/.test(id||'')||phase==='upcoming')return '';
 const href=phase==='live'?'live-game.html?league=epl&game='+id:report(id);
 return '<a href="'+esc(href)+'">'+(phase==='live'?'Live dispatch':'Match report')+'</a>';
}
function side(t,score,kickoff){
 const id=t.id||FIXED_IDS[t.name],name=nameById[id]||t.name;
 const past=resultHistory.filter(g=>g.kickoff_utc&&Date.parse(g.kickoff_utc)<Date.parse(kickoff)&&(g.home===name||g.away===name));
 const form=past.map(g=>{
  const home=g.home===name,scored=Number(home?g.home_score:g.away_score),allowed=Number(home?g.away_score:g.home_score);
  return {result:scored===allowed?'D':scored>allowed?'W':'L',scored,allowed,
   opponent:home?g.away:g.home,date:date(g.kickoff_utc),gameHref:report(g.fixture_id)};
 });
 const record=['W','D','L'].map(result=>form.filter(game=>game.result===result).length).join('–');
 const average=key=>form.length?form.reduce((sum,game)=>sum+game[key],0)/form.length:null;
 const elo=r.ratings[name];
 return {name,compactName:t.abbreviation,score,crest:crest(name,id),watermarkArt:crestUrl(id),teamHref:id?'epl-club.html?club='+id:'',
  color:COLORS[name]||t.color||'#655239',record,
  retro:Number.isFinite(elo)?'RETRO '+Math.round(elo)+(rankFor.get(name)?' ('+rankFor.get(name)+')':''):'RETRO —',
  scouting:{games:form.length,lastFive:form,pointsFor:average('scored'),pointsAgainst:average('allowed')}};
}
function matchForecast(g){
 const projected=g?.projected_score,p=g?.probabilities;
 if(!p||!['away','draw','home'].every(key=>Number.isFinite(p[key])&&p[key]>=0&&p[key]<=1))return '';
 return '<div class="epl-retro-forecast"><strong>RETRO pregame</strong><span>'+Math.round(100*p.away)+'% away · '+Math.round(100*p.draw)+'% draw · '+Math.round(100*p.home)+'% home</span>'+
  (Number.isFinite(projected?.away)&&Number.isFinite(projected?.home)?'<span>Projected '+projected.away+'–'+projected.home+'</span>':'')+'</div>';
}
function scorebug(g,phase){
 const resolve=t=>typeof t==='string'?{name:t,id:idByTeam[t]}:t;
 const away=side(resolve(g.away),g.away_score,g.kickoff_utc),home=side(resolve(g.home),g.home_score,g.kickoff_utc);
 const bug=window.SLTSportsScorebug?.render({phase,status:phase==='final'?'FULL TIME':g.status,fullTimeLabel:'FULL TIME',
  liveStatusOverride:g.status||'LIVE',time:date(g.kickoff_utc)+' ET',suppressPress:true,compactFinal:true,
  suppressMonogram:true,allowDraws:true,scoringUnit:' GF/match',away,home,ariaLabel:away.name+' at '+home.name+' scorecard'})||
  '<p>Scorecard unavailable.</p>';
 return bug+(phase==='final'?'':matchForecast(forecastById.get(String(g.fixture_id))));
}
function eplLedger(g,phase){
 return '<article class="ledger26-card epl-master-card" data-phase="'+phase+'" data-epl-fixture="'+esc(g.fixture_id)+'">'+
  '<div class="ledger26-meta"><span>'+esc(g.venue||'Premier League')+'</span><span>'+esc(date(g.kickoff_utc))+' ET</span><span class="epl-report-link">'+dispatch(g.fixture_id,phase)+'</span></div>'+
  '<details class="ledger26-expand"><summary class="ledger26-summary"><div class="epl-scorebug-content">'+scorebug(g,phase)+'</div>'+
  '<span class="ledger26-instruction">MATCH DETAILS</span></summary>'+
  '<div class="ledger26-expanded epl-match-stats"><p class="epl-stats-note">Open this match to load its statistics.</p></div>'+
  '</details></article>';
}
const slate=(phase,title,games)=>'<section class="epl-ledger-section" data-epl-phase="'+phase+'"'+(games.length?'':' hidden')+'><h3>'+title+
 '</h3><div class="epl-score-rail">'+games.map(g=>eplLedger(g,phase)).join('')+'</div></section>';
const rail=slate('live','Live matches',[])+slate('upcoming','Upcoming fixtures',upcomingGames.slice(0,10))+
 slate('final','Latest finals',recentResults.slice(0,6));
function updateScores(events){
 const mount=document.getElementById('epl-score-rail');
 if(!mount?.querySelector)return;
 for(const g of events){
  const phase=g.phase;
  if(!/^\d+$/.test(g.fixture_id))continue;
  const section=mount.querySelector('[data-epl-phase="'+phase+'"]');
  if(!section)continue;
  const grid=section.querySelector('.epl-score-rail');
  let card=mount.querySelector('[data-epl-fixture="'+g.fixture_id+'"]');
  if(!card){
   grid.insertAdjacentHTML(phase==='upcoming'?'beforeend':'afterbegin',eplLedger(g,phase));
   card=mount.querySelector('[data-epl-fixture="'+g.fixture_id+'"]');
  }else{
   const content=card.querySelector('.epl-scorebug-content'),html=scorebug(g,phase);
   if(content.dataset.rendered!==html){
    content.innerHTML=html;
    content.dataset.rendered=html;
   }
   card.querySelector('.ledger26-meta span').textContent=g.venue||'Premier League';
   if(card.dataset.phase!==phase)card.querySelector('.epl-report-link').innerHTML=dispatch(g.fixture_id,phase);
   card.dataset.phase=phase;
   if(card.parentElement!==grid)grid.prepend(card);
  }
 }
 mount.querySelectorAll('[data-epl-phase]').forEach(group=>{
  group.hidden=!group.querySelector('[data-epl-fixture]');
 });
}
const sorted=Object.entries(r.ratings).sort((a,b)=>b[1]-a[1]);const min=Math.min(...sorted.map(x=>x[1])),max=Math.max(...sorted.map(x=>x[1]));
const pulse=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
const leader=r.standings[0];if(leader)pulse('epl-pulse-leader',leader.club+' · '+leader.points+' pts');
pulse('epl-pulse-finals',String(r.completed_matches??'—'));
const nextGame=upcomingGames[0];if(nextGame){pulse('epl-pulse-kickoff',new Date(nextGame.kickoff_utc).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));pulse('epl-pulse-next-match',nextGame.home.name+' v '+nextGame.away.name+' · ET');}
if(sorted.length)pulse('epl-pulse-power',sorted[0][0]+' · '+num(sorted[0][1]));

// Both registers share one row renderer, including identity, record and place badge.
function register(items,isPower){
 const header='<div class="epl-register-head" aria-hidden="true"><span>#</span><span>Club</span><span>W–D–L</span><span>'+(isPower?'RETRO':'Pts')+'</span><span>'+(isPower?'Change':'RETRO')+'</span></div>';
 const body=items.map((t,i)=>{
  const value=r.ratings[t.club],delta=r.last_match_elo_delta?.[t.club];
  const change=Number.isFinite(delta)?(delta>0?'▲ +':delta<0?'▼ ':'')+num(delta):'—';
  return '<li class="epl-register-row'+(isPower?' epl-power-row':'')+'"><span class="epl-rank">'+(i+1)+'</span>'+team(t.club,idByTeam[t.club])+
   '<span class="epl-register-record">'+t.won+'–'+t.drawn+'–'+t.lost+'</span><strong class="epl-register-value">'+(isPower?num(value):t.points)+'</strong>'+
   '<span class="epl-register-secondary">'+(isPower?change:num(value))+'</span></li>';
 }).join('');
 return '<div class="epl-register">'+header+'<ol class="epl-register-list" aria-label="'+(isPower?'RETRO power rankings':'Premier League standings')+'">'+body+'</ol></div>';
}
const power=register(sorted.map(([club])=>standingByName.get(club)),true);
const rows=r.standings.map((t,i)=>'<tr class="'+(i<4?'epl-zone-top':i>=17?'epl-zone-bottom':'')+'"><td>'+String(i+1).padStart(2,'0')+'</td><td>'+team(t.club,idByTeam[t.club])+'</td><td>'+t.played+'</td><td>'+t.won+'–'+t.drawn+'–'+t.lost+'</td><td>'+t.gf+'</td><td>'+t.ga+'</td><td>'+((t.gd>0?'+':'')+t.gd)+'</td><td class="epl-pts">'+t.points+'</td><td>'+num(r.ratings[t.club])+'</td><td class="epl-form-cell">'+(r.last_five_form?.[t.club]||[]).map(v=>'<span class="epl-form-'+v.toLowerCase()+'">'+v+'</span>').join('')+'</td></tr>').join('');
const table='<div class="epl-table-scroll"><table class="epl-standings"><thead><tr><th>#</th><th>CLUB</th><th>P</th><th>W–D–L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th><th>ELO</th><th>FORM</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="epl-data-note">Based on '+r.completed_matches+' published finals · '+esc(r.as_of_date)+' · provisional Elo. Elo movement shown only when the replay export includes verified last-match deltas.</p>';
const forecast=fixtures.slice(0,5).map(g=>{const p=g.probabilities;return '<div class="epl-forecast-row"><span class="epl-score-date">'+date(g.kickoff_utc)+'</span><div class="epl-forecast-teams">'+team(g.home.name,g.home.id)+'<strong>vs</strong>'+team(g.away.name,g.away.id)+'</div><div class="epl-probability" aria-label="Home '+Math.round(p.home*100)+' percent, draw '+Math.round(p.draw*100)+' percent, away '+Math.round(p.away*100)+' percent"><i style="width:'+(100*p.home)+'%;background:'+esc(COLORS[g.home.name]||'#52695d')+'"></i><i style="width:'+(100*p.draw)+'%;background:#c1b39b"></i><i style="width:'+(100*p.away)+'%;background:'+esc(COLORS[g.away.name]||'#384b6b')+'"></i></div><div class="epl-prob-labels"><span>'+Math.round(p.home*100)+'% '+esc(g.home.name)+'</span><span>'+Math.round(p.draw*100)+'% draw</span><span>'+Math.round(p.away*100)+'% '+esc(g.away.name)+'</span></div><a class="epl-forecast-open" href="match-center.html?league=Premier%20League&amp;game='+encodeURIComponent(g.fixture_id)+'">Match details</a></div>'}).join('');
const attacks=[...r.standings].sort((a,b)=>b.gf-a.gf).slice(0,5).map((t,i)=>'<div class="epl-leader-row"><span class="epl-rank">'+(i+1)+'</span>'+team(t.club,idByTeam[t.club])+'<strong>'+t.gf+' <small>goals</small></strong></div>').join('');
const defense=[...r.standings].filter(t=>t.played>0).sort((a,b)=>a.ga/a.played-b.ga/b.played).slice(0,5).map((t,i)=>'<div class="epl-leader-row"><span class="epl-rank">'+(i+1)+'</span>'+team(t.club,idByTeam[t.club])+'<strong>'+num(t.ga/t.played)+' <small>GA/GP</small></strong></div>').join('');

const compact=register(r.standings,false);
const full='<details class="slt-full-table"><summary>Open full statistical table · GF, GA, GD, form</summary>'+table+'</details>';
const target=id=>document.getElementById(id);
if(target('epl-score-rail')){
 window.EPLMatchday={updateScores};
 target('epl-score-rail').innerHTML=rail;
}
if(target('epl-table-board'))target('epl-table-board').innerHTML=section('League Table','ORDERED BY LEAGUE POINTS',compact+full);
if(target('epl-power-board'))target('epl-power-board').innerHTML=section('RETRO Power 20','ORDERED BY INDEPENDENT RETRO',power);
if(target('epl-attack-board'))target('epl-attack-board').innerHTML=section('Best attacks','GOALS SCORED',attacks);
if(target('epl-defense-board'))target('epl-defense-board').innerHTML=section('Tightest defenses','GOALS ALLOWED PER MATCH',defense);
const top=target('epl-hero-clubs');
if(top)top.innerHTML=sorted.slice(0,4).map(([club,rating],i)=>'<a class="slt-hero-club" href="epl-club.html?club='+encodeURIComponent(idByTeam[club]||FIXED_IDS[club]||'')+'">'+crest(club,idByTeam[club])+'<strong>'+num(rating)+'</strong><small>#'+(i+1)+' '+esc(club)+'</small></a>').join('');
const heroNote=target('epl-hero-note');if(heroNote)heroNote.textContent='Rating edition '+r.as_of_date+' · '+r.completed_matches+' verified final scores';
const clubList=target('epl-club-directory');
if(clubList)clubList.innerHTML=r.standings.map((t,i)=>'<a class="slt-club-link" href="epl-club.html?club='+encodeURIComponent(idByTeam[t.club]||FIXED_IDS[t.club]||'')+'">'+crest(t.club,idByTeam[t.club])+'<span>'+esc(t.club)+'</span><small>'+(i+1)+'. · '+t.points+' pts · '+num(r.ratings[t.club])+' Elo</small></a>').join('');
if(status)status.textContent='Results through '+r.as_of_date+' · '+r.completed_matches+' verified finals · Scores and ratings from the current published edition';

}catch(e){
 console.error('EPL dashboard rendering failed:',e);
 if(status)status.textContent='EPL standings data currently unavailable.';
 if(root&&root!==status)root.innerHTML='<p role="status">EPL standings data currently unavailable.</p>';
 for(const id of ['epl-table-board','epl-power-board','epl-attack-board','epl-defense-board','epl-score-rail','epl-club-directory']){
  const mount=document.getElementById(id);
  if(mount)mount.innerHTML='<p role="status">Verified Premier League data could not be loaded. Please try again shortly.</p>';
 }
}}
load();
})();