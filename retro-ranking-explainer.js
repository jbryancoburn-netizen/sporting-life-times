/* Explain published RETRO rankings using their actual verified event network.
   This is diagnostic at the final fitted ratings, not a fictitious additive game Elo ledger. */
(function(root){'use strict';
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function explain(team,published){
 const ratings=new Map((published?.rankings||[]).map(t=>[String(t.team_id),t]));
 const id=String(team.team_id||'');
 const games=(published?.events||[]).filter(g=>String(g.home_id)===id||String(g.away_id)===id);
 const edge=finite(published?.parameters?.home_edge)??0;
 const result=[];
 for(const g of games){
  const isHome=String(g.home_id)===id, opponentId=String(isHome?g.away_id:g.home_id),opponent=ratings.get(opponentId);
  const home=ratings.get(String(g.home_id)),away=ratings.get(String(g.away_id));
  const hs=finite(g.home_score),as=finite(g.away_score);
  if(!opponent||!home||!away||hs===null||as===null||hs===as)continue;
  const court=g.neutral===true||g.site_verified!==true?0:edge;
  const expectedHome=1/(1+10**((Number(away.elo)-Number(home.elo)-court)/400));
  const expected=isHome?expectedHome:1-expectedHome;
  const scored=isHome?hs:as,allowed=isHome?as:hs;
  const win=scored>allowed,margin=Math.abs(scored-allowed);
  const movWeight=Math.min(2.5,1+Math.log1p(margin)/3);
  const fitSignal=movWeight*((win?1:0)-expected);
  result.push({name:opponent.team,rank:opponent.rank,elo:opponent.elo,scored,allowed,
   win,expected,margin,movWeight,fitSignal,date:String(g.date||''),neutral:g.neutral===true,venueKnown:g.site_verified===true});
 }
 result.sort((a,b)=>Math.abs(b.fitSignal)-Math.abs(a.fitSignal)||b.date.localeCompare(a.date));
 return {games:result,parameters:published?.parameters||{}};
}
// All card metrics are derived from verified final events and current published ratings.
// Average opponent rating is a transparent descriptive proxy, not an invented official SOS.
function cardMetrics(team,published){
 const ratings=new Map((published?.rankings||[]).map(t=>[String(t.team_id),t]));
 const id=String(team?.team_id||'');
 const games=(published?.events||[]).filter(g=>String(g.home_id)===id||String(g.away_id)===id)
  .map(g=>{
   const home=String(g.home_id)===id;
   const opponent=ratings.get(String(home?g.away_id:g.home_id));
   const scored=finite(home?g.home_score:g.away_score),allowed=finite(home?g.away_score:g.home_score);
   if(!opponent||scored===null||allowed===null||scored===allowed)return null;
   return {opponent,margin:scored-allowed,win:scored>allowed,
    date:String(g.date||''),id:String(g.id||'')};
  }).filter(Boolean);
 const ordered=games.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const best=games.filter(g=>g.win).sort((a,b)=>Number(b.opponent.elo)-Number(a.opponent.elo))[0]||null;
 const sample=games.length;
 return {
  games:sample,form:ordered.slice(-5).map(g=>g.win?'W':'L'),
  avgOpponent:sample?games.reduce((a,g)=>a+Number(g.opponent.elo),0)/sample:null,
  avgMargin:sample?games.reduce((a,g)=>a+g.margin,0)/sample:null,
  bestWin:best?{team:best.opponent.team,elo:Number(best.opponent.elo)}:null,
  dailyChange:finite(team.daily_change)
 };
}
function render(team,published,safe,showLights=false){
 const esc=typeof safe==='function'?safe:escape;
 const info=explain(team,published),games=info.games;
 const count=games.length,delta=finite(team.daily_change),metrics=cardMetrics(team,published);
 const pulse=[count+' verified D-I '+(count===1?'game':'games'),delta===null?'':('Daily '+(delta>0?'+':'')+delta.toFixed(1))].filter(Boolean).join(' · ');
 const lines=games.map(g=>'<li><strong>'+esc(g.name)+' <small>(#'+esc(g.rank)+')</small></strong>'+
   '<span>'+(g.win?'W ':'L ')+g.scored+'–'+g.allowed+'</span>'+
   '<small>'+esc(g.date)+' · Opponent rating '+Number(g.elo).toFixed(1)+
   ' · Expected win chance: '+Math.round(g.expected*100)+'%'+
   ' · Performance vs. expectation: '+(g.fitSignal>0?'+':'')+g.fitSignal.toFixed(2)+'</small></li>').join('');
 const params=info.parameters;
 const text='<p class="rank-why-method"><strong>How RETRO ranks teams:</strong> Beating strong opponents, winning by more than expected, and performing well away from home can help a team. Every verified Division I result is considered.</p>'+
   '<p class="rank-why-method"><strong>Reading the games:</strong> A positive performance number means the result was better than RETRO expected at today\'s ratings. It is <strong>not</strong> the number of rating points earned from that game.</p>';
 const value=n=>n===null?'—':Number(n).toFixed(1);
 const movement=metrics.dailyChange===null?'Unavailable':metrics.dailyChange===0?'No change':(metrics.dailyChange>0?'▲ +':'▼ −')+Math.abs(metrics.dailyChange).toFixed(Math.abs(metrics.dailyChange)<0.1?2:1);
 const latest=metrics.form.length?metrics.form.map(letter=>'<i class="rank-form-'+letter.toLowerCase()+'" title="'+(letter==='W'?'Win':'Loss')+'">'+letter+'</i>').join(''):'—';
 const facts='<div class="rank-quick-stats" aria-label="Verified rating context">'+
   '<span><small>RATING CHANGE</small><b>'+esc(movement)+'</b></span>'+
   '<span><small>OPP. STRENGTH</small><b>'+value(metrics.avgOpponent)+'</b></span>'+
   '<span><small>AVG. POINT MARGIN</small><b>'+(metrics.avgMargin!==null&&metrics.avgMargin>0?'+':'')+value(metrics.avgMargin)+'</b></span>'+
   (showLights
    ? '<span><small>LAST 5</small><span data-recent-results></span></span>'
    : '<span><small>RECENT RESULTS</small><b class="rank-form">'+latest+'</b></span>')+'</div>';
 const best=metrics.bestWin?'<p class="rank-why-best"><strong>STRONGEST WIN</strong> '+esc(metrics.bestWin.team)+' · Opponent rating '+value(metrics.bestWin.elo)+'</p>':
   '<p class="rank-why-best">No verified D-I win yet.</p>';
 return '<td class="rank-explanation">'+facts+'<details class="rank-why"><summary>Why is '+esc(team.team||'this team')+' #'+esc(team.rank)+'?</summary>'+
  '<small class="rank-why-pulse">'+esc(pulse)+'</small>'+
  '<div class="rank-why-body">'+best+text+
  (lines?'<ol class="rank-why-games">'+lines+'</ol>':'<p>No verified matchup breakdown is available.</p>')+'</div></details></td>';
}
const api={explain,render,cardMetrics};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SLTRetroExplainer=api;
})(typeof window!=='undefined'?window:globalThis);
