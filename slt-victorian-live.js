/* Sporting Life & Times | Victorian Live Match Desk
   Source-backed, read-only experience; never invents positions, plays, scores, or live win odds.
   Away always precedes home. The published scorebug and its rating pipeline are untouched. */
(function () {
'use strict';
const q=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const league=String(params.get('league')||'').toLowerCase();
const id=String(params.get('game')||'').replace(/^espn:/,'');
const catalog={
 ncaam:{label:"Men's College Basketball",path:'basketball/mens-college-basketball',periods:'halves',kind:'basketball',back:'ncaam-slate.html'},
 ncaaw:{label:"Women's College Basketball",path:'basketball/womens-college-basketball',periods:'quarters',kind:'basketball',back:'ncaam-slate.html?gender=women'},
 nba:{label:'National Basketball Association',path:'basketball/nba',periods:'quarters',kind:'basketball',back:'nba-game-center.html'},
 nfl:{label:'National Football League',path:'football/nfl',periods:'quarters',kind:'football',back:'nfl.html'},
 cfb:{label:'College Football',path:'football/college-football',periods:'quarters',kind:'football',back:'cfb-scoreboard.html'},
 epl:{label:'Premier League',path:'soccer/eng.1',periods:'halves',kind:'soccer',back:'epl.html'}
};
const config=catalog[league],validId=/^\d{7,12}$/.test(id);
if(!config||!validId){
 q('vld-status').textContent='Choose a published game from the Sporting Life & Times Daily Ledger.';
 q('vld-main').innerHTML='<p class="vld-empty">No valid game was selected. <a href="sports.html">Return to the sports editions</a>.</p>';
 return;
}
const endpoint='https://site.api.espn.com/apis/site/v2/sports/'+config.path+'/summary?event='+encodeURIComponent(id);
q('vld-edition').textContent=config.label.toUpperCase();
q('vld-back').href=config.back;
q('vld-sport').textContent=config.kind==='basketball'?'THE COURTSIDE DISPATCH':config.kind==='football'?'THE GRIDIRON DISPATCH':'THE TOUCHLINE DISPATCH';
document.title=config.label+' · Live Game | Sporting Life & Times';
let lastGood=null,updatedAt=0,busy=false,chosenTab='live',requestNo=0;
const timeET=t=>new Date(t).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const safeScore=v=>{const n=num(v?.value??v?.displayValue??v);return Number.isInteger(n)&&n>=0&&n<=500?n:null;};
const clr=(v,fallback)=>/^[0-9a-f]{6}$/i.test(String(v||'').replace(/^#/,''))?'#'+String(v).replace(/^#/,''):fallback;
const sourceLogo=v=>{let s=String(v||'');return /^https:\/\/(?:a\.espncdn\.com|cdn\.nba\.com|.*\.espncdn\.com)\//i.test(s)?s:'';};
function statusPhase(status){
 const state=String(status?.type?.state||status?.type?.name||'').toLowerCase();
 return state==='in'||state==='in_progress'?'live':state==='post'||state==='final'?'final':'upcoming';
}
function periodLabel(n){
 if(config.kind==='soccer')return n<=2?'H'+n:'ET'+(n-2);
 if(config.periods==='halves')return n<=2?'H'+n:'OT'+(n-2);
 return n<=4?'Q'+n:'OT'+(n-4);
}
const teamCode=t=>String(t?.team?.abbreviation||'').trim().toUpperCase().slice(0,8);
function normalize(raw){
 const head=raw?.header,comp=head?.competitions?.[0],members=comp?.competitors||[];
 if(String(comp?.id||head?.id||'')&&String(comp?.id||head?.id||'')!==id)throw Error('Source game identifier does not match the requested match');
 const away=members.find(t=>t.homeAway==='away'),home=members.find(t=>t.homeAway==='home');
 if(!away||!home)throw Error('The game feed does not identify both competitors');
 const team=(t,side)=>({
  side,id:String(t.team?.id||''),name:String(t.team?.displayName||t.team?.shortDisplayName||t.team?.name||'Unknown team'),
  short:String(t.team?.shortDisplayName||t.team?.abbreviation||t.team?.name||'TEAM'),
  code:teamCode(t),logo:sourceLogo(t.team?.logos?.[0]?.href||t.team?.logo||''),
  color:clr(t.team?.color,side==='away'?'#762c2c':'#19394b'),
  score:safeScore(t.score),record:String(t.record||t.records?.[0]?.summary||''),
  lines:t.linescores||[]
 });
 const a=team(away,'away'),h=team(home,'home');
 const status=comp.status||head.status||{},phase=statusPhase(status);
 const statTeams=raw?.boxscore?.teams||[];
 const boxstats={};
 for(const t of statTeams){const side=String(t.team?.id)===a.id?'away':String(t.team?.id)===h.id?'home':null;
  if(!side)continue;
  boxstats[side]=t.statistics||[];}
 const playSource=Array.isArray(raw?.plays)?raw.plays:Array.isArray(raw?.plays?.items)?raw.plays.items:
  Array.isArray(raw?.playByPlay?.plays)?raw.playByPlay.plays:Array.isArray(raw?.scoringPlays)?raw.scoringPlays:[];
 const plays=playSource.flatMap((p,i)=>{
  const text=String(p?.text||p?.type?.text||'').replace(/\s+/g,' ').trim();
  if(!text)return[];
  const pnum=Number(p.period?.number||p.period||0),clock=String(p.clock?.displayValue||p.clockDisplayValue||'');
  return [{id:String(p.id??p.playId??i),i,period:Number.isInteger(pnum)?pnum:0,clock, text:text.slice(0,400),
   awayScore:safeScore(p.awayScore??p.away_score),homeScore:safeScore(p.homeScore??p.home_score),
   scoring:p.scoringPlay===true||p.scoring_play===true,
   shooting:p.shootingPlay===true||p.shooting_play===true,
   shotSchema:p.coordinate_system||p.coordinateSystem||'',
   shotX:p.coordinate_x??null,shotY:p.coordinate_y??null,
   teamId:String(p.team?.id||'') }];
 });
 // ESPN returns events in different orders across sports; sort strictly by reported period and remaining game clock.
 const remaining=s=>{const bits=String(s).split(':').map(Number);return bits.length===2&&bits.every(Number.isFinite)?bits[0]*60+bits[1]:null;};
 plays.sort((x,y)=>{
  if(x.period&&y.period&&x.period!==y.period)return x.period-y.period;
  const cx=remaining(x.clock),cy=remaining(y.clock);
  return cx!==null&&cy!==null&&cx!==cy?cy-cx:x.i-y.i;
 });
 const boxPlayers=raw?.boxscore?.players||[];
 const venue=String(comp?.venue?.fullName||raw?.gameInfo?.venue?.fullName||'');
 const addr=comp?.venue?.address||raw?.gameInfo?.venue?.address||{};
 const location=[addr.city,addr.state||addr.country].filter(Boolean).join(', ');
 const broadcasters=(comp?.broadcasts||[]).flatMap(x=>x.names||[]).join(', ');
 const detail=String(status.type?.shortDetail||status.type?.description||status.displayClock||comp?.status?.type?.description||'Match details');
 return {id,a,h,phase,detail,venue,location,broadcasters,plays,boxstats,boxPlayers,raw,source:'ESPN game summary'};
}

function nbaOfficial(raw,playFeed){
 const g=raw?.game||raw;if(!g?.awayTeam||!g?.homeTeam)throw Error('NBA official game report lacks teams');
 if(String(g.gameId||'')!==id)throw Error('NBA official game identifier differs from the selected game');
 const phase=Number(g.gameStatus)===3?'final':Number(g.gameStatus)===2?'live':'upcoming';
 const parts=[g.awayTeam,g.homeTeam];
 const pick=(t,side)=>({
  side,id:String(t.teamId||''),name:[t.teamCity,t.teamName].filter(Boolean).join(' ')||String(t.teamTricode||'Team'),
  short:String(t.teamName||t.teamTricode||'Team'),code:String(t.teamTricode||'').slice(0,8),
  logo:sourceLogo('https://cdn.nba.com/logos/nba/'+String(t.teamId||'')+'/primary/L/logo.svg'),
  color:'#'+(side==='away'?'702e31':'294d60'),score:safeScore(t.score),record:'',
  lines:(t.periods||[]).map(x=>({value:x.score}))
 });
 const a=pick(parts[0],'away'),h=pick(parts[1],'home');
 const names=[['pointsInThePaint','Paint points'],['reboundsTotal','Rebounds'],['assists','Assists'],
  ['turnovers','Turnovers'],['blocks','Blocks'],['steals','Steals'],['foulsPersonal','Personal fouls']];
 const stats=t=>names.filter(([key])=>t.statistics?.[key]!=null).map(([key,name])=>({name,displayValue:String(t.statistics[key])}));
 const boxstats={away:stats(parts[0]),home:stats(parts[1])};
 const labels=['MIN','PTS','REB','AST','STL','BLK','FGM','FGA','3PM','3PA','FTM','FTA'];
 const statKeys=['minutes','points','reboundsTotal','assists','steals','blocks','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted'];
 const boxPlayers=parts.map(t=>({team:{displayName:[t.teamCity,t.teamName].filter(Boolean).join(' ')},
  statistics:[{labels,athletes:(t.players||[]).map(p=>({athlete:{displayName:p.name||p.nameI||''},
   stats:statKeys.map(k=>String(p.statistics?.[k]??'—'))}))}]}));
 const duration=v=>{const m=/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(v||''));
  return m?String(Number(m[1]||0))+':'+String(Math.floor(Number(m[2]||0))).padStart(2,'0'):String(v||'');};
 const actions=playFeed?.game?.actions||playFeed?.actions||[];
 const plays=actions.flatMap((p,i)=>{
  const text=String(p.description||'').trim();if(!text)return[];
  return [{id:String(p.actionNumber??i),i,period:Number(p.period)||0,clock:duration(p.clock),text,
   awayScore:safeScore(p.scoreAway),homeScore:safeScore(p.scoreHome),teamId:String(p.teamId||''),
   scoring:p.isFieldGoal===1||p.actionType==='freethrow',shooting:false,
   shotSchema:'',shotX:null,shotY:null}];
 });
 const site=g.arena||{},location=[site.arenaCity,site.arenaState].filter(Boolean).join(', ');
 return {id,a,h,phase,detail:String(g.gameStatusText||'NBA game'),venue:String(site.arenaName||''),
  location,broadcasters:'',plays,boxstats,boxPlayers,raw,source:'NBA official live box score'+(plays.length?' and play register':'')};
}
async function getJSON(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
 try{const response=await fetch(url+(url.includes('?')?'&':'?')+'_='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
 }finally{clearTimeout(timer);}
}
async function loadGame(){
 const sources=league==='nba'&&id.startsWith('00')?['nba','espn']:['espn',...(league==='nba'?['nba']:[])];
 let lastError=null;
 for(const source of sources){
  try{
   if(source==='espn')return normalize(await getJSON(endpoint));
   const box=await getJSON('https://cdn.nba.com/static/json/liveData/boxscore/boxscore_'+id+'.json');
   let plays=null;
   try{plays=await getJSON('https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_'+id+'.json');}catch{}
   return nbaOfficial(box,plays);
  }catch(e){lastError=e;console.warn(source+' unavailable for '+id,e);}
 }
 throw lastError||Error('No trusted source responded');
}

function headline(g){return g.phase==='live'?'● LIVE DISPATCH':g.phase==='final'?'FINAL EDITION':'PREGAME EDITION';}
function crest(t){
 return '<span class="vld-crest" style="--side:'+t.color+'">'+(t.logo?'<img src="'+esc(t.logo)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<span class="vld-monogram">'+esc(t.code||t.short.slice(0,2))+'</span>')+'</span>';
}
function reportedFouls(g,side){
 const source=g.boxstats?.[side]||[];
 for(const value of source){
  const name=String(value?.name||value?.label||value?.abbreviation||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!['teamfouls','totalfouls','personalfouls','foulspersonal'].includes(name))continue;
  const count=num(value.displayValue??value.value);
  if(Number.isInteger(count)&&count>=0&&count<=200)return count;
 }
 return null;
}
function scoreboard(g){
 const line=(t)=>'<div class="vld-team vld-team--'+t.side+'" style="--side:'+t.color+'">'+crest(t)+
 '<div class="vld-identity"><strong>'+esc(t.name)+'</strong><span>'+esc(t.code)+(t.record?' · '+esc(t.record):'')+'</span>'+
 (reportedFouls(g,t.side)!==null?'<small class="vld-fouls">REPORTED FOULS · '+reportedFouls(g,t.side)+'</small>':'')+'</div>'+
 '<b class="vld-points">'+(g.phase==='upcoming'?'—':t.score??'—')+'</b></div>';
 return '<section class="vld-score"><div class="vld-score-kicker"><span>'+headline(g)+'</span><span>'+esc(g.detail)+'</span></div>'+
 line(g.a)+line(g.h)+'<div class="vld-score-footer">'+
 '<span>'+esc(g.venue||'Site not reported')+(g.location?' · '+esc(g.location):'')+'</span>'+
 (g.broadcasters?'<span>'+esc(g.broadcasters)+'</span>':'')+'</div></section>';
}
function lineScore(g){
 const members=[g.a,g.h];
 const count=Math.max(0,...members.map(t=>t.lines.length));
 if(!count)return '<p class="vld-empty">Verified period scoring has not been published for this match.</p>';
 const read=t=>t.lines.map(x=>safeScore(x)).filter(x=>x!==null);
 if(members.some(t=>t.lines.length!==count||read(t).length!==count))
   return '<p class="vld-empty">Period totals are incomplete or differ between sources.</p>';
 const totals=members.map(t=>read(t).reduce((a,b)=>a+b,0));
 if(members.some((t,i)=>t.score!==null&&totals[i]!==t.score))
   return '<p class="vld-empty">Period scoring is refreshing and has been withheld until the source totals agree.</p>';
 const labels=Array.from({length:count},(_,i)=>'<th>'+periodLabel(i+1)+'</th>').join('');
 return '<div class="vld-scroll"><table class="vld-table"><thead><tr><th>CLUB</th>'+labels+'<th>TOTAL</th></tr></thead><tbody>'+
 members.map(t=>'<tr><th>'+esc(t.code||t.short)+'</th>'+read(t).map(v=>'<td>'+v+'</td>').join('')+'<td><strong>'+esc(t.score??'—')+'</strong></td></tr>').join('')+
 '</tbody></table></div>';
}
function verifiedScores(g){
 const points=g.plays.filter(p=>p.awayScore!==null&&p.homeScore!==null);
 if(points.length<2)return {ok:false,reason:'The source has not reported a scoring sequence',points};
 for(let i=1;i<points.length;i++)if(points[i].awayScore<points[i-1].awayScore||points[i].homeScore<points[i-1].homeScore)
  return {ok:false,reason:'Play totals have been revised or reported out of order',points};
 const last=points[points.length-1];
 if(g.phase==='final'&&g.a.score!==null&&g.h.score!==null&&
    (last.awayScore!==g.a.score||last.homeScore!==g.h.score))
    return {ok:false,reason:'Play totals disagree with the final scoreboard',points};
 if(g.a.score!==null&&g.h.score!==null&&(last.awayScore>g.a.score||last.homeScore>g.h.score))
    return {ok:false,reason:'Reported plays are newer than the live scoreboard',points};
 return {ok:true,points,behind:g.a.score!==last.awayScore||g.h.score!==last.homeScore};
}
function trend(g){
 const v=verifiedScores(g);
 if(!v.ok)return '<div class="vld-empty">'+esc(v.reason)+'. The ledger will display a graph once the sources reconcile.</div>';
 const pts=v.points,length=pts.length,step=Math.max(1,Math.ceil(length/160));
 const series=pts.filter((_,i)=>i%step===0||i===length-1);
 const margins=pts.map(p=>p.awayScore-p.homeScore);
 const maxA=Math.max(0,...margins),maxH=Math.max(0,...margins.map(x=>-x)),cap=Math.max(5,Math.ceil(Math.max(maxA,maxH)/5)*5);
 const coords=series.map((p,i)=>[20+i*760/Math.max(1,series.length-1),125-100*(p.awayScore-p.homeScore)/cap]);
 const paths=coords.slice(1).map((now,i)=>{
  const prev=coords[i],m1=series[i].awayScore-series[i].homeScore,m2=series[i+1].awayScore-series[i+1].homeScore;
  const segment=(a,b,c)=>'<path d="M'+a.join(' ')+' L'+b.join(' ')+'" stroke="'+c+'" />';
  if(m1*m2<0){const t=Math.abs(m1)/(Math.abs(m1)+Math.abs(m2));const mid=[prev[0]+(now[0]-prev[0])*t,125];
   return segment(prev,mid,m1>0?g.a.color:g.h.color)+segment(mid,now,m2>0?g.a.color:g.h.color);}
  return segment(prev,now,(m1||m2)>=0?g.a.color:g.h.color);
 }).join('');
 let leadChanges=0,prior=0;for(const m of margins){const s=Math.sign(m);if(s&&prior&&s!==prior)leadChanges++;if(s)prior=s;}
 const label=v.behind?'Play-by-play is behind the current scoreboard. ':'';
 return '<div class="vld-flow-summary"><span>'+esc(g.a.code)+' largest lead <strong>+'+maxA+'</strong></span>'+
 '<span>Lead changes <strong>'+leadChanges+'</strong></span><span>'+esc(g.h.code)+' largest lead <strong>+'+maxH+'</strong></span></div>'+
 '<svg class="vld-chart" viewBox="0 0 800 250" role="img" aria-label="Reported scoring margin, away above centerline and home below.">'+
 '<rect x="20" y="25" width="760" height="100" fill="'+g.a.color+'" opacity=".08"/>'+
 '<rect x="20" y="125" width="760" height="100" fill="'+g.h.color+'" opacity=".08"/>'+
 '<line x1="20" y1="125" x2="780" y2="125" class="vld-zero"/>'+
 '<text x="30" y="18">'+esc(g.a.code)+' LEAD</text><text x="30" y="243">'+esc(g.h.code)+' LEAD</text>'+
 '<g fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+paths+'</g>'+
 '</svg><p class="vld-source">'+label+'Actual point margin by reported scoring events; horizontal spacing represents event order, not elapsed time. Not a betting projection.</p>';
}
function courtSVG(){
 if(config.kind==='football')return '<svg class="vld-court-svg" viewBox="0 0 640 340" aria-hidden="true"><rect x="15" y="25" width="610" height="290" rx="1"/>'+
 Array.from({length:9},(_,i)=>'<line x1="'+(76+i*61)+'" y1="25" x2="'+(76+i*61)+'" y2="315"/>').join('')+
 '<line x1="50" y1="25" x2="50" y2="315"/><line x1="590" y1="25" x2="590" y2="315"/></svg>';
 if(config.kind==='soccer')return '<svg class="vld-court-svg" viewBox="0 0 640 340" aria-hidden="true"><rect x="15" y="25" width="610" height="290"/><line x1="320" y1="25" x2="320" y2="315"/><circle cx="320" cy="170" r="60"/><rect x="15" y="90" width="90" height="160"/><rect x="535" y="90" width="90" height="160"/><rect x="15" y="125" width="30" height="90"/><rect x="595" y="125" width="30" height="90"/></svg>';
 return '<svg class="vld-court-svg" viewBox="0 0 640 340" aria-hidden="true"><rect x="22" y="20" width="596" height="300"/>'+
 '<line x1="320" y1="20" x2="320" y2="320"/><circle cx="320" cy="170" r="51"/>'+
 '<rect x="22" y="105" width="118" height="130"/><rect x="500" y="105" width="118" height="130"/>'+
 '<circle cx="72" cy="170" r="11"/><circle cx="568" cy="170" r="11"/>'+
 '<path d="M22 56 A161 161 0 0 1 22 284 M618 56 A161 161 0 0 0 618 284"/>'+
 '<path d="M140 105 A70 70 0 0 1 140 235 M500 105 A70 70 0 0 0 500 235"/></svg>';
}
function shots(g){
 if(config.kind!=='basketball')return '<p class="vld-empty">Court plotting is available for basketball only. Location tracking is not supplied for this sport.</p>';
 const verified=g.plays.filter(p=>p.shooting&&p.shotSchema==='halfcourt_feet_v1'&&
  p.shotX!==null&&p.shotY!==null&&num(p.shotX)!==null&&num(p.shotY)!==null&&
  num(p.shotX)>=0&&num(p.shotX)<=50&&num(p.shotY)>=0&&num(p.shotY)<=47&&!/free throw/i.test(p.text));
 if(!verified.length)return '<p class="vld-empty">No certified shot coordinates have been supplied. The court is a diagram, not a live player-tracking animation.</p>';
 return '<div class="vld-shot-marks">'+verified.slice(-40).map(p=>{
  const x=5+(num(p.shotX)/50)*90,y=5+(1-num(p.shotY)/47)*90;
  const color=p.teamId===g.a.id?g.a.color:g.h.color;
  return '<i class="vld-shot" style="left:'+x+'%;top:'+y+'%;background:'+color+'" title="'+esc(p.text)+'"></i>';
 }).join('')+'</div><p class="vld-source">Certified half-court locations only; dots mark reported shots, not ball movement.</p>';
}
function now(g){
 const last=g.plays[g.plays.length-1],game=String(g.detail||'');
 return '<section class="vld-now"><div class="vld-now-head"><span>◈ THE LATEST DISPATCH</span><time>'+esc(last?(periodLabel(last.period||1)+' · '+(last.clock||'clock unavailable')):game)+'</time></div>'+
 '<p>'+esc(last?.text|| (g.phase==='upcoming'?'Awaiting tipoff.':'No sourced play-by-play has been reported for this game.'))+'</p>'+
 (last&&last.awayScore!==null&&last.homeScore!==null?'<small>Reported play score: '+esc(g.a.code)+' '+last.awayScore+' · '+esc(g.h.code)+' '+last.homeScore+'</small>':'')+'</section>';
}
function teamStats(g){
 const groups=['away','home'].map(s=>new Map((g.boxstats[s]||[]).map(row=>
  [String(row.name||row.label||row.abbreviation||'').toLowerCase(),String(row.displayValue??row.value??'')])));
 const a=groups[0],h=groups[1];
 const keys=[...new Set([...a.keys(),...h.keys()])].filter(Boolean).slice(0,45);
 if(!keys.length)return '<p class="vld-empty">No provider-verified team statistics have been published.</p>';
 return '<div class="vld-scroll"><table class="vld-table"><thead><tr><th>MEASURE</th><th>'+esc(g.a.code)+'</th><th>'+esc(g.h.code)+'</th></tr></thead><tbody>'+
 keys.map(k=>'<tr><th>'+esc(k.replace(/([A-Z])/g,' $1'))+'</th><td>'+esc(a.get(k)??'—')+'</td><td>'+esc(h.get(k)??'—')+'</td></tr>').join('')+'</tbody></table></div>';
}
function players(g){
 if(!g.boxPlayers.length)return '<p class="vld-empty">Official individual statistics are not yet available.</p>';
 return g.boxPlayers.map(group=>{
  const sec=group.statistics?.[0],labels=sec?.labels||[],people=sec?.athletes||[];
  if(!labels.length||!people.length)return '';
  return '<h3 class="vld-subheading">'+esc(group.team?.displayName||'Players')+'</h3><div class="vld-scroll"><table class="vld-table"><thead><tr><th>PLAYER</th>'+
   labels.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
   people.map(p=>'<tr><th>'+esc(p.athlete?.displayName||'')+'</th>'+labels.map((_,i)=>'<td>'+esc(p.stats?.[i]??'—')+'</td>').join('')+'</tr>').join('')+
   '</tbody></table></div>';
 }).join('')||'<p class="vld-empty">Player statistics are not available.</p>';
}
function eventLog(g){
 return g.plays.length?'<ol class="vld-plays">'+g.plays.slice().reverse().map(p=>'<li><span>'+esc(periodLabel(p.period||1))+' '+esc(p.clock||'')+'</span><p>'+esc(p.text)+'</p><b>'+
  (p.awayScore!==null&&p.homeScore!==null?esc(p.awayScore)+'–'+esc(p.homeScore):'')+'</b></li>').join('')+'</ol>':
 '<p class="vld-empty">No play-by-play supplied for this game. Events are never simulated.</p>';
}
function panel(tab,content){return '<section class="vld-panel" data-vld-panel="'+tab+'" role="tabpanel" id="vld-panel-'+tab+'" aria-labelledby="vld-tab-'+tab+'"'+(tab!==chosenTab?' hidden':'')+'>'+content+'</section>';}
function page(g){
 const tabs=[['live','Live dispatch'],['stats','Statistics'],['players','Players'],['plays','Every play'],['shots','Court & shots']];
 const section='<section class="vld-paper vld-live-grid">'+
  '<div class="vld-live-main"><h2>The game in motion</h2>'+
  '<div class="vld-floor">'+courtSVG()+(config.kind==='basketball'?'<span class="vld-floor-caption">ILLUSTRATED COURT · NO SIMULATED POSSESSIONS</span>':'<span class="vld-floor-caption">FIELD DIAGRAM · NOT PLAYER TRACKING</span>')+'</div>'+
  now(g)+'</div><aside class="vld-flow"><h2>The Lead Ledger</h2>'+trend(g)+'</aside></section>';
 return scoreboard(g)+
 '<section class="vld-paper"><h2>Period Scoring</h2>'+lineScore(g)+'</section>'+
 '<nav class="vld-tabs" role="tablist" aria-label="Game view">'+tabs.map(([k,t])=>'<button type="button" role="tab" id="vld-tab-'+k+'" aria-controls="vld-panel-'+k+'" data-vld-tab="'+k+'" aria-selected="'+(k===chosenTab)+'">'+t+'</button>').join('')+'</nav>'+
 panel('live',section)+
 panel('stats','<section class="vld-paper"><h2>Official Team Totals</h2>'+teamStats(g)+'</section>')+
 panel('players','<section class="vld-paper"><h2>Player Box Scores</h2>'+players(g)+'</section>')+
 panel('plays','<section class="vld-paper"><h2>The Play Register</h2>'+eventLog(g)+'</section>')+
 panel('shots','<section class="vld-paper"><h2>Shot Locations</h2><div class="vld-shot-floor">'+courtSVG()+shots(g)+'</div></section>')+
 '<p class="vld-attribution">Source: '+esc(g.source)+'. Live and final scores, play accounts and statistics are independently reported by the provider. RETRO pregame forecasts and predictions are not represented as in-game win probabilities. No fabricated possessions or shot locations.</p>';
}
function choose(tab,focus){
 chosenTab=tab;
 document.querySelectorAll('[data-vld-tab]').forEach(b=>{const yes=b.dataset.vldTab===tab;b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1;if(yes&&focus)b.focus();});
 document.querySelectorAll('[data-vld-panel]').forEach(el=>el.hidden=el.dataset.vldPanel!==tab);
}
q('vld-main').addEventListener('click',e=>{const b=e.target.closest('[data-vld-tab]');if(b)choose(b.dataset.vldTab,false);});
q('vld-main').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 const b=e.target.closest('[data-vld-tab]');if(!b)return;
 const all=[...document.querySelectorAll('[data-vld-tab]')],i=all.indexOf(b);
 e.preventDefault();all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length].click();
 choose(document.querySelector('[data-vld-tab][aria-selected=true]').dataset.vldTab,true);
});
function paint(g){
 lastGood=g;updatedAt=Date.now();q('vld-main').innerHTML=page(g);
 choose(chosenTab,false);
 q('vld-status').textContent=(g.phase==='live'?'LIVE · ':g.phase==='final'?'FINAL · ':'PREGAME · ')+
  'Checked '+timeET(updatedAt)+' ET · '+(g.phase==='live'?'updates every 15 seconds':'refreshes periodically');
}
async function update(){
 if(busy||document.hidden)return;busy=true;const request=++requestNo;
 try{
  const game=await loadGame();
  if(request===requestNo)paint(game);
 }catch(error){
  console.warn('Victorian live desk:',error);
  const note=lastGood?'Feed unavailable · last received '+timeET(updatedAt)+' ET. Display is not current.':
   'Live source unavailable. No unverified score will be displayed.';
  q('vld-status').textContent=note;
  if(!lastGood)q('vld-main').innerHTML='<p class="vld-empty">The live report could not be verified. Please return to the <a href="'+esc(config.back)+'">game ledger</a> or refresh.</p>';
 }finally{busy=false;}
}
q('vld-reload').addEventListener('click',update);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
setInterval(()=>{if(!document.hidden)update();},15000);
update();
})();