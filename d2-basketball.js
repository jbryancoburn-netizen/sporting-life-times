(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gender=(document.body.dataset.gender||new URLSearchParams(location.search).get('gender'))==='women'?'women':'men';
const path=gender==='women'?'d2-womens-basketball.html':'d2-mens-basketball.html';
const page=document.body.dataset.page;
const desk=document.documentElement.dataset.d2Desk;
const views={scores:'ledger',elo:'retro',teams:'teams',conferences:'conferences','schedule-recovery':'sources'};
const view=views[desk]||'';
const edition=gender==='women'?'Women’s':'Men’s';
const dept={
 scores:['THE DAILY LEDGER','Scores and fixtures. Select a game for RETRO analysis and the full Gamefile.'],
 elo:['THE POWER INDEX','The independent national RETRO table and the games behind it.'],
 teams:['THE SCHOOL DIRECTORY','Find any school and open its season schedule.'],
 conferences:['THE CONFERENCE DESK','Browse schools and their verified overall records.'],
 'schedule-recovery':['THE SOURCEBOOK','Published fixture coverage and verification by school.']
};
const route=(v,base=path)=>base+(v?'?view='+v:'');
const navLink=(text,href,active)=>'<a href="'+href+'"'+(active?' aria-current="page"':'')+'>'+text+'</a>';
function mount(){
 const ledger=desk==='scores';
 const header=$('d2-masthead');
 const banner='<a href="'+path+'">Sporting Life &amp; Times</a>';
 if(ledger){
  document.body.classList.add('sl-ledger-page');
  header.parentElement.className='sl-shell';
  header.className='sl-header';
 }
 header.innerHTML=(ledger?
  '<div class="sl-meta"><span>INDEPENDENT SPORTS JOURNALISM &amp; DATA</span><span>DIVISION II / 2026–27</span></div><div class="sl-masthead">'+banner+'<span>THE COLLEGE BASKETBALL EDITION</span></div>':
  '<div class="topline"><a href="index.html">Independent sports journalism &amp; data</a><span>'+edition+' Division II · 2026–27</span></div><div class="masthead">'+banner+'</div><div class="edition-line">The College Basketball Edition</div>')+
  '<nav class="nav cbb-universal-nav chronicle-nav" aria-label="College basketball navigation"><div class="cbb-gender-bar cbb-edition-switch" role="group" aria-label="Division II edition">'+
  ['men','women'].map(sex=>'<a class="cbb-gender-option" href="'+route(view,'d2-'+sex+'s-basketball.html')+'"'+(sex===gender?' aria-current="page"':'')+'>'+(sex==='men'?'Men':'Women')+'</a>').join('')+'</div>'+
  navLink('Chronicle',path,page==='home'&&!desk)+navLink('Daily Ledger',route('ledger'),ledger)+navLink('RETRO Rankings',route('retro'),desk==='elo')+navLink('Conferences',route('conferences'),desk==='conferences')+
  '<details class="chronicle-more"><summary>More</summary><div class="chronicle-more-list">'+navLink('Find Your Team',route('teams'),desk==='teams')+navLink('Sources and Coverage',route('sources'),desk==='schedule-recovery')+navLink('Division I','ncaam.html?gender='+gender)+navLink('All Sports','sports.html')+'</div></details></nav>';
 if(page!=='home')return;
 const [title,deck]=dept[desk]||['THE HARDWOOD CHRONICLE',edition+' Division II basketball'];
 const main=$('d2-main');
 if(desk){
  main.insertAdjacentHTML('beforebegin','<section class="slt-department-band" aria-label="'+title+'"><div class="slt-department-kicker"><span>COLLEGE BASKETBALL / DIVISION II</span><span>2026–27 EDITION</span></div><h1>'+title+'</h1><p>'+deck+'</p></section>');
 }else{
  document.body.setAttribute('data-d2-front','');
  document.body.classList.add('chronicle-front-page');
  header.classList.add('chronicle-masthead');
  main.classList.add('chronicle-main');
  main.insertAdjacentHTML('afterbegin','<section class="chronicle-nameplate"><h1>The Hardwood Chronicle</h1><p>'+edition+' Division II Basketball</p></section><section class="cbb-front-edition" data-d2-news data-chronicle-wire aria-labelledby="edition-news-title"><div class="cbb-front-title"><h2 id="edition-news-title">The Leading Stories</h2><span class="slt-front-status chronicle-news-stamp" role="status">Opening the news desk…</span></div><div class="slt-front-grid chronicle-news-content" aria-live="polite"><p>Checking current verified reports…</p></div></section><section class="chronicle-desks" aria-labelledby="chronicle-desks-title"><h2 id="chronicle-desks-title">Basketball Desks</h2><div class="chronicle-desk-grid"><section><h3>Games &amp; Teams</h3><a href="'+route('ledger')+'">Daily Ledger</a><a href="'+route('conferences')+'">Conference Standings</a><a href="'+route('teams')+'">Team Directory</a></section><section><h3>RETRO &amp; Statistics</h3><a href="'+route('retro')+'">RETRO Rankings</a></section><section><h3>Sources &amp; Records</h3><a href="'+route('sources')+'">Sources and Coverage</a></section></div></section>');
 }
}
const state={data:null,teams:new Map()};
const link=t=>'d2-team.html?gender='+encodeURIComponent(gender)+'&team='+encodeURIComponent(t.id);
const name=t=>esc(t?.name||t?.id||'Unknown school');
const gameLink=g=>'d2-game.html?gender='+encodeURIComponent(gender)+'&game='+encodeURIComponent(g.id);
const tipMinute=v=>{const m=/^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)\s*ET$/i.exec(String(v||'').trim());return m?(Number(m[1])%12)*60+Number(m[2])+(m[3].toUpperCase()==='PM'?720:0):1440;};
const chronological=(a,b)=>String(a.date).localeCompare(String(b.date))||tipMinute(a.start_time)-tipMinute(b.start_time)||String(a.id).localeCompare(String(b.id));
const pct=t=>((t.w||0)+(t.l||0))?((t.w||0)/((t.w||0)+(t.l||0))):0;
const label=t=>t?.conference||'Conference unverified';
const memberBadge=t=>t?.not_eligible_for_dii_elo?'<small class="member-tag" title="'+esc(t.membership_status||t.membership_note||'Not eligible for 2026–27 DII Elo')+'">NOT IN 2026–27 DII ELO</small>':'';
const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#274c5e';
function logo(t){
 const slug=String(t?.slug||'').replace(/[^a-z0-9-]/gi,'');
 const branded=/^#[0-9a-f]{6}$/i.test(t?.primary||'')&&/^#[0-9a-f]{6}$/i.test(t?.secondary||'');
 const initials=String(t?.name||'?').replace(/\b(?:university|college|of|at|the)\b/gi,'').trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
 const colors='style="--c1:'+color(t?.primary)+';--c2:'+color(t?.secondary)+'"';
 const description=branded?(t?.color_provenance||'School colors from source provider'):'Brand colors unavailable; neutral rings used';
 return '<span class="logo-shell '+(branded?'branded':'unbranded')+'" title="'+esc(description)+'" '+colors+'>'+
 (slug?'<img loading="lazy" alt="" src="https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+encodeURIComponent(slug)+'.svg" '+
 'data-logo-fallback="https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg" '+
 'onerror="if(this.dataset.logoFallback){this.src=this.dataset.logoFallback;delete this.dataset.logoFallback}else this.remove()">':'')+
 '<small class="logo-initials">'+esc(initials)+'</small></span>';
}
function school(id){return state.teams.get(String(id))||{id:String(id),name:id,slug:''}}
function row(t,i,withRank=true){return '<div class="board-row"><span class="rank-cell">'+(withRank?i+1:'')+'</span>'+logo(t)+'<a class="school-link" href="'+link(t)+'">'+name(t)+memberBadge(t)+'</a><span>'+(t.w||0)+'–'+(t.l||0)+'</span><span>'+Math.round(pct(t)*1000)/10+'%</span><span class="elo">'+Number(t.elo||1500).toFixed(0)+'</span></div>'}
function game(g,includeLink=true){
 const away=school(g.away),home=school(g.home),final=g.status==='final';
 const live=g.status==='live',scoreShown=final||live;
 const time=g.start_time||(g.tipoff_as_posted?g.tipoff_as_posted+' · TIME ZONE UNCONFIRMED':'Tipoff TBA');
 const mode=final?'final':live?'live':'upcoming';
 const line=t=>({name:t.name||'Unverified school',score:scoreShown?(t.id===away.id?g.away_score:g.home_score):null,
   crest:logo(t),teamHref:link(t),
   watermarkArt:t.slug?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+encodeURIComponent(t.slug)+'.svg':'',
   color:color(t.primary),record:(t.w||0)+'–'+(t.l||0),
   retro:!t.not_eligible_for_dii_elo&&Number.isFinite(Number(t.elo))?'RETRO '+Math.round(Number(t.elo)):'RETRO —'});
 const scorebug=window.SLTSportsScorebug?.render({phase:mode,compactFinal:true,
  status:live?(g.status_detail||g.period||'LIVE'):'',away:line(away),home:line(home)});
 const probability=(g.pred_home_pct===null||g.pred_home_pct===undefined)?null:Number(g.pred_home_pct);
 const validPct=Number.isFinite(probability)&&probability>=0&&probability<=100;
 const change=v=>(Number(v)>0?'+':'')+Number(v).toFixed(1);
 const odds=validPct?'<p class="ledger26-detail-note">Pregame home win chance: '+probability.toFixed(1)+
  '% · experimental RETRO model</p>'+
  (final&&Number.isFinite(Number(g.elo_change_home))?
   '<p class="ledger26-detail-note">RETRO change: '+esc(away.name)+' '+esc(change(g.elo_change_away))+
   ' / '+esc(home.name)+' '+esc(change(g.elo_change_home))+'</p>':''):'';
 const venue=g.venue||(g.venue_city?g.venue_city+' · Arena not confirmed':'Venue awaiting official confirmation');
 const broadcast=g.network||'Broadcast unconfirmed';
 const details='<div class="ledger26-expanded"><p class="ledger26-detail-note">'+
  esc(g.date+' · '+time+(g.neutral?' · NEUTRAL SITE':''))+'</p>'+odds+
  '<p class="ledger26-detail-note"><a href="'+link(away)+'">'+name(away)+'</a> · <a href="'+
  link(home)+'">'+name(home)+'</a></p>'+
  (g.source_url&&/^https:\/\//.test(g.source_url)?'<p><a href="'+esc(g.source_url)+
  '" target="_blank" rel="noopener noreferrer">VIEW VERIFIED SOURCE ↗</a></p>':'')+
  (includeLink?'<p><a href="'+gameLink(g)+'">OPEN FULL GAMEFILE ↗</a></p>':'')+
  '</div>';
 return '<article class="game-card ledger26-card ledger26-card--'+mode+'"><div class="ledger26-meta"><span class="ledger26-venue"><strong class="d2-visible-tipoff">'+esc(final?'FINAL':live?(g.status_detail||'LIVE'):time)+'</strong> · '+esc(venue)+
  '</span><span class="ledger26-network">'+esc(broadcast)+'</span></div><details class="ledger26-expand"><summary class="ledger26-summary">'+
  (scorebug||'<p class="note">Scorebug unavailable</p>')+
  '<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+details+'</details></article>';
}
function renderLedger(d,today){
 const picker=$('game-date');
 const query=new URLSearchParams(location.search);
 const search=$('sl-search');
 const filters=$('sl-filters');
 const label=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'});
 let filter=filters.querySelector('[aria-pressed="true"]').dataset.filter;
 picker.value=query.get('date')||today;
 if(!picker.value)picker.value=today;
 function showDate(){
  const date=picker.value||today;
  const url=new URL(location.href);
  if(date!==today||url.searchParams.has('date'))url.searchParams.set('date',date);
  history.replaceState(null,'',url);
  $('sl-date').textContent=label.format(new Date(date+'T12:00:00Z'));
  const needle=search.value.trim().toLowerCase();
  const selected=d.games.filter(g=>g.date===date&&(filter==='all'||g.status===filter)&&
   (!needle||[g.away,g.home].some(id=>String(school(id).name).toLowerCase().includes(needle))));
  selected.sort(chronological);
  const onDay=d.games.filter(g=>g.date===date);
  for(const choice of filters.querySelectorAll('[data-filter]')){
   choice.querySelector('span').textContent=choice.dataset.filter==='all'?onDay.length:onDay.filter(g=>g.status===choice.dataset.filter).length;
  }
  $('sl-count').textContent=selected.length+' '+(selected.length===1?'game':'games');
  $('sl-games').innerHTML=selected.length?selected.map(g=>game(g)).join(''):'<div id="game-grid" class="sl-empty"><strong>No games shown</strong><p>Choose another date or change the filters.</p></div>';
 }
 picker.onchange=showDate;
 search.oninput=showDate;
 filters.onclick=event=>{
  const button=event.target.closest('[data-filter]');
  if(!button)return;
  filter=button.dataset.filter;
  for(const choice of filters.querySelectorAll('[data-filter]')){
   choice.classList.toggle('is-active',choice===button);
   choice.setAttribute('aria-pressed',String(choice===button));
  }
  showDate();
 };
 for(const [id,step] of [['sl-prev',-1],['sl-next',1]])$(id).onclick=()=>{
  const date=new Date((picker.value||today)+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+step);
  picker.value=date.toISOString().slice(0,10);
  showDate();
 };
 $('sl-reload').onclick=init;
 $('sl-today').onclick=()=>{picker.value=today;showDate();};
 showDate();
}
function renderHome(d){
if(!desk)return;
const teams=(d.teams||[]).slice().sort((a,b)=>Number(!!a.not_eligible_for_dii_elo)-Number(!!b.not_eligible_for_dii_elo)||a.name.localeCompare(b.name));
const games=d.games||[];
const finals=games.filter(g=>g.status==='final'&&g.elo_eligible);
const transitionCount=teams.filter(t=>t.not_eligible_for_dii_elo).length;
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York'}).format(new Date());
if(desk==='scores'){
 renderLedger(d,today);
 return;
}
$('directory-count').textContent=teams.length+' listed programs · '+transitionCount+' excluded from DII Elo';
const ranked=teams.filter(t=>!t.not_eligible_for_dii_elo&&(t.w||0)+(t.l||0)>0).sort((a,b)=>b.elo-a.elo||b.w-a.w||a.name.localeCompare(b.name));
const hasGames=finals.length>0;
const scheduleBySchool=new Map(teams.map(t=>[t.id,[]]));
for(const g of games.slice().sort(chronological)){
 scheduleBySchool.get(g.home)?.push(g);
 scheduleBySchool.get(g.away)?.push(g);
}
const gameDateLabel=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
const minuteParts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'}).format(new Date()).split(':');
const localMinute=Number(minuteParts[0])*60+Number(minuteParts[1]);
function rankingSlips(t){
 const schedule=scheduleBySchool.get(t.id);
 const last=schedule.findLast(g=>g.status==='final'&&g.verified&&Number.isInteger(g.home_score)&&Number.isInteger(g.away_score));
 const next=schedule.find(g=>g.status==='scheduled'&&(g.date>today||
  (g.date===today&&tipMinute(g.start_time)>localMinute)));
 const describe=(g,completed)=>{
  if(!g)return null;
  const home=g.home===t.id;
  const score=home?g.home_score:g.away_score,other=home?g.away_score:g.home_score;
  const won=completed&&score>other;
  return {href:gameLink(g),kind:completed?(won?'win':'loss'):'next',
   opponent:school(home?g.away:g.home).name,location:home||g.neutral?'vs.':'at',
   day:g.date,dateLabel:gameDateLabel.format(new Date(g.date+'T12:00:00Z')),
   scoreline:completed?(won?'W ':'L ')+score+'–'+other:'',tipoff:completed?'':g.start_time};
 };
 const gamesNode=document.createElement('div');
 gamesNode.setAttribute('data-ranking-games',t.id);
 const slips=window.SLTRankingGames?.gameSlips(describe(last,true),describe(next,false));
 if(slips)gamesNode.append(slips);
 return gamesNode;
}
function rankCard(t,i){
 const card=document.createElement('div');
 card.className='cbb-elo-power';
 card.innerHTML='<span class="cbb-elo-rank">#'+(i+1)+'</span>'+logo(t)+'<span class="cbb-elo-power-name"><strong><a href="'+link(t)+'">'+name(t)+'</a></strong><small>'+esc(label(t))+'</small><small>RETRO '+Number(t.elo).toFixed(1)+'</small></span><b class="cbb-overall-record"><small>W–L</small>'+t.w+'–'+t.l+'</b>';
 card.append(rankingSlips(t));
 return card;
}
$('elo-note').textContent=(hasGames?'Early-season ratings from verified Division II finals; see model calibration status below.':'Every program began at Elo 1500; no artificial carryover or rankings before verified games.')+' · Home edge '+(d.model?.home_elo_edge??'TBA')+' · K '+(d.model?.k??'TBA')+' · '+(d.model?.status||'Calibration pending')+'.';
if(desk==='elo'){
 const board=$('elo-board');
 if(!hasGames){board.textContent='No ratings available until eligible games are completed.';return;}
 board.innerHTML='<section class="cbb-elo-card"><h2>The RETRO Power 10</h2><div id="d2-top-ten"></div></section>'+
  '<section class="cbb-elo-card"><h2>The National Table</h2><label>Find a school <input id="d2-rank-search" type="search" autocomplete="off"></label>'+
  window.SLTBasketballDeskLayout.rankingTable([],'d2-rank-rows')+'</section>';
 $('d2-top-ten').append(...ranked.slice(0,10).map(rankCard));
 const search=$('d2-rank-search');
 function renderTable(){
  const needle=search.value.trim().toLowerCase();
  const rows=ranked.map((t,i)=>({t,i})).filter(({t})=>(t.name+' '+label(t)).toLowerCase().includes(needle));
  const body=$('d2-rank-rows');
  body.replaceChildren(...rows.map(({t,i})=>{
   const template=document.createElement('template');
   template.innerHTML=window.SLTBasketballDeskLayout.rankingRow({rank:i+1,name:t.name,badge:logo(t),href:link(t),note:label(t),
    color:t.primary,record:t.w+'–'+t.l,rating:Number(t.elo).toFixed(1)});
   const tr=template.content.firstElementChild;
   tr.children[1].append(rankingSlips(t));
   return tr;
  }));
 }
 search.addEventListener('input',renderTable);
 renderTable();
 return;
}
function directory(q){const found=teams.filter(t=>(t.name+' '+label(t)).toLowerCase().includes(q));$('team-directory').innerHTML=found.length?found.map((t,i)=>row(t,i,false)).join(''):'<div class="note">No teams match the search or the registry has not yet been verified.</div>'}
$('team-search').addEventListener('input',e=>directory(e.target.value.trim().toLowerCase()));directory('');
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();const sel=$('conference-select');
sel.innerHTML='<option value="">Select a verified conference</option>'+confs.map(c=>'<option>'+esc(c)+'</option>').join('');
function conference(){
 const list=teams.filter(t=>t.conference&&t.conference===sel.value).sort((a,b)=>pct(b)-pct(a)||b.elo-a.elo);
 $('conference-board').innerHTML=list.length?'<p class="muted">Overall records only until official conference games and tiebreakers are verified.</p>'+
  window.SLTBasketballDeskLayout.standingsTable(['Place','School','W–L','PCT','RETRO'],list.map(t=>({
   name:t.name,href:link(t),badge:logo(t),values:[t.w+'–'+t.l,pct(t).toFixed(3),Number(t.elo).toFixed(1)]
  }))):'<div class="note">Conference memberships and official standings are not yet verified for this edition.</div>';
}
sel.addEventListener('change',conference);conference();
$('coverage').innerHTML='Preliminary Division II edition: <b>'+teams.length+'</b> listed programs, including <b>'+transitionCount+'</b> documented future or conference-transition entries not counted as certified DII opponents. NCAA membership has not yet been fully reconciled. This desk currently lists <b>'+teams.length+'</b> identified programs and <b>'+games.length+'</b> published fixtures or finals.<br>Institutional primary and secondary colors are taken from matched provider records where available. Any generated second-ring tonal accent is a visual treatment, <b>not</b> a verified school secondary color. School-specific conference, venue, television and roster fields appear only when the sources support them. A discovered team is not automatically a certified 2026–27 member.<br><b>Feed:</b> '+esc(d.source||'NCAA')+'<br><b>Quality:</b> '+esc(d.quality?.status||'Refresh pending')+'<br><b>Important:</b> Independent Elo changes require confirmed Division II opponents; exhibitions and cross-division games are excluded.';

const coverageStats=d.quality?.field_coverage;
if(coverageStats){
 const total=Number(coverageStats.fixture_records||0);
 $('coverage').innerHTML+='<br><b>Schedule coverage audit:</b> '+esc(coverageStats.schools_with_at_least_one_fixture)+
 ' schools have at least one published fixture; '+esc(coverageStats.schools_with_no_published_fixtures)+
 ' have none. '+esc(coverageStats.games_with_named_venue)+' / '+total+
 ' games include a named venue; '+esc(coverageStats.games_with_network)+' / '+total+
 ' include a broadcast network; '+esc(coverageStats.games_with_verified_tipoff??'—')+' have posted tipoff times and '+esc(coverageStats.games_with_stream_link??'—')+' have verified stream links. <b>Full schedule certification remains pending.</b>';
}
renderScheduleRecovery(d);
const brandedSchools=teams.filter(t=>/^#[0-9a-f]{6}$/i.test(t.primary||'')&&/^#[0-9a-f]{6}$/i.test(t.secondary||''));
const officialPairs=brandedSchools.filter(t=>t.color_provenance&&t.color_provenance.includes('ESPN-published primary and secondary')).length;
$('coverage').innerHTML+='<br><b>Logo rings:</b> '+brandedSchools.length+' of '+teams.length+
 ' teams currently have institution-matched palette data ('+officialPairs+' ESPN-published two-color pairs).'+
 ' When a university lists white as its secondary, a nonwhite <em>editorial tonal accent</em> is used and marked in the source data; it is not represented as an official second school color.'+
 ' Schools without a verified primary remain in neutral paper styling.';
}
function renderScheduleRecovery(d){
 const target=$('schedule-recovery-content');if(!target)return;
 // Count actual published fixtures, never assumed conference schedules.
 // Ineligible/future Division II schools do NOT count as missing 2026-27
 // DII schedules (e.g. West Florida is competing in Division I).
 const schools=new Map((d.teams||[]).map(t=>[String(t.id),{team:t,fixtures:0,tipoffs:0}]));
 for(const g of (d.games||[])){
  for(const id of new Set([String(g.away),String(g.home)])){
   const row=schools.get(id);if(!row)continue;
   row.fixtures++;if(g.start_time)row.tipoffs++;
  }
 }
 const entries=[...schools.values()].sort((a,b)=>a.fixtures-b.fixtures||a.team.name.localeCompare(b.team.name));
 const eligible=entries.filter(x=>!x.team.not_eligible_for_dii_elo);
 const excluded=entries.filter(x=>x.team.not_eligible_for_dii_elo);
 const empty=eligible.filter(x=>x.fixtures===0),thin=eligible.filter(x=>x.fixtures>0&&x.fixtures<=6);
 const renderRows=rows=>rows.map(x=>'<a class="recovery-school" href="'+link(x.team)+'">'+
 '<strong>'+name(x.team)+'</strong><span>'+esc(x.team.conference||'Conference unverified')+
 '</span><small>'+x.fixtures+' '+(x.fixtures===1?'GAME':'GAMES')+
 (x.fixtures?' · '+x.tipoffs+' WITH VERIFIED TIPOFF':'')+'</small></a>').join('');
 const renderExcluded=rows=>rows.map(x=>'<a class="recovery-school" href="'+link(x.team)+'">'+
 '<strong>'+name(x.team)+'</strong><span>'+esc(x.team.membership_status||'Not eligible for 2026–27 Division II Elo')+
 '</span><small>'+x.fixtures+' PUBLISHED GAMES · NO DII ELO</small></a>').join('');
 target.innerHTML='<div class="recovery-ribbon">'+
 '<div><strong>'+empty.length+'</strong><span>ELIGIBLE · NO GAMES</span></div>'+
 '<div><strong>'+thin.length+'</strong><span>ELIGIBLE · 1–6 GAMES</span></div>'+
 '<div><strong>'+eligible.filter(x=>x.fixtures>6).length+'</strong><span>ELIGIBLE · 7+ GAMES</span></div></div>'+
 '<p class="recovery-explainer">Counts include only schools eligible for the 2026–27 DII Elo ledger. They reflect games actually published in this edition, not completed official school schedules. Exhibition and cross-division games may be absent.</p>'+
 '<details class="recovery-details" '+(empty.length?'open':'')+'><summary>UNLISTED ELIGIBLE SCHOOL SCHEDULES · '+empty.length+'</summary>'+
 (empty.length?'<div class="recovery-school-grid">'+renderRows(empty)+'</div>':'<p class="recovery-explainer">Every eligible DII program has at least one published game; full-season verification remains pending.</p>')+'</details>'+
 '<details class="recovery-details"><summary>LOW-COVERAGE ELIGIBLE SCHOOL SCHEDULES · '+thin.length+'</summary>'+
 (thin.length?'<div class="recovery-school-grid">'+renderRows(thin)+'</div>':'<p class="recovery-explainer">No eligible DII programs currently have 1–6 listed games.</p>')+'</details>'+
 (excluded.length?'<details class="recovery-details"><summary>NOT ELIGIBLE FOR 2026–27 DII ELO · '+excluded.length+'</summary>'+
 '<p class="recovery-explainer">These are legacy directory listings, future applicants, or transitioning schools; their missing DII schedules are not recovery work. Their profiles retain source-backed membership notes.</p>'+
 '<div class="recovery-school-grid">'+renderExcluded(excluded)+'</div></details>':'');
}

function renderTeam(d){const id=new URLSearchParams(location.search).get('team');const t=state.teams.get(id);$('back-link').href=path;const el=$('team-profile');
const back=$('back-link');if(back)back.textContent='← BACK TO '+(gender==='women'?'WOMEN’S':'MEN’S')+' DII NEWSPAPER';
for(const a of document.querySelectorAll('.switches a'))a.classList.toggle('selected',gender==='women'?a.href.includes('womens'):a.href.includes('mens'));
if(!t){el.innerHTML='<div class="note">School not found in the verified team index. <a href="'+path+'">Browse the newspaper</a>.</div>';return}
const membership=t.membership_status?'<div class="note member-alert"><b>MEMBERSHIP:</b> '+esc(t.membership_status)+'. '+esc(t.membership_note||'')+(t.membership_source?' <a href="'+esc(t.membership_source)+'" target="_blank" rel="noopener noreferrer">OFFICIAL SOURCE ↗</a>':'')+'</div>':'';
const gs=(d.games||[]).filter(g=>g.away===t.id||g.home===t.id).sort(chronological);
const schedule=gs.map(g=>{
 const home=g.home===t.id,opponent=school(home?g.away:g.home),phase=g.status==='final'||g.status==='live'?g.status:'upcoming';
 const own=home?g.home_score:g.away_score,against=home?g.away_score:g.home_score;
 const outcome=phase==='final'&&Number.isFinite(own)&&Number.isFinite(against)&&own!==against?(own>against?'W':'L'):'';
 const rating=home?g.pregame_elo_home:g.pregame_elo_away;
 return {date:g.date,phase,site:g.neutral?'neutral':home?'home':'away',opponent:opponent.name,teamHref:link(opponent),badge:logo(opponent),
  color:opponent.primary,venue:g.venue_location||g.venue,tipoff:g.start_time||g.tipoff_as_posted,network:g.network||g.broadcast,
  retro:Number.isFinite(rating)?rating.toFixed(1):null,outcome,gameHref:gameLink(g),
  result:outcome?outcome+' '+own+'–'+against:phase==='final'?'Final':phase==='live'?'Live':null};
});
el.innerHTML=membership+'<div class="team-hero">'+logo(t)+'<div><span class="eyebrow">DII '+esc(gender.toUpperCase())+' · SCHOOL DESK</span><h1>'+name(t)+'</h1><p>'+esc(label(t))+' · '+esc(t.city||'Location not yet verified')+'</p></div></div><div class="team-stats metrics"><div class="team-stat metric"><strong>'+(t.w||0)+'–'+(t.l||0)+'</strong><span>VERIFIED DII RECORD</span></div><div class="team-stat metric"><strong>'+Number(t.elo||1500).toFixed(0)+'</strong><span>INDEPENDENT ELO</span></div><div class="team-stat metric"><strong>'+gs.length+'</strong><span>PUBLISHED SCHEDULE ENTRIES</span></div></div>'+window.SLTBasketballDeskLayout.schedule(schedule,'No verified games are published for this school yet.')+'<p class="note">Team-page fields will expand as official rosters, venues, broadcasts, and conference classifications are verified. No placeholders are presented as facts.</p>';
const reg=window.SLTBasketballStats;if(reg){const summary=reg.fromGames(gs,t.id,{requireFinal:true,requireVerified:true});el.querySelector('.team-stats')?.insertAdjacentHTML('afterend',reg.register(summary,{note:'2026–27 Division II source-verified final scores only; scheduled and disputed games excluded.'}));}}
function renderGame(d){
 const id=new URLSearchParams(location.search).get('game');
 const g=(d.games||[]).find(x=>String(x.id)===id);
 const el=$('gamefile-profile'),back=$('back-link');
 back.href=path+'?view=ledger'+(g?'&date='+encodeURIComponent(g.date):'');back.textContent='← BACK TO THE DAILY LEDGER';
 for(const a of document.querySelectorAll('.switches a'))a.classList.toggle('selected',gender==='women'?a.href.includes('womens'):a.href.includes('mens'));
 if(!g){el.innerHTML='<div class="note">Game not found in published '+esc(gender)+' Division II records. <a href="'+path+'">Back to the newspaper</a>.</div>';return;}
 const away=school(g.away),home=school(g.home);
 const src=[],seen=new Set();
 function add(url,txt){if(!/^https:\/\//.test(String(url||''))||seen.has(url))return;seen.add(url);src.push('<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(txt)+' ↗</a>');}
 add(g.source_url,'Game result or fixture source');
 for(const u of (Array.isArray(g.official_schedule_sources)?g.official_schedule_sources:[]))add(u,'University or conference schedule');
 add(g.tipoff_source_url,'Tipoff verification');add(g.venue_source_url,'Venue verification');
 add(g.broadcast_source_url,'Broadcast verification');add(g.stream_url,'Watch stream');
 const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(1):'Not available';
 const live=g.status==='live',final=g.status==='final';
 const pregame=(typeof g.pred_home_pct==='number'&&Number.isFinite(g.pred_home_pct));
 el.innerHTML='<div class="gamefile-title cbb-gamefile-hero"><span class="cbb-gamefile-eyebrow">DII '+esc(gender.toUpperCase())+' · '+esc(g.date)+' · '+esc(final?'FINAL':live?'LIVE (published feed)':'SCHEDULED')+'</span><h1>'+name(away)+(g.neutral?' <em>vs.</em> ':' <em>at</em> ')+name(home)+'</h1><p>'+esc(g.neutral?'Neutral site: team order is the published designation, not home court.':'Away first · home second')+'</p></div>'+
 '<div class="gamefile-score" data-gamefile-panel="summary">'+game(g,false)+'</div><div class="gamefile-grid">'+
 '<section class="gamefile-box"><h2>THE RETRO MODEL</h2><div class="gamefile-facts"><div><small>AWAY PREGAME ELO</small><strong>'+esc(fmt(g.pregame_elo_away))+'</strong></div><div><small>HOME PREGAME ELO</small><strong>'+esc(fmt(g.pregame_elo_home))+'</strong></div></div>'+
 '<p>'+(pregame?'Pre-game win chances: <b>'+esc((100-g.pred_home_pct).toFixed(1))+'%</b> '+name(away)+'; <b>'+esc(g.pred_home_pct.toFixed(1))+'%</b> '+name(home)+'.':'No evidence-backed win estimate.')+'</p>'+
 '<p class="muted">Independent 1500-start Elo. Home edge: '+esc(g.neutral?'none (neutral site)':d.model?.home_elo_edge??'unavailable')+' · K: '+esc(d.model?.k??'unavailable')+'. <b>'+(d.model?.calibrated?'Parameters fitted on official 2025–26 NCAA Division II finals; season Elo reset remains 1500.':'Division II parameters are provisional, not historically calibrated.')+'</b></p></section>'+
 '<section class="gamefile-box"><h2>GAME INTELLIGENCE</h2><p><b>Tipoff:</b> '+esc(g.start_time||'Unconfirmed')+'<br><b>Arena:</b> '+esc(g.venue||'Unconfirmed')+
 (g.venue_city?'<br><b>Published location:</b> '+esc(g.venue_city):'')+
 '<br><b>Network / stream:</b> '+esc(g.network||'Not verified')+
 (g.tournament?'<br><b>Tournament:</b> '+esc(g.tournament):'')+'</p><p class="muted">Player-by-player box scores are not included until verified player data exists. No statistics are invented.</p></section></div>'+
 '<section class="gamefile-box gamefile-source-box"><h2>VERIFY THE REPORTING</h2><div class="gamefile-source-links">'+(src.length?src.join(''):'<span class="muted">No game-specific source link is currently stored.</span>')+'</div>'+
 '<p class="muted">Published ledger updated '+esc(d.as_of?new Date(d.as_of).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'at an unknown time')+'. Refresh to check for newly published results. This page does not represent real-time play-by-play.</p></section>';
}
async function init(){try{const res=await fetch('data/d2-'+gender+'-2026-27.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Published data unavailable');const d=await res.json();if(d.gender!==gender||d.season!=='2026-27'||d.starting_elo!==1500||d.team_target!==298)throw Error('Failed women/men data-isolation contract');state.data=d;state.teams=new Map((d.teams||[]).map(t=>[String(t.id),t]));const eligible=(d.teams||[]).filter(t=>!t.not_eligible_for_dii_elo).length;const summary=$('school-count-summary');if(summary)summary.textContent=eligible+' eligible DII programs · RETRO ratings';$('status').textContent='NCAA scoreboard / published program directory · '+(d.as_of?new Date(d.as_of).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Awaiting verified first refresh')+' · '+(d.quality?.status||'provisional coverage');if(document.body.dataset.page==='team')renderTeam(d);else if(document.body.dataset.page==='game')renderGame(d);else renderHome(d)}catch(e){$('status').textContent='Source feed unavailable; existing standings were not replaced with invented values.';const target=$('team-profile')||$('gamefile-profile')||(desk==='scores'?$('sl-games'):$('elo-board'));if(target)target.innerHTML='<div class="note">'+esc(e.message)+'</div>';}}
mount();
if(page!=='home'||desk)init();
if(document.body.dataset.page==='game'){
 $('gamefile-refresh').addEventListener('click',init);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)init();});
}
})();