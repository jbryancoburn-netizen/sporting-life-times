/* Lazy, in-place match summaries. Only open live games poll; closed cards stay quiet. */
(()=>{'use strict';
const rail=document.getElementById('epl-score-rail');if(!rail)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=new WeakSet();
const priority={
 possessionPct:'Possession',totalShots:'Shots',shotsOnTarget:'Shots on target',
 wonCorners:'Corners',accuratePasses:'Accurate passes',saves:'Saves',
 foulsCommitted:'Fouls',yellowCards:'Yellow cards',redCards:'Red cards'
};
const number=value=>{
 const text=String(value??'').trim();
 return /^\d+(?:\.\d+)?%?$/.test(text)?Number.parseFloat(text):null;
};
function comparison(a,h,key){
 const away=number(a?.displayValue),home=number(h?.displayValue);
 const total=away+home;
 if(!Object.hasOwn(priority,key)||away===null||home===null||total===0)return '';
 return '<span class="epl-stat-bar" aria-hidden="true"><i style="flex-basis:'+100*away/total+'%"></i><i style="flex-basis:'+100*home/total+'%"></i></span>';
}
function statValue(entry,key){
 const value=entry?.displayValue;
 return key==='possessionPct'&&number(value)!==null?String(value).replace(/%$/,'')+'%':value??'—';
}
const playerColumns={totalGoals:'G',goalAssists:'A',totalShots:'SH',shotsOnTarget:'SOT',saves:'SV',yellowCards:'YC',redCards:'RC'};
function playerTable(roster,name){
 const players=roster.filter(p=>p.stats?.length&&(p.starter||p.subbedIn));
 if(!players.length)return '';
 const rows=players.map(p=>{
  const stats=new Map(p.stats.map(stat=>[stat.name,stat.displayValue]));
  return '<tr><th scope="row">'+esc(p.athlete?.shortName||p.athlete?.displayName||'Player')+'</th>'+
   Object.keys(playerColumns).map(key=>'<td>'+esc(stats.get(key)??'—')+'</td>').join('')+'</tr>';
 }).join('');
 const labels={G:'Goals',A:'Assists',SH:'Shots',SOT:'Shots on target',SV:'Saves',YC:'Yellow cards',RC:'Red cards'};
 return '<details class="epl-player-box"><summary>'+esc(name)+' player stats</summary><table><thead><tr><th scope="col">Player</th>'+
  Object.values(playerColumns).map(label=>'<th scope="col"><abbr title="'+labels[label]+'">'+label+'</abbr></th>').join('')+
  '</tr></thead><tbody>'+rows+'</tbody></table></details>';
}
function content(data){
 const game=data.header?.competitions?.[0];if(!game)throw Error('Match summary unavailable');
 const sides=['away','home'].map(side=>game.competitors?.find(t=>t.homeAway===side));
 if(sides.some(t=>!t))throw Error('Match teams unavailable');
 const teams=sides.map(t=>(data.boxscore?.teams||[]).find(x=>String(x.team?.id)===String(t.id||t.team?.id)));
 const maps=teams.map(t=>new Map((t?.statistics||[]).map(s=>[s.name,s])));
 const keys=[...new Set([...Object.keys(priority),...maps[0].keys(),...maps[1].keys()])].filter(key=>maps.some(map=>map.has(key)));
 const names=sides.map(t=>t.team?.shortDisplayName||t.team?.displayName||'Club');
 const rows=keys.map(key=>{
  const a=maps[0].get(key),h=maps[1].get(key);
  return '<tr><td>'+esc(statValue(a,key))+'</td><th scope="row">'+esc(priority[key]||a?.label||h?.label||key)+
   comparison(a,h,key)+'</th><td>'+esc(statValue(h,key))+'</td></tr>';
 }).join('');
 const stats=rows?'<h3>Match statistics</h3><table><thead><tr><th>'+esc(names[0])+' · Away</th><th>Statistic</th><th>'+esc(names[1])+' · Home</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="epl-stats-note">'+(game.status?.type?.state==='pre'?'Match statistics will appear after kickoff.':'Match statistics have not been supplied yet.')+'</p>';
 const events=(data.keyEvents||[]).filter(e=>e.text||e.shortText).map(e=>'<li><strong>'+esc(e.clock?.displayValue||'')+'</strong> '+esc(e.text||e.shortText)+'</li>').join('');
 const sheets=sides.map((side,index)=>{
  const id=String(side.team?.id||side.id);
  const t=(data.rosters||[]).find(team=>team.homeAway===side.homeAway||String(team.team?.id)===id);
  if(!t?.roster?.length)return {lineup:'',stats:''};
  const line=p=>esc([p.jersey,p.athlete?.displayName||p.athlete?.fullName,p.position?.abbreviation].filter(Boolean).join(' · '));
  const group=(players,title)=>players.length?'<h4>'+title+'</h4><ul>'+players.map(p=>'<li>'+line(p)+'</li>').join('')+'</ul>':'';
  return {lineup:'<section><h4>'+esc(names[index])+(t.formation?' · '+esc(t.formation):'')+'</h4>'+
   group(t.roster.filter(p=>p.starter),'Starting XI')+group(t.roster.filter(p=>!p.starter),'Bench')+'</section>',stats:playerTable(t.roster,names[index])};
 });
 const rosters=sheets.map(s=>s.lineup).join(''),players=sheets.map(s=>s.stats).join('');
 return {game,sides,html:'<p class="epl-stats-note"><strong>'+esc(game.status?.type?.shortDetail||game.status?.type?.description||'Match details')+'</strong> · '+esc(data.gameInfo?.venue?.fullName||'Venue not supplied')+'</p>'+stats+(events?'<h3>Match events</h3><ol>'+events+'</ol>':'')+(rosters?'<h3>Team sheets</h3><div class="epl-team-sheets">'+rosters+'</div>':'')+players+'<p class="epl-stats-note">Checked '+esc(new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))+'. Open live matches refresh every 30 seconds.</p><button type="button" data-epl-stats-retry>Refresh match stats</button>'};
}
async function load(details){
 if(!details.open||active.has(details))return;
 const card=details.closest('[data-epl-fixture]'),id=card?.dataset.eplFixture;if(!/^\d+$/.test(id||''))return;
 const panel=details.querySelector('.epl-match-stats');if(!panel)return;
 active.add(details);panel.setAttribute('aria-busy','true');
 if(!details.dataset.loaded)panel.innerHTML='<p role="status">Loading match statistics…</p>';
 try{
 const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event='+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Match summary unavailable');
 const data=await response.json();if(String(data.header?.id)!==id)throw Error('Fixture mismatch');
 const result=content(data);
 const openedPlayerTables=Array.from(panel.querySelectorAll?.('.epl-player-box')||[],table=>table.open);
 panel.innerHTML=result.html;
 panel.querySelectorAll?.('.epl-player-box').forEach((table,index)=>{table.open=Boolean(openedPlayerTables[index]);});
 details.dataset.loaded='true';details.dataset.matchState=result.game.status?.type?.state||'';
 const scores=card.querySelectorAll('.ledger26-points');result.sides.forEach((t,i)=>{if(scores[i])scores[i].textContent=result.game.status?.type?.state==='pre'?'—':String(t.score??'—')});
 }catch(error){if(!details.dataset.loaded)panel.innerHTML='<p role="status">Match statistics are temporarily unavailable. Try refreshing this game.</p><button type="button" data-epl-stats-retry>Retry match stats</button>';}
 finally{active.delete(details);panel.removeAttribute('aria-busy');}
}
rail.addEventListener('toggle',event=>{if(event.target.matches('details.ledger26-expand')&&event.target.open)load(event.target)},true);
rail.addEventListener('click',event=>{if(event.target.closest('[data-epl-stats-retry]'))load(event.target.closest('details'))});
setInterval(()=>{if(!document.hidden)rail.querySelectorAll('details.ledger26-expand[open]').forEach(d=>{if(d.dataset.matchState!=='post')load(d)})},30000);
})();
