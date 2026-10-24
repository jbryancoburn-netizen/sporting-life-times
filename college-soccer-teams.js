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




const box=(heading)=>{const section=node('section',undefined,'team-panel');section.append(node('h3',heading));profile.append(section);return section;};
function open(t){
profile.replaceChildren();results.replaceChildren();
const header=node('div',undefined,'team-hero');
header.append(node('p',cohortName(t.cohort)+' · '+String(rankings.as_of||'Latest published edition'),'team-eyebrow'));
const badge=node('span',t.team.split(/\\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(),'team-monogram');
const identity=node('div',undefined,'team-identity');
identity.append(badge);
const identityText=node('div');identityText.append(node('h2',t.team),node('p','2026 NCAA SOCCER · PROGRAM REPORT','team-identity-caption'));
identity.append(identityText);header.append(identity);
const actions=node('div',undefined,'team-hero-actions');
const share=node('a','Share program page ↗','team-hero-link');share.href='college-soccer-team.html?team='+encodeURIComponent(t.cohort+':'+t.team_id);
actions.append(share);header.append(actions);profile.append(header);
const metrics=node('div',undefined,'team-metrics');
for(const [label,value] of [['Elo',fmt(t.elo)],['Division rank','#'+t.rank],['Record',t.record],['Goals for / against',t.gf+' / '+t.ga],['Goal differential',(t.gd>0?'+':'')+t.gd]]){const metric=node('div',undefined,'team-metric');metric.append(node('span',label),node('strong',value));metrics.append(metric);}
metrics.firstElementChild.classList.add('team-metric-lead');
profile.append(metrics);
const sectionNav=node('nav',undefined,'team-section-nav');
sectionNav.setAttribute('aria-label','Team profile sections');
for(const [href,label] of [['team-news','News'],['team-form','Latest scores'],['team-season','Season'],['team-forecast','Forecasts'],['team-results','Results'],['team-data','Methodology']]){
 const a=node('a',label);a.href='#'+href;sectionNav.append(a);
}
profile.append(sectionNav);
if(t.cohort==='men-d3'&&t.team_id==='trine'){
const official=node('p',undefined,'team-official-links');
const schedule=node('a',"Official 2026 Trine men's soccer schedule & results ↗");
schedule.href='https://trinethunder.com/sports/mens-soccer/schedule/2026';schedule.target='_blank';schedule.rel='noopener noreferrer';
official.append(schedule);profile.append(official);
}
const note=node('p','Ratings and season records come from the published provisional NCAA soccer Elo dataset. Verified finals below are only the incremental official-game ledger, not a complete season schedule.','college-elo-note');profile.append(note);
const key=t.cohort+':'+t.team_id;
const teamForecasts=forecasts.filter(f=>f.cohort===t.cohort&&(f.home_team===t.team_id||f.away_team===t.team_id));
const finalById=new Map(verified.map(f=>[f.match_id,f]));
const upcoming=teamForecasts.filter(f=>!finalById.has(f.match_id)).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));
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
main.append(form,stories,scheduleSection);
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
 fetch('data/college-soccer-team-news.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})
]);
if(resources[0].status==='fulfilled')verified=resources[0].value.results||[];
if(resources[1].status==='fulfilled')forecasts=resources[1].value.forecasts||[];
if(resources[2].status==='fulfilled')gameIndex=resources[2].value;
if(resources[3].status==='fulfilled')scheduleData=resources[3].value;
if(resources[4].status==='fulfilled')newsData=resources[4].value;
if(search.value.trim().length>=2){
 const current=new URLSearchParams(location.search).get('team');
 if(current&&byId.has(current))open(byId.get(current));
 else render();
}

}catch(err){results.textContent='Team profiles are temporarily unavailable because a required published data feed could not be loaded.';console.error('NCAA soccer team finder',err);}
})();