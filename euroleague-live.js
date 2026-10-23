(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const host=document.getElementById('el-live-scorebugs'),status=document.getElementById('el-live-status');
if(!host||!status)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const et=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
let lastGood=null;
async function refresh(){
try{
 const r=await fetch('data/euroleague-live.json?cb='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw Error('Live feed not published');
 const d=await r.json(),stamp=Date.parse(d.updated_at);
 if(!Number.isFinite(stamp)||!Array.isArray(d.games))throw Error('Bad feed');
 const stale=Date.now()-stamp>15*60*1000;
 const games=d.games.filter(g=>g.status==='live'||g.status==='scheduled'||g.status==='final').slice(0,18);
 const logo=t=>/^https:\/\//.test(t?.logo||'')?'<img alt="" loading="lazy" src="'+esc(t.logo)+'">':'';
 const team=t=>'<div class="el-live-team">'+logo(t)+'<span>'+esc(t.name||t.code)+'</span><b>'+esc(t.score??'—')+'</b></div>';
 host.innerHTML=games.map(g=>'<article class="el-live-card"><div class="el-live-meta"><span class="'+(g.status==='live'&&!stale?'el-live-now':'')+'">'+esc(g.status==='live'&&!stale?'LIVE':g.status==='final'?'FINAL':g.status==='live'?'LAST REPORTED · LIVE':g.status==='scheduled'&&Date.parse(g.date)<Date.now()?'STATUS PENDING':'UPCOMING')+'</span><small>'+esc(et(g.date))+'</small></div>'+team(g.away)+team(g.home)+(g.status==='live'&&!stale?'<small>'+esc(g.status_detail||'In progress')+'</small>':'')+'</article>').join('')||'<p class="hub-small">No games in this scorebug window.</p>';
 status.textContent=(stale?'Score feed delayed · Last captured ':'Scorebug feed checked ')+et(d.updated_at)+' ET · Automatically checks for updates every 60 seconds';
 lastGood=d;
}catch(e){
 status.textContent=lastGood?'Live feed temporarily unavailable · Keeping last verified snapshot':'Live feed is awaiting its first published snapshot. Scores are not estimated.';
}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
})();