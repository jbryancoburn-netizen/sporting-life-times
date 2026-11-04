/* The Sporting Life & Times · shared college-basketball letterpress scorebug.
   One source renderer for the Daily Ledger and Courtside Desk, men and women. */
(function(root){
 'use strict';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''))?v:'#655239';
 // A rank shared by multiple equally rated programs must be identified as tied.
 // This uses the published rank distribution, not alphabetical tiebreakers.
 function formatRetro(profile,tieCounts,maxRank){
  const elo=Number(profile?.elo),rank=Number(profile?.rank);
  if(!profile||!Number.isFinite(elo))return 'RETRO —';
  const base='RETRO '+Math.round(elo);
  if(!Number.isInteger(rank)||rank<1||rank>maxRank)return base;
  const tied=(tieCounts?.get(rank)||0)>1;
  return base+' ('+(tied?'T-':'#')+rank+')';
 }
 function render(input){
  const g=input||{},phase=['live','final','upcoming'].includes(g.phase)?g.phase:'upcoming';
  const label=(phase==='final'?'FINAL':phase==='upcoming'?'UPCOMING':g.status||'LIVE');
  const team=t=>{
   const x=t||{},poll=x.poll||null;
   const pollText=poll?[poll.coaches??'NR',poll.ap??'NR'].join('/'):'';
   const pollTitle=poll?'Coaches '+(poll.coaches?'#'+poll.coaches:'unranked')+' / AP '+(poll.ap?'#'+poll.ap:'unranked'):'';
   const badge=pollText?'<span class="ledger26-poll" title="'+esc(pollTitle)+'" aria-label="'+esc(pollTitle)+'">'+esc(pollText)+'</span>':'';
   const scored=phase==='upcoming'?'—':x.score==null?'—':String(x.score);
   const context=[x.record||'0–0',x.retro||'RETRO —'].join(' · ');
   return '<div class="ledger26-team" style="--ledger26-school:'+color(x.color)+'">'+
    '<span class="ledger26-crest">'+(x.crest||'')+'</span>'+
    '<span class="ledger26-identity"><strong class="ledger26-name">'+badge+esc(x.name||'School')+'</strong>'+
    '<small class="ledger26-record">'+esc(context)+'</small></span>'+
    '<b class="ledger26-points">'+esc(scored)+'</b></div>';
  };
  return '<div class="ledger26-scorebug" role="group" aria-label="'+esc(g.away?.name||'Away')+' at '+esc(g.home?.name||'Home')+' scoreboard">'+
    '<span class="ledger26-monogram"><img src="assets/slt-engraved-black.svg" width="35" height="49" alt="Sporting Life and Times monogram"></span>'+
    '<div class="ledger26-teams">'+team(g.away)+team(g.home)+'</div>'+
    '<div class="ledger26-status" data-phase="'+phase+'"><strong>'+esc(label)+'</strong></div></div>';
 }
 root.SLTBasketballScorebug={render,formatRetro,version:'shared-letterpress-v2'};
})(typeof window!=='undefined'?window:globalThis);
