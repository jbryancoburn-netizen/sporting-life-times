/* Shared NBL full-season club schedules, no dependence on failing multiweek ESPN API queries. */
(function(){
'use strict';
const root=document.getElementById('nbl-club-full-fixture');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const selected=()=>new URLSearchParams(location.search).get('team')||document.getElementById('nbl-club-picker')?.value||'Sydney Kings';
const date=s=>new Date(s).toLocaleString('en-AU',{timeZone:'Australia/Sydney',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
function render(data){
 const name=selected(),items=data.games.filter(g=>norm(g.home)===norm(name)||norm(g.away)===norm(name));
 const completed=items.filter(g=>g.state==='post').length,upcoming=items.filter(g=>g.state==='pre').length;
 const dates=items.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 root.innerHTML='<h2>Full-season club fixture</h2><p>'+items.length+' scheduled games · '+completed+' sourced finals · '+upcoming+' upcoming. '+(items.length===33?'All 33 regular-season fixtures are represented.':'WARNING: The club does not have all 33 required games.')+' Times are Sydney local.</p>'+
 (items.length?'<div class="nbl-fixture-scroll"><table><thead><tr><th>Date</th><th>Visitor</th><th>Home</th><th>Result</th><th>Arena</th><th>Television</th></tr></thead><tbody>'+dates.map(g=>{
  const result=g.state==='post'?g.away_score+'–'+g.home_score:(g.state==='in'?'LIVE '+(g.away_score??'')+'–'+(g.home_score??''):'Scheduled');
  return '<tr><td>'+esc(date(g.date))+'</td><td>'+esc(g.away)+'</td><td>'+esc(g.home)+'</td><td>'+esc(result)+'</td><td>'+esc(g.venue||'TBA')+'</td><td>'+esc(g.broadcasts.join(', ')||'TBA')+'</td></tr>';
 }).join('')+'</tbody></table></div>':'<p>Club fixtures could not be matched to the published season file.</p>')+
 '<small>FixtureDownload schedule candidates, with ESPN final-score candidates layered where available. Official NBL fixture-by-fixture certification remains pending. Verify against <a href="https://schedule.nbl.com.au/nbl" target="_blank" rel="noopener noreferrer">the NBL schedule</a>.'+(data.failedDates?' Recent live ESPN checks failed; results may lag.':'')+'</small>';
}
async function load(){try{
 if(!window.NBLFullSchedule)throw Error('Fixture library missing');
 const data=await window.NBLFullSchedule.load();
 render(data);
}catch(e){root.innerHTML='<h2>Full-season club fixture</h2><p>Cannot load the stored club fixture: '+esc(e.message)+'. <a href="https://schedule.nbl.com.au/nbl" target="_blank" rel="noopener noreferrer">Official NBL schedule ↗</a></p>';}}
load();setInterval(load,5*60*1000);
})();
