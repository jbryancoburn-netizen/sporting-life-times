(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('data/nbl-elo.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{
 if(d.status!=='calculated'||!Array.isArray(d.ratings)||d.ratings.length!==10){
  $('nbl-elo-status').textContent='MODEL NOT CERTIFIED · '+(d.reason||'Ratings temporarily withheld');
  $('nbl-elo-table').innerHTML='<p class="hub-small">The scoreboard and official league standings are separate from the Elo model. We will not publish made-up team ratings.</p>';
  return;
 }
 $('nbl-elo-status').textContent='MODEL CALCULATED · '+d.games_processed+' audited results · '+esc(d.season||'');
 $('nbl-elo-table').innerHTML='<div class="nba-current-table-wrap"><table class="nba-mini-table"><thead><tr><th>Rank</th><th>Club</th><th>Elo</th></tr></thead><tbody>'+d.ratings.map((t,i)=>'<tr><td>'+(i+1)+'</td><th>'+esc(t.team)+'</th><td>'+esc(Number(t.elo).toFixed(1))+'</td></tr>').join('')+'</tbody></table></div>';
 const games=(d.recent_results||[]).slice(-5).reverse();
 $('nbl-elo-recent').innerHTML=games.length?'<h3 class="league-subhead">RECENT ELO MOVEMENT</h3>'+games.map(g=>'<div class="league-report-line">'+esc(g.away)+' '+esc(g.away_score)+' · '+esc(g.home)+' '+esc(g.home_score)+' <small>Home Elo change '+(Number(g.elo_change)>0?'+':'')+esc(g.elo_change)+'</small></div>').join(''):'';
}).catch(e=>{$('nbl-elo-status').textContent='NBL rating data unavailable · '+e.message});


fetch('data/nbl-elo-research.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Research Elo unavailable');return r.json()}).then(d=>{
 if(d.status!=='RESEARCH_ONLY_UNCERTIFIED'||d.production_approved!==false||
    d.prediction_certified!==false||d.ratings?.length!==10||
    d.ratings.some((r,i)=>r.rank!==i+1||!Number.isFinite(Number(r.elo))))return;
 const table=$('nbl-elo-table');
 const status=$('nbl-elo-status');
 if(!table||!status)return;
 status.textContent='INDEPENDENT ELO · RESEARCH EDITION · '+d.current_regular_season_games+' completed regular-season games · Forecasts not certified';
 table.innerHTML='<p class="hub-small">Actual independently calculated Elo ratings, replayed after each completed game. The ratings are experimental; their win probabilities have not passed predictive validation.</p>'+
  '<div class="nba-current-table-wrap"><table class="nba-mini-table"><thead><tr><th>Rank</th><th>Club</th><th>W–L</th><th>Elo</th></tr></thead><tbody>'+
  d.ratings.map(r=>'<tr><td>'+esc(r.rank)+'</td><th>'+esc(r.team)+'</th><td>'+esc(r.wins)+'–'+esc(r.losses)+'</td><td>'+esc(Number(r.elo).toFixed(1))+'</td></tr>').join('')+
  '</tbody></table></div>';
 const latest=d.recent_results||[];
 const recent=$('nbl-elo-recent');
 if(recent)recent.innerHTML='<h3 class="league-subhead">LATEST ELO MOVEMENT</h3>'+latest.slice(-5).reverse().map(g=>
    '<div class="league-report-line">'+esc(g.away)+' '+esc(g.away_score)+' · '+esc(g.home)+' '+esc(g.home_score)+
    ' <small>'+esc(g.home)+' '+(g.elo_delta_home>0?'+':'')+esc(Number(g.elo_delta_home).toFixed(2))+' Elo</small></div>').join('');
}).catch(()=>{});

fetch('data/nbl-elo-research-status.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Research audit unavailable');return r.json()}).then(d=>{
 const node=$('nbl-elo-research');
 if(!node||d.status!=='RESEARCH_ONLY_NOT_CERTIFIED'||d.production_approved!==false)return;
 const b=d.benchmarks||{};
 const rows=[['Historical-validation selection',b.validation_selected?.holdout_log_loss],
             ['Original Elo model',b.existing_elo?.holdout_log_loss],
             ['50/50 reference',b.coin_flip?.holdout_log_loss],
             ['Previous-season home-rate reference',b.lagged_home_rate?.holdout_log_loss]];
 if(rows.some(x=>!Number.isFinite(Number(x[1]))))return;
 node.innerHTML='<h3 class="league-subhead">MODEL AUDIT · '+esc(d.as_of)+'</h3>'+
  '<p class="hub-small">Historical Elo replay is operational, but the current forecasting settings failed evaluation on '+esc(d.holdout_games)+' completed regular-season games. Lower log loss is better.</p>'+
  '<div class="nba-current-table-wrap"><table class="nba-mini-table"><thead><tr><th>Forecast method</th><th>Holdout log loss</th></tr></thead><tbody>'+
  rows.map(([name,value])=>'<tr><th>'+esc(name)+'</th><td>'+esc(Number(value).toFixed(4))+'</td></tr>').join('')+
  '</tbody></table></div>'+
  '<p class="hub-small">These are retrospective research calculations from candidate source results, not approved predictions or published team ratings. <a href="'+esc(d.source_artifact_run)+'">Read the historical source audit</a>.</p>';
}).catch(()=>{});
})();
