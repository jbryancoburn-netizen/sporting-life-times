function feedFreshness(value,limitMinutes=45){const stamp=Date.parse(value||'');if(!Number.isFinite(stamp))return ' · UPDATE TIME UNKNOWN';const age=(Date.now()-stamp)/60000;return age>limitMinutes?' · STALE DATA ('+Math.floor(age/60)+'h old)':age< -10?' · CHECK FEED CLOCK':' · RECENT REFRESH'}
function prettyDate(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(d)}
async function loadData(){try{const r=await fetch('data.json');if(!r.ok)throw Error('data.json unavailable');return await r.json()}catch(e){return {teams:[]}}}
const rabbyColors={
'Chicago Bears':'#0b162a','Chicago Cubs':'#0e3386','Tampa Bay Rays':'#092c5c','Tampa Bay Lightning':'#002868','Indiana Pacers':'#002d62','Fort Wayne Komets':'#f26722','Tottenham Hotspur':'#132257','FC Bayern Munich Basketball':'#dc052d','Indiana Hoosiers Football':'#990000',"Indiana Hoosiers Men's Basketball":'#990000',"Indiana Hoosiers Women's Basketball":'#990000','Indiana Hoosiers Baseball':'#990000',"Indiana Hoosiers Men's Soccer":'#990000','South Florida Bulls Football':'#006747',"South Florida Bulls Men's Basketball":'#006747',"South Florida Bulls Women's Basketball":'#006747',"Vermont Catamounts Men's Hockey":'#007155',"Vermont Catamounts Men's Basketball":'#007155','Trine Thunder Football':'#003b71',"Trine Thunder Men's Basketball":'#003b71'};
let rabbyLogos={};
function renderTeams(teams,query=''){const root=document.querySelector('#team-list');if(!root)return;const q=query.trim().toLowerCase();const filtered=teams.filter(t=>(t.name+' '+t.category).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));root.innerHTML=filtered.map(t=>{const color=rabbyColors[t.name]||'#283d32';const logo=rabbyLogos[t.name];return '<article class="team-card rabby-card" style="--team-accent:'+color+'">'+(logo?'<img class="rabby-watermark" src="'+escapeHtml(logo)+'" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.hidden=false"><span class="missing-team-logo" hidden aria-hidden="true">—</span>':'<span class="missing-team-logo" aria-hidden="true">—</span>')+'<p class="meta">THE RABBY 20 · '+escapeHtml(t.category)+'</p><h3><a href="team.html?team='+encodeURIComponent(t.name)+'">'+escapeHtml(t.name)+'</a></h3><a class="team-card-link" href="team.html?team='+encodeURIComponent(t.name)+'">OPEN TEAM DESK →</a></article>'}).join('')||'<p>No matching teams.</p>'}
const permanentRabbyLogos={
'Fort Wayne Komets':'https://logotyp.us/file/komets.svg',
'FC Bayern Munich Basketball':'https://img.fcbayern.com/image/upload/v1659540089/cms/public/images/fcb-basketball/logos/FC_Bayern_Basketball-Logo.svg',
'Trine Thunder Football':'https://dbukjj6eu5tsf.cloudfront.net/sidearm.sites/trine.sidearmsports.com/documents/2025/8/22/PowerT_Blue__2_.png',
"Trine Thunder Men's Basketball":'https://dbukjj6eu5tsf.cloudfront.net/sidearm.sites/trine.sidearmsports.com/documents/2025/8/22/PowerT_Blue__2_.png',
'Chicago Bears':'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
'Chicago Cubs':'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
'Tampa Bay Rays':'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
'Tampa Bay Lightning':'https://a.espncdn.com/i/teamlogos/nhl/500/tb.png',
'Indiana Pacers':'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
'Tottenham Hotspur':'https://a.espncdn.com/i/teamlogos/soccer/500/367.png',
'Indiana Hoosiers Football':'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
"Indiana Hoosiers Men's Basketball":'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
"Indiana Hoosiers Women's Basketball":'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
'Indiana Hoosiers Baseball':'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
"Indiana Hoosiers Men's Soccer":'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
'South Florida Bulls Football':'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
"South Florida Bulls Men's Basketball":'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
"South Florida Bulls Women's Basketball":'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
"Vermont Catamounts Men's Hockey":'https://a.espncdn.com/i/teamlogos/ncaa/500/261.png',
"Vermont Catamounts Men's Basketball":'https://a.espncdn.com/i/teamlogos/ncaa/500/261.png'
};
function loadRabbyLogos(teams){rabbyLogos={...permanentRabbyLogos};renderTeams(teams,document.querySelector('#team-search')?.value||'')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const isPromotion=a=>window.SportingEditorial?.isPromotion(a)??true;
async function init(){const data=await loadData();renderTeams(data.teams||[]);loadRabbyLogos(data.teams||[]);document.querySelector('#team-search')?.addEventListener('input',e=>renderTeams(data.teams||[],e.target.value));const date=document.querySelector('#edition-date');if(date)date.textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();try{const r=await fetch('articles.json');if(!r.ok)throw Error('No feed data');const d=await r.json();const items=(d.articles||[]).filter(a=>!isPromotion(a));const sportOf=a=>{const t=(a.title||'').toLowerCase(),c=(a.category||'').toLowerCase(),src=(a.source||'').toLowerCase();if(c==='baseball'||src==='mlb')return 'Baseball';if(c==='basketball'||src==='nba'||/\\b(nba|wnba|basketball|lakers|celtics|knicks)\\b/.test(t))return 'Basketball';if(c==='hockey'||src==='nhl'||/\\b(nhl|hockey|stanley cup)\\b/.test(t))return 'Hockey';if(/\\b(nfl|football|quarterback|touchdown|super bowl|chiefs|bears|colts)\\b/.test(t))return 'Football';if(/\\b(soccer|premier league|champions league|europa league|man utd|man city|arsenal|chelsea|liverpool|real madrid|barcelona|bayern|ballon d'or|goal-kick|fifa)\\b/.test(t))return 'Soccer';return c==='multi-sport'?'Other sports':(a.category||'Other sports')};
// Editorial front-page selection: substantive stories first, with topic variety.
const newsworthy=a=>/^(https:\/\/)/.test(a.url||'')&&Boolean((a.title||'').trim());
const editorialScore=a=>{
  const summary=(a.summary||'').trim();
  const title=(a.title||'').trim();
  const age=Date.now()-Date.parse(a.published_at||'');
  const freshness=Number.isFinite(age)&&age>=0?Math.max(0,28-age/3600000):0;
  const substance=Math.min(18,summary.length/14);
  const clickbait=/\b(promo|offer|deal|discount|how to watch|streaming guide|where to watch|best picks|prediction odds|betting tips)\b/i.test(title)?-45:0;
  return freshness+substance+(title.length>35&&title.length<125?7:0)+clickbait;
};
const candidates=items.filter(newsworthy).sort((a,b)=>editorialScore(b)-editorialScore(a));
const balanced=[],usedSports=new Set();
for(const a of candidates){
  const sport=sportOf(a);
  if(!usedSports.has(sport)){balanced.push(a);usedSports.add(sport)}
  if(balanced.length===5)break;
}
for(const a of candidates){if(balanced.length>=7)break;if(!balanced.includes(a))balanced.push(a)}
// The full wire remains chronological; the cover is a compact editorial selection.
const rabbyAliases=[
['Chicago Bears',/\b(chicago bears|bears quarterback|bears coach)\b/i],
['Chicago Cubs',/\b(chicago cubs|\bcubs\b|cubs manager|wrigley field)\b/i],
['Tampa Bay Rays',/\b(tampa bay rays|rays baseball|\brays\b)\b/i],
['Tampa Bay Lightning',/\b(tampa bay lightning|lightning hockey|\bbolts\b)\b/i],
['Indiana Pacers',/\b(indiana pacers|pacers basketball|\bpacers\b)\b/i],
['Fort Wayne Komets',/\b(fort wayne komets|komets hockey)\b/i],
['Tottenham Hotspur',/\b(tottenham|spurs soccer|spurs football|hotspur)\b/i],
['FC Bayern Munich Basketball',/\b(bayern basketball|bayern munich basketball)\b/i],
['Indiana Hoosiers',/\b(indiana hoosiers|hoosiers football|hoosiers basketball|hoosiers baseball|hoosiers soccer|indiana football|indiana basketball|iu basketball|iu football)\b/i],
['South Florida Bulls',/\b(south florida bulls|usf bulls|usf football|usf basketball|south florida football|south florida basketball)\b/i],
['Vermont Catamounts',/\b(vermont catamounts|catamounts hockey|catamounts basketball|vermont hockey|vermont basketball|uvm hockey)\b/i],
['Trine Thunder',/\b(trine thunder|trine university football|trine basketball|trine football|trine university basketball)\b/i]
];
const rabbyStories=items.map(a=>({...a,team:rabbyAliases.find(([,pattern])=>pattern.test(a.title||''))?.[0]})).filter(a=>a.team);
const rabbyLead=document.querySelector('#rabby-front-lead'),rabbyBriefs=document.querySelector('#rabby-front-stories');
if(rabbyLead){const a=rabbyStories[0];rabbyLead.hidden=!a;rabbyLead.innerHTML=a?'<p class="meta">'+escapeHtml(a.team)+' · '+escapeHtml(a.source)+'</p><h3><a href="'+escapeHtml(a.url)+'" target="_blank" rel="noopener noreferrer">'+window.SportingNewsFormat.title(a)+'</a></h3><p>'+window.SportingNewsFormat.summary(a)+'</p>':''}
if(rabbyBriefs){rabbyBriefs.hidden=rabbyStories.length<2;rabbyBriefs.innerHTML=rabbyStories.slice(1,9).map(a=>'<article><p class="meta">'+escapeHtml(a.team)+' · '+escapeHtml(a.source)+'</p><h3><a href="'+escapeHtml(a.url)+'" target="_blank" rel="noopener noreferrer">'+window.SportingNewsFormat.title(a)+'</a></h3></article>').join('')}
const lead=balanced[0];if(lead){const h=document.querySelector('#lead-headline'),p=document.querySelector('#lead-summary'),by=document.querySelector('#lead-source'),a=document.querySelector('#lead-link');if(h)h.textContent=window.SportingNewsFormat.clean(lead.title,220);const fig=document.querySelector('#lead-photo'),photo=document.querySelector('#lead-photo-img'),credit=document.querySelector('#lead-photo-credit');if(fig&&photo&&lead.image_url&&/^https:\/\/ichef\.bbci\.co\.uk\/ace\//.test(lead.image_url)){photo.src=lead.image_url;photo.alt='Image supplied with the story by '+(lead.source||'the publisher');if(credit)credit.textContent='IMAGE: '+(lead.source||'Publisher')+' · Original story linked below';fig.hidden=false;photo.onerror=()=>{fig.hidden=true}}if(fig&&!(/^https:\/\/ichef\.bbci\.co\.uk\/ace\//.test(lead.image_url||'')))fig.hidden=true;if(p)p.textContent=window.SportingNewsFormat.clean(lead.summary||'Read the full story from the original publisher.',280);if(by)by.textContent=window.SportingNewsFormat.clean(lead.source||'Publisher',75)+' · '+window.SportingNewsFormat.time(lead.published_at);if(a){a.href=lead.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='READ AT '+(lead.source||'SOURCE').toUpperCase()+' →'}}const briefs=document.querySelector('#front-briefs');if(briefs)briefs.innerHTML=balanced.filter(a=>a!==lead).slice(0,8).map(a=>'<article><p class="meta">'+escapeHtml(sportOf(a))+' · '+escapeHtml(a.source||'Source')+'</p><h3><a href="'+escapeHtml(a.url||'#')+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(a.title||'Story')+'</a></h3>'+(a.summary?'<p class="front-story-excerpt">'+escapeHtml(a.summary)+'</p>':'')+'<a class="front-story-read" href="'+escapeHtml(a.url||'#')+'" target="_blank" rel="noopener noreferrer">Read story →</a></article>').join('');const more=document.querySelector('#front-more-stories');if(more){const remaining=balanced.filter(a=>a!==lead).slice(8,20);more.hidden=!remaining.length;more.innerHTML=remaining.length?'<h3 class="front-more-heading">More from the Sporting Wire</h3>'+remaining.map(a=>'<article><p class="meta">'+escapeHtml(sportOf(a))+' · '+escapeHtml(a.source||'Source')+'</p><h4><a href="'+escapeHtml(a.url||'#')+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(a.title||'Story')+'</a></h4>'+(a.summary?'<p>'+escapeHtml(a.summary)+'</p>':'')+'</article>').join(''):'';} const status=document.querySelector('#news-status');if(status)status.textContent=items.length?('Updated '+(prettyDate(d.updated_at)||'recently')+feedFreshness(d.updated_at)+' · '+items.length+' items'): 'No articles have been collected yet. Run the scheduled feed collector in GitHub Actions.';const root=document.querySelector('#news-list');if(root)root.innerHTML=items.filter(a=>a!==lead).map(a=>'<article class="news-card">'+(a.image_url&&/^https:\/\//.test(a.image_url)?'<img class="news-photo" src="'+escapeHtml(a.image_url)+'" alt="Image supplied by '+escapeHtml(a.source||'publisher')+'" loading="lazy" onerror="this.style.display=\'none\'">':'')+'<p class="meta">'+window.SportingNewsFormat.meta(a)+'</p><h3><a href="'+escapeHtml(a.url||'#')+'" target="_blank" rel="noopener noreferrer">'+window.SportingNewsFormat.title(a)+'</a></h3><p>'+(a.summary?window.SportingNewsFormat.summary(a):'Open the original publisher for details.')+'</p></article>').join('')}catch(e){const status=document.querySelector('#news-status');if(status)status.textContent='News feed has not been refreshed yet. Current headlines will appear after the feed workflow successfully runs.'}}
init();
function easternDay(v){const d=new Date(v);return Number.isNaN(d.getTime())?'DATE NOT PROVIDED':new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}).format(d).toUpperCase()}
function easternTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?'TIME TBD':new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(d)+' ET'}
function gameStamp(g){const n=Date.parse(g.date||'');return Number.isFinite(n)?n:0}
function standingDetails(t,g){const x=t.standings;if(!x||typeof x!=='object')return '';const pre=x.before,post=x.after;const record=v=>v&&Number.isInteger(v.wins)&&Number.isInteger(v.losses)?v.wins+'–'+v.losses+(Number.isInteger(v.ot_losses)?'–'+v.ot_losses:''):'';const rank=v=>v&&Number.isInteger(v.rank)&&v.rank>0?'#'+v.rank:'';const current=g.state==='post'?(post||pre):(pre||post);if(!current)return '';const value=record(current),place=rank(current);const divisionRaw=String(current.division||'').toUpperCase();const divisionMap={'ATLANTIC':'ATL','METROPOLITAN':'MET','CENTRAL':'CEN','PACIFIC':'PAC','A':'ATL','M':'MET','C':'CEN','P':'PAC','AL EAST':'ALE','AL CENTRAL':'ALC','AL WEST':'ALW','NL EAST':'NLE','NL CENTRAL':'NLC','NL WEST':'NLW'};const division=divisionMap[divisionRaw]||(/^(ATL|MET|CEN|PAC|ALE|ALC|ALW|NLE|NLC|NLW)$/.test(divisionRaw)?divisionRaw:'');const displayDivision=g.league==='MLB'?({'ALE':'AL E','ALC':'AL C','ALW':'AL W','NLE':'NL E','NLC':'NL C','NLW':'NL W'}[division]||division):g.league==='NFL'?({'AFC EAST':'AFC E','AFC WEST':'AFC W','AFC NORTH':'AFC N','AFC SOUTH':'AFC S','NFC EAST':'NFC E','NFC WEST':'NFC W','NFC NORTH':'NFC N','NFC SOUTH':'NFC S'}[divisionRaw]||divisionRaw.replace(/^(AFC|NFC) (EAST|WEST|NORTH|SOUTH)$/,(all,c,d)=>c+' '+d[0])):division;if(!value&&!place)return '';let movement='';if(g.state==='post'&&pre&&post&&!pre.season_final&&!post.season_final&&Number.isInteger(pre.rank)&&Number.isInteger(post.rank)){const delta=pre.rank-post.rank;movement=delta>0?'<span class="standing-move up" title="Up '+delta+' division place(s)" aria-label="Up '+delta+' division places">▲'+delta+'</span>':delta<0?'<span class="standing-move down" title="Down '+(-delta)+' division place(s)" aria-label="Down '+(-delta)+' division places">▼'+(-delta)+'</span>':'<span class="standing-move flat" title="No division rank change">—</span>'}return '<small class="team-standing" title="'+(g.state==='post'?'Verified standings snapshot':'Latest verified standings')+'">'+escapeHtml(value)+(place?' · '+(displayDivision?escapeHtml(displayDivision)+' ':'')+escapeHtml(place):'')+(movement?' '+movement:'')+'</small>'}
function teamRows(g){
 const teams=g.teams||[];
 const numeric=teams.map(t=>Number(t.score));
 const hasScores=g.state!=='pre'&&teams.length===2&&teams.every(t=>t.score!==null&&t.score!==undefined&&t.score!==''&&Number.isFinite(Number(t.score)));
 const maxScore=hasScores?Math.max(...numeric):null;
 return teams.map(t=>{
  const logo=t.logo&&/^https:\/\//.test(t.logo)?'<img class="team-logo'+(g.league==='NHL'?' team-logo-nhl':'')+'" src="'+escapeHtml(t.logo)+'" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">':'';
  const rank=Number.isInteger(t.national_rank)&&t.national_rank>=1&&t.national_rank<=25?'<span class="college-rank" aria-label="National rank '+t.national_rank+'">#'+t.national_rank+'</span> ':'';
  const leading=hasScores&&Number(t.score)===maxScore&&numeric[0]!==numeric[1];
  const score=g.state==='pre'?'':(t.score??'');
  return '<div class="register-team'+(leading?' register-team-leading':'')+'"><span class="team-with-logo">'+logo+rank+escapeHtml(t.name)+'</span><strong class="register-score">'+escapeHtml(score)+'</strong>'+standingDetails(t,g)+'</div>';
 }).join('')
}
function registerGames(games){let last='';return games.map(g=>{
 const day=easternDay(g.date);
 const heading=day!==last?'<div class="register-date">'+escapeHtml(day)+'</div>':'';
 last=day;
 const status=g.state==='post'?'FINAL':g.state==='in'?g.status:easternTime(g.date);
 const url=g.url||g.source_url||'';
 return heading+'<article class="register-game" data-game-id="'+escapeHtml(g.id||'')+'" data-game-date="'+escapeHtml((g.date||'').slice(0,10))+'"><div class="register-sport"><span>'+escapeHtml(g.league)+'</span><strong>'+escapeHtml(status)+'</strong></div>'+teamRows(g)+(g.venue?'<div class="register-venue">'+escapeHtml(g.venue)+'</div>':'')+(g.broadcast?'<div class="register-broadcast">'+escapeHtml(g.broadcast)+'</div>':'')+'<div class="register-game-links">'+(g.id?'<a class="match-center-open" href="match-center.html?league='+encodeURIComponent(g.league)+'&game='+encodeURIComponent(g.id)+'">MATCH CENTER ↗</a>':'')+( /^https:\/\//.test(url)?'<a class="register-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>':'')+'</div></article>'
}).join('')}
function registerSection(title,games){return '<section class="register-section"><div class="register-heading"><h3>'+title+'</h3><span>'+games.length+' GAMES</span></div><div class="register-columns">'+registerGames(games)+'</div></section>'}
async function loadScoreboards(){const status=document.querySelector('#scores-status'),root=document.querySelector('#scoreboard-list');if(!root)return;try{const r=await fetch('scoreboards.json?ts='+Math.floor(Date.now()/240000));if(!r.ok)throw Error('Scoreboard unavailable');let d=await r.json();let mergedLoaded=false;try{const m=await fetch('multi_scoreboards.json?ts='+Math.floor(Date.now()/240000));if(m.ok){const merged=await m.json();if(merged.schema_version===2&&Array.isArray(merged.leagues)&&merged.summary){d=merged;mergedLoaded=true;const conflictCount=merged.summary?.conflicts||0;if(conflictCount)console.warn('Scoreboard conflicts quarantined:',conflictCount)}}}catch(_e){}if(!mergedLoaded){try{const o=await fetch('official_scoreboards.json?ts='+Math.floor(Date.now()/240000));if(o.ok){const official=await o.json();for(const block of official.leagues||[]){if(block.games?.length){d.leagues=(d.leagues||[]).filter(l=>l.league!==block.league);d.leagues.push(block)}}if((official.leagues||[]).some(l=>l.games?.length))d.source='ESPN + official MLB/NHL feeds'}}catch(_e){}}const leagueBlocks=(d.leagues||[]).map(l=>{const seen=new Set();const unique=(l.games||[]).filter(g=>{const names=(g.teams||[]).map(t=>String(t.name||'').toLowerCase()).sort().join('|');const key=[l.league,String(g.date||'').slice(0,10),names,String(g.id||'')].join('::');if(seen.has(key))return false;seen.add(key);return true});return {...l,games:unique}});d.leagues=leagueBlocks;const leagues=leagueBlocks.filter(l=>l.games?.length);const games=leagues.flatMap(l=>l.games.map(g=>({...g,league:l.league,source_url:l.source_url})));const featuredRules=[
['NFL',['Chicago Bears']],['MLB',['Chicago Cubs','Tampa Bay Rays']],['NHL',['Tampa Bay Lightning']],['NBA',['Indiana Pacers']],['ECHL',['Fort Wayne Komets']],['Premier League',['Tottenham Hotspur','Tottenham']],['Champions League',['Tottenham Hotspur','Tottenham']],['Europa League',['Tottenham Hotspur','Tottenham']],['EuroLeague',['Bayern Munich','FC Bayern']],['College Football',['Indiana Hoosiers','South Florida Bulls','Trine Thunder']],["Men's College Basketball",['Indiana Hoosiers','South Florida Bulls','Vermont Catamounts','Trine Thunder']],["Women's College Basketball",['Indiana Hoosiers','South Florida Bulls']],['College Baseball',['Indiana Hoosiers']],["NCAA Men's Soccer",['Indiana Hoosiers']],["NCAA Men's Hockey",['Vermont Catamounts']]];
const mine=games.filter(g=>featuredRules.some(([league,names])=>league===g.league&&(g.teams||[]).some(t=>names.some(n=>t.name.toLowerCase()===n.toLowerCase()||t.name.toLowerCase().includes(n.toLowerCase())))));const sorted=arr=>arr.sort((a,b)=>gameStamp(a)-gameStamp(b));const completed=arr=>arr.sort((a,b)=>gameStamp(b)-gameStamp(a));const sections=arr=>{const live=arr.filter(g=>g.state==='in'),final=arr.filter(g=>g.state==='post'),future=arr.filter(g=>g.state!=='in'&&g.state!=='post');return (live.length?registerSection('LIVE GAMES',sorted(live)):'')+(final.length?registerSection('FINAL RESULTS',completed(final)):'')+(future.length?registerSection('UPCOMING FIXTURES',sorted(future)):'')};const desk=document.querySelector('#team-desk-games'),deskStatus=document.querySelector('#team-desk-status');if(desk){desk.innerHTML=mine.length?'<div class="register-mast"><span>SPORTING LIFE & TIMES / PERSONAL SPORTS DESK</span><h3>THE RABBY 20</h3><p>Final results · Live scores · Upcoming fixtures</p></div>'+sections(mine):'<p>No Rabby 20 matchups found in the current feeds. Specialist team sources are still needed.</p>'}if(deskStatus)deskStatus.textContent=mine.length?mine.length+' verified featured matchups · Updated '+prettyDate(d.updated_at):'Current feeds do not cover every Rabby 20 program.';if(status)status.textContent='Source: '+(d.source||'ESPN')+' · Updated '+prettyDate(d.updated_at)+feedFreshness(d.updated_at)+' · '+leagues.length+' leagues with reported games · Other leagues may be out of season or lack feed coverage';const departmentGroups=[
['Professional Basketball',['NBA','EuroLeague','Australian NBL']],
['Professional Football',['NFL','CFL']],
['Professional Hockey',['NHL','ECHL']],
['College Football',['College Football']],
['College Basketball',["Men's College Basketball","Women's College Basketball"]],
['Other College Sports',['College Baseball',"NCAA Men's Soccer","NCAA Men's Hockey",'College Softball','College Volleyball']],
['Baseball',['MLB']],
['Soccer',['Premier League','Champions League','Europa League']]
];
const byLeague=new Map((d.leagues||[]).map(l=>[l.league,l]));
root.innerHTML='<p class="scoreboard-edition-note">THE DAILY REGISTER · VERIFIED RESULTS & FIXTURES · ALL TIMES EASTERN</p>'+departmentGroups.map(([department,names])=>{
const available=names.map(name=>byLeague.get(name)).filter(Boolean);
if(!available.length)return '';
return '<section class="scoreboard-department"><h3 class="scoreboard-department-title">'+escapeHtml(department)+'</h3>'+available.map(l=>{
const rows=(l.games||[]).map(g=>({...g,league:l.league,source_url:l.source_url}));
return '<div class="league-register" data-score-league="'+escapeHtml(l.league)+'"><div class="league-register-title"><h4>'+escapeHtml(l.league)+'</h4><span>'+rows.length+' GAMES</span></div>'+(rows.length?sections(rows):'<p class="register-empty">No verified games returned for this league and date range'+(l.error?' · Source unavailable':'')+'.</p>')+'</div>'
}).join('')+'</section>'
}).join('')}catch(e){if(status)status.textContent='Scoreboard data unavailable; no scores have been fabricated.'}}
loadScoreboards();
// Re-read the published scoreboard while the page remains open; GitHub Pages
// publishes snapshots, so this does not imply second-by-second live tracking.
setInterval(()=>{if(!document.hidden)loadScoreboards()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadScoreboards()});

async function loadCollegeDesk(){
 const root=document.querySelector('#college-schedules-list'),status=document.querySelector('#college-schedules-status');if(!root)return;
 try{
  const response=await fetch('college_schedules.json?ts='+Math.floor(Date.now()/240000));if(!response.ok)throw Error('Not published yet');
  const data=await response.json();const today=new Date().toISOString().slice(0,10);
  let sections='',count=0;
  for(const team of data.teams||[]){
   const all=(team.games||[]).filter(g=>g.date&&g.teams?.length===2);
   const recent=all.filter(g=>g.date<=today).slice(-3),upcoming=all.filter(g=>g.date>today).slice(0,4);
   const selected=[...recent,...upcoming];if(!selected.length)continue;count+=selected.length;
   const games=selected.map(g=>{
    const opponent=g.teams[1],us=g.teams[0],date=new Date(g.date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
    const score=g.state==='post'&&us.score!=null&&opponent.score!=null?'FINAL · '+escapeHtml(us.score)+'–'+escapeHtml(opponent.score):'SCHEDULED · TIME UNVERIFIED';
    return '<article class="register-game"><div class="register-sport"><span>'+escapeHtml(date)+'</span><strong>'+score+'</strong></div><div class="register-team">'+escapeHtml(us.name)+' vs '+escapeHtml(opponent.name)+'</div><a class="register-link" href="'+escapeHtml(g.url)+'" target="_blank" rel="noopener noreferrer">OFFICIAL SCHOOL SCHEDULE ↗</a></article>';
   }).join('');
   sections+='<section class="register-section"><div class="register-heading"><h3>'+escapeHtml(team.team)+'</h3><span>'+selected.length+' GAMES</span></div><div class="register-columns">'+games+'</div></section>';
  }
  root.innerHTML=sections||'<p>School schedules are not yet available in a verified format.</p>';
  if(status)status.textContent=count+' school-sourced schedule entries · '+(data.updated_at||'').slice(0,10)+' · Dates shown without unverified kickoff times';
 }catch(e){if(status)status.textContent='Official college schedules have not been collected yet.'}
}
loadCollegeDesk();
