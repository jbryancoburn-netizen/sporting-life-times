/* COURTCAST / The Sporting Life & Times. Sourced plays, not optical tracking. */
(function(global){
'use strict';
const contexts=new WeakMap(),activeByGame=new Map(),MAX=12;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const score=v=>v===null||v===undefined||v===''||!Number.isSafeInteger(Number(v))||Number(v)<0||Number(v)>500?null:Number(v);
const teamColor=(t,fallback)=>{const raw=String(t?.team?.color||'').replace(/^#/,'');
 if(/^[a-f0-9]{6}$/i.test(raw)&&raw.toLowerCase()!=='ffffff')return '#'+raw;
 return global.MBBLogos?.colorForESPN?.(t?.team?.id)?.primary||fallback;};
const sideName=t=>{
 const id=String(t?.team?.id||'');
 const canonical=t?.team?.schoolLabel||global.MBBLogos?.schoolNameForESPN?.(id)||'';
 const short=String(t?.team?.shortDisplayName||'').trim();
 const fallback=short.length>2?short:t?.team?.displayName||t?.team?.name||'TEAM';
 return String(canonical||fallback).trim().replace(/\bSt\.$/,'State').toUpperCase();
};
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
// A real scoring timeline requires clocks on every plotted scoring event.
// A provider's chronological game clock is NOT the real-world wall clock.
function clockSeconds(value){
 const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(value||'').trim());
 if(!m)return null;
 return Number(m[1])*60+Number(m[2]);
}
function elapsedClock(play,women){
 const period=play.period;
 if(!Number.isInteger(period)||period<1||period>12)return null;
 const length=period<=(women?4:2)?(women?600:1200):300;
 const remaining=clockSeconds(play.clock);
 if(remaining===null||remaining>length)return null;
 return Math.min(period-1,women?4:2)*(women?600:1200)+
  Math.max(0,period-(women?4:2)-1)*300+(length-remaining);
}
function clockAtElapsed(seconds,women){
 const length=women?600:1200,count=women?4:2;
 const period=seconds<count*length?Math.floor(seconds/length)+1:count+1+Math.floor((seconds-count*length)/300);
 const duration=period<=count?length:300;
 const remaining=duration-(seconds-(period<=count?(period-1)*length:count*length+(period-count-1)*300));
 return (period<=count?(women?'Q':'H')+period:'OT'+(period-count))+
  ' '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
}
function timelineFor(scoring,game){
 const women=game?.gender==='women'||game?.league==='ncaaw';
 const elapsed=scoring.map(p=>elapsedClock(p,women));
 const complete=elapsed.every((v,i)=>v!==null&&(!i||v>=elapsed[i-1]));
 if(!complete)return null; // No invented play times or interpolated clocks.
 const last=elapsed.at(-1),end=Math.max(300,Math.ceil(last/300)*300);
 const step=end<=300?60:end<=600?120:300;
 return {elapsed,end,step,women,caption:'Game clock · '+(women?'quarters':'halves')+
   ' · each point at its reported time'};
}
function gameFlow(plays,game,attributePlay){
 // Use validated, chronological, source-reported scoring events only.
 // The graph is the ACTUAL point margin, never the pregame RETRO spread.
 const audit=verifyPlayScores(plays,game);
 if(!audit.ok)return '';
 const scoring=audit.sequence;
 const margin=p=>p.awayScore-p.homeScore;
 const sampled=scoring.length>300?scoring.filter((p,i)=>i%Math.ceil(scoring.length/300)===0||i===scoring.length-1):scoring;
 const margins=scoring.map(margin);
 const awayMax=Math.max(0,...margins),homeMax=Math.max(0,...margins.map(n=>-n));
 const scale=Math.max(10,Math.ceil(Math.max(awayMax,homeMax)/10)*10);
 const left=116,right=876,mid=210,extent=128;
 const timeline=timelineFor(scoring,game);
 const shownIndices=sampled.map(p=>scoring.indexOf(p));
 const x=i=>left+(right-left)*(timeline?
   timeline.elapsed[shownIndices[i]]/timeline.end:
   i/Math.max(1,sampled.length-1));
 const y=lead=>mid-lead/scale*extent;
 const xy=sampled.map((p,i)=>[x(i),y(margin(p))]);
 // Reserve room for the endpoint before placing interior clock labels.
 const axisMarks=timeline?(()=>{
   const width=right-left;
   const ticks=Array.from({length:Math.floor(timeline.end/timeline.step)+1},(_,i)=>i*timeline.step);
   if(ticks.at(-1)!==timeline.end)ticks.push(timeline.end);
   let nextLabel=right,nextCompact=right;
   return ticks.reverse().map(secs=>{
    const pos=left+width*secs/timeline.end;
    const isEnd=secs===timeline.end,isStart=secs===0;
    const major=isStart||isEnd||secs%600===0;
    const show=major&&(isEnd||isStart||(nextLabel-pos>=115&&pos-left>=115));
    const compact=show&&(isEnd||isStart||(nextCompact-pos>=175&&pos-left>=175));
    if(show)nextLabel=pos;
    if(compact)nextCompact=pos;
    const label=isEnd&&secs%(timeline.women?600:1200)===0&&secs<=2400||
      isEnd&&secs>2400&&secs%300===0?
      clockAtElapsed(secs-1,timeline.women).replace(/0:01$/,'0:00'):
      clockAtElapsed(secs,timeline.women);
    return '<line class="slc-flow-time-rule" x1="'+pos.toFixed(1)+'" y1="'+(mid-extent)+'" x2="'+pos.toFixed(1)+'" y2="'+(mid+extent)+'"/>'+
      '<line class="slc-flow-time-tick" x1="'+pos.toFixed(1)+'" y1="378" x2="'+pos.toFixed(1)+'" y2="387"/>'+
      (show?'<text class="slc-flow-time-label'+(compact?'':' slc-flow-time-label--mobile-hide')+
      '" x="'+pos.toFixed(1)+'" y="408" text-anchor="'+(isStart?'start':isEnd?'end':'middle')+'">'+
       esc(label)+'</text>':'');
   }).reverse().join('');
 })():
   // Event-order labels are displayed only when reliable play clocks are absent.
   [0,Math.floor((sampled.length-1)/2),sampled.length-1].filter((i,idx,all)=>all.indexOf(i)===idx)
    .map((i,j,all)=>'<text class="slc-flow-time-label'+(j>0&&j<all.length-1?' slc-flow-time-label--mobile-hide':'')+
     '" x="'+x(i).toFixed(1)+'" y="408" text-anchor="'+
      (i===0?'start':i===sampled.length-1?'end':'middle')+'">EVENT '+(shownIndices[i]+1)+'</text>').join('');

 // Timeouts use provider-reported plays. When some scoring clocks are missing,
 // locate markers by actual event order instead of suppressing them altogether.
 const timeouts=[],seenTimeout=new Set();
 for(let i=0;i<plays.length;i++){
  const p=plays[i];
  if(!/\btime\s*[- ]?out\b/i.test(p.kind+' '+p.text))continue;
  const elapsed=elapsedClock(p,game?.gender==='women'||game?.league==='ncaaw');
  if(timeline&&(elapsed===null||elapsed>timeline.end))continue;
  const key=p.id+'|'+p.period+'|'+p.clock;
  if(seenTimeout.has(key))continue;
  seenTimeout.add(key);
  // A timeout does not need a scoring event or invented clock time.
  let count=0,latestScore={awayScore:0,homeScore:0};
  for(let j=0;j<=i;j++){
   const q=plays[j];
   if(q.awayScore!==null&&q.homeScore!==null){
    count++;
    latestScore={awayScore:q.awayScore,homeScore:q.homeScore};
   }
  }
  const fraction=timeline?elapsed/timeline.end:Math.min(1,Math.max(0,(count-1)/Math.max(1,scoring.length-1)));
  timeouts.push({...p,index:i,elapsed,position:fraction,latestScore});
 }
 timeouts.sort((a,b)=>a.position-b.position);
 // Use true timeouts first; when the provider omits timeout entries, divide
 // by observed period transitions instead of hiding all scoring segment controls.
 const periodCuts=[];
 if(!timeouts.length){
  let priorPeriod=null;
  for(let i=0;i<plays.length;i++){
   const p=plays[i],period=Number(p.period);
   if(!Number.isInteger(period)||period<1)continue;
   if(priorPeriod!==null&&period!==priorPeriod){
    const q=plays[i-1];
    const latestScore=periodCuts.length?periodCuts.at(-1).latestScore:{awayScore:0,homeScore:0};
    let previous=latestScore;
    for(let k=0;k<i;k++){if(plays[k].awayScore!==null&&plays[k].homeScore!==null)previous={awayScore:plays[k].awayScore,homeScore:plays[k].homeScore};}
    periodCuts.push({index:i-1,clock:'END P'+priorPeriod,period:priorPeriod,position:i/Math.max(1,plays.length),latestScore:previous});
   }
   priorPeriod=period;
  }
 }
 const endPoint={clock:'LATEST',index:plays.length,position:1,latestScore:scoring.at(-1)};
 const startPoint={clock:'TIPOFF',index:-1,position:0,latestScore:{awayScore:0,homeScore:0}};
 const cut=[startPoint,...(timeouts.length?timeouts:periodCuts),endPoint];
 const segmentsFromTimeouts=timeouts.length>0;
 const spanData=cut.slice(1).map((end,i)=>{
  const start=cut[i],a=start.latestScore,b=end.latestScore;
  return {start,end,away:b.awayScore-a.awayScore,home:b.homeScore-a.homeScore,
   events:plays.slice(start.index+1,end.index).filter(p=>p&&typeof p.text==='string')};
 }).filter(v=>v.end.index>v.start.index);
 const periodMarks=timeline?Array.from({length:timeline.women?3:1},(_,i)=>({
  elapsed:(i+1)*(timeline.women?600:1200),
  label:timeline.women?'END Q'+(i+1):'HALFTIME'
 })).filter(p=>p.elapsed<timeline.end).map(p=>{
  const xx=left+(right-left)*p.elapsed/timeline.end;
  return '<line class="slc-flow-period-rule" x1="'+xx+'" x2="'+xx+'" y1="80" y2="338"/>'+
   '<text class="slc-flow-period-label" x="'+xx+'" y="66" text-anchor="middle">'+p.label+'</text>';
 }).join(''):'';
 const timeoutMarks=timeouts.map(p=>{
  const xx=left+(right-left)*p.position;
  return '<g class="slc-flow-timeout"><title>'+esc(p.text+' · '+p.clock)+'</title>'+
   '<line x1="'+xx+'" x2="'+xx+'" y1="82" y2="338"/>'+
   '<circle cx="'+xx+'" cy="75" r="5"/></g>';
 }).join('');
 const away=game?sideName(game.away):'AWAY',home=game?sideName(game.home):'HOME';
 // Native disclosure panels make each stretch keyboard- and touch-accessible.
 const segmentStrip=spanData.length?'<section class="slc-flow-segments" aria-label="Scoring segments between timeouts">'+
  '<div class="slc-flow-segments-head"><strong>'+(segmentsFromTimeouts?'TIMEOUT-TO-TIMEOUT SCORING':'SCORING BY REPORTED PERIOD')+'</strong><span>Select a segment for scores and plays</span></div>'+
  '<div class="slc-flow-segment-grid">'+spanData.map((v,i)=>{
   const prior=v.start.latestScore,ending=v.end.latestScore;
   const difference=v.away-v.home;
   const spanLabel=p=>p.clock==='TIPOFF'||p.clock==='LATEST'||String(p.clock||'').startsWith('END P')?p.clock:
     (p.period?'P'+p.period+' ':'')+(p.clock||'TIME NOT REPORTED');
   const scores=v.events.filter(p=>p.awayScore!==null&&p.homeScore!==null);
   let a=prior.awayScore,h=prior.homeScore,awayScoring=0,homeScoring=0;
   const scoringEvents=[];
   for(const p of scores){
    const da=p.awayScore-a,dh=p.homeScore-h;
    if(da>0||dh>0){
     if(da>0)awayScoring++;if(dh>0)homeScoring++;
     scoringEvents.push(p);
    }
    a=p.awayScore;h=p.homeScore;
   }
   const leading=difference>0?away:difference<0?home:'EVEN';
   const leadLine=difference===0?'EVEN SCORING':leading+' +'+Math.abs(difference)+' THIS STRETCH';
   const eventTypes=[['FOULS',/\bfoul\b/i],['TURNOVERS',/\bturnover\b/i],['REBOUNDS',/\brebound\b/i],['STEALS',/\bsteal\b/i],['BLOCKS',/\bblock\b/i]];
   const typeCounts=eventTypes.map(([label,re])=>({label,count:v.events.filter(p=>re.test(p.kind+' '+p.text)).length})).filter(x=>x.count>0);
   const logged=v.events.filter(p=>eventTypes.some(([,re])=>re.test(p.kind+' '+p.text)));
   const examples=scoringEvents.length?scoringEvents.slice(0,10):logged.slice(0,6);
   const playList=examples.length?'<ol class="slc-flow-segment-plays">'+examples.map(p=>
    '<li><small>'+esc((p.period?'P'+p.period+' ':'')+(p.clock||'—'))+'</small>'+
    '<span>'+esc(typeof attributePlay==='function'?attributePlay(p):p.text)+'</span>'+
    (p.awayScore!==null&&p.homeScore!==null?'<b>'+p.awayScore+'–'+p.homeScore+'</b>':'')+'</li>').join('')+'</ol>':
    '<p class="slc-flow-segment-empty">No scoring-play details reported for this stretch.</p>';
   return '<details class="slc-flow-segment">'+
    '<summary aria-label="Segment '+(i+1)+', '+esc(spanLabel(v.start))+' to '+esc(spanLabel(v.end))+', expand scores and statistics">'+
    '<span class="slc-flow-segment-label">SEGMENT '+(i+1)+'</span>'+
    '<span class="slc-flow-segment-clock">'+esc(spanLabel(v.start))+' – '+esc(spanLabel(v.end))+'</span>'+
    '<span class="slc-flow-segment-result"><b>'+v.away+'–'+v.home+'</b><small>'+esc(away)+' – '+esc(home)+' PTS</small></span>'+
    '<span class="slc-flow-segment-expand">SCORES &amp; STATS <span aria-hidden="true">⌄</span></span></summary>'+
    '<div class="slc-flow-segment-details">'+
    '<div class="slc-flow-segment-scoreline"><span>START <b>'+prior.awayScore+'–'+prior.homeScore+'</b></span>'+
    '<span>END <b>'+ending.awayScore+'–'+ending.homeScore+'</b></span></div>'+
    '<div class="slc-flow-segment-names"><span>'+esc(away)+' <b>'+v.away+' PTS</b></span>'+
    '<span>'+esc(home)+' <b>'+v.home+' PTS</b></span></div>'+
    '<p class="slc-flow-segment-swing">'+esc(leadLine)+' · SCORING PLAYS '+awayScoring+'–'+homeScoring+'</p>'+
    (typeCounts.length?'<p class="slc-flow-segment-count">REPORTED: '+typeCounts.map(x=>x.label+' '+x.count).join(' · ')+'</p>':'')+
    '<h5>REPORTED PLAYS</h5>'+playList+
    (scoringEvents.length>10?'<p class="slc-flow-segment-more">First 10 scoring plays shown; see Every Play for the complete log.</p>':'')+
    '</div></details>';
  }).join('')+'</div></section>':'';
 const last=scoring.at(-1),latest=margin(last);
 const awayColor=teamColor(game?.away,'#23657d'),homeColor=teamColor(game?.home,'#b17931');
 const leader=latest>0?away:latest<0?home:'TIED';
 const latestLabel=latest===0?'TIED · 0 POINTS':leader+' +'+Math.abs(latest)+' POINT'+(Math.abs(latest)===1?'':'S');
 const a11y=latest===0?'tied':leader+' leads by '+Math.abs(latest)+' points';
 const drawLine=(p,q,color)=>'<line x1="'+p[0].toFixed(1)+'" y1="'+p[1].toFixed(1)+
   '" x2="'+q[0].toFixed(1)+'" y2="'+q[1].toFixed(1)+
   '" stroke="'+color+'" stroke-width="5" stroke-linecap="round"/>';
 const segments=xy.map((current,i)=>{
   const previous=i?xy[i-1]:[left,mid];
   const before=i?margin(sampled[i-1]):0,after=margin(sampled[i]);
   const corner=[current[0],previous[1]];
   const ink=value=>value>0?awayColor:value<0?homeColor:'#455b60';
   const horizontal=drawLine(previous,corner,ink(before));
   if(before*after<0){
     const tie=[current[0],mid];
     return horizontal+drawLine(corner,tie,ink(before))+drawLine(tie,current,ink(after));
   }
   return horizontal+drawLine(corner,current,ink(after||before));
 }).join('');
 const tickMargins=[scale,scale/2,0,-scale/2,-scale];
 const grid=tickMargins.map(n=>{
   const position=y(n),zero=n===0;
   const label=zero?'TIED':(n>0?'+':'−')+Math.abs(n);
   return '<line x1="'+left+'" y1="'+position+'" x2="'+right+'" y2="'+position+
     '" class="'+(zero?'slc-flow-zero':'slc-flow-grid')+'"/>'+
     '<text class="slc-flow-tick'+(zero?' slc-flow-tick--zero':'')+
     '" x="'+(left-14)+'" y="'+(position+5)+'" text-anchor="end">'+label+'</text>';
 }).join('');
 const lastPoint=xy.at(-1),marker=latest>0?awayColor:latest<0?homeColor:'#455b60';
 return '<div class="slc-flow" style="--slc-away:'+awayColor+';--slc-home:'+homeColor+
   '" role="group" aria-label="Scoring margin by reported play. Latest: '+esc(a11y)+
   '. Largest reported leads: '+esc(away)+' '+awayMax+' points, '+esc(home)+' '+homeMax+
   ' points. Positive values favor the away team.">'+
   '<div class="slc-flow-heading"><strong>GAME FLOW</strong><span>POINT MARGIN BY PLAY</span></div>'+
   '<div class="slc-flow-status"><span>LATEST REPORTED MARGIN</span><strong>'+esc(latestLabel)+
   '</strong><small>'+esc(away)+' '+last.awayScore+' · '+esc(home)+' '+last.homeScore+'</small></div>'+
   '<div class="slc-flow-key"><span><i class="slc-away-dot"></i>'+esc(away)+' LEAD (ABOVE ZERO)</span>'+
   '<span><i class="slc-home-dot"></i>'+esc(home)+' LEAD (BELOW ZERO)</span></div>'+
   '<div class="slc-flow-lead-list"><span>LARGEST REPORTED LEAD</span><b>'+esc(away)+
   ' +'+awayMax+'</b><b>'+esc(home)+' +'+homeMax+'</b></div>'+
   '<div class="slc-flow-time-heading">'+(timeline?'GAME CLOCK · '+(timeline.women?'QUARTERS':'HALVES'):'EVENT ORDER · SOURCE CLOCKS INCOMPLETE')+'</div>'+
   '<svg viewBox="0 0 940 430" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+
   '<rect x="'+left+'" y="'+(mid-extent)+'" width="'+(right-left)+'" height="'+extent+
   '" fill="'+awayColor+'" opacity=".065"/>'+
   '<rect x="'+left+'" y="'+mid+'" width="'+(right-left)+'" height="'+extent+
   '" fill="'+homeColor+'" opacity=".065"/>'+
   grid+axisMarks+periodMarks+
   '<text class="slc-flow-side" x="'+left+'" y="43">'+esc(away)+' LEAD</text>'+
   '<text class="slc-flow-side" x="'+left+'" y="371">'+esc(home)+' LEAD</text>'+
   segments+timeoutMarks+
   '<circle cx="'+lastPoint[0].toFixed(1)+'" cy="'+lastPoint[1].toFixed(1)+
   '" r="9" fill="'+marker+'" stroke="#fff" stroke-width="3"/>'+
   '<text class="slc-flow-score" x="'+right+'" y="43" text-anchor="end">'+esc(away)+' '+last.awayScore+'</text>'+
   '<text class="slc-flow-score" x="'+right+'" y="371" text-anchor="end">'+esc(home)+' '+last.homeScore+'</text>'+
   '</svg>'+segmentStrip+
   '<p>Above TIED: '+esc(away)+' ahead. Below: '+esc(home)+' ahead. '+
   (timeline?'Horizontal spacing uses the source game clock; flat portions mean no reported scoring change. ':
     'The source does not timestamp every scoring event; horizontal spacing shows event order, not elapsed time. ')+
   'Latest reported play: '+esc(last.period?'PERIOD '+last.period+' · ':'')+
   esc(last.clock||'time not reported')+'.</p></div>';
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
function name(t){return sideName(t);}
function stop(c){if(c.timer){clearInterval(c.timer);c.timer=null;}}
function draw(c){
  const g=c.game,plays=c.plays,selected=c.follow?plays.at(-1):plays.find(p=>p.id===c.selected)||plays.at(-1);
  const validation=verifyPlayScores(plays,g);
  const aging=Date.now()-(c.updatedAt||0);
  const delayed=g.phase==='live'&&aging>60000;
  const pos=selected?location(selected):null,arr=plays.slice(-MAX).reverse();
  const shotPlays=plays.filter(p=>location(p)!==null).slice(-30);
  // The sourced lead graph is always available when scores reconcile, even if shot coordinates exist.
  const flow=gameFlow(plays,g);
  const live=g.phase==='live',final=g.phase==='final';
  c.node.innerHTML='<div class="slc-wrap" style="--slc-away:'+teamColor(g.away,'#23657d')+';--slc-home:'+teamColor(g.home,'#b17931')+'"><header class="slc-head"><div><small>THE SPORTING LIFE & TIMES / GAMEFILE</small>'+
    '<h2>COURTCAST</h2></div><b>'+(delayed?'FEED DELAYED':live?'LIVE PLAY-BY-PLAY':final?'FINAL · PLAY REPLAY':'PREGAME')+'</b></header>'+
    (delayed?'<p class="slc-warning">Live play feed has not refreshed for more than one minute. The events below are the most recent available, not confirmed current.</p>':'')+
    '<div class="slc-columns"><section class="slc-visual"><div class="slc-teams"><span class="slc-away-name">'+esc(sideName(g.away))+'</span>'+
    '<span class="slc-home-name">'+esc(sideName(g.home))+'</span></div>'+
    (flow?flow:(!validation.ok&&validation.sequence.length>=3?
      '<div class="slc-data-conflict" role="status"><strong>GAME FLOW UNAVAILABLE</strong><span>'+esc(validation.reason)+'. The verified score above remains authoritative.</span></div>':
      '<div class="slc-standby"><strong>COURT VIEW NOT AVAILABLE</strong><span>No certified play-by-play score sequence is available. Recorded plays remain listed at right.</span></div>'))+
    (shotPlays.length?'<details class="slc-shot-details"><summary>Verified shot locations ('+shotPlays.length+')</summary><div class="slc-floor">'+lines+
      shotPlays.map(p=>{const xy=location(p);return '<span class="slc-shot'+(p.scoring?' slc-shot-made':'')+(selected?.id===p.id?' slc-shot-current':'')+'" style="--x:'+xy.x+'%;--y:'+xy.y+'%" title="'+esc(p.text)+'" aria-hidden="true"></span>';}).join('')+
      '<span class="slc-court-label">SOURCE-REPORTED SHOT LOCATIONS · HALF-COURT PLOT</span></div></details>':'')+
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
    (c.inline?'':(global.SLTRadio?'':stationLinks(g)))+
    '<footer class="slc-note">Play log: sourced game events. Shot marks appear only where normalized source coordinates exist. '+
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
     timer:null,previousPlay:prior?.previousPlay??null,updatedAt:meta.updatedAt||0,inline:meta.inline===true};
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
 c.game=game;c.plays=parsePlays(summary);c.updatedAt=meta.updatedAt||0;c.inline=meta.inline===true;
 if(c.selected&&!c.plays.some(p=>p.id===c.selected)){c.follow=true;c.selected=null;}
 draw(c);
}
global.SLTCourt={mount,parsePlays,location,stationLinks,gameFlow,verifyPlayScores};
})(window);