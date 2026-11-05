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
 function livePanel(g,label){
  const raw=String(label||'LIVE').trim();
  const halftime=/\b(?:HALF\s*TIME|HALFTIME|INTERMISSION)\b/i.test(raw);
  const clock=halftime?'':(raw.match(/\b\d{1,2}:\d{2}\b/)||[])[0]||'';
  const m=halftime?null:raw.match(/\b(?:1ST|2ND|3RD|4TH|FIRST|SECOND|THIRD|FOURTH)\s*(?:HALF|PERIOD|QUARTER)?\b|\b(?:OVERTIME|[2-9]OT|OT)\b/i);
  const period=m?m[0].trim().toUpperCase():'';
  const periods={'1ST':'FIRST HALF','2ND':'SECOND HALF','FIRST':'FIRST HALF','SECOND':'SECOND HALF',
    '3RD':'THIRD QUARTER','4TH':'FOURTH QUARTER','THIRD':'THIRD QUARTER','FOURTH':'FOURTH QUARTER','OT':'OVERTIME'};
  const periodLabel=periods[period]||period.replace(/^1ST HALF$/,'FIRST HALF').replace(/^2ND HALF$/,'SECOND HALF').replace(/^3RD QUARTER$/,'THIRD QUARTER').replace(/^4TH QUARTER$/,'FOURTH QUARTER');
  const momentum=g.momentum&&typeof g.momentum.text==='string'?g.momentum:null;
  if(halftime)return '<div class="ledger26-status ledger26-status--stack" data-phase="live"><strong class="ledger26-clock ledger26-clock--text">HALFTIME</strong></div>';
  const main=clock||(!periodLabel&&raw!=='LIVE'?raw:'LIVE');
  return '<div class="ledger26-status ledger26-status--stack" data-phase="live">'+
    '<strong class="ledger26-clock'+(clock?'':' ledger26-clock--text')+'">'+esc(main)+'</strong>'+
    (periodLabel?'<span class="ledger26-period">'+esc(periodLabel)+'</span>':'')+
    (momentum?'<small class="ledger26-situation ledger26-momentum'+(momentum.kind==='run'?' ledger26-momentum--run':'')+'">'+esc(momentum.text)+'</small>':'')+'</div>';
 }
 function pregamePanel(g){
  const f=g.forecast;
  if(!f||typeof f.team!=='string'||!Number.isFinite(f.probability)||f.probability<0||f.probability>1)
    return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming"><strong class="ledger26-pregame-empty">PREGAME</strong></div>';
  const team=f.team.trim(),percent=Math.round(f.probability*100);
  const margin=Number.isFinite(f.margin)&&f.margin>0?'+'+f.margin.toFixed(1):'';
  return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming" aria-label="'+
    esc(team+' '+percent+' percent win probability'+(margin?', RETRO projected winning margin '+margin+' points':''))+'">'+
    '<strong class="ledger26-pregame-prob">'+percent+'%</strong>'+
    '<span class="ledger26-pregame-team" title="'+esc(team)+'">'+esc(team)+'</span>'+
    '<span class="ledger26-pregame-caption">WIN CHANCE</span>'+
    (margin?'<span class="ledger26-pregame-edge">'+margin+'</span><span class="ledger26-pregame-caption">RETRO EDGE</span>':'')+
    '</div>';
 }
 function render(input){
  const g=input||{},phase=['live','final','upcoming'].includes(g.phase)?g.phase:'upcoming';
  const label=(phase==='final'?
    (/^FINAL(?:\s*\/\s*OT|\s*\(OT\)|\s+AFTER\s+EXTRA\s+TIME)?$/i.test(String(g.status||''))?g.status:'FINAL'):
    phase==='upcoming'?([g.tipoff||g.time,g.network||g.tv].filter(Boolean).join(' · ')):g.status||'LIVE');
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
  return '<div class="ledger26-scorebug" role="group" aria-label="'+esc(g.ariaLabel||((g.away?.name||'Away')+' at '+(g.home?.name||'Home')+' scoreboard'))+'">'+
    '<span class="ledger26-monogram"><img src="assets/slt-engraved-black.svg" width="35" height="49" alt="Sporting Life and Times monogram"></span>'+
    '<div class="ledger26-teams">'+team(g.away)+team(g.home)+'</div>'+
    (phase==='live'?livePanel(g,label):phase==='upcoming'?pregamePanel(g):label?'<div class="ledger26-status" data-phase="'+phase+'"><strong>'+esc(label)+'</strong></div>':'')+'</div>';
 }
 // The Daily Ledger is the universal newspaper model, not a separate sport skin.
 // Keep the old alias for existing college basketball pages.
 root.SLTSportsScorebug={render,formatRetro,version:'shared-letterpress-v10'};
 root.SLTBasketballScorebug=root.SLTSportsScorebug;
})(typeof window!=='undefined'?window:globalThis);
