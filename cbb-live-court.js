/* COURTCAST / The Sporting Life & Times. Sourced plays, not optical tracking. */
(function(global){
'use strict';
const contexts=new WeakMap(),activeByGame=new Map(),MAX=12;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parsePlays(data){
  let raw=data?.plays;
  if(!Array.isArray(raw))raw=raw?.items||data?.gamepackageJSON?.plays||data?.playByPlay?.plays||[];
  if(!Array.isArray(raw))return [];
  return raw.flatMap((p,index)=>{
    if(!p||typeof p.text!=='string'||!p.text.trim())return [];
    return [{id:String(p.id??p.playId??p.sequenceNumber??index),index,
      teamId:p.team?.id==null?null:String(p.team.id),
      period:Number(p.period?.number||p.period||0),
      clock:String(p.clock?.displayValue||p.clockDisplayValue||''),
      kind:String(p.type?.text||p.typeText||''),
      text:p.text.replace(/\s+/g,' ').trim().slice(0,350)}];
  });
}
function location(play,g){
  // Illustration only: away-team EVENTS left and home-team EVENTS right;
  // this is NOT actual basket orientation or a measured ball position.
  const away=String(g.away?.team?.id||''),home=String(g.home?.team?.id||'');
  let x=50,y=50;
  if(play.teamId===away&&away)x=26;
  else if(play.teamId===home&&home)x=74;
  if(/free throw/i.test(play.text)){x=x<50?34:66;y=50;}
  else if(/3.pt|three.point|three point/i.test(play.text)){x=x<50?30:70;y=28;}
  else if(/dunk|layup|tip.in/i.test(play.text)){x=x<50?12:88;y=50;}
  else if(/rebound/i.test(play.text)){x=x<50?21:79;y=63;}
  else if(/turnover|steal/i.test(play.text)){x=x<50?39:61;y=41;}
  return {x,y};
}
const lines='<svg viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true">'+
 '<rect x="10" y="10" width="920" height="480" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<path d="M470 10V490" stroke="currentColor" stroke-width="3"/>'+
 '<circle cx="470" cy="250" r="62" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<rect x="10" y="169" width="180" height="162" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<rect x="750" y="169" width="180" height="162" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<circle cx="190" cy="250" r="62" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<circle cx="750" cy="250" r="62" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<path d="M10 50H68 A247 247 0 0 1 68 450H10 M930 50H872 A247 247 0 0 0 872 450H930" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<path d="M51 229H74M889 229H866" stroke="currentColor" stroke-width="4"/>'+
 '<circle cx="74" cy="250" r="15" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '<circle cx="866" cy="250" r="15" fill="none" stroke="currentColor" stroke-width="3"/>'+
 '</svg>';
function name(t){return t?.team?.abbreviation||t?.team?.shortDisplayName||t?.team?.displayName||'Team';}
function stop(c){if(c.timer){clearInterval(c.timer);c.timer=null;}}
function draw(c){
  const g=c.game,plays=c.plays,selected=c.follow?plays.at(-1):plays.find(p=>p.id===c.selected)||plays.at(-1);
  const pos=selected?location(selected,g):null,arr=plays.slice(-MAX).reverse();
  const live=g.phase==='live',final=g.phase==='final';
  c.node.innerHTML='<div class="slc-wrap"><header class="slc-head"><div><small>THE SPORTING LIFE & TIMES / GAMEFILE</small>'+
    '<h2>COURTCAST</h2></div><b>'+(live?'LIVE PLAY-BY-PLAY':final?'FINAL · PLAY REPLAY':'PREGAME')+'</b></header>'+
    '<div class="slc-columns"><section class="slc-visual"><div class="slc-teams"><span>AWAY · '+esc(name(g.away))+'</span>'+
    '<span>HOME · '+esc(name(g.home))+'</span></div>'+
    '<div class="slc-floor">'+lines+
      (pos?'<span class="slc-ball" style="--x:'+pos.x+'%;--y:'+pos.y+'%" aria-hidden="true"></span>':'')+
      '<span class="slc-court-label">SCHEMATIC ACTIVITY · NOT LIVE BALL TRACKING</span></div>'+
    '<div class="slc-now" aria-live="polite">'+
    (selected?'<small>'+esc(selected.clock||'TIME NOT LISTED')+
      (selected.period?' · PERIOD '+esc(selected.period):'')+'</small><strong>'+esc(selected.text)+'</strong>':
      '<strong>'+(g.phase==='upcoming'?'Awaiting tipoff.':'No verified play-by-play is available for this matchup.')+'</strong>')+
    '</div><div class="slc-actions"><button type="button" data-slc-action="replay"'+(plays.length<2?' disabled':'')+
    '>▶ Replay '+Math.min(plays.length,MAX)+' plays</button>'+
    '<button type="button" data-slc-action="follow"'+(!plays.length?' disabled':'')+
    ' aria-pressed="'+String(c.follow)+'">'+(c.follow?'Following latest':'Go to latest')+'</button></div></section>'+
    '<aside class="slc-feed"><h3>RECENT PLAYS <span>'+esc(plays.length)+' events</span></h3>'+
    (arr.length?'<ol>'+arr.map(p=>'<li><button type="button" data-slc-play="'+esc(p.id)+'"'+
      (p.id===selected?.id?' aria-current="true"':'')+'><time>'+esc(p.clock||'—')+
      '</time><span>'+esc(p.text)+'</span></button></li>').join('')+'</ol>':
      '<p>Play-by-play is not available. We do not create simulated events.</p>')+'</aside></div>'+
    '<footer class="slc-note">Recorded plays: ESPN play-by-play, an attributed secondary feed. Refreshed with the Gamefile approximately every 30 seconds. '+
    'The ball illustrates the team and type of recorded event—not the actual position of the ball or players.</footer></div>';
  const marker=c.node.querySelector('.slc-ball');
  if(marker&&c.previousPlay&&selected?.id!==c.previousPlay.id){
    const initial=location(c.previousPlay,g);
    marker.style.setProperty('--x',initial.x+'%');
    marker.style.setProperty('--y',initial.y+'%');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(marker.isConnected){marker.style.setProperty('--x',pos.x+'%');marker.style.setProperty('--y',pos.y+'%');}
    }));
  }
  c.previousPlay=selected||null;
}
function replay(c){
 stop(c);if(c.plays.length<2)return;
 c.follow=false;const last=c.plays.slice(-MAX);let i=0;
 c.selected=last[i].id;draw(c);
 if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 c.timer=setInterval(()=>{
  if(!c.node.isConnected){stop(c);return;}
  if(++i>=last.length){stop(c);c.follow=true;c.selected=null;draw(c);return;}
  c.selected=last[i].id;draw(c);
 },2200);
}
function mount(node,game,summary){
 if(!node||!game)return;
 const key=String(game.id||'')+'/'+String(game.away?.team?.id||'');
 let c=contexts.get(node);
 if(!c){
  const prior=activeByGame.get(key);
  if(prior)stop(prior);
  c={node,game,plays:[],follow:prior?.follow??true,selected:prior?.selected??null,
     timer:null,previousPlay:prior?.previousPlay??null};
  contexts.set(node,c);
  activeByGame.set(key,c);
  if(activeByGame.size>40)activeByGame.delete(activeByGame.keys().next().value);
  node.addEventListener('click',e=>{
   const b=e.target.closest('[data-slc-play],[data-slc-action]');
   if(!b||!node.contains(b))return;
   if(b.dataset.slcAction==='replay'){replay(c);return;}
   if(b.dataset.slcAction==='follow'){stop(c);c.follow=true;c.selected=null;draw(c);return;}
   if(b.dataset.slcPlay){stop(c);c.follow=false;c.selected=b.dataset.slcPlay;draw(c);}
  });
 }
 c.game=game;c.plays=parsePlays(summary);
 if(c.selected&&!c.plays.some(p=>p.id===c.selected)){c.follow=true;c.selected=null;}
 draw(c);
}
global.SLTCourt={mount,parsePlays,location};
})(window);