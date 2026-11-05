/* Lazy, in-place match summaries. Only open live games poll; closed cards stay quiet. */
(()=>{'use strict';
const rail=document.getElementById('epl-score-rail');if(!rail)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=new WeakSet();
function content(data){
 const game=data.header?.competitions?.[0];if(!game)throw Error('Match summary unavailable');
 const sides=['away','home'].map(side=>game.competitors?.find(t=>t.homeAway===side));
 if(sides.some(t=>!t))throw Error('Match teams unavailable');
 const teams=sides.map(t=>(data.boxscore?.teams||[]).find(x=>String(x.team?.id)===String(t.id||t.team?.id)));
 const maps=teams.map(t=>new Map((t?.statistics||[]).map(s=>[s.name,s])));
 const keys=[...new Set([...maps[0].keys(),...maps[1].keys()])];
 const names=sides.map(t=>t.team?.shortDisplayName||t.team?.displayName||'Club');
 const rows=keys.map(key=>{const a=maps[0].get(key),h=maps[1].get(key);return '<tr><td>'+esc(a?.displayValue??'—')+'</td><th scope="row">'+esc(a?.label||h?.label||key)+'</th><td>'+esc(h?.displayValue??'—')+'</td></tr>'}).join('');
 const stats=rows?'<h3>Match statistics</h3><table><thead><tr><th>'+esc(names[0])+' · Away</th><th>Statistic</th><th>'+esc(names[1])+' · Home</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="epl-stats-note">'+(game.status?.type?.state==='pre'?'Match statistics will appear after kickoff.':'Match statistics have not been supplied yet.')+'</p>';
 const events=(data.keyEvents||[]).filter(e=>e.text||e.shortText).map(e=>'<li><strong>'+esc(e.clock?.displayValue||'')+'</strong> '+esc(e.text||e.shortText)+'</li>').join('');
 const rosters=['away','home'].map(side=>(data.rosters||[]).find(t=>t.homeAway===side)).filter(Boolean).map(t=>'<h3>'+esc(t.team?.displayName)+' lineup</h3><p class="epl-stats-note">'+(t.roster||[]).filter(p=>p.starter).map(p=>esc(p.athlete?.displayName||p.athlete?.fullName||'')).filter(Boolean).join(' · ')+'</p>').join('');
 return {game,sides,html:'<p class="epl-stats-note"><strong>'+esc(game.status?.type?.shortDetail||game.status?.type?.description||'Match details')+'</strong> · '+esc(data.gameInfo?.venue?.fullName||'Venue not supplied')+'</p>'+stats+(events?'<h3>Match events</h3><ol>'+events+'</ol>':'')+rosters+'<p class="epl-stats-note">Checked '+esc(new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))+'. Open live matches refresh every 30 seconds.</p><button type="button" data-epl-stats-retry>Refresh match stats</button>'};
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
 const result=content(data);panel.innerHTML=result.html;details.dataset.loaded='true';details.dataset.matchState=result.game.status?.type?.state||'';
 const scores=card.querySelectorAll('.ledger26-points');result.sides.forEach((t,i)=>{if(scores[i])scores[i].textContent=result.game.status?.type?.state==='pre'?'—':String(t.score??'—')});
 }catch(error){panel.innerHTML='<p role="status">Match statistics are temporarily unavailable. Try refreshing this game.</p><button type="button" data-epl-stats-retry>Retry match stats</button>';}
 finally{active.delete(details);panel.removeAttribute('aria-busy');}
}
rail.addEventListener('toggle',event=>{if(event.target.matches('details.ledger26-expand')&&event.target.open)load(event.target)},true);
rail.addEventListener('click',event=>{if(event.target.closest('[data-epl-stats-retry]'))load(event.target.closest('details'))});
setInterval(()=>{if(!document.hidden)rail.querySelectorAll('details[open]').forEach(d=>{if(d.dataset.matchState!=='post')load(d)})},30000);
})();
