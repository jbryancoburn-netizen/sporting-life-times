/* Current-season women-only statistics. Prior-season data is never substituted. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function render(id){
 const host=document.getElementById('wbb-team-stats');if(!host)return;
 const url='https://site.web.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/'+encodeURIComponent(id)+'/athletes/statistics?season=2027';
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Statistics unavailable');
  const data=await res.json();
  if(data.status!=='success'||Number(data.requestedSeason?.year)!==2027||String(data.team?.id)!==String(id))throw Error('No current-season statistics');
  const stats=new Map((data.teamTotals||[]).flatMap(c=>c.stats||[]).map(s=>[s.name,s]));
  if(!(Number(stats.get('gamesPlayed')?.value)>0))throw Error('Season has not started');
  const fields=[['avgPoints','Points / game'],['avgRebounds','Rebounds / game'],['avgAssists','Assists / game'],['fieldGoalPct','Field goal %'],['threePointFieldGoalPct','Three point %'],['freeThrowPct','Free throw %'],['avgSteals','Steals / game'],['avgBlocks','Blocks / game']];
  host.innerHTML='<div class="wbb-stat-grid">'+fields.filter(([key])=>stats.has(key)).map(([key,label])=>'<div class="wbb-stat"><small>'+label+'</small><strong>'+esc(stats.get(key).displayValue)+'</strong></div>').join('')+'</div><p class="wbb-muted">2026–27 women’s season · '+esc(stats.get('gamesPlayed').displayValue)+' games · <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">ESPN statistics source ↗</a></p>';
  const people=(Array.isArray(data.results)?data.results:[]).flatMap(group=>group.leaders||[]).filter(p=>p.athlete?.id&&p.athlete?.displayName);
  const unique=[...new Map(people.map(p=>[String(p.athlete.id),p])).values()].map(p=>({...p,values:new Map((p.statistics||[]).flatMap(c=>c.stats||[]).map(v=>[v.name,v]))}));
  if(unique.length){
   const options=[['avgPoints','Points'],['avgRebounds','Rebounds'],['avgAssists','Assists'],['avgSteals','Steals'],['avgBlocks','Blocks']];
   host.insertAdjacentHTML('beforeend','<h3>Player Leaders</h3><label class="wbb-roster-filter-label">Statistic <select id="wbb-leader-stat">'+options.map(([key,label])=>'<option value="'+key+'">'+label+' per game</option>').join('')+'</select></label><div id="wbb-leader-grid" class="wbb-roster-grid"></div>');
   const select=host.querySelector('#wbb-leader-stat'),grid=host.querySelector('#wbb-leader-grid');
   const draw=()=>{grid.innerHTML=unique.filter(p=>Number(p.values.get('gamesPlayed')?.value)>0&&p.values.has(select.value)).sort((a,b)=>Number(b.values.get(select.value).value)-Number(a.values.get(select.value).value)).slice(0,5).map(p=>{
    const athlete=p.athlete,photo=athlete.headshot?.href,href=(athlete.links||[]).find(l=>l.rel?.includes('playercard'))?.href;
    return '<article class="wbb-player-card">'+(/^https:\/\//.test(photo||'')?'<div class="wbb-player-avatar"><img src="'+esc(photo)+'" alt="" loading="lazy"></div>':'')+'<div class="wbb-player-body"><strong>'+esc(athlete.displayName)+'</strong><span class="wbb-player-meta">'+esc(p.values.get(select.value).displayValue)+' per game</span>'+(/^https:\/\//.test(href||'')?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Player profile ↗</a>':'')+'</div></article>';
   }).join('');};select.addEventListener('change',draw);draw();
  }

 }catch{
  host.innerHTML='<div class="wbb-season-awaiting"><strong>Season statistics</strong><p>2026–27 team statistics and scoring, rebounding and assist leaders are awaiting published women’s results. Check the full schedule above for the next tipoff.</p></div>';
 }
}
w.WBBTeamStats={render};
})(window);
