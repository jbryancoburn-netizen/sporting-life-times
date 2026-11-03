/* Two-row college basketball scorebug indicators. Unreported values stay unknown.
 * Do not infer jersey colors, possession arrows, timeout budgets or coach's challenges.
 * NCAA men's half fouls and women's quarter fouls must come from an explicit live source.
 */
(function(root,factory){'use strict';const api=factory();root.SLTCollegeIndicators=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const nonneg=(x,cap=35)=>{if(typeof x==='string'&&!/^\d{1,2}$/.test(x))return null;const n=Number(x);return x!==null&&x!==undefined&&x!==''&&Number.isInteger(n)&&n>=0&&n<=cap?n:null;};
const pick=(x,keys)=>{if(!x||typeof x!=='object')return null;for(const k of keys){const n=nonneg(x[k]);if(n!==null)return n;}return null;};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fromGame(game,team,summary,opts={}){
  const id=String(team?.team?.id??'');
  const live=game?.phase==='live';
  // A completed-game box is not evidence of the remaining live timeout/challenge counts.
  const fresh=summary&&summary.boxscore&&Number.isFinite(opts.summaryAgeMs)&&opts.summaryAgeMs<=120000?summary:null;
  const competitors=fresh?.header?.competitions?.[0]?.competitors||[];
  const reported=competitors.find(x=>String(x?.team?.id??'')===id)||null;
  const sources=live?[reported,team]:[];
  function field(keys){for(const o of sources){const value=pick(o,keys);if(value!==null)return value;}return null;}
  function pool(remainKeys,totalKeys){
    const remaining=field(remainKeys),total=field(totalKeys);
    return remaining!==null&&total!==null&&total<=7&&remaining<=total?{remaining,total}:null;
  }
  const timeouts=pool(['timeoutsRemaining','timeOutsRemaining'],['timeoutsTotal','timeOutsTotal','timeoutLimit']);
  const challenges=pool(['challengesRemaining','coachChallengesRemaining'],['challengesTotal','coachChallengesTotal']);
  const fouls=field(['teamFouls','periodTeamFouls']);
  const rawBonus=sources.map(x=>x?.bonusStatus??x?.bonus).find(v=>typeof v==='string')||'';
  const bonus={single:'1 & 1',double:'2 SHOTS',bonus:'BONUS',oneAndOne:'1 & 1',twoShots:'2 SHOTS'}[rawBonus]||null;
  const possession=Boolean(id&&game?.alternatingPossessionTeamId!=null&&
    String(game.alternatingPossessionTeamId)===id);
  return {timeouts,challenges,fouls,bonus,possession};
}
function dotset(label,pool){
  if(!pool)return '<span class="slt-cbb-unavailable" aria-label="'+esc(label)+' not reported">—</span>';
  return '<span class="slt-cbb-dots" aria-label="'+esc(label)+' '+pool.remaining+' of '+pool.total+' remaining">'+
    Array.from({length:pool.total},(_,i)=>'<i aria-hidden="true" class="slt-cbb-dot'+(i<pool.remaining?' is-remaining':'')+'"></i>').join('')+'</span>';
}
function render(v){
  const d=v||{};
  return '<span class="slt-cbb-indicator"><b>TO</b> '+dotset('Timeouts',d.timeouts)+'</span>'+
    '<span class="slt-cbb-indicator"><b>CH</b> '+dotset('Coach challenges',d.challenges)+'</span>'+
    '<span class="slt-cbb-indicator"><b>FOULS</b> '+(d.fouls===null||d.fouls===undefined?'—':esc(d.fouls))+'</span>'+
    (d.bonus?'<span class="slt-cbb-bonus">'+esc(d.bonus)+'</span>':'');
}
return {fromGame,render};
});
