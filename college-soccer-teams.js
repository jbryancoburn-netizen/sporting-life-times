(async()=>{'use strict';
const search=document.getElementById('college-team-search');
const results=document.getElementById('college-team-results');
const profile=document.getElementById('college-team-profile');
if(!search||!results||!profile)return;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const url=new URL(location.href);
const cohortName=c=>(c.startsWith('women')?'Women':'Men')+' · Division '+({1:'I',2:'II',3:'III'}[c.slice(-1)]);
const fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
const fullDate=s=>{try{return new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}catch{return s;}};
results.textContent='Loading NCAA soccer schools…';
try{
const rankingResponse=await fetch('data/college-soccer-elo.json',{cache:'no-store'});
if(!rankingResponse.ok)throw Error('Rankings unavailable: '+rankingResponse.status);
const rankings=await rankingResponse.json();
const teams=Object.entries(rankings.cohorts).flatMap(([cohort,rows])=>rows.map(t=>({...t,cohort})));
const byId=new Map(teams.map(t=>[t.cohort+':'+t.team_id,t]));
let forecasts=[],verified=[];
let newsData={articles:[],updated_at:null};
let scheduleData={teams:{}};
let gameIndex={teams:{}};
let brandData={teams:{}};
let conferenceData={conferences:{},team_to_conference:{}};




const box=(heading)=>{const section=node('section',undefined,'team-panel');section.append(node('h3',heading));profile.append(section);return section;};
function open(t){
profile.replaceChildren();results.replaceChildren();
const brand=brandData.teams?.[t.cohort+':'+t.team_id];
profile.style.setProperty('--team-primary',brand?.primary||'#152b42');
profile.style.setProperty('--team-accent',brand?.accent||'#c5a15a');
profile.classList.toggle('team-has-brand',!!brand);
const header=node('div',undefined,'team-hero');
if(brand?.logo_url){
 const watermark=node('img');watermark.className='team-hero-logo-bg';watermark.alt='';watermark.setAttribute('aria-hidden','true');
 watermark.src=brand.logo_url;watermark.loading='lazy';
 watermark.addEventListener('error',()=>watermark.remove());header.append(watermark);
}
header.append(node('p',cohortName(t.cohort)+' · '+String(rankings.as_of||'Latest published edition'),'team-eyebrow'));
const badge=node('span',t.team.split(/\\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(),'team-monogram');
if(brand?.logo_url){
  const logo=node('img');logo.src=brand.logo_url;logo.alt=t.team+' athletics logo';logo.loading='lazy';logo.decoding='async';
  logo.addEventListener('error',()=>{logo.remove();badge.textContent=brand.badge_text||t.team.slice(0,1);});
  badge.replaceChildren(logo);
}
const identity=node('div',undefined,'team-identity');
identity.append(badge);
const identityText=node('div');identityText.append(node('h2',t.team),node('p',(brand?.nickname?brand.nickname.toUpperCase()+' · ':'')+'2026 NCAA SOCCER · PROGRAM REPORT','team-identity-caption'));
if(brand){
 const details=node('div',undefined,'team-identity-detail');
 if(brand.city||brand.location)details.append(node('span','CITY  ·  '+(brand.city?(brand.city+', '+(brand.state||'')):brand.location)));
 if(brand.conference)details.append(node('span','CONFERENCE  ·  '+(brand.conference_short||brand.conference)));
 identityText.append(details);
}

identity.append(identityText);header.append(identity);
const actions=node('div',undefined,'team-hero-actions');
const share=node('a','Share program page ↗','team-hero-link');share.href='college-soccer-team.html?team='+encodeURIComponent(t.cohort+':'+t.team_id);
actions.append(share);
if(brand?.official_team_url){const official=node('a','Official athletics ↗','team-hero-link');official.href=brand.official_team_url;official.target='_blank';official.rel='noopener noreferrer';actions.append(official);}
header.append(actions);profile.append(header);
const metrics=node('div',undefined,'team-metrics');
for(const [label,value] of [['Elo',fmt(t.elo)],['Division rank','#'+t.rank],['Record',t.record],['Goals for / against',t.gf+' / '+t.ga],['Goal differential',(t.gd>0?'+':'')+t.gd]]){const metric=node('div',undefined,'team-metric');metric.append(node('span',label),node('strong',value));metrics.append(metric);}
metrics.firstElementChild.classList.add('team-metric-lead');
profile.append(metrics);
const visual=node('section',undefined,'team-visual-report');
visual.id='team-visual-report';
const visualHead=node('div',undefined,'team-visual-heading');
visualHead.append(node('h3','The Season in Numbers'),node('span','2026 · '+t.gp+' matches'));
visual.append(visualHead);
const panels=node('div',undefined,'team-visual-grid');
const formPanel=node('div',undefined,'team-visual-panel');
formPanel.append(node('h4','Season Results'));
const resultVisual=node('div',undefined,'team-results-visual');
const donut=node('div',undefined,'team-results-donut');
const matches=Math.max(0,Number(t.w)+Number(t.d)+Number(t.l));
if(matches){
 const wp=100*Number(t.w)/matches,dp=100*Number(t.d)/matches;
 donut.style.background='conic-gradient(#2d775b 0 '+wp+'%,#d7ae64 '+wp+'% '+(wp+dp)+'%,#ba6257 '+(wp+dp)+'% 100%)';
}else donut.classList.add('team-empty-donut');
const hole=node('div',undefined,'team-donut-hole');
hole.append(node('strong',String(matches)),node('small','MATCHES'));donut.append(hole);
resultVisual.append(donut);
const legend=node('div',undefined,'team-results-legend');
for(const [label,value,k] of [['Wins',t.w,'win'],['Draws',t.d,'draw'],['Losses',t.l,'loss']]){
 const line=node('div',undefined,'team-legend-line');
 line.append(node('span',label,'team-legend-label team-legend-'+k),node('strong',String(value)));
 legend.append(line);
}
resultVisual.append(legend);formPanel.append(resultVisual);
panels.append(formPanel);
const goalsPanel=node('div',undefined,'team-visual-panel');
goalsPanel.append(node('h4','Attack & Defense'));
const maxGoals=Math.max(1,Number(t.gf)||0,Number(t.ga)||0);
for(const [label,value,type] of [['Goals scored',t.gf,'for'],['Goals conceded',t.ga,'against']]){
 const row=node('div',undefined,'team-goal-row');
 const heading=node('div',undefined,'team-goal-row-head');heading.append(node('span',label),node('strong',String(value)));row.append(heading);
 const rail=node('div',undefined,'team-goal-rail'),bar=node('div',undefined,'team-goal-fill team-goal-'+type);
 bar.style.width=(100*Number(value)/maxGoals).toFixed(1)+'%';rail.append(bar);row.append(rail);goalsPanel.append(row);
}
const gd=node('div',undefined,'team-goal-difference');gd.append(node('span','Goal difference'),node('strong',(Number(t.gd)>0?'+':'')+t.gd));goalsPanel.append(gd);
panels.append(goalsPanel);
const ratingPanel=node('div',undefined,'team-visual-panel');
ratingPanel.append(node('h4','Elo League Context'));
const division=rankings.cohorts[t.cohort]||[];
const ratingValues=division.map(team=>Number(team.elo)).filter(Number.isFinite);
const avg=ratingValues.length?ratingValues.reduce((sum,v)=>sum+v,0)/ratingValues.length:0;
const top=ratingValues.length?Math.max(...ratingValues):0;
const ratingList=node('div',undefined,'team-elo-bars');
const scale=Math.max(top,Number(t.elo),1);
for(const [label,value,type] of [['This program',Number(t.elo),'team'],['Division average',avg,'average'],['Division leader',top,'leader']]){
 const row=node('div',undefined,'team-elo-bar-row');const labelRow=node('div',undefined,'team-goal-row-head');
 labelRow.append(node('span',label),node('strong',fmt(value)));row.append(labelRow);
 const rail=node('div',undefined,'team-goal-rail');const bar=node('div',undefined,'team-goal-fill team-elo-'+type);
 bar.style.width=(100*value/scale).toFixed(1)+'%';rail.append(bar);row.append(rail);ratingList.append(row);
}
ratingPanel.append(ratingList);
ratingPanel.append(node('p','Current provisional Elo ratings within this division. Bars share a zero-based scale; not historical change.','team-visual-footnote'));
panels.append(ratingPanel);
visual.append(panels);profile.append(visual);
const conferenceKey=conferenceData.team_to_conference?.[t.cohort+':'+t.team_id];
const conference=conferenceData.conferences?.[conferenceKey];
if(conference){
 const members=(conference.teams||[]).map(id=>byId.get(t.cohort+':'+id)).filter(Boolean).sort((a,b)=>Number(b.elo)-Number(a.elo));
 const ownPos=members.findIndex(a=>a.team_id===t.team_id)+1;
 const conferencePanel=node('section',undefined,'team-conference-desk');conferencePanel.id='team-conference';
 const confHeader=node('div',undefined,'team-conference-head');
 const textHead=node('div');textHead.append(node('small','CONFERENCE COMPARISON · INDEPENDENT USRS'),node('h3',conference.name));
 const confMetric=node('div',undefined,'team-conference-position');
 confMetric.append(node('strong','#'+ownPos),node('small','of '+members.length+' in conference Elo'));
 confHeader.append(textHead,confMetric);conferencePanel.append(confHeader);
 const barChart=node('div',undefined,'team-conference-bars');
 const maxElo=Math.max(1,...members.map(a=>Number(a.elo)));
 for(const member of members){
  const selected=member.team_id===t.team_id;
  const line=node('div',undefined,'team-conference-bar-row'+(selected?' is-current':''));
  const teamLink=node('a',member.team);teamLink.href='college-soccer-team.html?team='+encodeURIComponent(t.cohort+':'+member.team_id);
  const name=node('div',undefined,'team-conference-name');name.append(teamLink);
  if(selected)name.append(node('small','THIS PROGRAM'));
  const graph=node('div',undefined,'team-conference-rail');
  const fill=node('span',undefined,'team-conference-fill');fill.style.width=(100*Number(member.elo)/maxElo).toFixed(1)+'%';graph.append(fill);
  const value=node('strong',fmt(member.elo),'team-conference-elo');
  line.append(name,graph,value);barChart.append(line);
 }
 conferencePanel.append(barChart);
 const stats=node('div',undefined,'team-conference-compare');
 const avg=members.reduce((sum,v)=>sum+Number(v.elo),0)/Math.max(1,members.length);
 const above=members.filter(m=>Number(m.elo)>Number(t.elo)).length;
 for(const [label,value,details] of [
  ['USRS conference rank','#'+ownPos+' / '+members.length,'Current independently calculated Elo order'],
  ['Conference Elo average',fmt(avg),(Number(t.elo)>=avg?'+':'')+fmt(Number(t.elo)-avg)+' Elo versus conference average'],
  ['Conference teams ahead',String(above),'By current Elo, not official league points']
 ]){
  const card=node('div',undefined,'team-conf-stat');card.append(node('span',label),node('strong',value),node('small',details));stats.append(card);
 }
 conferencePanel.append(stats);
 const tableSection=node('div',undefined,'team-official-conference');
 tableSection.append(node('h4','Official MIAA conference standings'));
 const table=node('table',undefined,'team-conference-table');
 const thead=node('thead'),heading=node('tr');
 for(const label of ['School','Conf. W–L–D','Points','USRS Elo'])heading.append(node('th',label));
 thead.append(heading);table.append(thead);
 const tbody=node('tbody');
 const official=(conference.official_conference||[]).slice().sort((a,b)=>Number(b.points)-Number(a.points));
 for(const entry of official){
  const member=byId.get(t.cohort+':'+entry.team_id);if(!member)continue;
  const tr=node('tr');if(member.team_id===t.team_id)tr.className='is-current';
  const first=node('td');const anchor=node('a',member.team);anchor.href='college-soccer-team.html?team='+encodeURIComponent(t.cohort+':'+member.team_id);first.append(anchor);
  tr.append(first,node('td',entry.record),node('td',entry.points),node('td',fmt(member.elo)));tbody.append(tr);
 }
 table.append(tbody);tableSection.append(table);
 const src=node('a','Official conference standings ↗');src.href=conferenceData.source_url;src.target='_blank';src.rel='noopener noreferrer';tableSection.append(src);
 conferencePanel.append(tableSection);
 conferencePanel.append(node('p','Conference records are sourced from the official MIAA standings; Elo, full-season totals and comparisons use our independently maintained rating snapshot. Cutoffs may differ.','team-visual-footnote'));
 profile.append(conferencePanel);
}
const sectionNav=node('nav',undefined,'team-section-nav');
sectionNav.setAttribute('aria-label','Team profile sections');
for(const [href,label] of [['team-conference','Conference'],['team-visual-report','Infographics'],['team-featured','Match Center'],['team-news','News'],['team-season-graphics','Season form'],['team-form','Latest scores'],['team-season','Season'],['team-forecast','Forecasts'],['team-results','Results'],['team-data','Methodology']]){
 const a=node('a',label);a.href='#'+href;sectionNav.append(a);
}
profile.append(sectionNav);
if(t.cohort==='men-d3'&&t.team_id==='trine'){
const official=node('p',undefined,'team-official-links');
const schedule=node('a',"Official 2026 Trine men's soccer schedule & results ↗");
schedule.href='https://trinethunder.com/sports/mens-soccer/schedule/2026';schedule.target='_blank';schedule.rel='noopener noreferrer';
official.append(schedule);profile.append(official);
}
const teamRankings=rankings.cohorts[t.cohort]||[];
const standing=node('div',undefined,'team-elo-standing');
const pct=teamRankings.length>1?Math.max(0,Math.min(100,100*(1-(t.rank-1)/(teamRankings.length-1)))):50;
const standingHeading=node('div',undefined,'team-standing-heading');
standingHeading.append(node('strong','USRS Elo · Division standing'),node('span','#'+t.rank+' of '+teamRankings.length));
standing.append(standingHeading);
const track=node('div',undefined,'team-standing-track');track.setAttribute('role','img');track.setAttribute('aria-label',t.team+' ranks '+t.rank+' of '+teamRankings.length+' in '+cohortName(t.cohort));
const fill=node('div',undefined,'team-standing-fill');fill.style.width=pct.toFixed(2)+'%';track.append(fill);standing.append(track);
standing.append(node('p','The marker reflects divisional rank—not an Elo change or forecast probability. Ratings remain provisional.','team-standing-caption'));
profile.append(standing);
const note=node('p','Ratings and season records come from the published provisional NCAA soccer Elo dataset. Verified finals below are only the incremental official-game ledger, not a complete season schedule.','college-elo-note');profile.append(note);
const key=t.cohort+':'+t.team_id;
const teamForecasts=forecasts.filter(f=>f.cohort===t.cohort&&(f.home_team===t.team_id||f.away_team===t.team_id));
const finalById=new Map(verified.map(f=>[f.match_id,f]));
const upcoming=teamForecasts.filter(f=>!finalById.has(f.match_id)).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));
const keyData=scheduleData.teams?.[key]||gameIndex.teams?.[key]||{games:[]};
const finishedGames=(keyData.games||[]).filter(g=>g.status==='final').slice().sort((a,b)=>b.date.localeCompare(a.date));
const pendingGames=(keyData.games||[]).filter(g=>g.status!=='final').slice().sort((a,b)=>a.date.localeCompare(b.date));
const feature=node('section',undefined,'team-match-feature');feature.id='team-featured';
feature.append(node('h3','Match Center','team-feature-heading'));
const last=finishedGames[0];
const next=pendingGames.find(g=>g.kickoff_utc?Date.parse(g.kickoff_utc)>Date.now():g.date>=new Date().toISOString().slice(0,10));
const prominent=last||next;
if(prominent){
 const eye=node('div',undefined,'team-match-eyebrow');
 eye.append(node('span',last?'LATEST VERIFIED FINAL':'NEXT LISTED FIXTURE'),node('span',fullDate(prominent.date)));feature.append(eye);
 const match=node('div',undefined,'team-match-scorebug');
 const first=node('div',undefined,'team-match-side');
if(brand?.logo_url){const teamLogo=node('img');teamLogo.className='team-match-logo';teamLogo.src=brand.logo_url;teamLogo.alt=t.team+' crest';teamLogo.loading='lazy';teamLogo.addEventListener('error',()=>teamLogo.remove());first.append(teamLogo);}
first.append(node('small',prominent.venue==='home'?'HOME':'AWAY'),node('strong',t.team));
 const nums=node('div',undefined,'team-match-number');nums.append(node('strong',prominent.status==='final'?prominent.goals_for+' : '+prominent.goals_against:'vs'),node('span',prominent.status==='final'?'FINAL · '+(prominent.goals_for>prominent.goals_against?'WIN':prominent.goals_for<prominent.goals_against?'LOSS':'DRAW'):'FIXTURE'));
 const second=node('div',undefined,'team-match-side');second.append(node('small',prominent.venue==='home'?'AWAY':'HOME'),node('strong',prominent.opponent));
 match.append(first,nums,second);feature.append(match);
 if(prominent.source_url){const a=node('a','Official match record ↗');a.href=prominent.source_url;a.target='_blank';a.rel='noopener noreferrer';a.className='team-feature-source';feature.append(a);}
}else feature.append(node('p','Verified game coverage is not yet available for this program.'));
profile.append(feature);
const stories=box('Latest program news');stories.id='team-news';stories.classList.add('team-panel-news');
const curated=scheduleData.teams?.[key];
const indexed=gameIndex.teams?.[key];
const season=curated||indexed;
const scheduleSection=box('2026 Season · Schedule & Results');scheduleSection.id='team-season';scheduleSection.classList.add('team-panel-season');
if(season?.games?.length){
 const official=node('p',curated?'Full season · '+(scheduleData.source_name||'Official college athletics source'):'Partial coverage · Verified NCAA finals and archived pregame forecasts; not the full season','college-elo-note');
 scheduleSection.append(official);
 const table=node('table',undefined,'team-schedule-table');
 const head=node('thead');const heading=node('tr');
 for(const label of ['Date','Match','Score','Result'])heading.append(node('th',label));
 head.append(heading);table.append(head);
 const tbody=node('tbody');
 for(const g of season.games){
   const tr=node('tr');
   tr.append(node('td',fullDate(g.date)));
   tr.append(node('td',(g.venue==='home'?'vs ':'at ')+g.opponent));
   tr.append(node('td',g.status==='final'?g.goals_for+'–'+g.goals_against:'—'));
   tr.append(node('td',g.status==='final'?(g.goals_for>g.goals_against?'W':g.goals_for<g.goals_against?'L':'D'):g.kickoff_utc&&Date.parse(g.kickoff_utc)<Date.now()?'Awaiting final':'Scheduled'));
   if(g.source_url){const link=node('a','Official game ↗');link.href=g.source_url;link.target='_blank';link.rel='noopener noreferrer';tr.children[1].append(' ',link);}
   tbody.append(tr);
 }
 table.append(tbody);scheduleSection.append(table);
 if(curated&&scheduleData.source_url){const citation=node('a','View official season schedule ↗');citation.href=scheduleData.source_url;citation.target='_blank';citation.rel='noopener noreferrer';scheduleSection.append(citation);}
}else{
 scheduleSection.append(node('p','No verified fixtures for this team are currently available in our published game index.'));
}
const pred=box('Locked forecasts · Awaiting official results');pred.id='team-forecast';pred.classList.add('team-panel-forecasts');
if(!upcoming.length)pred.append(node('p','No unmatched locked forecasts for this program in the current archive.'));
for(const f of upcoming.slice(0,20)){
const home=f.home_team===t.team_id,opp=home?f.away_name:f.home_name;
const item=node('div',undefined,'team-game');
const left=node('div');left.append(node('strong',(home?'vs ':'at ')+opp));left.append(node('small',new Date(f.kickoff_utc).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})));
const right=node('div',undefined,'team-game-forecast');
const p=home?f.p_home:f.p_away;
right.append(node('strong',Math.round(p*100)+'% win'));right.append(node('small',Math.round(f.p_draw*100)+'% draw · '+(Date.parse(f.kickoff_utc)<Date.now()?'Awaiting final':'Pregame')));
item.append(left,right);pred.append(item);
}
const games=verified.filter(g=>g.match_id.startsWith(t.cohort.startsWith('women')?'women-':'men-')&&(g.home_team===t.team_id||g.away_team===t.team_id)).sort((a,b)=>b.date.localeCompare(a.date));
const finals=box('Recent verified results');finals.id='team-results';finals.classList.add('team-panel-results');
if(!games.length)finals.append(node('p','No verified recent finals appear in the currently published incremental ledger.'));
for(const g of games.slice(0,30)){
const home=g.home_team===t.team_id,opponent=home?g.away_team:g.home_team;
const gf=home?g.home_goals:g.away_goals,ga=home?g.away_goals:g.home_goals;
const line=node('div',undefined,'team-game');
const left=node('div');left.append(node('strong',(home?'vs ':'at ')+opponent));left.append(node('small',fullDate(g.date)));
const right=node('div',undefined,'team-game-forecast');
const a=node('a',gf+'–'+ga+' '+(gf>ga?'W':gf<ga?'L':'D'));a.href=g.source_game;a.rel='noopener noreferrer';a.target='_blank';right.append(a);
line.append(left,right);finals.append(line);
}
const matched=(newsData.articles||[]).filter(a=>Array.isArray(a.team_keys)&&a.team_keys.includes(key)).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));
const newsInfo=node('p',(newsData.updated_at?'News scan: '+new Date(newsData.updated_at).toLocaleString()+' · ':'')+matched.length+' matched sourced stories','college-elo-note');stories.append(newsInfo);
for(const a of matched.slice(0,12)){
  const article=node('article',undefined,'team-news-story');
  const link=node('a',a.title);link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);
  article.append(node('small',(a.source||'Publisher')+(a.published_at?' · '+new Date(a.published_at).toLocaleDateString():'')+' · External report'));
  if(a.summary)article.append(node('p',a.summary));stories.append(article);
}
if(!matched.length)stories.append(node('p','No confirmed program-specific articles in the current news scan. This page will not substitute unrelated headlines.'));
const newsSearch=node('a','More '+t.team+' '+(t.cohort.startsWith('women')?'women’s':'men’s')+' soccer coverage ↗');
newsSearch.href='https://news.google.com/search?q='+encodeURIComponent('"'+t.team+'" '+(t.cohort.startsWith('women')?'women\'s':'men\'s')+' college soccer');newsSearch.target='_blank';newsSearch.rel='noopener noreferrer';newsSearch.className='team-share';stories.append(newsSearch);
const stat=box('Model & data coverage');stat.id='team-data';stat.classList.add('team-panel-data');
stat.append(node('p',teamForecasts.length+' timestamped forecasts found for this team · '+games.length+' recent verified ledger results. Forecasts are research predictions, not guarantees.'));
stat.append(node('p','An Elo movement chart requires saved date-by-date ratings. The published current rating is not enough to reconstruct that history; no synthetic trend is shown.','college-elo-note'));
const seasonGraphics=box('Season Form · Every Result');
seasonGraphics.id='team-season-graphics';
seasonGraphics.classList.add('team-panel-graphics');
const seasonGames=(season?.games||[]).filter(g=>g.status==='final').slice().sort((a,b)=>a.date.localeCompare(b.date));
if(seasonGames.length){
 const run=node('div',undefined,'team-result-timeline');run.setAttribute('role','list');run.setAttribute('aria-label','Results in chronological order');
 seasonGames.forEach((g,index)=>{
   const result=g.goals_for>g.goals_against?'W':g.goals_for<g.goals_against?'L':'D';
   const tile=node('div',undefined,'team-timeline-match team-timeline-'+result.toLowerCase());
   tile.setAttribute('role','listitem');
   tile.setAttribute('title',fullDate(g.date)+' · '+result+' '+g.goals_for+'–'+g.goals_against+' '+(g.venue==='home'?'vs ':'at ')+g.opponent);
   tile.append(node('span',String(index+1),'team-timeline-number'),node('strong',result));
   run.append(tile);
 });
 seasonGraphics.append(run);
 seasonGraphics.append(node('p','Season progression, oldest to newest. Green = win · Gold = draw · Red = loss. Tap or hover a match for details.','team-visual-footnote'));
 const splits=node('div',undefined,'team-splits');
 for(const [venue,label] of [['home','At Home'],['away','On the Road']]){
  const subset=seasonGames.filter(g=>g.venue===venue);
  const wins=subset.filter(g=>g.goals_for>g.goals_against).length;
  const draws=subset.filter(g=>g.goals_for===g.goals_against).length;
  const losses=subset.length-wins-draws;
  const card=node('div',undefined,'team-split-card');
  card.append(node('span',label,'team-split-title'),node('strong',wins+'–'+losses+'–'+draws,'team-split-record'));
  const stack=node('div',undefined,'team-split-stack');stack.setAttribute('role','img');stack.setAttribute('aria-label',label+': '+wins+' wins, '+draws+' draws, '+losses+' losses');
  for(const [count,type] of [[wins,'win'],[draws,'draw'],[losses,'loss']]){
   if(!count)continue;
   const seg=node('span',undefined,'team-split-segment team-split-'+type);seg.style.width=(100*count/subset.length).toFixed(1)+'%';stack.append(seg);
  }
  card.append(stack);card.append(node('small',subset.length+' verified matches'));
  splits.append(card);
 }
 seasonGraphics.append(splits);
}else seasonGraphics.append(node('p','A season-wide form graphic will appear when a verified game sequence becomes available.'));
const form=box('Latest scorelines');form.id='team-form';form.classList.add('team-panel-form');
const finished=(season?.games||[]).filter(g=>g.status==='final').slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
if(!finished.length)form.append(node('p','Recent verified scorelines will appear as official results arrive.'));
else{
 const strip=node('div',undefined,'team-score-strip');
 for(const g of finished){
  const tile=node('div',undefined,'team-score-tile');
  const result=g.goals_for>g.goals_against?'W':g.goals_for<g.goals_against?'L':'D';
  tile.classList.add('team-score-'+result.toLowerCase());
  tile.append(node('span',fullDate(g.date),'team-score-date'));
  tile.append(node('strong',g.goals_for+' : '+g.goals_against,'team-score-number'));
  tile.append(node('span',result+' · '+(g.venue==='home'?'vs ':'at ')+g.opponent,'team-score-opponent'));
  strip.append(tile);
 }
 form.append(strip);
}
const dashboard=node('div',undefined,'team-dashboard');
const main=node('div',undefined,'team-dashboard-main');
const aside=node('aside',undefined,'team-dashboard-aside');
main.append(form,stories,seasonGraphics,scheduleSection);
aside.append(pred,finals,stat);
dashboard.append(main,aside);
profile.append(dashboard);
const link=node('a','Share team profile ↗');link.href='college-soccer-team.html?team='+encodeURIComponent(key);link.className='team-share';profile.append(link);
if(location.pathname.endsWith('college-soccer-team.html'))document.title=t.team+' Soccer Elo & Scores | The Sporting Life & Times';
history.replaceState(null,'',location.pathname+'?team='+encodeURIComponent(key)+'#college-team-finder');
}
function render(){
const q=search.value.trim().toLocaleLowerCase();results.replaceChildren();if(q.length<2)return;
const matches=teams.filter(t=>t.team.toLocaleLowerCase().includes(q)).sort((a,b)=>a.team.localeCompare(b.team)).slice(0,35);
for(const t of matches){const button=node('button',t.team+' · '+cohortName(t.cohort),'team-search-result');button.type='button';button.addEventListener('click',()=>{search.value=t.team;open(t);});results.append(button);}
if(!matches.length)results.append(node('p','No matching school. Try a shorter school name.'));
}
search.addEventListener('input',render);
results.replaceChildren();
results.setAttribute('aria-label',teams.length+' searchable NCAA soccer programs');
if(search.value.trim().length>=2)render();
else results.append(node('p','Type at least two letters to search '+teams.length.toLocaleString()+' college soccer programs.','college-elo-note'));
const selected=new URLSearchParams(location.search).get('team');
if(selected&&byId.has(selected)){
 const t=byId.get(selected);search.value=t.team;open(t);
}
const resources=await Promise.allSettled([
 fetch('data/college-soccer-elo-final-ledger.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-prospective-v2.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-team-game-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-team-schedules.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-team-news.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-team-branding.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
 fetch('data/college-soccer-conferences.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})
]);
if(resources[0].status==='fulfilled')verified=resources[0].value.results||[];
if(resources[1].status==='fulfilled')forecasts=resources[1].value.forecasts||[];
if(resources[2].status==='fulfilled')gameIndex=resources[2].value;
if(resources[3].status==='fulfilled')scheduleData=resources[3].value;
if(resources[4].status==='fulfilled')newsData=resources[4].value;
if(resources[5].status==='fulfilled')brandData=resources[5].value;
if(resources[6].status==='fulfilled')conferenceData=resources[6].value;
if(search.value.trim().length>=2){
 const current=new URLSearchParams(location.search).get('team');
 if(current&&byId.has(current))open(byId.get(current));
 else render();
}

}catch(err){results.textContent='Team profiles are temporarily unavailable because a required published data feed could not be loaded.';console.error('NCAA soccer team finder',err);}
})();