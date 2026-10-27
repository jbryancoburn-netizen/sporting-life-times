(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=t=>{const code=String(t?.code||'').trim().toUpperCase(),url=String(t?.logo||'');return /^https:\/\//.test(url)?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(code)+'" src="'+esc(url)+'" alt="" loading="lazy">':'';};
const date=v=>{const x=new Date(v);return Number.isFinite(x.getTime())?x.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}):'Date unavailable'};
let lastEditionStamp=null;
async function refreshEdition(){
try{
 const r=await fetch('data/euroleague-model.json?v='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw Error('Ratings missing');
 const d=await r.json(),teams=d.rankings||[],table=d.standings||[],results=d.recent_results||[];
 if(d.updated_at===lastEditionStamp)return;
 if(teams.length<18||teams.length>24||table.length!==teams.length||!Number.isInteger(d.games_completed)||d.games_completed<1||table.reduce((n,t)=>n+t.wins,0)!==d.games_completed||table.reduce((n,t)=>n+t.losses,0)!==d.games_completed)throw Error('Ratings totals inconsistent');
 const elo=teams[0],record=[...table].sort((a,b)=>b.wins/(b.played||1)-a.wins/(a.played||1)||b.wins-a.wins)[0];
 const offense=[...table].filter(t=>t.played>0).sort((a,b)=>b.for/b.played-a.for/a.played)[0];
 const defense=[...table].filter(t=>t.played>0).sort((a,b)=>a.against/a.played-b.against/b.played)[0];
 const tiles=[
 ['TOP ELO CLUB',elo.name,Number(elo.elo).toFixed(1)+' Elo'],
 ['BEST WIN PCT',record.name,record.wins+'–'+record.losses+' · '+(record.wins/record.played*100).toFixed(1)+'%'],
 ['TOP OFFENSE',offense.name,(offense.for/offense.played).toFixed(1)+' points per game'],
 ['TOP DEFENSE',defense.name,(defense.against/defense.played).toFixed(1)+' points allowed']
 ];
 $('el-front-strip').innerHTML=tiles.map(([title,value,sub])=>'<div class="el-front-number"><small>'+esc(title)+'</small><strong>'+esc(value)+'</strong><span>'+esc(sub)+'</span></div>').join('');

 const insight=$('el-insights-grid');
 if(insight){
  const sample=table.filter(t=>t.played>0);
  const leader=(arr,fn)=>[...arr].sort(fn).slice(0,6);
  const charts=[
   {heading:'ELO POWER INDEX',unit:'Elo',rows:leader(teams,(a,b)=>b.elo-a.elo),value:t=>Number(t.elo),label:t=>Number(t.elo).toFixed(1),baseline:1450},
   {heading:'POINTS PER GAME',unit:'PPG',rows:leader(sample,(a,b)=>b.for/b.played-a.for/a.played),value:t=>t.for/t.played,label:t=>(t.for/t.played).toFixed(1),baseline:0},
   {heading:'DEFENSIVE WALL',unit:'Opponent PPG',rows:leader(sample,(a,b)=>a.against/a.played-b.against/b.played),value:t=>110-t.against/t.played,label:t=>(t.against/t.played).toFixed(1)+' allowed',baseline:0},
   {heading:'POINT DIFFERENTIAL',unit:'Per game',rows:leader(sample,(a,b)=>(b.for-b.against)/b.played-(a.for-a.against)/a.played),value:t=>(t.for-t.against)/t.played,label:t=>((t.for-t.against)/t.played>0?'+':'')+((t.for-t.against)/t.played).toFixed(1),baseline:0}
  ];
  insight.innerHTML=charts.map(ch=>{
   const vals=ch.rows.map(ch.value),hi=Math.max(...vals,1),lo=Math.min(ch.baseline,...vals);
   return '<article class="el-chart"><header><h3>'+esc(ch.heading)+'</h3><small>'+esc(ch.unit)+' · verified season games</small></header>'+
   ch.rows.map((t,i)=>'<div class="el-chart-row"><span class="el-chart-rank">'+(i+1)+'</span><span class="el-chart-club">'+logo(t)+'<span title="'+esc(t.name)+'">'+esc(t.name)+'</span></span><div class="el-chart-track"><i style="width:'+Math.max(3,Math.min(100,100*(ch.value(t)-lo)/(hi-lo||1))).toFixed(1)+'%"></i></div><b>'+esc(ch.label(t))+'</b></div>').join('')+'</article>';
  }).join('');
 }

 const spot=$('el-club-spotlight');
 if(spot){
  const byStanding=new Map(table.map(t=>[t.code,t]));
  const clubTiles=teams.slice(0,8).map((t,i)=>{
   const s=byStanding.get(t.code)||t,played=s.played||0,ppg=played?s.for/played:0,opp=played?s.against/played:0;
   const net=ppg-opp;
   const pct=played?s.wins/played:0;
   return '<article class="el-club-tile"><div class="el-club-tile-top"><span class="el-club-rank">#'+(i+1)+'</span>'+logo(t)+'<div><h3>'+esc(t.name)+'</h3><small>'+esc(t.code)+' · '+esc(s.wins)+'–'+esc(s.losses)+'</small></div></div><div class="el-club-elo">'+Number(t.elo).toFixed(1)+' <span>ELO</span></div><div class="el-club-statgrid"><div><b>'+(pct*100).toFixed(0)+'%</b><small>WIN RATE</small></div><div><b>'+ppg.toFixed(1)+'</b><small>POINTS / G</small></div><div><b>'+opp.toFixed(1)+'</b><small>ALLOWED / G</small></div><div><b>'+(net>0?'+':'')+net.toFixed(1)+'</b><small>NET / G</small></div></div><div class="el-club-winbar" aria-label="'+(pct*100).toFixed(0)+' percent wins"><i style="width:'+(pct*100).toFixed(1)+'%"></i></div></article>';
  });
  spot.innerHTML=clubTiles.join('');
 }
 const byCode=new Map(teams.map(t=>[t.code,t]));
 $('el-recent-results-list').innerHTML=results.length?results.slice(0,10).map(g=>{
 const away=byCode.get(g.away)||{code:g.away},home=byCode.get(g.home)||{code:g.home};
 const row=(t,score)=>'<div class="el-result-row"><span>'+logo(t)+'<span class="el-result-name" title="'+esc(t.name||t.code)+'">'+esc(t.name||t.code)+'</span></span><b>'+esc(score)+'</b></div>';
 return '<article class="el-result-card"><small>'+esc(date(g.date))+' · FINAL</small>'+row(away,g.score?.[1])+row(home,g.score?.[0])+'</article>';
 }).join(''):'<p class="hub-small">Recent verified finals not yet provided by the model.</p>';
 lastEditionStamp=d.updated_at;
 if($('el-prediction-status'))$('el-prediction-status').textContent=(d.fixtures||[]).length+' future matchups in the published schedule · Elo probabilities use independent ratings; projected scores and spreads remain experimental.';
}catch(err){
 if(lastEditionStamp){console.warn('EuroLeague edition refresh',err.message);return;}
 if($('el-front-strip'))$('el-front-strip').textContent='Model statistical summary unavailable.';
 if($('el-recent-results-list'))$('el-recent-results-list').textContent='Recent verified EuroLeague results unavailable.';
 console.warn('EuroLeague edition',err.message);
}
}
refreshEdition();
setInterval(()=>{if(!document.hidden)refreshEdition()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshEdition()});
window.addEventListener('focus',()=>{if(!document.hidden)refreshEdition()});
(async()=>{
 const el=document.getElementById('el-validation-panel');
 if(!el)return;
 try{
  const r=await fetch('data/euroleague-validation.json?cache='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('Not published');
  const d=await r.json(),v=d.scoring_forecast_validation;
  if(!v||!v.games_evaluated)throw Error('No scoring evaluation');
  const boxes=[
   ['SCORE SAMPLE',v.games_evaluated+' games','Historical pregame-only evaluation'],
   ['GAME TOTAL ERROR',v.total_mae+' pts','Mean absolute error in projected totals'],
   ['MARGIN ERROR',v.margin_mae+' pts','Mean absolute error in projected margin']
  ];
  if(Number.isFinite(v.league_average_total_mae)&&Number.isFinite(v.zero_margin_baseline_mae)){
   const totalGain=v.league_average_total_mae-v.total_mae;
   const marginGain=v.zero_margin_baseline_mae-v.margin_mae;
   boxes.push(['TOTAL VS BASELINE',(totalGain>=0?'-':'+')+Math.abs(totalGain).toFixed(2)+' pts MAE','League-average baseline '+v.league_average_total_mae.toFixed(2)+' · Lower error is better']);
   boxes.push(['MARGIN VS BASELINE',(marginGain>=0?'-':'+')+Math.abs(marginGain).toFixed(2)+' pts MAE','Zero-margin baseline '+v.zero_margin_baseline_mae.toFixed(2)+' · '+v.games_evaluated+' tested games']);
  }
  if(d.heldout_evaluation?.selected_holdout&&d.heldout_evaluation?.baseline_holdout){
   const h=d.heldout_evaluation,selected=h.selected_holdout,baseline=h.baseline_holdout;
   boxes.push(['ELO HOLDOUT', (selected.accuracy*100).toFixed(1)+'%','2026–27 held-out picks · '+selected.n+' games']);
   boxes.push(['HOLDOUT LOG LOSS',selected.log_loss.toFixed(3),'Tuned vs baseline '+baseline.log_loss.toFixed(3)+' · Lower is better']);
  }
  el.innerHTML=boxes.map(([heading,value,note])=>'<article><small>'+esc(heading)+'</small><b>'+esc(value)+'</b><small>'+esc(note)+'</small></article>').join('');
 }catch(e){el.textContent='Historical forecast evaluation not yet available; scoring parameters remain provisional.';}
})();
})();