/* Rabby independent forecast scorecard.
 * Reads only snapshots captured before tipoff, never backdated scores.
 */
(()=>{'use strict';
if(document.body.dataset.page!=='matchups')return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(x,d=1)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(d):'—';
const dt=s=>new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
function attach(){
 if(document.getElementById('nba-rabby-audit'))return document.getElementById('nba-rabby-audit');
 const target=document.querySelector('#nba-rabby-status')?.closest('.panel');
 if(!target)return null;
 const node=document.createElement('section');node.className='panel rabby-audit';node.id='nba-rabby-audit';
 target.insertAdjacentElement('afterend',node);return node;
}
function summary(m,label){
 const n=m?.sample||0;
 return '<div class="rabby-audit-metric"><small>'+esc(label)+'</small><strong>'+n+'</strong><span>Graded pregame forecasts</span>'+
  (n?'<div class="rabby-audit-kpis"><div><b>'+num(m.margin_mae)+'</b><small>Margin MAE</small></div><div><b>'+num(m.total_mae)+'</b><small>Total MAE</small></div><div><b>'+num(m.team_score_mae)+'</b><small>Team score MAE</small></div><div><b>'+num(m.elo_brier,3)+'</b><small>Elo Brier</small></div><div><b>'+num(m.league_total_baseline_mae)+'</b><small>League-total baseline MAE</small></div><div><b>'+num(m.elo_winner_accuracy*100,1)+'%</b><small>Elo winner accuracy</small></div></div>':
  '<p>No verified final scores have been graded for this snapshot window yet.</p>')+'</div>';
}
function view(root,ledger){
 const records=ledger.forecasts||[],outcomes=ledger.results||{},m=ledger.metrics||{};
 const exclusions=ledger.exceptions||{};
 const frozen=records.filter(f=>!outcomes[f.id]&&!exclusions[f.id]).length;
 const excluded=Object.keys(exclusions).length,graded=Object.keys(outcomes).length;
 const pending=[...records].filter(f=>!outcomes[f.id]&&!exclusions[f.id]).sort((a,b)=>a.date.localeCompare(b.date)||a.phase.localeCompare(b.phase)).slice(0,12);
 const waitingRows=pending.map(f=>'<tr><td>'+esc(f.away)+' at '+esc(f.home)+'</td><td>'+esc(f.phase==='near_tipoff'?'Near tipoff':'Early')+'</td><td>'+esc(dt(f.captured_at))+'</td><td>'+f.away_score+'–'+f.home_score+'</td><td>'+esc(dt(f.date))+'</td></tr>').join('');
 const models=Object.entries(m.by_model_version||{}).map(([version,v])=>{
  const gradedCount=(v.early?.sample||0)+(v.near_tipoff?.sample||0);
  return '<tr><td><code>'+esc(version.slice(0,12))+'</code></td><td>'+v.forecasts+'</td><td>'+gradedCount+'</td><td>'+num(v.near_tipoff?.total_mae)+'</td><td>'+num(v.near_tipoff?.margin_mae)+'</td></tr>';
 }).join('');
 const cohorts=models?'<h3>Forecast model versions</h3><div class="nba-table-wrap"><table class="nba-table rabby-audit-table"><thead><tr><th>Model hash</th><th>Snapshots</th><th>Graded</th><th>Near-tipoff total MAE</th><th>Near-tipoff margin MAE</th></tr></thead><tbody>'+models+'</tbody></table></div>':'';

 const rows=records.filter(f=>outcomes[f.id]).slice(-14).reverse().map(f=>{
  const g=outcomes[f.id];
  const err=Math.abs(g.home_score-g.away_score-f.margin);
  const link=/^espn-nba-\d+$/.test(f.id)?'<a href="nba-live-game.html?game='+esc(f.id.replace('espn-nba-',''))+'">Game ↗</a>':'';
  return '<tr><td>'+esc(f.away)+' at '+esc(f.home)+'<small>'+esc(f.phase==='near_tipoff'?'Near tipoff':'Early')+' · '+esc(dt(f.captured_at))+'</small></td>'+
   '<td>'+f.away_score+'–'+f.home_score+'</td><td>'+g.away_score+'–'+g.home_score+'</td><td>'+num(err)+'</td><td>'+link+'</td></tr>';
 }).join('');
 root.innerHTML='<div class="eyebrow">Rabby · Model Accountability</div><h2>Pregame Forecast Scorecard</h2>'+
  '<p class="rabby-audit-desc">Every prediction shown here was saved <strong>before tipoff</strong> with the input-data fingerprints and model version. Finals are added separately. We never reconstruct a pregame prediction from the result.</p>'+
  '<div class="rabby-audit-summary">'+summary(m.early,'EARLY · 2–24 HOURS')+summary(m.near_tipoff,'NEAR TIPOFF · 10–120 MIN')+'</div>'+
  '<div class="rabby-audit-meta">'+records.length+' frozen snapshots · '+graded+' completed games graded · '+frozen+' ungraded snapshots · '+excluded+' rescheduled fixtures excluded · archive updated '+(ledger.updated_at?esc(dt(ledger.updated_at)):'not yet available')+'</div>'+
  (rows?'<div class="nba-table-wrap"><table class="nba-table rabby-audit-table"><thead><tr><th>Game / captured</th><th>Prediction<br>(away–home)</th><th>Final<br>(away–home)</th><th>Margin error</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':
  '<div class="nba-empty">Forecast scoring begins after future games finish. There are no fabricated or retroactively created model results.</div>')+
  (waitingRows?'<h3>Frozen Predictions Awaiting Finals</h3><div class="nba-table-wrap"><table class="nba-table rabby-audit-table"><thead><tr><th>Game</th><th>Capture window</th><th>Captured</th><th>Projected away–home</th><th>Scheduled tip</th></tr></thead><tbody>'+waitingRows+'</tbody></table></div>':'')+
  cohorts+
  (excluded?'<p class="rabby-audit-note">'+excluded+' postponed or rescheduled fixture(s) are quarantined from accuracy calculations; original pregame snapshots remain preserved.</p>':'')+
  '<p class="rabby-audit-note">MAE = average absolute error in points. Brier = mean squared win-probability error (lower is better). Season aggregates can contain multiple model versions; compare individual versions and capture windows rather than treating mixed-model results as a controlled experiment. Injury availability and rest remain informational until prospectively calibrated.</p>'; 
}
async function refresh(){
 const root=attach();if(!root)return;
 try{
  const response=await fetch('data/nba-rabby-forecast-ledger.json',{cache:'no-store'});
  if(!response.ok)throw Error('Forecast archive is not published yet');
  const ledger=await response.json();
  if(ledger.schema!=='rabby-nba-prospective-v1'||!Array.isArray(ledger.forecasts))throw Error('Unexpected archive schema');
  view(root,ledger);
 }catch(e){
  root.innerHTML='<div class="eyebrow">Rabby · Model Accountability</div><h2>Pregame Forecast Scorecard</h2>'+
  '<div class="nba-empty">The immutable forecast ledger has not published a verified snapshot yet. Predictions are never backfilled. '+esc(e.message)+'.</div>';
 }
}
refresh();
const app=document.getElementById('app');
if(app)new MutationObserver(changes=>{
 if(changes.some(m=>[...m.addedNodes].some(node=>node.nodeType===1&&
   (node.id==='nba-rabby-status'||node.querySelector?.('#nba-rabby-status')))))refresh();
}).observe(app,{childList:true,subtree:true});
setInterval(()=>{if(!document.hidden)refresh();},5*60000);
})();