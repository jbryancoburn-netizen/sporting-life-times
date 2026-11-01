/* Women-only season statistics: verified final-score ledger first; player data separately attributed. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const https=v=>typeof v==='string'&&/^https:\/\//.test(v)?v:'';
const number=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:
  typeof n==='string'&&/^\d+$/.test(n)?Number(n):NaN;
const round=n=>(Math.round(n*10)/10).toFixed(1);
function summarizeFinals(data,teamId){
 if(data?.season!=='2026-27'||!Array.isArray(data.games))return null;
 const occur=new Map();
 for(const g of data.games){
  const id=String(g?.id??'');
  if(/^\d+$/.test(id))occur.set(id,(occur.get(id)||0)+1);
 }
 let games=0,wins=0,losses,pointsFor=0,pointsAgainst=0;
 losses=0;
 for(const g of data.games){
  const id=String(g?.id??'');
  if(!/^\d+$/.test(id)||occur.get(id)!==1||g.status!=='final'||g.completed===false)continue;
  const day=String(g.date||'').slice(0,10);
  if(day<'2026-11-01'||day>'2027-04-30')continue;
  const home=String(g.home_id)===String(teamId),away=String(g.away_id)===String(teamId);
  if(home===away||String(g.home_id)===String(g.away_id))continue;
  const h=number(g.home_score),a=number(g.away_score);
  if(!Number.isFinite(h)||!Number.isFinite(a)||h===a)continue;
  games++;
  const ours=home?h:a,theirs=home?a:h;
  wins+=+(ours>theirs);losses+=+(ours<theirs);
  pointsFor+=ours;pointsAgainst+=theirs;
 }
 return {games,wins,losses,pointsFor,pointsAgainst,
  ppg:games?round(pointsFor/games):null,
  allowed:games?round(pointsAgainst/games):null,
  margin:games?round((pointsFor-pointsAgainst)/games):null,
  asOf:data.as_of||null};
}
function teamMarkup(stats){
 if(!stats||!stats.games)return '<div class="wbb-season-awaiting"><strong>2026–27 season statistics</strong><p>No women’s Division I final has been published for this team. Every team began at 1500 Elo; only completed games count toward this record.</p></div>';
 const fields=[
  ['Record',stats.wins+'–'+stats.losses],
  ['Games',stats.games],
  ['Points / game',stats.ppg],
  ['Allowed / game',stats.allowed],
  ['Scoring margin',((Number(stats.margin)>0)?'+':'')+stats.margin]
 ];
 return '<div class="wbb-stat-grid wbb-verified-stat-grid">'+fields.map(([name,value])=>
  '<div class="wbb-stat"><small>'+esc(name)+'</small><strong>'+esc(value)+'</strong></div>').join('')+'</div>'+
  '<p class="wbb-muted">2026–27 women’s games · calculated exclusively from '+stats.games+
  ' published final'+(stats.games===1?'':'s')+'. Opponent statistics and scoring margin are results-based, not projections. '+
  '<a href="ncaam.html?gender=women#wbb-games">Verified women’s results ↗</a></p>';
}
function validatedESPN(data,teamId){
 if(data?.status!=='success'||Number(data.requestedSeason?.year)!==2027||String(data.team?.id)!==String(teamId))return null;
 const totals=new Map((Array.isArray(data.teamTotals)?data.teamTotals:[]).flatMap(c=>c.stats||[]).filter(s=>s?.name).map(s=>[s.name,s]));
 if(!(Number(totals.get('gamesPlayed')?.value)>0))return null;
 const fields=[
  ['fieldGoalPct','Field goal %'],['threePointFieldGoalPct','Three-point %'],
  ['freeThrowPct','Free throw %'],['avgRebounds','Rebounds / game'],
  ['avgAssists','Assists / game'],['avgSteals','Steals / game'],['avgBlocks','Blocks / game']
 ].filter(([k])=>totals.has(k)&&Number.isFinite(Number(totals.get(k).value)));
 const people=(Array.isArray(data.results)?data.results:[]).flatMap(g=>g.leaders||[])
   .filter(p=>p?.athlete?.id&&p.athlete?.displayName);
 const uniq=[...new Map(people.map(p=>[String(p.athlete.id),p])).values()]
   .map(p=>({...p,values:new Map((p.statistics||[]).flatMap(g=>g.stats||[]).filter(v=>v?.name).map(v=>[v.name,v]))}));
 return {fields,totals,people:uniq};
}
async function render(id){
 const host=document.getElementById('wbb-team-stats');
 if(!host)return;
 host.innerHTML='<p class="wbb-muted">Checking published 2026–27 women’s final scores…</p>';
 let source=null;
 try{
  const r=await fetch('data/ncaaw-2026-27-verified-games.json',{cache:'no-store'});
  if(!r.ok)throw Error('final scoreboard unavailable');
  source=await r.json();
 }catch{}
 const summary=summarizeFinals(source,id);
 host.innerHTML=summary?teamMarkup(summary):'<div class="wbb-season-awaiting"><strong>Verified team statistics unavailable</strong><p>The women’s final-score ledger could not be validated. We will not substitute men’s or earlier-season results.</p></div>';
 const panel=document.createElement('section');
 panel.className='wbb-player-leaders-panel';
 panel.innerHTML='<h3>2026–27 Player Leaders</h3><p class="wbb-muted">Checking current-season women’s statistics…</p>';
 host.appendChild(panel);
 const url='https://site.web.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/'+encodeURIComponent(id)+'/athletes/statistics?season=2027';
 try{
  const resp=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!resp.ok)throw Error('statistics source unavailable');
  const data=validatedESPN(await resp.json(),id);
  if(!data)throw Error('current-season player statistics not yet validated');
  if(data.fields.length){
   const html=data.fields.map(([key,label])=>'<div class="wbb-stat"><small>'+esc(label)+'</small><strong>'+
    esc(data.totals.get(key).displayValue||Number(data.totals.get(key).value).toFixed(1))+'</strong></div>').join('');
   panel.insertAdjacentHTML('beforebegin','<div class="wbb-stat-extra"><h3>Additional Women’s Team Statistics</h3>'+
     '<div class="wbb-stat-grid">'+html+'</div><p class="wbb-muted">Current 2026–27 ESPN women’s statistics · '+
     esc(data.totals.get('gamesPlayed').displayValue)+' reported games. <a href="'+esc(url)+
     '" target="_blank" rel="noopener noreferrer">Statistics source ↗</a></p></div>');
  }
  const categories=[['avgPoints','Scoring'],['avgRebounds','Rebounding'],['avgAssists','Assists'],
   ['avgSteals','Steals'],['avgBlocks','Blocks']];
  if(!data.people.length)throw Error('verified player leaders not yet available');
  const options=categories.filter(([k])=>data.people.some(p=>Number(p.values.get('gamesPlayed')?.value)>0&&Number.isFinite(Number(p.values.get(k)?.value))));
  if(!options.length)throw Error('verified player leaders not yet available');
  panel.innerHTML='<h3>2026–27 Player Leaders</h3><label class="wbb-roster-filter-label">Statistic <select id="wbb-leader-stat">'+
    options.map(([key,label])=>'<option value="'+esc(key)+'">'+esc(label)+' / game</option>').join('')+
    '</select></label><div id="wbb-leader-grid" class="wbb-roster-grid"></div>'+
    '<p class="wbb-muted">Current women’s player statistics · <a href="'+esc(url)+
    '" target="_blank" rel="noopener noreferrer">ESPN source ↗</a></p>';
  const select=panel.querySelector('#wbb-leader-stat'),grid=panel.querySelector('#wbb-leader-grid');
  const draw=()=>{
   const selected=select.value;
   grid.innerHTML=data.people.filter(p=>Number(p.values.get('gamesPlayed')?.value)>0&&
     Number.isFinite(Number(p.values.get(selected)?.value)))
    .sort((a,b)=>Number(b.values.get(selected).value)-Number(a.values.get(selected).value))
    .slice(0,5).map(p=>{
     const photo=https(p.athlete.headshot?.href);
     const link=https((p.athlete.links||[]).find(x=>x.rel?.includes('playercard'))?.href);
     return '<article class="wbb-player-card">'+(photo?'<div class="wbb-player-avatar"><img src="'+esc(photo)+'" alt="" loading="lazy"></div>':'')+
      '<div class="wbb-player-body"><strong>'+esc(p.athlete.displayName)+'</strong>'+
      '<span class="wbb-player-meta">'+esc(p.values.get(selected).displayValue)+' per game</span>'+
      (link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Player profile ↗</a>':'')+
      '</div></article>';
    }).join('');
  };
  select.addEventListener('change',draw);draw();
 }catch{
  panel.innerHTML='<h3>2026–27 Player Leaders</h3><p class="wbb-muted">Current-season women’s player statistics are not yet available from the connected statistics source. Verified team results above remain current; no men’s or previous-season player data are substituted.</p>';
 }
}
w.WBBTeamStats={render,summarizeFinals,teamMarkup,validatedESPN};
})(window);
