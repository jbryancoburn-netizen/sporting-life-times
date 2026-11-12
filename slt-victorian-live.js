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
let lastEventChangeAt=0,lastScoreChangeSide='',latestSourceFailure='';
let retroArchive={status:'checking',payload:null};
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
const nbaAliases={NY:'NYK',SA:'SAS',GS:'GSW',NO:'NOP',WSH:'WAS',UTAH:'UTA'};
const canonicalNBA=c=>nbaAliases[String(c||'').toUpperCase()]||String(c||'').toUpperCase();
const teamCode=t=>{
 const code=String(t?.team?.abbreviation||'').trim().toUpperCase().slice(0,8);
 return league==='nba'?canonicalNBA(code):code;
};
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
  short:String(t.teamName||t.teamTricode||'Team'),code:canonicalNBA(String(t.teamTricode||'').slice(0,8)),
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
async function getJSON(url,timeoutMs=7000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const sep=url.includes('?')?'&':'?';
  const response=await fetch(url+sep+'_='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
 }finally{clearTimeout(timer);}
}
function easternDay(date=new Date()){
 const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=k=>p.find(x=>x.type===k)?.value||'';
 return get('year')+get('month')+get('day');
}
function normalizeScoreboardEvent(event){
 const comp=event?.competitions?.[0];
 if(String(event?.id)!==id||!Array.isArray(comp?.competitors))throw Error('Scoreboard event identity mismatch');
 const clean={...comp,date:comp.date||event.date,status:comp.status?.type?comp.status:event.status};
 const g=normalize({header:{id,competitions:[clean]},plays:[],boxscore:{teams:[],players:[]}});
 g.source='ESPN live scoreboard';
 g.sourceTier='scoreboard';
 g.fetchedAt=Date.now();
 return g;
}
async function liveScoreboard(){
 // The ESPN scoreboard can continue publishing game clocks and scores even
 // when the large per-event summary is temporarily missing or inaccessible.
 const candidate=new Set([easternDay()]);
 const base=lastGood?.raw?.header?.competitions?.[0]?.date||
  lastGood?.raw?.header?.competitions?.[0]?.startDate;
 if(base&&Number.isFinite(Date.parse(base)))candidate.add(easternDay(new Date(base)));
 // Previous-day college games may finish after midnight local.
 const previous=new Date();previous.setDate(previous.getDate()-1);
 candidate.add(easternDay(previous));
 let lastError=null;
 for(const day of candidate){
  try{
   const url='https://site.api.espn.com/apis/site/v2/sports/'+config.path+
    '/scoreboard?dates='+day+'&limit=500';
   const response=await getJSON(url,5500);
   const event=(response?.events||[]).find(x=>String(x?.id)===id);
   if(event)return normalizeScoreboardEvent(event);
  }catch(e){lastError=e;}
 }
 throw lastError||Error('Requested match was not found on current or previous live scoreboards');
}
function normalizePublishedMBB(data){
 if(league!=='ncaam')throw Error('Only verified men’s live-score snapshots are supported by this archive');
 const row=(data?.games||[]).find(x=>String(x?.id)===id);
 if(!row||!Array.isArray(row.teams)||row.teams.length!==2)throw Error('Game not in the latest published men’s scoreboard');
 const checked=Date.parse(data.scores_updated_at||'');
 if(!Number.isFinite(checked))throw Error('Published score data has no valid update timestamp');
 const mk=(t,side)=>({
  side,id:String(t.id||''),name:String(t.name||'Unknown team'),
  short:String(t.name||'Team'),code:'',logo:'',
  color:side==='away'?'#762c2c':'#19394b',
  score:safeScore(t.score),record:'',lines:[]
 });
 const a=mk(row.teams[0],'away'),h=mk(row.teams[1],'home');
 if(!a.id||!h.id||a.id===h.id)throw Error('Published scoreboard has conflicting team identities');
 const state=String(row.state||'').toLowerCase();
 const phase=state==='post'?'final':state==='in'?'live':'upcoming';
 return {id,a,h,phase,detail:String(row.status||'Reported game'),
  venue:'',location:'',broadcasters:String(row.broadcast||''),
  plays:[],boxstats:{},boxPlayers:[],raw:{header:{id,competitions:[{date:row.date}]}},
  source:'Sporting Life & Times verified men’s scoreboard ('+String(row.score_source||'published feed')+')',
  sourceTier:'published',fetchedAt:checked,
  isStale:Date.now()-checked>5*60*1000};
}
function preserveVerifiedDetail(g){
 const old=lastGood;
 if(!old||old.id!==g.id||old.a.id!==g.a.id||old.h.id!==g.h.id)return g;
 if(old.phase==='final'&&g.phase!=='final')return old;
 if(old.phase==='live'&&g.phase==='upcoming')return old;
 const oldScores=[old.a.score,old.h.score],newScores=[g.a.score,g.h.score];
 if(g.sourceTier!=='summary'&&oldScores.every(Number.isInteger)&&newScores.every(Number.isInteger)&&
  newScores.every((n,i)=>n<=oldScores[i])&&newScores.some((n,i)=>n<oldScores[i])){
  // A cached fallback must not overwrite a newer, verified game report.
  return {...old,sourceTier:'cached',isStale:true};
 }
 if(g.sourceTier!=='summary'){
  if(old.plays?.length)g.plays=old.plays;
  if(old.boxPlayers?.length)g.boxPlayers=old.boxPlayers;
  if(Object.keys(old.boxstats||{}).length)g.boxstats=old.boxstats;
  if(!g.venue)g.venue=old.venue;
  if(!g.location)g.location=old.location;
  if(!g.broadcasters)g.broadcasters=old.broadcasters;
 }
 return g;
}
async function loadGame(){
 const sources=league==='nba'&&id.startsWith('00')?['nba','espn','scoreboard']:
  ['espn',...(league==='nba'?['nba']:[]),'scoreboard',...(league==='ncaam'?['published']:[])];
 const errors=[];
 for(const source of sources){
  try{
   let result;
   if(source==='espn'){
    result=normalize(await getJSON(endpoint,6500));
    result.sourceTier='summary';result.fetchedAt=Date.now();
   }else if(source==='nba'){
    const box=await getJSON('https://cdn.nba.com/static/json/liveData/boxscore/boxscore_'+id+'.json',6000);
    let plays=null;
    try{plays=await getJSON('https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_'+id+'.json',4000);}catch{}
    result=nbaOfficial(box,plays);
    result.sourceTier='summary';result.fetchedAt=Date.now();
   }else if(source==='scoreboard'){
    result=await liveScoreboard();
   }else{
    result=normalizePublishedMBB(await getJSON('data/mbb-live.json',5500));
   }
   latestSourceFailure=errors.join(' · ');
   return preserveVerifiedDetail(result);
  }catch(e){errors.push(source+': '+String(e.message||e).slice(0,90));}
 }
 latestSourceFailure=errors.join(' · ');
 throw Error('All game sources failed ('+latestSourceFailure+')');
}

