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
 const logo=t=>/^[A-Z]{3}$/.test(String(t?.code||'').toUpperCase())?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(String(t.code).toUpperCase())+'" alt="'+esc(t.name||t.code)+' crest" src="assets/euroleague-logos/'+esc(String(t.code).toUpperCase())+'.png">':'';
 const team=t=>'<div class="el-live-team">'+logo(t)+'<span>'+esc(t.name||t.code)+'</span><b>'+esc(t.score??'—')+'</b></div>';
 const forecast=await fetch('data/euroleague-model.json?live='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const byId=new Map((forecast?.fixtures||[]).map(g=>[String(g.id),g]));
 const expanded=new Set([...host.querySelectorAll('details[open][data-game-id]')].map(el=>el.dataset.gameId));
 host.innerHTML=games.map(g=>{
 const scoreStamp=Date.parse(g.score_updated_at||''),scoreFresh=Number.isFinite(scoreStamp)&&Date.now()-scoreStamp<=15*60*1000;
 const freshLive=g.status==='live'&&!stale&&scoreFresh;
 const label=freshLive?'LIVE':g.status==='final'?'FINAL':g.status==='awaiting_final'?'AWAITING FINAL':g.status==='live'?'LAST REPORTED':g.status==='scheduled'&&Date.parse(g.date)<Date.now()?'STATUS PENDING':'UPCOMING';
 const a=Number(g.away?.score),h=Number(g.home?.score),scored=g.away?.score!=null&&g.home?.score!=null;

 const periods=Array.isArray(g.period_scores)?g.period_scores.filter(q=>Number.isFinite(q.home)&&Number.isFinite(q.away)):[];
 const pred=byId.get(String(g.id));
 const probability=Number(pred?.home_win_probability);
 const odds=Number.isFinite(probability)?Math.round(100*probability):null;
 const quarterRows=periods.length?'<div class="el-quarter-table"><div class="el-quarter-head"><span>TEAM</span>'+periods.map(q=>'<span>Q'+esc(q.period)+'</span>').join('')+'<strong>TOTAL</strong></div><div class="el-quarter-row"><b>'+esc(g.away.code)+'</b>'+periods.map(q=>'<span>'+esc(q.away)+'</span>').join('')+'<strong>'+esc(g.away.score??'—')+'</strong></div><div class="el-quarter-row"><b>'+esc(g.home.code)+'</b>'+periods.map(q=>'<span>'+esc(q.home)+'</span>').join('')+'<strong>'+esc(g.home.score??'—')+'</strong></div></div>':'<p class="el-live-unavailable">Quarter scores pending official confirmation.</p>';
 const pregame=odds!==null?'<div class="el-live-stat"><small>Pregame home win probability</small><strong>'+odds+'%</strong></div>':'';
 const forecast=pred?.projection?'<div class="el-live-stat"><small>Pregame projected total</small><strong>'+Number(pred.projection.total)+'</strong></div>':'';
 const stats=(g.status==='live'||g.status==='final')?'':('<div class="el-live-quickstats">'+pregame+forecast+'</div>');
 const margin=scored?'<div class="el-live-stat"><small>Lead</small><strong>'+Math.abs(a-h)+' pts</strong></div>':'';
 const total=scored?'<div class="el-live-stat"><small>Combined score</small><strong>'+(a+h)+'</strong></div>':'';
 const info='<div class="el-live-detail-inner"><h4>QUARTER-BY-QUARTER</h4>'+quarterRows+'<div class="el-live-detail-stats">'+margin+total+'</div>'+(pregame||forecast?'<details class="el-live-pregame"><summary>Pregame Elo &amp; projection</summary><div class="el-live-detail-stats">'+pregame+forecast+'</div></details>':'')+'<p class="el-live-unavailable">Detailed team and player statistics are awaiting a verified official feed.</p></div>';
 const detail=freshLive?g.status_detail||'In progress':g.status==='live'?'Last verified score · '+(Number.isFinite(scoreStamp)?et(g.score_updated_at):'time unavailable'):'';
 return '<article class="el-live-card el-live-card--enhanced"><div class="el-live-meta"><span class="'+(freshLive?'el-live-now':'')+'">'+esc(label)+'</span><small>'+esc(et(g.date))+'</small></div>'+team(g.away)+team(g.home)+(detail?'<div class="el-live-clock">'+esc(detail)+'</div>':'')+stats+'<details class="el-live-expand" data-game-id="'+esc(g.id)+'"><summary>Game center <span>Quarter scores · Elo · more</span></summary>'+info+'</details><div class="el-live-foot">Official score feed · '+(scoreFresh?'Updated '+esc(et(g.score_updated_at)):'Refresh every 60 sec')+'</div></article>';
 }).join('')||'<p class="hub-small">No games in this scorebug window.</p>';
 host.querySelectorAll('details[data-game-id]').forEach(el=>{if(expanded.has(el.dataset.gameId))el.open=true});
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