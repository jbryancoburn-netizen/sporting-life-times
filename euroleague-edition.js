(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=t=>/^https:\/\//.test(t?.logo||'')?'<img loading="lazy" alt="" src="'+esc(t.logo)+'">':'';
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
 const byCode=new Map(teams.map(t=>[t.code,t]));
 $('el-recent-results-list').innerHTML=results.length?results.slice(0,10).map(g=>{
 const away=byCode.get(g.away)||{code:g.away},home=byCode.get(g.home)||{code:g.home};
 const row=(t,score)=>'<div class="el-result-row"><span>'+logo(t)+esc(t.code)+'</span><b>'+esc(score)+'</b></div>';
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