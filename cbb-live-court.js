/* COURTCAST / The Sporting Life & Times. Sourced plays, not optical tracking. */
(function(global){
'use strict';
const contexts=new WeakMap(),activeByGame=new Map(),MAX=12;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const score=v=>v===null||v===undefined||v===''||!Number.isSafeInteger(Number(v))||Number(v)<0||Number(v)>500?null:Number(v);
function parsePlays(data){
  let raw=data?.plays;
  if(!Array.isArray(raw))raw=raw?.items||data?.gamepackageJSON?.plays||data?.playByPlay?.plays||[];
  if(!Array.isArray(raw))return [];
  const parsed=raw.flatMap((p,index)=>{
    if(!p||typeof p.text!=='string'||!p.text.trim())return [];
    return [{id:String(p.id??p.playId??p.sequenceNumber??index),index,
      teamId:p.team?.id==null?null:String(p.team.id),
      period:Number(p.period?.number||p.period||0),
      clock:String(p.clock?.displayValue||p.clockDisplayValue||''),
      kind:String(p.type?.text||p.typeText||''),
      shooting: p.shootingPlay===true || p.shooting_play===true,
      scoring: p.scoringPlay===true || p.scoring_play===true,
      // Only recognized normalized half-court coordinates, NEVER guessed.
      shotX:p.coordinate_x??null,shotY:p.coordinate_y??null,
      shotSchema:p.coordinate_system||p.coordinateSystem||null,
      awayScore:score(p.awayScore??p.away_score),homeScore:score(p.homeScore??p.home_score),
      text:p.text.replace(/\s+/g,' ').trim().slice(0,350)}];
  });
  // Certain providers return newest events first. The scoreboard must be
  // chronological before replaying, plotting or identifying the latest event.
  const inversions=xs=>xs.reduce((n,p,i)=>{
    if(!i)return n;
    const prev=xs[i-1];
    if(p.period&&prev.period&&p.period!==prev.period)return n+(p.period<prev.period?1:0);
    const sec=s=>{const parts=s.split(':').map(Number);return parts.length===2&&parts.every(Number.isFinite)?parts[0]*60+parts[1]:null;};
    const a=sec(prev.clock),b=sec(p.clock);
    return n+(a!==null&&b!==null&&b>a?1:0);
  },0);
  const chronological=inversions([...parsed].reverse())<inversions(parsed)?parsed.reverse():parsed;
  const seen=new Set();
  return chronological.filter(p=>{
    // IDs can repeat across data-provider patches; retain only one.
    const key=p.id+'|'+p.period+'|'+p.clock+'|'+p.text;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function location(play){
 // Validated hoopR-style half-court coordinates only: X 0–50, Y 0–47.
 // ESPN raw full-court coordinates are NOT interpreted here.
 // Nothing is positioned for substitutions, fouls, rebounds or turnovers.
 if(!play?.shooting || play.shotSchema!=='halfcourt_feet_v1' || /free throw/i.test(play.text))return null;
 const x=Number(play.shotX),y=Number(play.shotY);
 if(play.shotX===null||play.shotY===null||
    !Number.isFinite(x)||!Number.isFinite(y)||x<0||x>50||y<0||y>47)return null;
 // This is a normalized shot MAP, not an observed ball animation.
 return {x:50+x/50*43,y:6+(47-y)/47*88};
}
function verifyPlayScores(plays,game){
 const sequence=plays.filter(p=>p.awayScore!==null&&p.homeScore!==null);
 if(sequence.length<3)return {ok:false,reason:'Scoring sequence is not available',sequence};
 for(let i=1;i<sequence.length;i++){
   const p=sequence[i],prev=sequence[i-1];
   if(p.awayScore<prev.awayScore||p.homeScore<prev.homeScore)
     return {ok:false,reason:'Play-by-play scores run backward or have been revised',sequence};
 }
 const last=sequence[sequence.length-1];
 if(game?.disputed)return {ok:false,reason:'The participating sources disagree; play visualization withheld',sequence};
 if(game?.phase==='final'){
   const a=score(game.away?.score),h=score(game.home?.score);
   if(a!==null&&h!==null&&(last.awayScore!==a||last.homeScore!==h))
     return {ok:false,reason:'Play-by-play totals ('+last.awayScore+'–'+last.homeScore+
       ') disagree with the verified final ('+a+'–'+h+')',sequence};
 }
 return {ok:true,reason:'',sequence};
}
function gameFlow(plays,game){
 // Real scoreboard events only. Reject reversed scores and conflicting finals.
 const audit=verifyPlayScores(plays,game);
 if(!audit.ok)return '';
 const scoring=audit.sequence;
 const sampled=scoring.length>300?scoring.filter((p,i)=>i%Math.ceil(scoring.length/300)===0||i===scoring.length-1):scoring;
 const max=Math.max(6,...sampled.map(p=>Math.abs(p.awayScore-p.homeScore)));
 const xy=sampled.map((p,i)=>[
   46+(848*i/Math.max(1,sampled.length-1)),
   204-((p.awayScore-p.homeScore)/max)*146
 ]);
 const poly=xy.map(([x,y])=>x.toFixed(1)+','+y.toFixed(1)).join(' ');
 const last=scoring[scoring.length-1];
 return '<div class="slc-flow" role="img" aria-label="Score margin by sourced play. Away leads above center, home leads below">'+
   '<div class="slc-flow-heading"><strong>GAME FLOW</strong><span>SOURCED SCORE MARGINS · NOT PLAYER TRACKING</span></div>'+
   '<svg viewBox="0 0 940 410" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+
   '<line x1="46" y1="204" x2="894" y2="204" stroke="#aab9b6" stroke-dasharray="5 6" stroke-width="2"/>'+
   '<text x="48" y="32">AWAY LEAD</text><text x="48" y="379">HOME LEAD</text>'+
   '<polyline points="'+poly+'" fill="none" stroke="#204b57" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+
   '<circle cx="'+xy.at(-1)[0]+'" cy="'+xy.at(-1)[1]+'" r="10" fill="#ad673e" stroke="#fff" stroke-width="3"/>'+
   '<text x="860" y="32" text-anchor="end">AWAY '+last.awayScore+'</text>'+
   '<text x="860" y="379" text-anchor="end">HOME '+last.homeScore+'</text></svg>'+
   '<p>Points show successive sourced score updates (not elapsed game time). Last reported play: '+esc(last.clock||'clock unavailable')+
   '. This chart is not an official shot chart.</p></div>';
}
function stationLinks(g){
 const id=String(g.id||'');
 const radio=[{label:'Browse official college radio',url:'https://thevarsitynetwork.com/',note:'Broadcaster availability varies by matchup.'}];
 if(id==='401920982'){
   radio.unshift({label:'Notre Dame Radio Network',url:'https://fightingirish.com/radioaffiliates/',
     note:'Official university broadcaster; live stream or replay subject to availability.'});
 }
 return '<aside class="slc-audio"><div><strong>LISTEN TO THE GAME</strong>'+
   '<small>Authorized stations · audio opens at the broadcaster</small></div>'+
   '<div class="slc-audio-links">'+radio.map(r=>'<a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(r.note)+'">'+esc(r.label)+' ↗</a>').join('')+'</div>'+
   '<p>Audio is controlled by the rights-holder. CourtCast uses sourced game events, not transcribed radio. Broadcast delays may differ.</p></aside>';
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
  const validation=verifyPlayScores(plays,g);
  const aging=Date.now()-(c.updatedAt||0);
  const delayed=g.phase==='live'&&aging>60000;
  const pos=selected?location(selected):null,arr=plays.slice(-MAX).reverse();
  const shotPlays=plays.filter(p=>location(p)!==null).slice(-30);
  const flow=shotPlays.length?'':gameFlow(plays,g);
  const live=g.phase==='live',final=g.phase==='final';
  c.node.innerHTML='<div class="slc-wrap"><header class="slc-head"><div><small>THE SPORTING LIFE & TIMES / GAMEFILE</small>'+
    '<h2>COURTCAST</h2></div><b>'+(delayed?'FEED DELAYED':live?'LIVE PLAY-BY-PLAY':final?'FINAL · PLAY REPLAY':'PREGAME')+'</b></header>'+
    (delayed?'<p class="slc-warning">Live play feed has not refreshed for more than one minute. The events below are the most recent available, not confirmed current.</p>':'')+
    '<div class="slc-columns"><section class="slc-visual"><div class="slc-teams"><span>AWAY · '+esc(name(g.away))+'</span>'+
    '<span>HOME · '+esc(name(g.home))+'</span></div>'+
    (flow?flow:
      (!validation.ok&&validation.sequence.length>=3?'<div class="slc-data-conflict" role="status"><strong>GAME FLOW UNAVAILABLE</strong><span>'+esc(validation.reason)+'. The verified score above remains authoritative.</span></div>':
      (shotPlays.length?'<div class="slc-floor">'+lines+
      shotPlays.map(p=>{const xy=location(p);return '<span class="slc-shot'+(p.scoring?' slc-shot-made':'')+(selected?.id===p.id?' slc-shot-current':'')+'" style="--x:'+xy.x+'%;--y:'+xy.y+'%" title="'+esc(p.text)+'" aria-hidden="true"></span>';}).join('')+
      '<span class="slc-court-label">SOURCE-REPORTED SHOT LOCATIONS · HALF-COURT PLOT</span></div>':
      '<div class="slc-standby"><strong>COURT VIEW NOT AVAILABLE</strong><span>No certified shot coordinates or complete score progression are available. Recorded plays remain listed at right.</span></div>')))+
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
    (global.SLTRadio?'':stationLinks(g))+
    '<footer class="slc-note">Play log: attributed ESPN events. Shot marks appear only where normalized source coordinates exist. '+
    'This is not optical tracking or radio transcription. For ongoing games, score and plays are checked approximately every 15 seconds.</footer></div>';
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
function mount(node,game,summary,meta={}){
 if(!node||!game)return;
 const key=String(game.id||'')+'/'+String(game.away?.team?.id||'');
 let c=contexts.get(node);
 if(!c){
  const prior=activeByGame.get(key);
  if(prior)stop(prior);
  c={node,game,plays:[],follow:prior?.follow??true,selected:prior?.selected??null,
     timer:null,previousPlay:prior?.previousPlay??null,updatedAt:meta.updatedAt||0};
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
 c.game=game;c.plays=parsePlays(summary);c.updatedAt=meta.updatedAt||0;
 if(c.selected&&!c.plays.some(p=>p.id===c.selected)){c.follow=true;c.selected=null;}
 draw(c);
}
global.SLTCourt={mount,parsePlays,location,stationLinks,gameFlow,verifyPlayScores};
})(window);