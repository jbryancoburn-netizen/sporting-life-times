(()=>{'use strict';
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dateshift=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')};
const logo=id=>'https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(id)+'.png';
const fmt=d=>new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const asRow=g=>'<article class="score-row"><div class="teams">'+g.teams.map(t=>'<a class="score-team" href="cfb-team.html?team='+encodeURIComponent(t.id)+'"><img loading="lazy" alt="" src="'+logo(t.id)+'"><span>'+safe(t.name)+'</span><strong>'+safe(t.score??'')+'</strong></a>').join('')+'</div><div class="score-status">'+safe(g.status)+'<div class="score-meta">'+safe(fmt(g.date))+'</div></div></article>';
let lastPublished=null,lastGames=[];
async function update(){
const stamp=$('data-stamp'),scores=$('scores'),metrics=$('metrics');if(!stamp||!scores||!metrics)return;
let saved=[],audit=null,feedOk=0,feedError='';
try{
 const r=await fetch('data/cfb-2026-results.json?ts='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const data=await r.json();audit=data.audit;
 if(audit?.season!==2026||audit?.complete!==true||audit?.games!==data.games?.length)throw Error('Snapshot failed verification');
 saved=data.games.map(g=>({id:String(g.id),date:g.date,status:'FINAL',teams:g.teams.map(t=>({id:String(t.id),name:t.name,score:t.score}))}));
 lastPublished=audit.generated_at;lastGames=saved;
}catch(e){feedError=String(e.message||e);saved=lastGames}
const upcoming=[],live=[];
await Promise.allSettled([-7,0,7].map(async offset=>{
 const url='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates='+dateshift(offset)+'&limit=400&groups=80';
 const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP '+r.status);
 const data=await r.json();feedOk++;
 for(const e of data.events||[]){
  const c=e.competitions?.[0],s=c?.competitors||[];if(s.length!==2)continue;
  const g={id:String(e.id),date:e.date,status:e.status?.type?.shortDetail||'Scheduled',teams:s.map(t=>({id:String(t.team.id),name:t.team.shortDisplayName||t.team.displayName,score:t.score??''}))};
  if(!e.status?.type?.completed){(e.status?.type?.state==='in'?live:upcoming).push(g)}
 }
})).then(()=>{});
const unique=a=>[...new Map(a.map(g=>[g.id,g])).values()];
const recent=unique(saved).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,35);
const active=unique(live).sort((a,b)=>new Date(a.date)-new Date(b.date));
const next=unique(upcoming).filter(g=>new Date(g.date)>=Date.now()-3600000).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,15);
scores.innerHTML=(active.length?'<h3>Live Games</h3>'+active.map(asRow).join(''):'')+(next.length?'<h3>Upcoming Games</h3>'+next.map(asRow).join(''):'')+(recent.length?'<h3>Latest Finals</h3>'+recent.map(asRow).join(''):'<p class="data-note">Verified results temporarily unavailable.</p>');
const updated=lastPublished?new Date(lastPublished).toLocaleString():'Unavailable';
stamp.textContent='2026 results last published: '+updated+(feedOk?' · live schedule connected':' · schedule feed unavailable')+(feedError?' · saved results fallback':'');
const teams=new Set(saved.flatMap(g=>g.teams.map(t=>t.id)));
metrics.innerHTML=[[teams.size,'Schools in verified results'],[saved.length,'Completed games'],[feedOk+'/3','Live schedule feeds'],[recent[0]?new Date(recent[0].date).toLocaleDateString():'—','Latest final']].map(([v,k])=>'<div class="metric"><b>'+safe(v)+'</b><span>'+safe(k)+'</span></div>').join('');
}
update().catch(e=>{const s=$('data-stamp');if(s)s.textContent='College football update failed: '+e.message});
setInterval(()=>update().catch(console.error),300000);
})();