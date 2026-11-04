/* Independent college basketball schedule renderer.
   Runs even when rankings, article feeds, or MBB newsroom bootstrap fail. */
(async function refreshCalendar(){
'use strict';
const host=document.getElementById('mbb-calendar-host');
if(!host)return;
const selected=new URLSearchParams(location.search).get('team');
if(!selected)return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
await window.MBBLogos.ready;
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json();};
try{
 const cross=await load('data/ncaam-2026-27-espn-team-crosswalk.json');
 const team=(cross.teams||[]).find(t=>t.id===selected||String(t.espn_id)===selected);
 if(!team)throw Error('Unknown basketball team '+selected);
 // Shared page identity must follow the selected program, never a fixed school.
 document.title=team.name+' Basketball | The Sporting Life & Times';
 const icon=document.querySelector('link[rel="icon"]')||document.createElement('link');
 icon.rel='icon';icon.type='image/png';icon.href='https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(team.espn_id)+'.png';
 if(!icon.parentNode)document.head.appendChild(icon);
 const path='data/mbb-schedules-2026-27/'+encodeURIComponent(team.espn_id)+'.json';
 host.hidden=false;
 if(!host.dataset.scheduleLoaded)host.innerHTML='<section class="panel" id="full-season-schedule"><h2>'+escape(team.name)+' · 2026–27 Schedule</h2><p class="note">Loading published games…</p></section>';
 const data=await load(path);
 const valid=(data.events||[]).filter(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2);
 const officialClock=s=>/^(?:(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:a\.?m\.?|p\.?m\.?))?|\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s*(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?$/i.test(String(s||'').trim());
 const dateLabel=s=>/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}$/i.test(String(s||'').trim());
 const quality=e=>{const c=e.competitions[0],v=c.venue?.fullName||'';
  const schoolTime=e.official_school_time||e.official_time||'';
  const validTime=officialClock(schoolTime);
  const networks=[...(c.broadcasts||[]),...(e.broadcasts||[])];
  return (/Choose A Location|All Games Home|Select Location/i.test(v)||dateLabel(v)?0:v?4:0)
    +(validTime?8:0)+(networks.length?3:0)+(e.site_verified===true?2:0);
 };
 const distinct=new Map();
 for(const e of valid){const opponent=e.competitions[0].competitors.find(p=>String(p.team?.id)!==String(team.espn_id));const key=e.date.slice(0,10)+'|'+String(opponent?.team?.id||opponent?.team?.displayName||e.name||'').toLowerCase().trim();const old=distinct.get(key);if(!old||quality(e)>quality(old))distinct.set(key,e);}
 const games=[...distinct.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!games.length)throw Error('No games in '+path);
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=new Map();
 for(const entry of cross.teams||[]){for(const n of [entry.name,entry.espn_name]){const k=norm(n);if(!k)continue;if(!matches.has(k))matches.set(k,new Set());matches.get(k).add(String(entry.espn_id));}}
 // Reviewed official-school abbreviations, never fuzzy or guessed logos.
 const schoolAliases={'mdeasternshore':'2379','marylandeasternshore':'2379','etsu':'2193'};
 const exactId=n=>{const ids=matches.get(norm(n));if(ids?.size===1)return [...ids][0];
   const reviewed=schoolAliases[norm(n)];return reviewed&&schoolByCross.has(reviewed)?reviewed:'';};
 const schoolByCross=new Map((cross.teams||[]).map(t=>[String(t.espn_id),t]));
 const ratings=await load('data/ncaam-2026-27-retro-primary.json').catch(()=>null);
 // Non-counting October results are maintained in their own evidence ledger.
 // NEVER feed these scores to the RETRO model or call them regular-season finals.
 const exhibitionData=await load('data/mbb-exhibition-finals-2026-27.json').catch(()=>null);
 const bigTenPilot=(ratings?.rankings||[]).some(x=>String(x.team_id)===String(team.id)&&x.conference==='Big Ten');
 const ratingBySchool=new Map((ratings?.rankings||[]).map(x=>[String(x.team_id),x.elo]));
 const ncaaByEspn=new Map((cross.teams||[]).map(x=>[String(x.espn_id),String(x.id)]));
 const schoolByEspn=new Map((cross.teams||[]).map(x=>[String(x.espn_id),x]));
 const espnByNcaa=new Map((cross.teams||[]).map(x=>[String(x.id),String(x.espn_id)]));
 // Join on exact NCAA/ESPN identities AND official event date, never a fuzzy school name.
 const intervalDate=d=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d||'');
 const gameKey=(date,a,b)=>[date,...[String(a),String(b)].sort()].join('|');
 const verifiedFinals=new Map(),exhibitionFinals=new Map();
 if(exhibitionData?.season==='2026-27'&&exhibitionData.retro_included===false&&Array.isArray(exhibitionData.games)){
  for(const g of exhibitionData.games){
   const a=String(g.away_espn_id||''),h=String(g.home_espn_id||''),day=String(g.date||'');
   const score=n=>n!==''&&n!=null&&Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=300;
   if(g.classification!=='exhibition'||g.counts_for_retro!==false||g.verified!==true||
      !/^2026-10-[0-3][0-9]$/.test(day)||!schoolByCross.has(a)||!schoolByCross.has(h)||
      a===h||!score(g.away_score)||!score(g.home_score)||
      !/^https:\/\/[^\s"'<>]+$/.test(g.source_url||''))continue;
   const key=gameKey(day,a,h),old=exhibitionFinals.get(key);
   if(exhibitionFinals.has(key)){
    if(!old||old.away!==a||old.home!==h||old.away_score!==Number(g.away_score)||
       old.home_score!==Number(g.home_score))exhibitionFinals.set(key,null);
    continue;
   }
   exhibitionFinals.set(key,{away:a,home:h,away_score:Number(g.away_score),
    home_score:Number(g.home_score),source_url:g.source_url,
    source_tier:g.source_tier||'official'});
  }
 }
 const validRatings=ratings?.season==='2026-27'&&ratings?.model==='retro-clean-slate'&&
  ratings?.starting_elo===1500&&ratings?.rankings?.length===365&&
  Array.isArray(ratings?.events)&&ratings.events.length===ratings.games_played;
 if(validRatings)for(const result of ratings.events){
  const away=espnByNcaa.get(String(result.away_id)),home=espnByNcaa.get(String(result.home_id));
  const score=n=>n!==null&&n!==undefined&&Number.isInteger(Number(n))&&Number(n)>=0;
  if(!away||!home||away===home||!intervalDate(result.date)||
    !score(result.away_score)||!score(result.home_score)||
    Number(result.away_score)===Number(result.home_score)||
    !/^espn:[0-9]+$/.test(result.id||''))continue;
  const key=gameKey(result.date,away,home),previous=verifiedFinals.get(key);
  if(verifiedFinals.has(key)){
   if(!previous||previous.away!==away||previous.home!==home||
      previous.away_score!==Number(result.away_score)||previous.home_score!==Number(result.home_score))
    verifiedFinals.set(key,null);
   continue;
  }
  verifiedFinals.set(key,{away,home,away_score:Number(result.away_score),
   home_score:Number(result.home_score),date:result.date,id:String(result.id).slice(5)});
 }
 // Source venue verification does NOT determine whether a final score is valid.
 // School-site midnight openers can be dated one day later than the ESPN
 // event archive. Permit a one-day rollover ONLY for an exact unique matchup.
 const finalArchive=[...verifiedFinals.values()].filter(Boolean);
 const schoolFinal=(date,opponentId,midnight)=>{
   const direct=verifiedFinals.get(gameKey(date,team.espn_id,opponentId));
   if(direct)return direct;
   if(!midnight)return null;
   const epoch=Date.parse(date+'T12:00:00Z');
   const possible=finalArchive.filter(g=>
     [g.home,g.away].includes(String(team.espn_id))&&
     [g.home,g.away].includes(String(opponentId))&&
     Math.abs(Date.parse(g.date+'T12:00:00Z')-epoch)===86400000);
   return possible.length===1?possible[0]:null;
 };
 // Historical D-I records are reconstructed strictly before the game date.
 // Do not use current season totals as if they were historical.
 const enteringRecord=(espnId,day)=>{
  if(!espnId||!validRatings)return '—';
  let wins=0,losses=0;
  for(const result of verifiedFinals.values()){
   if(!result||result.date>=day)continue;
   if(result.home!==String(espnId)&&result.away!==String(espnId))continue;
   const selfHome=result.home===String(espnId);
   const myScore=selfHome?result.home_score:result.away_score;
   const theirScore=selfHome?result.away_score:result.home_score;
   if(myScore>theirScore)wins++;else if(myScore<theirScore)losses++;
  }
  return wins+'–'+losses;
 };
 const opponentElo=id=>{const n=ratingBySchool.get(ncaaByEspn.get(String(id)));return Number.isFinite(Number(n))?Math.round(Number(n)).toString():'Not rated';};
 const cells=games.map(e=>{
  const c=e.competitions[0],contestants=c.competitors||[];
  const self=contestants.find(x=>String(x.team?.id)===String(team.espn_id));
  const opponent=contestants.find(x=>x!==self)||{};
  const opponentName=opponent.team?.displayName||opponent.team?.name||e.name||'Opponent TBD';
  const knownId=String(opponent.team?.id||'').trim();
  const opponentId=knownId||exactId(opponentName);
  // Recover exact Division I identities when an imported opponent has no ID.
  // Non-Division I opponents retain initials instead of a guessed crest.
  const emblem=window.MBBLogos.byESPN(opponentId,'schedule',opponentName);
  const date=new Date(e.date);
  const day=Number.isFinite(+date)?date.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):e.date.slice(0,10);
  const verifiedTip=[e.official_school_time,e.official_time].find(officialClock)||'';
  const confirmed=Boolean(verifiedTip);
  const tip=confirmed?verifiedTip:'TBA'; // Never present placeholder imported noon as an official tip.
  const vs=e.site_verified===true?(self?.homeAway==='away'?'AWAY':self?.homeAway==='home'?'HOME':e.neutralSite===true?'NEUTRAL':'SITE TBA'):'SITE UNVERIFIED';
  const broadcastLabels=[...(c.broadcasts||[]),...(e.broadcasts||[])].flatMap(x=>{
   if(typeof x==='string')return [x];
   return [...(Array.isArray(x?.names)?x.names:x?.names?[x.names]:[]),x?.name,x?.media?.shortName,x?.media?.name].filter(Boolean);
  });
  // Published school sources may also carry a direct broadcast label.
  if(typeof e.broadcast==='string')broadcastLabels.push(e.broadcast);
  const namedNetwork=[...new Set(broadcastLabels.map(x=>String(x).trim()).filter(x=>x&&!/^(?:TBA|TBD|unknown|network tba)$/i.test(x)))].join(' / ');
  const watchURL=/^https:\/\/[^\s"'<>]+$/i.test(e.official_watch_url||'')?e.official_watch_url:'';
  const watchLink=watchURL?'<a href="'+escape(watchURL)+'" target="_blank" rel="noopener noreferrer">Stream link ↗</a>':'';
  const network=(namedNetwork?escape(namedNetwork):'Not announced')+(watchLink?' · '+watchLink:'');
  const rawVenue=(c.venue?.fullName||'').trim();
  const cleanVenue=/Choose A Location|All Games Home|Select Location/i.test(rawVenue)||dateLabel(rawVenue)?'':rawVenue;
  const address=c.venue?.address||{};
  const venueCity=[address.city,address.state].filter(Boolean).join(', ');
  const cityOnly=/^[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s.*)?$/.test(cleanVenue)||/^[A-Za-z .'-]+,\s*(?:Ohio|Florida|California|Texas|New York|Pennsylvania|Virginia|Georgia|Indiana|Kentucky|Tennessee|Illinois|Michigan|Wisconsin|Alabama|Arkansas|Missouri|Oklahoma|Iowa|Utah|Colorado|Arizona|Nevada|Oregon|Washington|Louisiana|Mississippi|Idaho|Kansas|Nebraska|Minnesota|Maryland|Connecticut|Montana|Maine|Vermont|Hawaii|Alaska|Wyoming|Delaware|Carolina|Dakota|Jersey|Mexico)(?:\s.*)?$/i.test(cleanVenue);
  const embedded=cleanVenue.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  const embeddedArena=embedded&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(embedded[2])?embedded[2].trim():'';
  const locationLabel=/^[A-Za-z .'-]+,\s*(?:[A-Z]{2}|Fla\.|Calif\.|N\.Y\.|N\.C\.|S\.C\.|Ga\.|Tenn\.|Tex\.|Pa\.|Ill\.|Mich\.|Mass\.|Ariz\.|Nev\.|Ore\.|Wash\.)\s*$/i.test(cleanVenue);
  const officialLocation=(c.venue?.official_school_location||'').trim();
  const officialFacility=officialLocation.match(/\(([^()]+)\)/);
  const officialArena=officialFacility&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(officialFacility[1])?officialFacility[1].trim():'';
  const arenaFromOfficialLine=cleanVenue.match(/(?:^|\s)((?:[A-Za-z0-9'.&-]+\s+){0,6}(?:Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation Center|Indoor Stadium|Dome|Auditorium))\s*$/i)?.[1]||'';
  let arena=(dateLabel(c.venue?.arenaName)?'':c.venue?.arenaName)||officialArena||embeddedArena||arenaFromOfficialLine||((cityOnly||locationLabel)?'Arena TBA':cleanVenue||'Arena TBA');
  const schoolCity=dateLabel(c.venue?.official_school_city)?'':c.venue?.official_school_city;
  const rawCity=schoolCity||venueCity||(embedded&&embeddedArena?embedded[1].trim():((cityOnly||locationLabel)?cleanVenue:'City TBA'));
  const cityState=(address.state||'').trim();
   const city=cityState&&rawCity!=='City TBA'&&!rawCity.includes(',')?rawCity+', '+cityState:rawCity;
  if(rawCity&&rawCity!=='City TBA'&&arena.startsWith(rawCity))arena=arena.slice(rawCity.length).replace(/^[\s/|,]+/,'')||arena;
  const scheduledDate=e.date.slice(0,10);
  const exhibition=e.exhibition===true||scheduledDate<'2026-11-01'||
    /\b(?:exhibition|exh\.|preseason|scrimmage)\b/i.test(e.name||'');
  const canceled=e.exhibition_canceled===true||e.status?.type?.state==='canceled';
  // For non-D-I opponents, an exact university-attested source result may
  // be carried by the schedule record without assigning a false NCAA ID.
  const special=e.exhibition_result;
  // A sourced regular-season result versus a non-Division I opponent is a final
  // on the team calendar, but does not enter the Division I RETRO game ledger.
  const otherDivisionResult=e.verified_non_d1_result;
  const verifiedNonD1=!exhibition&&!canceled&&!schoolByEspn.has(String(opponentId))&&
    otherDivisionResult?.verified===true&&
    otherDivisionResult?.classification==='regular-season'&&
    otherDivisionResult?.counts_for_retro===false&&
    /^https:\/\/[^\s"'<>]+$/.test(otherDivisionResult?.source_url||'')&&
    [otherDivisionResult?.team_score,otherDivisionResult?.opponent_score].every(n=>
      n!==''&&n!=null&&Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=300)?
    otherDivisionResult:null;
  const verifiedSpecial=exhibition&&!canceled&&special?.verified===true&&
    special?.counts_for_retro===false&&
    /^https:\/\/[^\s"'<>]+$/.test(special?.source_url||'')&&
    [special?.team_score,special?.opponent_score].every(n=>n!==''&&n!=null&&Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=300)?special:null;
  const midnight=/^12:0[0-9]\s*A\.?M\.?/i.test(verifiedTip.trim());
  const final=!exhibition&&!canceled&&opponentId?schoolFinal(scheduledDate,opponentId,midnight):null;
  const exhibitionFinal=exhibition&&!canceled&&opponentId?
    exhibitionFinals.get(gameKey(scheduledDate,team.espn_id,opponentId)):null;
  const completed=!!final||!!exhibitionFinal||!!verifiedSpecial||!!verifiedNonD1||
    e.status?.type?.completed===true||e.status?.type?.state==='post';
  const resultRecord=exhibitionFinal||final;
  const teamPoints=verifiedNonD1?verifiedNonD1.team_score:verifiedSpecial?verifiedSpecial.team_score:
    resultRecord?(resultRecord.home===String(team.espn_id)?
    resultRecord.home_score:resultRecord.away_score):(exhibition?null:self?.score);
  const opponentPoints=verifiedNonD1?verifiedNonD1.opponent_score:verifiedSpecial?verifiedSpecial.opponent_score:
    resultRecord?(resultRecord.home===String(team.espn_id)?
    resultRecord.away_score:resultRecord.home_score):(exhibition?null:opponent?.score);
  const hasScore=completed&&teamPoints!=null&&opponentPoints!=null&&
    String(teamPoints).trim()!==''&&String(opponentPoints).trim()!==''&&
    Number.isFinite(Number(teamPoints))&&Number.isFinite(Number(opponentPoints))&&
    (exhibition?(!!exhibitionFinal||!!verifiedSpecial):Number(teamPoints)!==Number(opponentPoints));
  const gameState=canceled?'CANCELED':exhibition?(hasScore?'EXHIBITION FINAL':
    /closed.scrimmage/i.test(e.name||'')?'CLOSED SCRIMMAGE':'EXHIBITION'):
    hasScore?'FINAL':completed?'RESULT PENDING':'UPCOMING';
  const winning=Number(teamPoints)>Number(opponentPoints),tied=Number(teamPoints)===Number(opponentPoints);
  const scoreText=hasScore?'<strong class="sched-result-score '+(tied?'sched-tie':winning?'sched-win':'sched-loss')+'">'+
    (tied?'T ':winning?'W ':'L ')+escape(teamPoints)+'–'+escape(opponentPoints)+'</strong>':
    '<span class="sched-result-pending">'+(canceled?'Event canceled':exhibition?'Exhibition result not reported':'Not final')+'</span>';
  const resultSource=exhibitionFinal||verifiedSpecial||verifiedNonD1;
  const sourceLink=resultSource?'<br><a class="mbb-exhibition-source" href="'+escape(resultSource.source_url)+
    '" rel="noopener noreferrer" target="_blank">'+(resultSource.source_tier==='independent_secondary'?
      'Published score ↗':'University result ↗')+'</a>':'';
  const result=scoreText+sourceLink;
  const gameFile=final?'<br><a class="mbb-schedule-gamefile" href="cbb-gamefile.html?day='+
    encodeURIComponent(final.date)+'&amp;game='+encodeURIComponent(final.id)+'">Game file ↗</a>':'';
  const statId=String(final?.id||e.id||'').replace(/^espn:/,'');
  const expandable=bigTenPilot&&hasScore&&/^\d+$/.test(statId);
  const historicalRecords=bigTenPilot?'<span class="victorian-at-game-records">ENTERING · '+escape(team.name)+' '+escape(enteringRecord(team.espn_id,scheduledDate))+' · '+escape(opponentName)+' '+escape(enteringRecord(opponentId,scheduledDate))+' <em>(verified D-I)</em></span>':'';
  const school=schoolByEspn.get(opponentId);
  const label=escape(school?.name||opponentName);
  const title=school?'<a href="ncaam-team.html?team='+encodeURIComponent(school.id)+'">'+label+'</a>':label;
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/New_York'});
  const scheduleState=hasScore?'final':canceled?'canceled':scheduledDate>=today?'upcoming':'past';
  return '<tr '+(bigTenPilot?'data-game-site="'+(vs==='HOME'?'home':vs==='AWAY'?'away':vs==='NEUTRAL'?'neutral':'unknown')+'" ':'')+(expandable?'class="victorian-completed-game" data-stat-id="'+escape(statId)+'" tabindex="0" aria-label="Expand statistics for '+escape(opponentName)+'" ':'')+'data-calendar-state="'+scheduleState+'" data-exhibition="'+(exhibition?'true':'false')+
    '" data-opponent="'+escape((school?.name||opponentName).toLowerCase())+'">'+
    '<td class="sched-date-cell"><time datetime="'+escape(scheduledDate)+'">'+escape(day)+'</time><span class="sched-game-status sched-status--'+(canceled?'canceled':exhibition?'exhibition':hasScore?'final':completed?'pending':'upcoming')+'">'+gameState+'</span></td>'+
    '<td class="sched-matchup-cell"><div class="sched-matchup">'+emblem+'<span class="sched-opponent"><strong>'+title+'</strong><small>'+vs.replace('SITE UNVERIFIED','LOCATION UNCONFIRMED')+'</small>'+historicalRecords+'</span></div></td>'+
    '<td class="sched-venue-cell"><div class="sched-venue"><strong>'+escape(arena)+'</strong><small>'+escape(city)+'</small></div></td>'+
    '<td class="sched-time-cell">'+escape(tip)+'</td>'+
    '<td class="sched-network-cell">'+network+'</td>'+
    '<td class="sched-elo-cell">'+(exhibition||verifiedNonD1?'Not applicable':escape(opponentElo(opponentId)))+'</td>'+
    '<td class="sched-result-cell">'+result+(bigTenPilot?'':gameFile)+(expandable?'<button type="button" class="victorian-stat-toggle" aria-expanded="false">GAME STATS ▾</button>':'')+'</td></tr>'+(expandable?'<tr class="victorian-stat-detail" hidden><td colspan="7"><div class="victorian-stat-content">Open for game statistics.</div></td></tr>':'');
 }).join('');
 const scoredExhibitions=games.filter(e=>{
  if(e.date.slice(0,10)>='2026-11-01')return false;
  const opponents=e.competitions?.[0]?.competitors||[];
  const other=opponents.find(x=>String(x.team?.id)!==String(team.espn_id));
  const special=e.exhibition_result;
  const sourcedNonDI=special?.verified===true&&special.counts_for_retro===false&&
    /^https:\/\/[^\s"'<>]+$/.test(special.source_url||'');
  return !!(sourcedNonDI||(other&&exhibitionFinals.get(gameKey(e.date.slice(0,10),team.espn_id,other.team?.id))));
 }).length;
 const method=data.verified_from_school?'Official university athletics calendar':data.verified_by_opponents?'Opponent universities confirmed these games; partial coverage':'Published schedule feed; official verification pending';
 const source=/^https:\/\/[^\s"'<>]+$/.test(data.source_url||'')&&!/espn\.com|realgm\.com|wikipedia\.org/i.test(data.source_url)?'<a href="'+escape(data.source_url)+'" target="_blank" rel="noopener">School athletics source ↗</a>':'';
 const savedSearch=host.querySelector('#calendar-opponent')?.value||'';
 const savedView=host.querySelector('#calendar-view')?.value||'all';
 host.innerHTML='<section class="panel '+(bigTenPilot?'victorian-team-calendar':'')+'" id="full-season-schedule"><div class="panel-head"><div class="eyebrow">'+escape(team.name)+' · 2026–27</div><h2>Full Season Schedule — '+games.length+' Games</h2></div><p class="note">'+escape(method)+' · Times follow the school listing and its published time zone. Regular-season finals follow RETRO; exhibition finals use a separate sourced ledger and never affect Elo. '+scoredExhibitions+' verified exhibition result(s). Unannounced broadcasts remain TBA. '+source+'</p>'+(bigTenPilot?'<div class="victorian-shade-key" aria-label="Schedule color key"><span><i class="home"></i>Home</span><span><i class="away"></i>Away</span><span><i class="neutral"></i>Neutral</span><span><i class="stats"></i>Hover: open game statistics</span></div>':'')+'<div class="calendar-controls"><label>Opponent <input id="calendar-opponent" class="input" type="search" placeholder="Find an opponent…"></label><label>Show <select id="calendar-view"><option value="all">All games</option><option value="upcoming">Upcoming games</option><option value="final">Finals</option><option value="exhibition">Exhibitions</option></select></label><span id="calendar-count" class="note" aria-live="polite"></span></div><div class="table-wrap"><table class="mbb-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Arena / City</th><th>Tipoff (school listing)</th><th>TV / Stream</th><th>Opp. RETRO</th><th>Result</th></tr></thead><tbody>'+cells+'</tbody></table></div></section>';
 const search=host.querySelector('#calendar-opponent'),view=host.querySelector('#calendar-view');
 search.value=savedSearch;view.value=savedView;
 const filter=()=>{let shown=0;for(const row of host.querySelectorAll('tbody tr:not(.victorian-stat-detail)')){row.hidden=!(row.dataset.opponent.includes(search.value.toLowerCase().trim())&&(view.value==='all'||(view.value==='exhibition'?row.dataset.exhibition==='true':row.dataset.calendarState===view.value)));if(!row.hidden)shown++;const detail=row.nextElementSibling;if(detail?.classList.contains('victorian-stat-detail'))detail.hidden=row.hidden||row.querySelector('.victorian-stat-toggle')?.getAttribute('aria-expanded')!=='true';}host.querySelector('#calendar-count').textContent=shown+' of '+games.length+' games';};
 if(bigTenPilot){
  const statTable=(heading,entries)=>'<div class="victorian-stat-block"><h3>'+escape(heading)+'</h3><table><tbody>'+entries.map(([label,values])=>'<tr><th>'+escape(label)+'</th>'+values.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  host.querySelectorAll('.victorian-completed-game').forEach(row=>{
   const button=row.querySelector('.victorian-stat-toggle'),detail=row.nextElementSibling;
   const toggle=async()=>{
    const opening=button.getAttribute('aria-expanded')!=='true';
    button.setAttribute('aria-expanded',String(opening));button.textContent=opening?'CLOSE STATS ▴':'GAME STATS ▾';detail.hidden=!opening;
    if(!opening||detail.dataset.loaded)return;
    const body=detail.querySelector('.victorian-stat-content');body.textContent='Retrieving verified game statistics…';
    try{
     const data=await load('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event='+encodeURIComponent(row.dataset.statId));
     const box=data.boxscore||{},teamStats=box.teams||[];
     const periods=data.header?.competitions?.[0]?.competitors||[];
     let html='';
     if(periods.some(t=>t.linescores?.length)){
      const max=Math.max(...periods.map(t=>t.linescores?.length||0));
      html+='<div class="victorian-stat-block"><h3>Period by Period</h3><table><thead><tr><th>Team</th>'+Array.from({length:max},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'<th>Final</th></tr></thead><tbody>'+periods.map(t=>'<tr><th>'+escape(t.team?.displayName||t.team?.name||'Team')+'</th>'+Array.from({length:max},(_,i)=>'<td>'+escape(t.linescores?.[i]?.displayValue??t.linescores?.[i]?.value??'—')+'</td>').join('')+'<td>'+escape(t.score??'—')+'</td></tr>').join('')+'</tbody></table></div>';
     }
     if(teamStats.length){
      const labels=[...new Set(teamStats.flatMap(t=>(t.statistics||[]).map(v=>v.label||v.name).filter(Boolean)))];
      if(labels.length)html+='<div class="victorian-stat-block"><h3>Team Box Score</h3><table><thead><tr><th>Statistic</th>'+teamStats.map(t=>'<th>'+escape(t.team?.displayName||t.team?.name||'Team')+'</th>').join('')+'</tr></thead><tbody>'+labels.map(label=>'<tr><th>'+escape(label)+'</th>'+teamStats.map(t=>{const stat=(t.statistics||[]).find(x=>(x.label||x.name)===label);return '<td>'+escape(stat?.displayValue??stat?.value??'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div>';
     }
     // Full player box scores, grouped by team, stay inside the expanded game card.
     for(const teamBox of box.players||[]){
      const players=teamBox.statistics?.[0];
      const athletes=players?.athletes||[];
      if(!athletes.length)continue;
      const columns=players.labels||[];
      html+='<div class="victorian-stat-block"><h3>'+escape(teamBox.team?.displayName||teamBox.team?.name||'Player Box Score')+'</h3><table class="victorian-player-box"><thead><tr><th>Player</th>'+columns.map(c=>'<th>'+escape(c)+'</th>').join('')+'</tr></thead><tbody>'+
       athletes.map(p=>'<tr><th>'+escape(p.athlete?.displayName||p.athlete?.shortName||'Player')+'</th>'+
        (p.stats||[]).map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+
       '</tbody></table></div>';
     }
     const details=data.header?.competitions?.[0]||{};
     const venue=details.venue||{};
     if(venue.fullName||venue.address?.city||details.attendance){
      html+='<div class="victorian-stat-block"><h3>Game Details</h3><p>'+
       [venue.fullName,[venue.address?.city,venue.address?.state].filter(Boolean).join(', '),details.attendance?'Attendance: '+Number(details.attendance).toLocaleString('en-US'):''].filter(Boolean).map(escape).join(' · ')+'</p></div>';
     }
     const leaders=data.leaders||[];
     if(leaders.length){
      html+='<div class="victorian-stat-block"><h3>Game Leaders</h3>'+
       leaders.map(t=>'<p><strong>'+escape(t.team?.displayName||'Team')+'</strong> · '+(t.leaders||[]).map(v=>escape(v.displayName||v.name||'')+': '+(v.leaders||[]).slice(0,2).map(p=>escape(p.athlete?.displayName||'')+' '+escape(p.displayValue||'')).join(', ')).join(' | ')+'</p>').join('')+'</div>';
     }
     body.innerHTML=html||'<p>Detailed statistics have not been published for this game.</p>';
     detail.dataset.loaded='true';
    }catch(error){body.textContent='Game statistics are currently unavailable from the source.';}
   };
   button.addEventListener('click',toggle);
   row.addEventListener('click',e=>{if(e.target.closest('button'))return;if(e.target.closest('a'))e.preventDefault();toggle();});
   row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggle();}});
  });
 }
 search.addEventListener('input',filter);view.addEventListener('change',filter);filter();
 host.dataset.scheduleLoaded=selected;
 if(!host.dataset.calendarPolling){host.dataset.calendarPolling='true';setInterval(()=>{if(!document.hidden)refreshCalendar();},60000);}
}catch(err){
 console.error('Standalone team calendar load failed',err);
 if(host.dataset.scheduleLoaded)return; // Retain the last successful calendar during a refresh outage.
 host.hidden=false;
 host.innerHTML='<section class="panel" id="full-season-schedule"><h2>Team Calendar Unavailable</h2><p class="note">Schedule could not be loaded. Please refresh this page.</p></section>';
}
})();
