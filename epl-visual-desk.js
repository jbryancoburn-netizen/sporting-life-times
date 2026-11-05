(()=>{'use strict';
const root=document.querySelector('#epl-visual-desk');if(!root)return;
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
const [r,f]=await Promise.all(['data/epl-ratings.json','data/epl-match-center.json'].map(async p=>{const x=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!x.ok)throw Error(p);return x.json()}));
if(!Array.isArray(r.standings)||r.standings.length!==20||!r.ratings||Object.keys(r.ratings).length!==20||!Array.isArray(f.fixtures))throw Error('Incomplete EPL data');
// Forecast exports may omit finals. The verified season ledger owns results.
const resultSource=Array.isArray(r.season_results)?r.season_results:f.recent_results;
if(!Array.isArray(resultSource))throw Error('Verified EPL results unavailable');
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
function eplLedger(g,done){
 const away=typeof g.away==='string'?{name:g.away,id:idByTeam[g.away]}:g.away;
 const home=typeof g.home==='string'?{name:g.home,id:idByTeam[g.home]}:g.home;
 const side=(t,points)=>{
  const st=standingByName.get(t.name),elo=r.ratings[t.name];
  return {name:t.name,score:done?points:null,crest:crest(t.name,t.id),
   color:COLORS[t.name]||'#655239',
   record:st?st.won+'–'+st.drawn+'–'+st.lost:'Record unavailable',
   retro:Number.isFinite(Number(elo))?'RETRO '+Math.round(Number(elo))+
    (rankFor.get(t.name)?' ('+rankFor.get(t.name)+')':''):'RETRO —'};
 };
 const bug=window.SLTSportsScorebug?.render({phase:done?'final':'upcoming',
   time:done?'':date(g.kickoff_utc)+' ET',network:g.network||g.broadcast||'',away:side(away,g.away_score),home:side(home,g.home_score)
 })||'<p>Scorebug unavailable.</p>';
 const path=done?'epl-match-report.html?game='+encodeURIComponent(g.fixture_id):
   'match-center.html?league=Premier%20League&game='+encodeURIComponent(g.fixture_id);
 return '<article class="ledger26-card epl-master-card" data-epl-fixture="'+esc(g.fixture_id)+'">'+
  '<div class="ledger26-meta"><span>'+esc(g.venue||'Premier League')+'</span>'+
  '<span>'+esc(date(g.kickoff_utc))+' ET</span></div>'+
  '<details class="ledger26-expand"><summary class="ledger26-summary">'+bug+
  '<span class="ledger26-instruction">MATCH STATS · CLICK TO EXPAND +</span></summary>'+
  '<div class="ledger26-expanded epl-match-stats" aria-live="polite"><p class="epl-stats-note">Open this game to load match statistics.</p></div>'+
  '</details></article>';
}
const upcomingTiles=upcomingGames.slice(0,4).map(g=>eplLedger(g,false)).join('');
const finals=recentResults.slice(0,6).map(g=>eplLedger(g,true)).join('');
const rail='<div class="epl-score-rail">'+upcomingTiles+finals+'</div>';
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
if(target('epl-score-rail'))target('epl-score-rail').innerHTML=rail||'<p>Verified finals are not available in this match snapshot.</p>';
if(target('epl-table-board'))target('epl-table-board').innerHTML=section('League Table','ORDERED BY LEAGUE POINTS',compact+full);
if(target('epl-power-board'))target('epl-power-board').innerHTML=section('RETRO Power 20','ORDERED BY INDEPENDENT RETRO',power);
if(target('epl-attack-board'))target('epl-attack-board').innerHTML=section('Best attacks','GOALS SCORED',attacks);
if(target('epl-defense-board'))target('epl-defense-board').innerHTML=section('Tightest defenses','GOALS ALLOWED PER MATCH',defense);
const top=target('epl-hero-clubs');
if(top)top.innerHTML=sorted.slice(0,4).map(([club,rating],i)=>'<a class="slt-hero-club" href="epl-club.html?club='+encodeURIComponent(idByTeam[club]||FIXED_IDS[club]||'')+'">'+crest(club,idByTeam[club])+'<strong>'+num(rating)+'</strong><small>#'+(i+1)+' '+esc(club)+'</small></a>').join('');
const heroNote=target('epl-hero-note');if(heroNote)heroNote.textContent='Rating edition '+r.as_of_date+' · '+r.completed_matches+' verified final scores';
const clubList=target('epl-club-directory');
if(clubList)clubList.innerHTML=r.standings.map((t,i)=>'<a class="slt-club-link" href="epl-club.html?club='+encodeURIComponent(idByTeam[t.club]||FIXED_IDS[t.club]||'')+'">'+crest(t.club,idByTeam[t.club])+'<span>'+esc(t.club)+'</span><small>'+(i+1)+'. · '+t.points+' pts · '+num(r.ratings[t.club])+' Elo</small></a>').join('');
root.textContent='Results through '+r.as_of_date+' · '+r.completed_matches+' verified finals · Scores and ratings from the current published edition';

}catch(e){console.error('EPL dashboard rendering failed:',e);root.innerHTML='<p role="status">EPL visual dashboard unavailable. Published model data could not be verified.</p>';}}
load();
})();