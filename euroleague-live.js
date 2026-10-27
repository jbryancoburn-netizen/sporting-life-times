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
 const checked=Date.parse(d.checked_at||d.updated_at),stale=Date.now()-(Number.isFinite(checked)?checked:stamp)>15*60*1000;
 const games=d.games.filter(g=>['live','scheduled','final','awaiting_final'].includes(g.status)).slice(0,18);
 const logo=t=>/^https:\/\//.test(t?.logo||'')?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(t.code||'')+'" alt="" loading="lazy" src="'+esc('assets/euroleague-logos/'+t.code+'.png')+'">':'';
 const team=t=>'<div class="el-live-team">'+logo(t)+'<span>'+esc(t.name||t.code)+'</span><b>'+esc(t.score??'—')+'</b></div>';
 const forecast=await fetch('data/euroleague-model.json?live='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const byId=new Map((forecast?.fixtures||[]).map(g=>[String(g.id),g]));
 host.innerHTML=games.map(g=>{
 const scoreStamp=Date.parse(g.score_updated_at||''),scoreFresh=Number.isFinite(scoreStamp)&&Date.now()-scoreStamp<=15*60*1000;
 const freshLive=g.status==='live'&&!stale&&scoreFresh;
 const label=freshLive?'LIVE':g.status==='final'?'FINAL':g.status==='awaiting_final'?'AWAITING FINAL':g.status==='live'?'LAST REPORTED':g.status==='scheduled'&&Date.parse(g.date)<Date.now()?'STATUS PENDING':'UPCOMING';
 const a=Number(g.away?.score),h=Number(g.home?.score),scored=g.away?.score!=null&&g.home?.score!=null;
 const total=scored?a+h:0,awayShare=total>0?Math.round(100*a/total):50;
 const leader=scored?(a===h?'Tied':(a>h?g.away.name:g.home.name)+' +'+Math.abs(a-h)):'Awaiting tip-off';
 const periods=Array.isArray(g.period_scores)?g.period_scores.filter(q=>Number.isFinite(q.home)&&Number.isFinite(q.away)):[];
 const quarters=periods.length?'<div class="el-live-periods"><span>PERIOD</span>'+periods.map(q=>'<span>Q'+q.period+'</span>').join('')+'<b>'+esc(g.away.code)+'</b>'+periods.map(q=>'<b>'+q.away+'</b>').join('')+'<b>'+esc(g.home.code)+'</b>'+periods.map(q=>'<b>'+q.home+'</b>').join('')+'</div>':'';
 const pred=byId.get(String(g.id));
 const projection=pred?.projection&&g.status==='scheduled'?'<div class="el-live-projection">ELO FORECAST · '+esc(pred.away.name)+' '+pred.projection.away+' – '+pred.projection.home+' '+esc(pred.home.name)+'</div>':'';
 const progress=scored?'<div class="el-live-flow"><div class="el-live-flow-label"><span>SCORING SHARE</span><strong>'+esc(leader)+'</strong></div><div class="el-live-flow-bar"><i style="width:'+awayShare+'%"></i></div><div class="el-live-flow-legend"><span>'+esc(g.away.code)+' '+awayShare+'%</span><span>'+esc(g.home.code)+' '+(100-awayShare)+'%</span></div></div>':'';
 const detail=freshLive?g.status_detail||'In progress':g.status==='live'?'Last verified score · '+(Number.isFinite(scoreStamp)?et(g.score_updated_at):'time unavailable'):'';
 return '<article class="el-live-card el-live-card--enhanced"><div class="el-live-meta"><span class="'+(freshLive?'el-live-now':'')+'">'+esc(label)+'</span><small>'+esc(et(g.date))+'</small></div>'+team(g.away)+team(g.home)+(detail?'<div class="el-live-clock">'+esc(detail)+'</div>':'')+progress+quarters+projection+'<div class="el-live-foot">Official score feed · '+(scoreFresh?'Updated '+esc(et(g.score_updated_at)):'Refresh every 60 sec')+'</div></article>';
 }).join('')||'<p class="hub-small">No games in this scorebug window.</p>';
 status.textContent=(stale?'Score feed delayed · Last checked ':'Score feed checked ')+et(d.checked_at||d.updated_at)+' ET · Automatically checks for updates every 60 seconds';
 lastGood=d;
}catch(e){
 status.textContent=lastGood?'Live feed temporarily unavailable · Keeping last verified snapshot':'Live feed is awaiting its first published snapshot. Scores are not estimated.';
}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('focus',()=>{if(!document.hidden)refresh()});
})();