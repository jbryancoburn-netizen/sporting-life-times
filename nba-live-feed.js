(()=>{'use strict';
const root={set innerHTML(value){const el=document.getElementById('nba-live-feed');if(el)el.innerHTML=value;}};
const status={set textContent(value){const el=document.getElementById('nba-live-status');if(el)el.textContent=value;}};
if(!document.getElementById('nba-live-feed'))return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nbaPrimaryIds={"ATL":1610612737,"BOS":1610612738,"BKN":1610612751,"CHA":1610612766,"CHI":1610612741,"CLE":1610612739,"DAL":1610612742,"DEN":1610612743,"DET":1610612765,"GSW":1610612744,"HOU":1610612745,"IND":1610612754,"LAC":1610612746,"LAL":1610612747,"MEM":1610612763,"MIA":1610612748,"MIL":1610612749,"MIN":1610612750,"NOP":1610612740,"NYK":1610612752,"OKC":1610612760,"ORL":1610612753,"PHI":1610612755,"PHX":1610612756,"POR":1610612757,"SAC":1610612758,"SAS":1610612759,"TOR":1610612761,"UTA":1610612762,"WAS":1610612764};
const canonicalCode=c=>({NY:'NYK',SA:'SAS',GS:'GSW',NO:'NOP',WSH:'WAS',UTAH:'UTA'}[String(c||'').toUpperCase()]||String(c||'').toUpperCase());
const logo=c=>'assets/nba-logos/'+canonicalCode(c)+'.png';
let lastOK=0;let fallbackRecords={};
let eloRatings={},forecastModel=null,completedEvents=[];
// RETRO is a published team rating, not an output of the Rabby possession model.
// Always load the earned 1500-reset ratings independently of forecast availability.
let retroRanks={};
async function loadPregameElo(){
 try{
  const response=await fetch('data/nba-elo-shadow-2026-27.json?retro='+Math.floor(Date.now()/30000),{cache:'no-store'});
  if(!response.ok)throw Error('RETRO rating feed HTTP '+response.status);
  const elo=await response.json();
  if(elo.league!=='NBA'||elo.season!=='2026-27'||elo.status!=='primary_live_earned_elo'||
     Number(elo.parameters?.season_start_elo)!==1500||Number(elo.parameters?.home_elo)!==40)
   throw Error('RETRO feed does not match the active NBA 2026–27 model');
  const rows=(elo.rankings||[]).filter(x=>nbaPrimaryIds[canonicalCode(x.team)]&&Number.isFinite(Number(x.elo)))
   .map(x=>({team:canonicalCode(x.team),elo:Number(x.elo)}))
   .sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team));
  if(rows.length!==30||new Set(rows.map(x=>x.team)).size!==30)
   throw Error('RETRO rating feed requires 30 unique NBA clubs');
  // Update independently: possession-model errors must never blank RETRO on scores.
  eloRatings=Object.fromEntries(rows.map(x=>[x.team,x.elo]));
  retroRanks=Object.fromEntries(rows.map((x,i)=>[x.team,i+1]));
  completedEvents=Array.isArray(elo.events)?elo.events:[];
 }catch(error){
  console.warn('NBA RETRO: retaining last validated earned rating snapshot:',error.message);
 }
 // This optional forecast layer is separate and can fail without hiding Elo.
 if(!window.RabbyPossessionModel){forecastModel=null;return;}
 try{
  const [statResponse,priorResponse]=await Promise.all([
   fetch('data/nba-possession-inputs.json',{cache:'no-store'}),
   fetch('data/nba-2025-26-team-advanced.json',{cache:'no-store'})
  ]);
  if(!statResponse.ok||!priorResponse.ok)throw Error('possession-model inputs unavailable');
  const [stats,priors]=await Promise.all([statResponse.json(),priorResponse.json()]);
  const model=window.RabbyPossessionModel.build(stats,4,priors);
  if(!model||model.coverage?.teams!==30)throw Error('incomplete possession-model coverage');
  forecastModel=model;
 }catch(error){
  forecastModel=null;
  console.warn('NBA forecast unavailable; RETRO ratings remain visible:',error.message);
 }
}
function projectNumbers(g){
 if(!forecastModel||!window.RabbyPossessionModel)return null;
 const hc=canonicalCode(g.home.code),ac=canonicalCode(g.away.code);
 const result=window.RabbyPossessionModel.project(hc,ac,forecastModel,eloRatings);
 return result?{...result,awayElo:eloRatings[ac],homeElo:eloRatings[hc]}:null;
}
function projected(g){
 const x=projectNumbers(g);if(!x)return '';
 const away=g.away.code,home=g.home.code,spread=x.margin>=0?home:away;
 const spreadText=Math.abs(x.margin)<0.5?'EVEN':spread+' −'+Math.abs(x.margin).toFixed(1);
 const d=Date.parse(x.coverage.updatedAt||'');
 const asOf=Number.isFinite(d)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(d))+' ET':'latest verified box scores';
 return '<div class="nba-pregame">'+
  '<div class="nba-pregame-label">RABBY · POSSESSION-BASED SCORE FORECAST · NOT LIVE</div>'+
  '<div class="nba-pregame-score">'+esc(away)+' '+x.awayScore+' – '+x.homeScore+' '+esc(home)+'</div>'+
  '<div class="nba-pregame-prob">Independent Elo: '+esc(away)+' '+Math.round((1-x.homeWin)*100)+'% · '+esc(home)+' '+Math.round(x.homeWin*100)+'%</div>'+
  '<div class="nba-pregame-breakdown"><span>Projected total <b>'+x.total.toFixed(1)+'</b></span><span>Expected margin <b>'+esc(spreadText)+'</b></span><span>Tempo <b>'+x.possessions.toFixed(1)+' poss.</b></span></div>'+
  '<div class="nba-pregame-ratings">Offense vs opponent defense · '+esc(away)+' '+x.awayEfficiency.toFixed(1)+' · '+esc(home)+' '+x.homeEfficiency.toFixed(1)+' pts/100</div>'+
  '<div class="nba-pregame-source">'+x.coverage.games+' verified box scores · '+esc(away)+' '+x.awayGames+' GP / '+esc(home)+' '+x.homeGames+' GP · updated '+esc(asOf)+'</div>'+ 
  '<div class="nba-pregame-rest">'+esc(away)+': '+esc(window.RabbyPossessionModel.restDisplay(window.RabbyPossessionModel.scheduleContext(away,g.date,completedEvents)))+' · '+esc(home)+': '+esc(window.RabbyPossessionModel.restDisplay(window.RabbyPossessionModel.scheduleContext(home,g.date,completedEvents)))+' <small>Completed fixtures only; no fatigue points assumed.</small></div>'+
  '<div data-nba-availability-away="'+esc(away)+'" data-nba-availability-home="'+esc(home)+'"></div>'+
  '</div>';
}
async function refreshRecords(){try{const r=await fetch('data/nba-2026-27-current-provisional.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),rec={};for(const e of data.events||[]){if(!Number.isFinite(Number(e.home_score))||!Number.isFinite(Number(e.away_score))||Number(e.home_score)===Number(e.away_score))continue;for(const t of [e.home,e.away])rec[t]??={w:0,l:0};const win=Number(e.home_score)>Number(e.away_score)?e.home:e.away,lose=win===e.home?e.away:e.home;rec[win].w++;rec[lose].l++}fallbackRecords=Object.fromEntries(Object.entries(rec).map(([k,v])=>[k,v.w+'-'+v.l]));}catch(e){console.warn('NBA verified record fallback unavailable',e.message)}}
const nbaBoxCache=new Map();
async function loadNBABox(card){
 const id=String(card.dataset.nbaGame||'').replace(/^espn-nba-/,'');
 const out=card.querySelector('.nba-live-stat-content');
 if(!out||!/^\d{7,12}$/.test(id))return;
 const cached=nbaBoxCache.get(id);
 if(cached&&Date.now()-cached.at<25000){out.innerHTML=cached.html;return}
 out.textContent='Loading live game statistics…';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+id+'&_='+Date.now(),{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json(),blocks=[];
  const teams=data.header?.competitions?.[0]?.competitors||[];
  const lines=teams.map(t=>({name:t.team?.displayName||t.team?.abbreviation||'',scores:t.linescores||[]}));
  if(lines.some(t=>t.scores.length)){
   const length=Math.max(...lines.map(t=>t.scores.length));
   const quarters=Array.from({length},(_,i)=>i<4?'Q'+(i+1):'OT'+(i-3));
   blocks.push('<section class="nba-live-stat-section"><h4>Quarter scoring</h4><div class="nba-live-stat-scroll"><table><thead><tr><th>Club</th>'+quarters.map(q=>'<th>'+q+'</th>').join('')+'</tr></thead><tbody>'+lines.map(t=>'<tr><th>'+esc(t.name)+'</th>'+quarters.map((_,i)=>'<td>'+esc(t.scores[i]?.displayValue??t.scores[i]?.value??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>');
  }
  for(const t of data.boxscore?.players||[]){
   const group=(t.statistics||[]).find(s=>Array.isArray(s.athletes)&&s.athletes.length);
   if(!group)continue;
   const columns=['MIN','PTS','REB','AST','FG','3PT'].map(k=>({k,index:(group.labels||[]).findIndex(label=>String(label).toUpperCase()===k)})).filter(v=>v.index>=0);
   if(!columns.length)continue;
   blocks.push('<section class="nba-live-stat-section"><h4>'+esc(t.team?.displayName||'Team')+' · Players</h4><div class="nba-live-stat-scroll"><table><thead><tr><th>Player</th>'+columns.map(v=>'<th>'+v.k+'</th>').join('')+'</tr></thead><tbody>'+(group.athletes||[]).filter(a=>a.athlete?.displayName).slice(0,18).map(a=>'<tr><th>'+esc(a.athlete.displayName)+'</th>'+columns.map(v=>'<td>'+esc(a.stats?.[v.index]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>');
  }
  const html=blocks.join('')||'<p>Detailed box-score statistics are not yet available from the live feed.</p>';
  nbaBoxCache.set(id,{html,at:Date.now()});
  if(card.isConnected&&card.open)out.innerHTML=html;
 }catch(e){if(card.isConnected)out.textContent='Live player statistics temporarily unavailable.';console.warn('NBA box score fetch failed',id,e.message)}
}
document.addEventListener('toggle',event=>{const card=event.target;if(card?.matches?.('#nba-live-feed details[data-nba-game]')&&card.open)loadNBABox(card)},true);
function render(payload){
 const events=Array.isArray(payload.events)?payload.events:[];
 if(!events.length){root.innerHTML='<p class="hub-small">No NBA games scheduled for the selected date.</p>';return;}
 const previouslyOpen=new Set([...document.querySelectorAll('#nba-live-feed details[data-nba-game][open]')].map(el=>el.dataset.nbaGame));
 const mapped=events.map(e=>{
  const co=e.competitions?.[0]||{};const cs=co.competitors||[];
  const away=cs.find(c=>c.homeAway==='away'),home=cs.find(c=>c.homeAway==='home');
  const st=e.status?.type||{},state=st.state||'pre';
  // NBA has four regulation quarters. Use the provider's numeric period, not
  // the shared college scorebug's default first/second-half label parsing.
  const nbaPeriod=Number(e.status?.period||0);
  const nbaClock=String(e.status?.displayClock||'').trim();
  const nbaPeriodLabel=({1:'1ST QUARTER',2:'2ND QUARTER',3:'3RD QUARTER',4:'4TH QUARTER'})[nbaPeriod]||(nbaPeriod>4?(nbaPeriod===5?'OT':(nbaPeriod-4)+'OT'):'');
  const rawLabel=st.shortDetail||st.description||'Scheduled';
  // Some providers only publish the clock inside the status string.
  const rawClock=(String(rawLabel).match(/\b\d{1,2}:\d{2}\b/)||[])[0]||'';
  const displayClock=nbaClock&&nbaClock!=='0:00'?nbaClock:rawClock;
  const label=state==='in'&&nbaPeriodLabel?(displayClock?displayClock+' ':'')+nbaPeriodLabel:rawLabel;
  if(!away||!home)return null;
  const team=c=>({name:c.team?.displayName||c.team?.name||'',code:canonicalCode(c.team?.abbreviation),score:c.score??'',record:c.records?.find(r=>r.type==='total')?.summary||fallbackRecords[canonicalCode(c.team?.abbreviation)]||''});
  const broadcasts=(co.broadcasts||[]).flatMap(b=>b.names||[]).filter(Boolean);
  return {away:team(away),home:team(home),state,label,date:e.date,id:e.id,network:broadcasts.join(' / ')};
 }).filter(g=>g&&/^[0-9]{7,12}$/.test(String(g.id)));
 if(!mapped.length){root.innerHTML='<p class="hub-small">No game details with valid provider IDs are available. <a href="nba-game-center.html">Verified archive</a>.</p>';return;}
 // Keep live games first, followed by upcoming tipoffs in chronological order;
 // completed games follow in reverse tipoff order. Never rely on feed insertion order.
 const priority=g=>({in:0,pre:1,post:2}[g.state]??3);
 mapped.sort((a,b)=>priority(a)-priority(b)||((priority(a)===2?-1:1)*(Date.parse(a.date)-Date.parse(b.date)))||String(a.id).localeCompare(String(b.id)));
 root.innerHTML=mapped.map(g=>{
  const playing=g.state==='in',final=g.state==='post';
  const phase=playing?'live':final?'final':'upcoming';
  const time=new Date(g.date).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
  const side=t=>({name:t.name||t.code,crest:'<img src="'+logo(t.code)+'" width="36" height="36" loading="lazy" alt="" onerror="this.hidden=true">',color:({ATL:'#E03A3E',BOS:'#007A33',BKN:'#242424',CHA:'#1D1160',CHI:'#CE1141',CLE:'#860038',DAL:'#00538C',DEN:'#0E2240',DET:'#C8102E',GSW:'#1D428A',HOU:'#CE1141',IND:'#002D62',LAC:'#C8102E',LAL:'#552583',MEM:'#5D76A9',MIA:'#98002E',MIL:'#00471B',MIN:'#0C2340',NOP:'#0C2340',NYK:'#006BB6',OKC:'#007AC1',ORL:'#0077C0',PHI:'#006BB6',PHX:'#1D1160',POR:'#E03A3E',SAC:'#5A2D81',SAS:'#343A40',TOR:'#CE1141',UTA:'#002B5C',WAS:'#002B5C'}[t.code]||'#655239'),record:t.record||'—',retro:Number.isFinite(eloRatings[canonicalCode(t.code)])?'RETRO '+Math.round(eloRatings[canonicalCode(t.code)])+' (#'+retroRanks[canonicalCode(t.code)]+')':'RETRO —',score:t.score});
  const scorebug=window.SLTSportsScorebug?.render({phase,periodFormat:'quarters',away:side(g.away),home:side(g.home),status:final?'FINAL':g.label,tipoff:time+' ET',network:g.network});
  if(!scorebug)return '';
  const pregameSafe=!playing&&!final&&Date.parse(g.date)>Date.now()+600000;
  return '<details class="ledger26-card ledger26-expand nba-expand-game" data-nba-game="'+esc(g.id)+'"'+(previouslyOpen.has(String(g.id))?' open':'')+'><summary class="ledger26-summary nba-expand-trigger">'+scorebug+'</summary><div class="nba-expand-content">'+(pregameSafe?projected(g):'<div class="nba-live-stat-content" aria-live="polite">Opening live statistics…</div>')+'<a class="nba-live-game-link" href="nba-live-game.html?game='+encodeURIComponent(g.id)+'">OPEN GAME CENTER ↗</a></div></details>';
 }).join('');
 for(const card of document.querySelectorAll('#nba-live-feed details[data-nba-game][open]'))loadNBABox(card);
}
// Normalize the NBA's official game-clock ISO duration at the feed boundary.
function officialGameClock(value){
 const raw=String(value||'').trim();
 if(/^\d{1,3}:\d{2}(?:\.\d+)?$/.test(raw))return raw.replace(/\.\d+$/,'');
 const duration=raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
 if(!duration||!raw.match(/\d/))return '';
 const minutes=Number(duration[1]||0)*60+Number(duration[2]||0);
 const seconds=Math.floor(Number(duration[3]||0));
 return minutes+':'+String(seconds).padStart(2,'0');
}
function fromNba(raw){
 const games=raw.scoreboard?.games||raw.games||[];
 const today=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const todayKey=today.year+today.month+today.day;
 const dated=games.filter(g=>{const d=g.gameTimeUTC||g.gameTime;if(!d)return false;const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(d)).map(x=>[x.type,x.value]));return p.year+p.month+p.day===todayKey});
 return {events:dated.map(g=>{
  const home=g.homeTeam||{},away=g.awayTeam||{},st=Number(g.gameStatus)||1;
  const comp=(t,side)=>({homeAway:side,team:{displayName:t.teamName?((t.teamCity||'')+' '+t.teamName).trim():t.teamTricode,abbreviation:t.teamTricode},score:t.score,records:[]});
  return {id:String(g.gameId),date:g.gameTimeUTC||g.gameTime,competitions:[{competitors:[comp(away,'away'),comp(home,'home')]}],status:{period:Number(g.period)||0,displayClock:officialGameClock(g.gameClock),type:{state:st===3?'post':st===2?'in':'pre',shortDetail:g.gameStatusText||''}}};
 })};
}
function fromArchive(p){return {events:(p.games||[]).map(g=>({id:g.id?.replace(/^espn-nba-/,'')||'',date:g.date,competitions:[{competitors:(g.teams||[]).map(t=>({homeAway:t.home_away,team:{displayName:t.name,abbreviation:t.code},score:t.score}))}],status:{type:{state:g.state==='post'?'post':g.state==='in'?'in':'pre',shortDetail:g.status||'Scheduled'}}}))};}
// Date navigation is enabled only in the NBA Game Center; the front-page rail stays on today.
const nbaDateInput=document.getElementById('nba-game-date');
const etDay=timestamp=>{
 const q=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp)).map(x=>[x.type,x.value]));
 return q.year+q.month+q.day;
};
const validDay=key=>/^\d{4}-\d{2}-\d{2}$/.test(key||'')&&new Date(key+'T12:00:00Z').toISOString().slice(0,10)===key;
const compactDay=key=>key.replaceAll('-','');
const fullDay=key=>key.slice(0,4)+'-'+key.slice(4,6)+'-'+key.slice(6,8);
const shiftDay=(key,step)=>{
 const when=new Date(key+'T12:00:00Z');when.setUTCDate(when.getUTCDate()+step);
 return when.toISOString().slice(0,10);
};
const prettyDay=key=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(key+'T12:00:00Z'));
let chosenDay=null;
const effectiveDay=()=>chosenDay?compactDay(chosenDay):etDay(Date.now());
function renderDateNav(){
 if(!nbaDateInput)return;
 const now=fullDay(etDay(Date.now())),key=chosenDay||now;
 nbaDateInput.value=key;
 const title=document.getElementById('nba-today-heading');
 if(title)title.textContent=key===now?"Today's NBA Games":'NBA Games · '+prettyDay(key);
 const note=document.querySelector('.nba-today-section .tools .notice');
 if(note)note.textContent='Eastern Time calendar · live, final and upcoming games';
 const todayButton=document.getElementById('nba-date-today');
 if(todayButton){todayButton.disabled=key===now;todayButton.setAttribute('aria-current',key===now?'date':'false')}
 const week=document.getElementById('nba-date-week');
 if(week)week.innerHTML=Array.from({length:7},(_,i)=>{
  const day=shiftDay(key,i-3),date=new Date(day+'T12:00:00Z');
  const dow=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short'}).format(date);
  return '<button type="button" data-nba-day="'+day+'" data-today="'+(day===now)+'" aria-pressed="'+(day===key)+'" aria-label="'+prettyDay(day)+'"><span>'+dow+'</span><b>'+Number(day.slice(-2))+'</b></button>';
 }).join('');
}
function chooseDay(day,push=true){
 if(!nbaDateInput||!validDay(day))return;
 chosenDay=day;renderDateNav();
 if(push){const url=new URL(location.href);url.searchParams.set('date',day);history.pushState(null,'',url.pathname+url.search+url.hash)}
 root.innerHTML='<p class="hub-small">Loading NBA games for '+esc(prettyDay(day))+'…</p>';
 status.textContent='Checking NBA schedule for '+prettyDay(day)+'…';
 if(refreshPromise)refreshPromise.finally(()=>refreshLive());
 else refreshLive();
}
function initDateNav(){
 if(!nbaDateInput)return;
 const fromUrl=new URL(location.href).searchParams.get('date');
 chosenDay=validDay(fromUrl)?fromUrl:fullDay(etDay(Date.now()));
 renderDateNav();
 nbaDateInput.addEventListener('change',()=>chooseDay(nbaDateInput.value));
 document.getElementById('nba-date-previous')?.addEventListener('click',()=>chooseDay(shiftDay(chosenDay,-1)));
 document.getElementById('nba-date-next')?.addEventListener('click',()=>chooseDay(shiftDay(chosenDay,1)));
 document.getElementById('nba-date-today')?.addEventListener('click',()=>chooseDay(fullDay(etDay(Date.now()))));
 document.getElementById('nba-date-week')?.addEventListener('click',e=>{
  const button=e.target.closest('button[data-nba-day]');
  if(button)chooseDay(button.dataset.nbaDay);
 });
 window.addEventListener('popstate',()=>{
  const day=new URL(location.href).searchParams.get('date');
  chooseDay(validDay(day)?day:fullDay(etDay(Date.now())),false);
 });
}
async function update(){
 const easternKey=offset=>{const q=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+offset)).map(x=>[x.type,x.value]));return q.year+q.month+q.day};
 const actualToday=easternKey(0),today=effectiveDay(),yesterday=chosenDay?compactDay(shiftDay(fullDay(today),-1)):easternKey(-24*3600000),tomorrow=compactDay(shiftDay(fullDay(today),1));
 // The front-page rail is for today's Eastern-date games only. Tomorrow's
 // fixtures belong on the upcoming schedule, not beneath a TODAY label.
 const gameDay=stamp=>{const d=new Date(stamp);if(!Number.isFinite(+d))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+p.month+p.day;};
 const sources=[
  ['ESPN selected day','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+today+'&_='+Date.now(),x=>x],
  ['ESPN ET boundary (prior)','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+yesterday+'&_='+Date.now(),x=>x],
  ...(chosenDay?[['ESPN ET boundary (next)','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+tomorrow+'&_='+Date.now(),x=>x]]:[]),
  ...(today===actualToday?[['NBA official fallback','https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',fromNba]]:[])
 ];
 const merged=new Map(),successful=[];
 const fetched=await Promise.all(sources.map(async ([name,url,normalize])=>{
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),5000);
  try{
   const response=await fetch(url,{cache:'no-store',signal:ctrl.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=normalize(await response.json());
   if(!Array.isArray(data.events))throw Error('invalid events');
   return {name,events:data.events};
  }catch(error){console.warn('NBA feed failed:',name,error.message);return null}
  finally{clearTimeout(timeout)}
 }));
 const quality=e=>{
  const state=e.status?.type?.state;
  const sides=e.competitions?.[0]?.competitors||[];
  const scores=sides.map(s=>Number(s.score));
  const total=scores.length===2&&scores.every(Number.isFinite)?scores[0]+scores[1]:0;
  const clock=String(e.status?.displayClock||'').trim();
  // Prefer a real clock and period when scoring totals are identical.
  return (state==='post'?1000000:state==='in'?100000:0)+
    total*10+(clock&&clock!=='0:00'?6:0)+(Number(e.status?.period)>0?2:0);
 };
 for(const result of fetched){
  if(!result)continue;
  successful.push(result.name);
  for(const event of result.events){
   const id=String(event.id||'');if(!id)continue;
   const when=Date.parse(event.date||'');
   if(!Number.isFinite(when)||gameDay(when)!==today)continue;
   const teams=event.competitions?.[0]?.competitors||[];
   const away=canonicalCode(teams.find(x=>x.homeAway==='away')?.team?.abbreviation);
   const home=canonicalCode(teams.find(x=>x.homeAway==='home')?.team?.abbreviation);
   const gameKey=away&&home?away+'-'+home+'-'+gameDay(when):id;
   const previous=merged.get(gameKey);
   if(!previous||quality(event)>quality(previous))merged.set(gameKey,event);
  }
 }
 // Published schedules and verified historical box scores fill gaps in dated ESPN results.
 const snapshots=['data/nba-upcoming-schedule.json',...(chosenDay&&today!==actualToday?['data/nba-game-center.json']:[])];
 await Promise.all(snapshots.map(async path=>{
  try{
   const response=await fetch(path+'?_='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const snapshot=await response.json();
   const publishedAt=Date.parse(snapshot.updated_at||'');
   const stale=!Number.isFinite(publishedAt)||Date.now()-publishedAt>30*60000;
   for(const event of fromArchive(snapshot).events){
    const when=Date.parse(event.date||'');
    if(!Number.isFinite(when)||gameDay(when)!==today)continue;
    const teams=event.competitions?.[0]?.competitors||[];
    const away=canonicalCode(teams.find(x=>x.homeAway==='away')?.team?.abbreviation);
    const home=canonicalCode(teams.find(x=>x.homeAway==='home')?.team?.abbreviation);
    const gameKey=away&&home?away+'-'+home+'-'+gameDay(when):String(event.id);
    if(merged.has(gameKey))continue;
    if(stale&&today===actualToday&&event.status?.type?.state==='in'){
     event.status.type.state='pre';event.status.type.shortDetail='Score update pending';
    }
    merged.set(gameKey,event);
   }
  }catch(error){console.warn('NBA date archive unavailable:',path,error.message)}
 }));
 // Cross-source match identity: normalize provider abbreviations and collapse
 // stale scheduled copies when an actual live/final version of the game exists.
 const aliases={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',UTAH:'UTA'};
 const canonical=t=>aliases[t]||t;
 const priority=e=>({in:3,post:2,pre:1}[e.status?.type?.state]||0);
 const dedup=new Map();
 for(const event of merged.values()){
  const competitors=event.competitions?.[0]?.competitors||[];
  const away=canonical(competitors.find(t=>t.homeAway==='away')?.team?.abbreviation||'');
  const home=canonical(competitors.find(t=>t.homeAway==='home')?.team?.abbreviation||'');
  const stamp=Date.parse(event.date||'');
  if(!away||!home||!Number.isFinite(stamp))continue;
  const pair=away+'-'+home;
  const current=dedup.get(pair);
  if(!current){dedup.set(pair,event);continue;}
  const diff=Math.abs(Date.parse(current.date)-stamp);
  // Separate true rematches when tipoffs differ by more than 30 hours.
  if(diff>30*3600000){dedup.set(pair+'-'+event.id,event);continue;}
  if(priority(event)>priority(current))dedup.set(pair,event);
 }
 // A club cannot appear in overlapping NBA games. A live/final provider game
 // takes precedence over an unverified scheduled snapshot for that same slot.
 const gameTeams=e=>(e.competitions?.[0]?.competitors||[]).map(c=>canonical(c.team?.abbreviation||'')).filter(Boolean);
 const gameTime=e=>Date.parse(e.date||'');
 const active=[...dedup.values()].filter(e=>e.status?.type?.state==='in');
 const filtered=[...dedup.values()].filter(e=>{
  if(e.status?.type?.state!=='pre')return true;
  const teams=gameTeams(e),time=gameTime(e);
  return !active.some(live=>Math.abs(gameTime(live)-time)<18*3600000&&teams.some(t=>gameTeams(live).includes(t)));
 });
 // When two future fixtures still conflict, retain the one corroborated by the
 // live scoreboard first, then the earliest published entry; never display both.
 const verified=new Map();
 const clean=[];
 for(const e of filtered.sort((a,b)=>({in:0,post:1,pre:2}[a.status?.type?.state]??3)-({in:0,post:1,pre:2}[b.status?.type?.state]??3)||gameTime(a)-gameTime(b))){
  const stamp=gameTime(e),teams=gameTeams(e);
  const collision=teams.some(t=>(verified.get(t)||[]).some(v=>Math.abs(v-stamp)<5*3600000));
  if(collision)continue;
  clean.push(e);
  for(const t of teams){const a=verified.get(t)||[];a.push(stamp);verified.set(t,a)}
 }
 // If the reader switched dates during a network request, discard the stale reply.
 if(today!==effectiveDay())return;
 if(clean.length){
  render({events:clean});lastOK=Date.now();
  status.textContent=(successful.length?'SOURCES · '+successful.join(' + '):'Published NBA archive')+' · '+(chosenDay?prettyDay(fullDay(today))+' · ':'')+'checked '+new Date(lastOK).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET'+(today===actualToday?' · refreshes every 30 seconds':'');
  return;
 }
 if(successful.length){
  root.innerHTML='<p class="hub-small">No NBA games listed for '+esc(prettyDay(fullDay(today)))+'. Choose another date above.</p>';
  status.textContent='No NBA games listed · '+prettyDay(fullDay(today));
 }else{
  status.textContent='NBA dated score feeds unavailable · select another date or try again';
  root.innerHTML='<p class="hub-small">Could not verify NBA games for '+esc(prettyDay(fullDay(today)))+'. The published archive may not cover this date.</p>';
 }

}
// Serialize refreshes, so an older response cannot overwrite a newer live score.
let refreshPromise=null;
function refreshLive(){
 if(refreshPromise)return refreshPromise;
 refreshPromise=update().catch(error=>console.warn('NBA live refresh failed:',error)).finally(()=>{refreshPromise=null;});
 return refreshPromise;
}
initDateNav();
Promise.allSettled([refreshRecords(),loadPregameElo()]).then(refreshLive);
setInterval(()=>{if(!document.hidden&&effectiveDay()===etDay(Date.now()))loadPregameElo().then(refreshLive)},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive()});
window.addEventListener('slt:nba-rendered',refreshLive);
})();