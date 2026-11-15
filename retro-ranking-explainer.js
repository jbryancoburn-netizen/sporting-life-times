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
function render(team,published,safe){
 const esc=typeof safe==='function'?safe:escape;
 const info=explain(team,published),games=info.games;
 const count=games.length,delta=finite(team.daily_change);
 const pulse=[count+' verified D-I '+(count===1?'game':'games'),delta===null?'':('Daily '+(delta>0?'+':'')+delta.toFixed(1))].filter(Boolean).join(' · ');
 const lines=games.map(g=>'<li><strong>'+esc(g.name)+' <small>(#'+esc(g.rank)+')</small></strong>'+
   '<span>'+(g.win?'W ':'L ')+g.scored+'–'+g.allowed+'</span>'+
   '<small>'+esc(g.date)+' · Opp. RETRO '+Number(g.elo).toFixed(1)+
   ' · Fitted win chance '+Math.round(g.expected*100)+'% · Margin weight ×'+g.movWeight.toFixed(2)+
   ' · Fit signal '+(g.fitSignal>0?'+':'')+g.fitSignal.toFixed(2)+'</small></li>').join('');
 const params=info.parameters;
 const text='<p class="rank-why-method">RETRO fits the entire verified Division I game network over '+esc(params.passes??'multiple')+
   ' iterative passes. Strong opponents, unexpected outcomes, scoring margins and verified home courts affect the fit. '+
   'The game signals below are calculated at the <strong>current fitted ratings</strong>; they are not individual Elo-point additions.</p>'+
   '<p class="rank-why-method">Fit signal = margin weight × (actual win result − fitted win chance). '+
   'A positive value indicates a result stronger than the current model expected. '+
   'The model also regularizes ratings and caps extreme values.</p>';
 return '<td class="rank-explanation"><details class="rank-why"><summary>Why #'+esc(team.rank)+'?</summary>'+
  '<small class="rank-why-pulse">'+esc(pulse)+'</small>'+
  '<div class="rank-why-body">'+text+
  (lines?'<ol class="rank-why-games">'+lines+'</ol>':'<p>No verified matchup breakdown is available.</p>')+'</div></details></td>';
}
const api={explain,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SLTRetroExplainer=api;
})(typeof window!=='undefined'?window:globalThis);
