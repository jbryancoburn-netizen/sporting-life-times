/* Expanded women-only game box scores. Verifies selected school before rendering. */
(()=>{'use strict';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const team=new URLSearchParams(location.search).get('team')||new URLSearchParams(location.search).get('id');
if(!/^\d+$/.test(team||''))return;
const table=(heading,columns,rows,klass='')=>{
 if(!rows.length)return '';
 return '<section class="wbb-stat-block"><h3>'+safe(heading)+'</h3><table class="'+klass+'"><thead><tr>'+columns.map(c=>'<th scope="col">'+safe(c)+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+row.map((value,i)=>i===0?'<th scope="row">'+safe(value)+'</th>':'<td data-label="'+safe(columns[i]||'')+'">'+safe(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';
};
async function retrieve(eventId,holder){
 const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event='+encodeURIComponent(eventId),{signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw Error('Game box score unavailable');
 const data=await response.json();
 const competitors=data.header?.competitions?.[0]?.competitors||[];
 if(!competitors.some(c=>String(c.team?.id)===String(team)))throw Error('Game identity does not match selected school');
 const box=data.boxscore||{};
 let html='';
 const periods=competitors.filter(c=>Array.isArray(c.linescores)&&c.linescores.length);
 if(periods.length){
  const n=Math.max(...periods.map(c=>c.linescores.length));
  const columns=['University',...Array.from({length:n},(_,i)=>'Period '+(i+1)),'Final'];
  html+=table('Period by Period',columns,periods.map(c=>[c.team?.displayName||c.team?.name||'School',...Array.from({length:n},(_,i)=>c.linescores[i]?.displayValue??c.linescores[i]?.value??'—'),c.score??'—']));
 }
 const teams=box.teams||[];
 if(teams.length){
  const labels=[...new Set(teams.flatMap(t=>(t.statistics||[]).map(s=>s.label||s.name).filter(Boolean)))];
  if(labels.length){
   const columns=['Team Statistic',...teams.map(t=>t.team?.displayName||t.team?.name||'School')];
   html+=table('Team Box Score',columns,labels.map(label=>[label,...teams.map(t=>{const stat=(t.statistics||[]).find(s=>(s.label||s.name)===label);return stat?.displayValue??stat?.value??'—';})]));
  }
 }
 for(const group of box.players||[]){
  const section=group.statistics?.[0];
  const players=section?.athletes||[],labels=section?.labels||[];
  if(!players.length)continue;
  html+=table((group.team?.displayName||group.team?.name||'School')+' — Players',['Player',...labels],players.map(p=>[p.athlete?.displayName||p.athlete?.shortName||'Player',...(p.stats||[])]),'wbb-player-game-box');
 }
 const game=data.header?.competitions?.[0];
 const venue=game?.venue||{};
 if(venue.fullName||venue.address?.city||game?.attendance){
  html+='<section class="wbb-stat-block"><h3>Game Details</h3><p>'+
    [venue.fullName,[venue.address?.city,venue.address?.state].filter(Boolean).join(', '),game.attendance?'Attendance: '+Number(game.attendance).toLocaleString('en-US'):''].filter(Boolean).map(safe).join(' · ')+'</p></section>';
 }
 holder.innerHTML=html||'<p>Detailed statistics have not been published for this verified game.</p>';
 holder.dataset.loaded='true';
}
document.addEventListener('click',async e=>{
 const button=e.target.closest('.wbb-stat-toggle');
 if(!button)return;
 const id=button.dataset.event;
 if(!/^\d+$/.test(id||''))return;
 const row=button.closest('tr'),detail=document.getElementById('wbb-detail-'+id);
 if(!row||!detail||row.dataset.gameId!==id)return;
 const opening=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(opening));
 button.textContent=opening?'Close Stats ▴':'Game Stats ▾';
 detail.hidden=!opening;
 if(!opening)return;
 const holder=detail.querySelector('.wbb-game-stats');
 if(!holder||holder.dataset.loaded||holder.dataset.pending)return;
 holder.dataset.pending='true';
 holder.textContent='Retrieving published women’s box score…';
 try{await retrieve(id,holder)}catch(error){holder.textContent=error.message+'. This game’s verified result remains in the schedule.'}
 finally{delete holder.dataset.pending}
});
})();