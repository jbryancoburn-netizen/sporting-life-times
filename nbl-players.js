(()=>{'use strict';
const root=document.getElementById('nbl-players-app');if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('Player-stat archive not published yet');return r.json()};
const cat=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const stat=(row,keys)=>{for(const k of keys){for(const [key,v] of Object.entries(row.stats||{}))if(cat(key)===cat(k)){let n=Number(v);if(Number.isFinite(n))return n}}return null};
const clubLink=t=>'nbl-team.html?team='+encodeURIComponent(t);
const logo=t=>'<img class="nbl-depth-logo" alt="" loading="lazy" src="assets/nbl-logos/'+cat(t)+'.png">';
Promise.all([data('data/nbl-player-boxscores.json'),data('data/nbl-standings.json')]).then(([box,stand])=>{
const availability=document.getElementById('nbl-player-availability');
availability.textContent=box.games_with_player_boxes+' of '+box.games_expected+' completed games include sourced player box scores. Incomplete or inaccessible games are excluded.';
if(!box.games.length){root.innerHTML='<p>No complete player box scores could be retrieved in the current archive. <a href="https://www.nbl.com.au/stats/statistics">Official NBL player statistics ↗</a></p>';return}
const normalizeName=t=>stand.rows.some(x=>x.team===t)?t:null;
const selected=new URLSearchParams(location.search).get('game');
if(document.body.dataset.playerPage==='boxes'){
const opts=box.games.slice().reverse().map(g=>'<option value="'+esc(g.id)+'">'+esc(new Date(g.date).toLocaleDateString())+' · '+esc(g.away)+' at '+esc(g.home)+'</option>').join('');
root.innerHTML='<label class="nbl-box-picker">Choose a completed game<select id="nbl-game-select">'+opts+'</select></label><div id="nbl-game-box"></div>';
const select=document.getElementById('nbl-game-select');if(selected&&box.games.some(g=>g.id===selected))select.value=selected;
function render(){const g=box.games.find(x=>x.id===select.value),node=document.getElementById('nbl-game-box');
node.innerHTML='<div class="nbl-box-scoreline"><div>'+logo(g.away)+'<strong>'+esc(g.away)+'</strong><b>'+g.away_score+'</b></div><div>'+logo(g.home)+'<strong>'+esc(g.home)+'</strong><b>'+g.home_score+'</b></div></div>'+g.teams.map(t=>'<section class="nbl-depth-panel"><h2>'+esc(t.team)+'</h2><div class="table-wrap"><table class="nbl-player-table"><thead><tr><th>Player</th>'+esc(t.players[0]?.labels?.join(' · ')||'').split(' · ').map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+t.players.map(a=>'<tr><th>'+esc(a.name)+'</th>'+a.raw.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>').join('')+(g.source_url?'<p><a href="'+esc(g.source_url)+'" target="_blank" rel="noopener noreferrer">Original game report ↗</a></p>':'');
}select.addEventListener('change',render);render();
}else{
const athletes=new Map;
for(const g of box.games)for(const t of g.teams)for(const a of t.players){
 const points=stat(a,['points','pts']),rebounds=stat(a,['rebounds','totalRebounds','reb']),assists=stat(a,['assists','ast']),steals=stat(a,['steals','stl']),blocks=stat(a,['blocks','blk']);
 if(points===null&&rebounds===null&&assists===null)continue;
 const id=a.id||a.name+'|'+t.team,key=id+'|'+t.team;
 let r=athletes.get(key)||{name:a.name,team:t.team,gp:0,points:0,rebounds:0,assists:0,steals:0,blocks:0,observations:{}};
 r.gp++;for(const [k,v] of Object.entries({points,rebounds,assists,steals,blocks}))if(v!==null){r[k]+=v;r.observations[k]=(r.observations[k]||0)+1}
 athletes.set(key,r);
}
const people=[...athletes.values()],categories=[['points','Scoring'],['rebounds','Rebounds'],['assists','Assists'],['steals','Steals'],['blocks','Blocks']];
root.innerHTML='<p class="nbl-depth-note">Per-game rates are calculated only from games with published player-stat lines. Partial coverage may affect rankings; minimum 2 recorded games for display.</p><div class="nbl-player-leaders">'+categories.map(([k,title])=>{let candidates=people.filter(x=>x.observations[k]>=2).sort((a,b)=>b[k]/b.observations[k]-a[k]/a.observations[k]).slice(0,12);return '<section class="nbl-depth-panel"><div class="nbl-depth-eyebrow">THE LEADERS</div><h2>'+title+' per game</h2>'+candidates.map((r,i)=>'<div class="nbl-depth-item"><span class="nbl-depth-number">'+(i+1)+'</span>'+logo(r.team)+'<a href="'+esc(clubLink(r.team))+'"><strong>'+esc(r.name)+'</strong><small>'+esc(r.team)+' · '+r.observations[k]+' games</small></a><b>'+(r[k]/r.observations[k]).toFixed(1)+'</b></div>').join('')+'</section>'}).join('')+'</div>';
}
}).catch(e=>{document.getElementById('nbl-player-availability').textContent='Player statistics are awaiting publication.';root.innerHTML='<p>Player box scores are not yet available in the newspaper archive. <a href="https://www.nbl.com.au/stats/statistics">View NBL official player stats ↗</a></p>'});
})();