function headline(g){return g.phase==='live'?'● LIVE DISPATCH':g.phase==='final'?'FINAL EDITION':'PREGAME EDITION';}
function crest(t){
 // College basketball must use the single site-wide 365-school identity,
 // vetted artwork and TWO-ring school-color mark. Never add our own ring
 // or place a raw, possibly misidentified ESPN logo in a competing shell.
 if(league==='ncaam'||league==='ncaaw'){
  if(window.MBBLogos?.render)return window.MBBLogos.render({espnId:t.id,name:t.name,size:'schedule'});
  return '<span class="vld-mark-unavailable" role="img" aria-label="'+esc(t.name)+' logo not loaded">'+esc(t.code||'—')+'</span>';
 }
 if(league==='nba'){
  // Use the same local thirty-team primary-logo catalog as the NBA scorebug.
  // Its single team-colored ring must not acquire a second or third wrapper.
  const code=canonicalNBA(t.code);
  const allowed='ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' ');
  if(!allowed.includes(code))return '<span class="vld-mark-unavailable" role="img" aria-label="'+esc(t.name)+' logo not verified">'+esc(code||'—')+'</span>';
  const teamColor=window.SLTScorebug?.color?.(code)||'#56534c';
  return '<span class="vld-nba-logo" style="--nba-team-color:'+esc(teamColor)+'" role="img" aria-label="'+esc(t.name)+' logo">'+
   '<img src="assets/nba-logos/'+code+'.png" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add(\'vld-mark-unavailable\')">'+
   '</span>';
 }
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
/* One SVG unit = one tenth of a foot. Court and markings use real 94' × 50'
   geometry; only floor colors and line thickness are editorial treatments. */
function basketballCourtSVG(){
 const nba=league==='nba';
 const restricted=league!=='ncaaw'; // Women's 2026-27 rules define under-basket area without a painted arc.
 const keyHalf=nba?80:60; // NBA 16' lane; NCAA 12' lane.
 const radius=nba?237.5:221.4583333; // NBA 23'9"; NCAA 22'1¾".
 const cornerY=nba?30:34; // NBA 3' from sidelines; NCAA 3'4.875" rounded for SVG.
 const junction=52.5+Math.sqrt(radius*radius-(250-cornerY)**2);
 const j=junction.toFixed(2),other=(940-junction).toFixed(2),lower=500-cornerY;
 const ftMarks=[30,70,100,130,160].map(x=>
  '<line x1="'+x+'" y1="'+(250-keyHalf)+'" x2="'+x+'" y2="'+(243-keyHalf)+'"/>'+
  '<line x1="'+x+'" y1="'+(250+keyHalf)+'" x2="'+x+'" y2="'+(257+keyHalf)+'"/>'+
  '<line x1="'+(940-x)+'" y1="'+(250-keyHalf)+'" x2="'+(940-x)+'" y2="'+(243-keyHalf)+'"/>'+
  '<line x1="'+(940-x)+'" y1="'+(250+keyHalf)+'" x2="'+(940-x)+'" y2="'+(257+keyHalf)+'"/>').join('');
 const grain=Array.from({length:25},(_,i)=>
  '<rect class="vld-plank" x="'+i*38+'" y="0" width="38" height="500" opacity="'+(i%2?.13:.07)+'"/>'+
  '<line class="vld-plank-joint" x1="'+i*38+'" y1="0" x2="'+i*38+'" y2="500"/>').join('');
 const ends=[0,1].map((_,side)=>{
  const right=side===1,origin=right?940:0,free=right?750:190,board=right?900:40,rim=right?887.5:52.5;
  return '<g class="vld-court-end" data-end="'+(right?'right':'left')+'">'+
   '<rect class="vld-paint" x="'+(right?750:0)+'" y="'+(250-keyHalf)+'" width="190" height="'+2*keyHalf+'"/>'+
   '<path class="vld-keyline" d="M'+origin+' '+(250-keyHalf)+' H'+free+' V'+(250+keyHalf)+' H'+origin+'"/>'+
   // The free-throw arc faces midcourt; the dashed half is inside the paint.
   '<path class="vld-court-line" d="M'+free+' 190 A60 60 0 0 '+(right?0:1)+' '+free+' 310"/>'+
   '<path class="vld-ft-dash" d="M'+free+' 190 A60 60 0 0 '+(right?1:0)+' '+free+' 310"/>'+
   '<line class="vld-backboard" x1="'+board+'" y1="220" x2="'+board+'" y2="280"/>'+
   '<circle class="vld-rim" cx="'+rim+'" cy="250" r="7.5"/>'+
   (restricted?'<path class="vld-restricted" d="M'+board+' 210 H'+rim+' A40 40 0 0 '+(right?0:1)+' '+rim+' 290 H'+board+'"/>':'')+
   '</g>';
 }).join('');
 const perimeter='<path class="vld-court-line vld-three-point" d="M0 '+cornerY+' H'+j+' A'+radius+' '+radius+' 0 0 1 '+j+' '+lower+' H0"/>'+
  '<path class="vld-court-line vld-three-point" d="M940 '+cornerY+' H'+other+' A'+radius+' '+radius+' 0 0 0 '+other+' '+lower+' H940"/>';
 const label=nba?'NBA':'NCAA';
 return '<svg class="vld-court-svg vld-court-svg--basketball" viewBox="-18 -18 976 536" role="img" '+
  'aria-label="'+label+' regulation full basketball court: 94 feet long by 50 feet wide; two goals, correctly proportioned lanes, free-throw circles, three-point arcs, midcourt and center circle.">'+
  '<rect class="vld-wood" x="0" y="0" width="940" height="500"/>'+
  '<g class="vld-grain">'+grain+'</g>'+
  ends+
  '<g class="vld-court-markings">'+
  '<rect class="vld-boundary" x="0" y="0" width="940" height="500"/>'+
  '<path class="vld-court-line" d="M470 0 V500"/>'+
  '<circle class="vld-court-line" cx="470" cy="250" r="60"/>'+
  perimeter+ftMarks+
  (nba?'<path class="vld-court-line" d="M280 0 V30 M660 0 V30 M280 500 V470 M660 500 V470"/>':'')+
  '</g>'+
  '<circle class="vld-center-medallion" cx="470" cy="250" r="44"/>'+
  '<text class="vld-center-monogram" x="470" y="255" text-anchor="middle">SLT</text>'+
  '</svg>';
}
function courtSVG(){
 if(config.kind==='football')return '<svg class="vld-court-svg" viewBox="0 0 640 340" aria-hidden="true"><rect x="15" y="25" width="610" height="290" rx="1"/>'+
 Array.from({length:9},(_,i)=>'<line x1="'+(76+i*61)+'" y1="25" x2="'+(76+i*61)+'" y2="315"/>').join('')+
 '<line x1="50" y1="25" x2="50" y2="315"/><line x1="590" y1="25" x2="590" y2="315"/></svg>';
 if(config.kind==='soccer')return '<svg class="vld-court-svg" viewBox="0 0 640 340" aria-hidden="true"><rect x="15" y="25" width="610" height="290"/><line x1="320" y1="25" x2="320" y2="315"/><circle cx="320" cy="170" r="60"/><rect x="15" y="90" width="90" height="160"/><rect x="535" y="90" width="90" height="160"/><rect x="15" y="125" width="30" height="90"/><rect x="595" y="125" width="30" height="90"/></svg>';
 return basketballCourtSVG();
}
function shots(g){
 if(config.kind!=='basketball')return '<p class="vld-empty">Shot-chart data is available only for basketball.</p>';
 const verified=g.plays.filter(p=>p.shooting&&p.shotSchema==='halfcourt_feet_v1'&&
  p.shotX!==null&&p.shotY!==null&&num(p.shotX)!==null&&num(p.shotY)!==null&&
  num(p.shotX)>=0&&num(p.shotX)<=50&&num(p.shotY)>=0&&num(p.shotY)<=47&&!/free throw/i.test(p.text));
 if(!verified.length)return '<p class="vld-empty">No court coordinates have been certified for this match. The regulation court above remains visible, but no player or shot locations are invented.</p>';
 // Half-court source coordinates alone do not say which direction each team
 // attacked in every period. Never draw them in a guessed full-court location.
 return '<div class="vld-coordinate-register"><h3 class="vld-subheading">Source-reported shot coordinates</h3>'+
  '<p class="vld-source">Verified half-court coordinate records are listed below. They are not projected onto the full court until basket direction can be independently established.</p>'+
  '<ol class="vld-plays">'+verified.slice(-40).reverse().map(p=>'<li><span>'+esc(periodLabel(p.period||1))+' · '+esc(p.clock||'—')+'</span>'+
  '<p>'+esc(p.text)+'</p><b>'+esc(p.shotX)+', '+esc(p.shotY)+'</b></li>').join('')+'</ol></div>';
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

/* The model's locked prospective archive is the only authority here. Never
   treat pregame chances as a live in-game win probability. */
function qualifiedPregame(row,game){
 if(!row||!game||!['ncaam','nba'].includes(league))return null;
 const gameStart=Date.parse(game.raw?.header?.competitions?.[0]?.date||
  game.raw?.header?.competitions?.[0]?.startDate||game.raw?.game?.gameTimeUTC||'');
 const dateInET=Number.isFinite(gameStart)?
  new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})
   .format(new Date(gameStart)):'';
 const captured=league==='nba'?row.captured_at:row.captured_at_utc;
 const capturedMs=Date.parse(captured||'');
 if(!Number.isFinite(capturedMs))return null;
 // If the feed omitted the tipoff timestamp, only accept a forecast recorded
 // before the event's stated calendar date (a conservative fallback).
 const scheduled=league==='nba'?Date.parse(row.date||''):Date.parse((row.date||'')+'T00:00:00Z');
 if((Number.isFinite(gameStart)&&capturedMs>=gameStart)||
   (!Number.isFinite(gameStart)&&(!Number.isFinite(scheduled)||capturedMs>=scheduled)))return null;
 if(league==='ncaam'){
  if(String(row.id)!=='espn:'+id||row.forecast_model!=='retro-central-elo-uncapped-v2')return null;
  if(dateInET&&row.date!==dateInET)return null;
  const chance=Number(row.home_win_probability),margin=Number(row.projected_home_margin);
  if(!Number.isFinite(chance)||chance<0||chance>1||
    row.home_win_probability==null||!Number.isFinite(margin)||row.projected_home_margin==null)return null;
  return {home:chance,margin,captured,model:'RETRO central Elo',source:'Certified pregame archive'};
 }
 if(String(row.id)!=='espn-nba-'+id||
    String(row.away||'')!==game.a.code||String(row.home||'')!==game.h.code)return null;
 const chance=Number(row.home_win_prob),margin=Number(row.margin);
 if(row.home_win_prob==null||!Number.isFinite(chance)||chance<0||chance>1||
    row.margin==null||!Number.isFinite(margin))return null;
 return {home:chance,margin,captured,model:'RETRO NBA possession model',source:'Locked NBA prospective ledger'};
}
function archivedPregame(game){
 if(retroArchive.status!=='ready')return null;
 const payload=retroArchive.payload;
 if(payload?.season!=='2026-27')return null;
 const records=league==='ncaam'?payload.predictions:league==='nba'?payload.forecasts:[];
 if(!Array.isArray(records))return null;
 const row=records.find(r=>String(r.id)===(league==='nba'?'espn-nba-':'espn:')+id);
 return qualifiedPregame(row,game);
}
function retroPanel(g){
 const unavailable=retroArchive.status==='checking'?'Retrieving the locked forecast archive…':
  retroArchive.status==='error'?'The archived predictions could not be loaded.':
  !['ncaam','nba'].includes(league)?'A certified RETRO pregame archive is not available for this competition.':
  'No timestamp-verified pregame forecast is stored for this match.';
 const p=archivedPregame(g);
 if(!p)return '<div class="vld-empty">'+esc(unavailable)+' No probability has been estimated from the current score.</div>';
 const away=(1-p.home)*100,home=p.home*100;
 const margin=Math.round(Math.abs(p.margin)*2)/2;
 const favorite=margin<0?g.a.name:margin>0?g.h.name:'Even';
 const line=margin===0?'EVEN':favorite+' −'+margin.toFixed(1);
 const captured=new Date(p.captured).toLocaleString('en-US',{timeZone:'America/New_York',
  month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
 return '<section class="vld-retro"><div class="vld-retro-flag"><strong>FROZEN BEFORE TIPOFF</strong>'+
  '<span>Historical pregame chances · NOT live win probability</span></div>'+
  '<div class="vld-retro-labels"><span>'+esc(g.a.name)+' <b>'+away.toFixed(1)+'%</b></span>'+
  '<span>'+esc(g.h.name)+' <b>'+home.toFixed(1)+'%</b></span></div>'+
  '<div class="vld-retro-meter" role="img" aria-label="RETRO pregame win probabilities: '+
   esc(g.a.name)+' '+away.toFixed(1)+' percent, '+esc(g.h.name)+' '+home.toFixed(1)+' percent">'+
  '<span style="width:'+away.toFixed(2)+'%;background:'+g.a.color+'"></span>'+
  '<span style="width:'+home.toFixed(2)+'%;background:'+g.h.color+'"></span></div>'+
  '<p class="vld-retro-margin">RETRO pregame projected margin: <strong>'+esc(line)+'</strong></p>'+
  '<p class="vld-source">'+esc(p.source)+' · '+esc(p.model)+
  ' · Captured '+esc(captured)+' ET. The forecast stays frozen after tipoff and is not recalculated from the live score.</p>'+
  '</section>';
}
async function loadRetroArchive(){
 if(!['ncaam','nba'].includes(league)){
  retroArchive={status:'unsupported',payload:null};return;
 }
 const path=league==='nba'?'data/nba-rabby-forecast-ledger.json':'data/retro-pregame-archive-2026-27.json';
 try{
  const payload=await getJSON(path);
  retroArchive={status:payload?.season==='2026-27'?'ready':'error',payload};
 }catch(e){console.warn('RETRO archive unavailable:',e);retroArchive={status:'error',payload:null};}
 if(lastGood){q('vld-main').innerHTML=page(lastGood);choose(chosenTab,false);}
}

function eventLog(g){
 return g.plays.length?'<ol class="vld-plays">'+g.plays.slice().reverse().map(p=>'<li><span>'+esc(periodLabel(p.period||1))+' '+esc(p.clock||'')+'</span><p>'+esc(p.text)+'</p><b>'+
  (p.awayScore!==null&&p.homeScore!==null?esc(p.awayScore)+'–'+esc(p.homeScore):'')+'</b></li>').join('')+'</ol>':
 '<p class="vld-empty">No play-by-play supplied for this game. Events are never simulated.</p>';
}
function panel(tab,content){return '<section class="vld-panel" data-vld-panel="'+tab+'" role="tabpanel" id="vld-panel-'+tab+'" aria-labelledby="vld-tab-'+tab+'"'+(tab!==chosenTab?' hidden':'')+'>'+content+'</section>';}
function page(g){
 const tabs=[['live','Live dispatch'],['retro','RETRO'],['stats','Statistics'],['players','Players'],['plays','Every play'],['shots','Court & shots']];
 const section='<section class="vld-paper vld-live-grid">'+
  '<div class="vld-live-main"><h2>The game in motion</h2>'+
  '<div class="vld-floor">'+courtSVG()+'</div><p class="vld-floor-caption">'+(config.kind==='basketball'?(league==='nba'?'NBA REGULATION · 94 × 50 FT · 16-FT LANE':'NCAA REGULATION · 94 × 50 FT · 12-FT LANE'):'FIELD DIAGRAM · NOT PLAYER TRACKING')+'</p>'+
  now(g)+'</div><aside class="vld-flow"><h2>The Lead Ledger</h2>'+trend(g)+'</aside></section>';
 return scoreboard(g)+
 '<section class="vld-paper"><h2>Period Scoring</h2>'+lineScore(g)+'</section>'+
 '<nav class="vld-tabs" role="tablist" aria-label="Game view">'+tabs.map(([k,t])=>'<button type="button" role="tab" id="vld-tab-'+k+'" aria-controls="vld-panel-'+k+'" data-vld-tab="'+k+'" aria-selected="'+(k===chosenTab)+'">'+t+'</button>').join('')+'</nav>'+
 panel('live',section)+
 panel('retro','<section class="vld-paper"><h2>RETRO · The Pregame Forecast Ledger</h2>'+retroPanel(g)+'</section>')+
 panel('stats','<section class="vld-paper"><h2>Official Team Totals</h2>'+teamStats(g)+'</section>')+
 panel('players','<section class="vld-paper"><h2>Player Box Scores</h2>'+players(g)+'</section>')+
 panel('plays','<section class="vld-paper"><h2>The Play Register</h2>'+eventLog(g)+'</section>')+
 panel('shots','<section class="vld-paper"><h2>Court &amp; Reported Shots</h2><div class="vld-shot-floor">'+courtSVG()+'</div>'+shots(g)+'</section>')+
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
// MBB/WBB logo identity is loaded asynchronously from the shared registry.
// Replace any initial fallback as soon as the verified catalog is ready.
if(league==='ncaam'||league==='ncaaw')
 window.MBBLogos?.ready?.then(ok=>{if(ok&&lastGood)paint(lastGood);});
loadRetroArchive();
update();
})();