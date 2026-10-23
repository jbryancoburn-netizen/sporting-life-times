(()=>{'use strict';
const el=document.getElementById('nba-player-notebook'),status=document.getElementById('nba-player-notebook-status');
if(!el||!status)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=x=>{const v=Number(x);return Number.isFinite(v)?v:0};
(async()=>{
try{
 const response=await fetch('data/nba-game-center.json',{cache:'no-store'});
 if(!response.ok)throw Error('Archive unavailable');
 const data=await response.json();
 const games=(data.games||[]).filter(g=>g.state==='post'&&Array.isArray(g.players)&&g.players.length);
 const ps=new Map();
 for(const g of games)for(const p of g.players){
  if(!p.id||!p.name)continue;
  let x=ps.get(p.id)||{name:p.name,team:p.team,gp:0,pts:0,fgm:0,fga:0,fg3m:0,ftm:0,fta:0,ast:0,tov:0,stl:0,blk:0};
  x.gp++;for(const k of ['pts','fgm','fga','fg3m','ftm','fta','ast','tov','stl','blk'])x[k]+=num(p[k]);ps.set(p.id,x);
 }
 const all=[...ps.values()];
 if(!all.length){status.textContent='Individual player box scores not yet captured · No invented statistics';el.innerHTML='<p class="hub-small">The official game archive currently has no verified player rows. <a href="https://www.nba.com/stats/players/traditional" target="_blank" rel="noopener noreferrer">See official individual player statistics ↗</a></p>';return;}
 const categories=[
  ['Three-pointers made','3PM',p=>p.fg3m,p=>p.fg3m>=1],
  ['Scoring efficiency','TS%',p=>p.pts/(2*(p.fga+.44*p.fta))*100,p=>p.fga+.44*p.fta>=8],
  ['Playmaking security','AST/TO',p=>p.ast/p.tov,p=>p.ast>=3&&p.tov>=1],
  ['Defensive disruption','STL+BLK',p=>p.stl+p.blk,p=>p.stl+p.blk>=1]
 ];
 el.innerHTML='<div class="nba-early-leader-grid">'+categories.map(([title,unit,metric,valid])=>{
  const leaders=all.filter(valid).map(p=>({...p,v:metric(p)})).filter(p=>Number.isFinite(p.v)).sort((a,b)=>b.v-a.v||a.name.localeCompare(b.name)).slice(0,5);
  return '<div class="nba-early-leader"><h3>'+esc(title)+'</h3><table class="nba-mini-table"><thead><tr><th>Player</th><th>GP</th><th>'+unit+'</th></tr></thead><tbody>'+(leaders.length?leaders.map(p=>'<tr><th>'+esc(p.name)+' <small>'+esc(p.team)+'</small></th><td>'+p.gp+'</td><td>'+p.v.toFixed(unit==='TS%'?1:unit==='AST/TO'?2:0)+'</td></tr>').join(''):'<tr><td colspan="3">Insufficient verified observations</td></tr>')+'</tbody></table></div>';
 }).join('')+'</div>';
 status.textContent=games.length+' captured final box scores · '+all.length+' players · Incomplete sample; not official season leaders';
}catch(e){status.textContent='Player-stat source unavailable';el.textContent='Individual player metrics unavailable; no estimated values displayed.';}
})();
})();