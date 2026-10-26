
/* The NBA Newspaper. One data layer shared by every NBA edition page.
 * The college-basketball template owns the typography/grid; NBA owns its data and logic.
 */
(async()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?esc(u.href):''}catch{return ''}};
const fmt=(n,d=0)=>Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const date=s=>{let d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date unavailable'};
const nyday=s=>{let d=new Date(s);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):''};
const load=async path=>{try{let r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});return r.ok?await r.json():null}catch{return null}};
const meta={
ATL:['Atlanta Hawks','East','Southeast','#e03a3e'],BOS:['Boston Celtics','East','Atlantic','#007a33'],BKN:['Brooklyn Nets','East','Atlantic','#333333'],
CHA:['Charlotte Hornets','East','Southeast','#1d1160'],CHI:['Chicago Bulls','East','Central','#ce1141'],CLE:['Cleveland Cavaliers','East','Central','#860038'],
DAL:['Dallas Mavericks','West','Southwest','#00538c'],DEN:['Denver Nuggets','West','Northwest','#0e2240'],DET:['Detroit Pistons','East','Central','#c8102e'],
GSW:['Golden State Warriors','West','Pacific','#1d428a'],HOU:['Houston Rockets','West','Southwest','#ce1141'],IND:['Indiana Pacers','East','Central','#002d62'],
LAC:['LA Clippers','West','Pacific','#c8102e'],LAL:['Los Angeles Lakers','West','Pacific','#552583'],MEM:['Memphis Grizzlies','West','Southwest','#5d76a9'],
MIA:['Miami Heat','East','Southeast','#98002e'],MIL:['Milwaukee Bucks','East','Central','#00471b'],MIN:['Minnesota Timberwolves','West','Northwest','#0c2340'],
NOP:['New Orleans Pelicans','West','Southwest','#0c2340'],NYK:['New York Knicks','East','Atlantic','#006bb6'],OKC:['Oklahoma City Thunder','West','Northwest','#007ac1'],
ORL:['Orlando Magic','East','Southeast','#0077c0'],PHI:['Philadelphia 76ers','East','Atlantic','#006bb6'],PHX:['Phoenix Suns','West','Pacific','#1d1160'],
POR:['Portland Trail Blazers','West','Northwest','#e03a3e'],SAC:['Sacramento Kings','West','Pacific','#5a2d81'],SAS:['San Antonio Spurs','West','Southwest','#343a40'],
TOR:['Toronto Raptors','East','Atlantic','#ce1141'],UTA:['Utah Jazz','West','Northwest','#002b5c'],WAS:['Washington Wizards','East','Southeast','#002b5c']
};
const codes=Object.keys(meta),aliases={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'};
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+(aliases[t]||String(t||'').toLowerCase())+'.png';
const name=t=>meta[t]?.[0]||t,tl=t=>'nba-team-desk.html?team='+encodeURIComponent(t);
const team=t=>'<a class="team-link" href="'+tl(t)+'"><img loading="lazy" alt="" src="'+logo(t)+'" onerror="this.hidden=true"><span>'+esc(name(t))+'</span></a>';
const image=t=>'<img loading="lazy" alt="" src="'+logo(t)+'" onerror="this.hidden=true">';
const section=(k,h,path,label)=>'<div class="panel-head"><div><div class="eyebrow">'+k+'</div><h2>'+h+'</h2></div>'+(path?'<a href="'+path+'">'+(label||'Explore →')+'</a>':'')+'</div>';
const blank=t=>'<div class="nba-empty">'+esc(t)+'</div>';
let data={},rates={},seed={},prior={},records={},ordered=[],lastState='',filter='',playerFilter='';
const gets=[['current','data/nba-2026-27-current-provisional.json'],['pre','data/nba-2026-27-preseason-provisional.json'],['old','data/nba-2025-26-final.json'],['schedule','data/nba-upcoming-schedule.json'],['archive','data/nba-game-center.json'],['leaders','data/nba-player-leaders.json'],['news','data/nba-top-stories.json'],['wire','data/nba-roster-wire-snapshot.json']];
async function fetchAll(){let result=await Promise.all(gets.map(async x=>[x[0],await load(x[1])]));
 data=Object.fromEntries(result);
 rates=Object.fromEntries((data.current?.rankings||[]).filter(x=>meta[x.team]&&Number.isFinite(x.elo)).map(x=>[x.team,x.elo]));
 seed=Object.fromEntries((data.pre?.rankings||[]).map(x=>[x.team,x.elo]));
 prior=Object.fromEntries((data.old?.rankings||[]).map(x=>[x.team,x.elo]));
 records=Object.fromEntries(codes.map(t=>[t,{w:0,l:0,pf:0,pa:0}]));
 const seen=new Set();
 (data.current?.events||[]).forEach(g=>{if(!meta[g.home]||!meta[g.away]||!Number.isFinite(+g.home_score)||!Number.isFinite(+g.away_score)||seen.has(g.id))return;
 seen.add(g.id);let h=records[g.home],a=records[g.away];h.pf+=+g.home_score;h.pa+=+g.away_score;a.pf+=+g.away_score;a.pa+=+g.home_score;if(+g.home_score>+g.away_score){h.w++;a.l++}else if(+g.away_score>+g.home_score){a.w++;h.l++}});
 ordered=codes.filter(t=>Number.isFinite(rates[t])).sort((a,b)=>rates[b]-rates[a]||name(a).localeCompare(name(b)));
}
const rank=t=>ordered.indexOf(t)+1,rec=t=>records[t].w+'–'+records[t].l;
const stand=(conference)=>codes.filter(t=>meta[t][1]===conference).sort((a,b)=>{
 let x=records[a],y=records[b],px=(x.w+x.l)?x.w/(x.w+x.l):0,py=(y.w+y.l)?y.w/(y.w+y.l):0;
 return py-px||y.w-x.w||((rates[b]||0)-(rates[a]||0))||name(a).localeCompare(name(b));});
function stamp(){if(!$('#data-stamp'))return;
 const captured=data.archive?.games?.length||0;$('#data-stamp').innerHTML='<span class="pulse"></span>'+esc(data.current?.games_played??'—')+' scored finals · '+captured+' archived box scores · Feed '+date(data.schedule?.updated_at);
 $('#access-stamp').textContent='Viewed '+date(new Date().toISOString());}
function card(g){
 const ts=g.teams||[],a=ts.find(t=>t.home_away==='away')||ts[0],h=ts.find(t=>t.home_away==='home')||ts[1];if(!a||!h||!meta[a.code]||!meta[h.code])return '';
 const state=g.state==='post'?'FINAL':g.state==='in'?'LIVE':date(g.date),gameId=g.id;
 const dest=g.state==='post'?'nba-game-center.html?game='+encodeURIComponent(gameId):'nba-live-game.html?game='+encodeURIComponent(gameId);
 const side=t=>'<div class="score-team">'+image(t.code)+'<span>'+esc(name(t.code))+'</span><strong>'+(g.state==='pre'?'<em>'+rec(t.code)+'</em>':esc(t.score??'—'))+'</strong></div>';
 return '<div class="score-card '+(g.state==='in'?'is-live':'')+'"><small>'+esc(state)+'</small><a href="'+dest+'">'+side(a)+side(h)+'</a><a class="score-link" href="'+dest+'">'+(g.state==='post'?'Box score & game analysis':'Live matchup & game center')+' ↗</a></div>';
}
function gamesFor(days=1,limit=12){const games=[...(data.schedule?.games||[])];
 // Deduplicate by source event ID, never create extra score cards from overlapping feeds.
 const dedup=new Map();games.forEach(g=>{if(!g.id)return;const old=dedup.get(g.id);if(!old||(['post','in'].includes(g.state)&&old.state==='pre'))dedup.set(g.id,g)});
 return [...dedup.values()].filter(g=>g.teams?.length>=2&&meta[g.teams[0]?.code]&&meta[g.teams[1]?.code]).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,300);
}
function liveRail(){
 const today=nyday(new Date()),games=gamesFor();let todayGames=games.filter(g=>nyday(g.date)===today).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 if(todayGames.length)return todayGames.slice(0,12).map(card).join('');
 const finals=games.filter(g=>g.state==='post').sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const upcoming=games.filter(g=>g.state==='pre'&&Date.parse(g.date)>Date.now());
 return (upcoming.slice(0,6).length?upcoming.slice(0,6):finals.slice(0,6)).map(card).join('')||blank('No current games in the published schedule feed.');}
function stories(t){
 const items=(data.news?.articles||[]).filter(a=>a.title&&href(a.url)&&!/(sportsbook|parlay|odds boost|bonus bet|promo code|sports betting|betting picks|best bets|player props)/i.test([a.title,a.summary,a.url].join(' ')));
 const today=Date.now(),seen=new Set();let filtered=items.filter(a=>{if(seen.has(a.url))return false;seen.add(a.url);return true})
 .sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0));
 if(t){const full=name(t).toLowerCase(),short=full.split(' ').at(-1),city=full.substring(0,full.lastIndexOf(' '));filtered=filtered.filter(a=>{let s=(a.title+' '+(a.summary||'')).toLowerCase();return s.includes(full)||s.includes(short)||(city.length>7&&s.includes(city));});}
 return filtered.slice(0,t?12:12).map((a,i)=>'<article class="nba-story '+(i===0?'lead':'')+'"><div class="byline">'+esc(a.source||'NBA desk')+' · '+date(a.published_at)+'</div><h3><a target="_blank" rel="noopener noreferrer" href="'+href(a.url)+'">'+esc(a.title)+'</a></h3>'+(a.summary?'<p>'+esc(a.summary).slice(0,i?210:325)+'</p>':'')+'</article>').join('')||blank('No verified attributed stories are available for this selection.');
}
function rankRows(list){return list.map(t=>'<div class="rank-row"><span class="rank">'+rank(t)+'</span>'+team(t)+'<span class="rank-score">'+fmt(rates[t],1)+'<small>'+rec(t)+' · '+esc(meta[t][1])+'</small></span></div>').join('')}
function leaders(stat,count=4){
 let items=(data.leaders?.rows||[]).filter(x=>x.stat===stat&&Number.isFinite(x.value)).sort((a,b)=>b.value-a.value).slice(0,count);
 return items.map((x,i)=>'<div class="nba-leader"><div><small>'+esc(stat.toUpperCase())+' · '+esc(x.gp)+' captured games</small><b>'+esc(x.player)+'</b><small>'+team(x.team)+'</small></div><div style="text-align:right"><strong>'+fmt(x.value,1)+'</strong></div></div>').join('')||blank('Captured-game leader data unavailable.');}
const searchLinks=()=>'<div class="nba-section-links"><a href="nba-standings.html">Standings</a><a href="nba-rankings.html">USRS Elo</a><a href="nba-players.html">Player Leaders</a><a href="nba-playoffs.html">Playoff Picture</a><a href="nba-matchups.html">Matchup Lab</a><a href="nba-game-center.html">Game Center</a></div>';
function directory(){
 let entries=codes.filter(t=>name(t).toLowerCase().includes(filter)||t.toLowerCase().includes(filter)).sort((a,b)=>name(a).localeCompare(name(b)));
 return '<div id="teams">'+section('All 30 franchises','Find Your Team')+'<div class="nba-filters"><label for="nba-team-search">Search team or city</label><input id="nba-team-search" type="search" placeholder="e.g. Indiana, Celtics, Nuggets" value="'+esc(filter)+'" autocomplete="off"><small class="muted">'+entries.length+' teams</small></div><div id="nba-team-results" class="nba-team-grid">'+entries.map(t=>'<a href="'+tl(t)+'" class="nba-team-tile" style="--team-color:'+meta[t][3]+'">'+image(t)+'<b>'+esc(name(t))+'</b><small>'+rec(t)+' · #'+rank(t)+' Elo</small></a>').join('')+'</div></div>';
}
function stats(){
 const played=(data.current?.events||[]).length;
 return '<div class="metrics"><div class="metric"><b>30</b><span>Franchise desks</span></div><div class="metric"><b>'+esc(played)+'</b><span>2026–27 verified games</span></div><div class="metric"><b>'+(data.leaders?.coverage?.unique_players||'—')+'</b><span>Players in captured box scores</span></div><div class="metric"><b>'+(data.archive?.games?.length||0)+'</b><span>Detailed game archives</span></div></div>';}
function home(){
 const top=ordered.slice(0,4);
 const hero='<section class="hero"><div><div class="eyebrow">2026–27 · The NBA Edition</div><h1>THE LEAGUE<br>NEVER STOPS.</h1><p>Thirty clubs. An independent Elo power table. The news moving the league, live scores, playoff races, box scores and player performances—all in one NBA newspaper.</p><a class="cta" href="nba-rankings.html">Explore NBA Power Rankings ↗</a></div><div class="hero-art">'+top.map(t=>'<div class="hero-team">'+image(t)+'<strong>'+fmt(rates[t],0)+'</strong><small>'+esc(t)+' · #'+rank(t)+'</small></div>').join('')+'</div></section>';
 const rail='<section class="panel"><div class="nba-ticker">'+section('The scoreboard','Tonight & Latest Finals','nba-matchups.html','Every matchup →')+'</div><div class="nba-score-rail" id="nba-score-rail">'+liveRail()+'</div></section>';
 const cols='<div class="grid"><div class="column"><section class="panel orange">'+section('The News Desk','Around the Association')+stories()+'</section><section class="panel">'+section('Every City, Every Team','30 Team Desks','nba-team-desk.html?team=IND','Open a team →')+'<p class="note">Club stories, season records, recent games, player production and independent ratings.</p></section></div><div class="column"><section class="panel teal">'+section('USRS · Independent Ratings','NBA Power 10','nba-rankings.html','Full rankings →')+rankRows(ordered.slice(0,10))+'</section><section class="panel">'+section('Individual Performers','Scoring Leaders','nba-players.html','All categories →')+leaders('ppg',5)+'<p class="note">Captured box-score sample—not necessarily the entire NBA season.</p></section></div><div class="column"><section class="panel">'+section('Postseason Radar','East · West','nba-playoffs.html','Playoff picture →')+['East','West'].map(c=>'<div class="nba-section-band">'+c+'</div>'+stand(c).slice(0,5).map((t,i)=>'<div class="rank-row"><span class="rank">'+(i+1)+'</span>'+team(t)+'<span class="rank-score">'+rec(t)+'<small>#'+rank(t)+' Elo</small></span></div>').join('')).join('')+'<p class="note">Early-season ordering based on verified W–L, with Elo breaking equal records; not official NBA tiebreakers.</p></section><section class="panel teal">'+section('Game Intelligence','Tonight’s Matchups','nba-matchups.html','Forecast lab →')+'<div class="nba-static-cover"><div class="nba-kicker">The Rabby + USRS Desk</div><h3>Every game has a story before tipoff.</h3><p class="note">Elo-based win chances, both rosters, recent results and a direct route to our detailed game analysis.</p><a class="nba-tag" href="nba-matchups.html">Open Matchups ↗</a></div></section></div></div>';
 return hero+stats()+rail+cols+directory();}
function table(headers,rows){return '<div class="nba-table-wrap"><table class="nba-table"><thead><tr>'+headers.map(h=>'<th class="'+(h[1]||'')+'">'+h[0]+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';}
function standingRows(list){return list.map((t,i)=>{let r=records[t],pct=r.w+r.l?r.w/(r.w+r.l):0;return '<tr><td class="num">'+(i+1)+'</td><td>'+team(t)+'</td><td class="num">'+r.w+'</td><td class="num">'+r.l+'</td><td class="num">'+fmt(pct,3)+'</td><td class="num">'+rank(t)+'</td><td class="num">'+fmt(rates[t],1)+'</td></tr>';});}
const standingHeads=[['#','num'],['Club'],['W','num'],['L','num'],['PCT','num'],['Elo #','num'],['USRS Elo','num']];
function standings(){
 const blocs=['East','West'].map(c=>'<section class="panel">'+section('Standings desk',c+'ern Conference','nba-conference.html?conference='+c,'Conference desk →')+table(standingHeads,standingRows(stand(c)))+'</section>').join('');
 const divs=['Atlantic','Central','Southeast','Northwest','Pacific','Southwest'].map(d=>'<div class="nba-division-card"><h3>'+d+'</h3>'+table([['Club'],['W–L','num'],['Elo','num']],codes.filter(t=>meta[t][2]===d).sort((a,b)=>stand(meta[a][1]).indexOf(a)-stand(meta[b][1]).indexOf(b)).map(t=>'<tr><td>'+team(t)+'</td><td class="num">'+rec(t)+'</td><td class="num">'+fmt(rates[t],0)+'</td></tr>'))+'</div>').join('');
 return '<div class="eyebrow">2026–27 · NBA</div><h1>STANDINGS DESK</h1><p class="nba-note">Win–loss records are reconstructed from the independent verified-finals ledger. Equal-record ordering here uses Elo, not the NBA’s full official multi-team tiebreaker procedure.</p><div class="nba-mini-grid">'+blocs+'</div><h2>Six Divisions</h2><div class="nba-mini-grid">'+divs+'</div>'+directory();}
function rankings(){
 const rows=ordered.map((t,i)=>'<tr><td class="num">'+(i+1)+'</td><td>'+team(t)+'</td><td>'+esc(meta[t][1])+'</td><td class="num">'+rec(t)+'</td><td class="num"><strong>'+fmt(rates[t],2)+'</strong></td><td class="num">'+fmt(seed[t],2)+'</td><td class="num">'+(Number.isFinite(seed[t])?'<span style="color:'+(rates[t]-seed[t]>=0?'#147b62':'#bb5331')+'">'+(rates[t]-seed[t]>=0?'+':'')+fmt(rates[t]-seed[t],2)+'</span>':'—')+'</td><td class="num">'+fmt(prior[t],2)+'</td></tr>');
 return '<div class="eyebrow">USRS · Independent basketball ratings</div><h1>NBA POWER RANKINGS</h1><p class="nba-note">Current ratings update from verified finals. The preseason and 2025–26 end-of-season baselines remain separate comparisons; they are not overwritten by live results.</p>'+stats()+table([['#','num'],['Team'],['Conf.'],['W–L','num'],['Current Elo','num'],['Opening Elo','num'],['Change','num'],['2025–26 Final','num']],rows)+'<p class="note">Traditional Elo incorporates prior-season strength and completed game outcomes; roster-adjusted estimates are separate and must not be presented as verified without sourced coverage.</p>';}
function playoff(){
 const list=['East','West'].map(c=>'<div class="nba-projection"><div class="eyebrow">2026–27 · '+c+'ern Conference</div><h3>Current Projected Seeds</h3><div class="nba-seeds">'+stand(c).map((t,i)=>'<a href="'+tl(t)+'" class="nba-seed"><span class="seed">'+(i+1)+'</span>'+image(t)+'<span><b>'+esc(name(t))+'</b><small>'+rec(t)+' · Elo #'+rank(t)+' · '+(i<6?'Top-six position':i<10?'Play-in position':'Outside current top ten')+'</small></span></a>').join('')+'</div></div>').join('');
 return '<div class="eyebrow">The Road to the NBA Playoffs</div><h1>PLAYOFF PICTURE</h1><p class="nba-note">Projected order from the current reconstructed conference records, with independent Elo used to separate ties. Play-in positions are seeds 7–10, direct positions 1–6. These are early projections—not official seeds, schedules, or qualified teams.</p>'+list+'<div class="panel">'+section('How It Works','Conference Race & Play-In')+'<div class="nba-mini-grid"><div class="nba-static-cover"><div class="nba-kicker">Seeds 1–6</div><h3>Direct playoff places</h3><p>Each conference’s six highest seeds advance directly under the current NBA postseason format.</p></div><div class="nba-static-cover"><div class="nba-kicker">Seeds 7–10</div><h3>Play-In Tournament</h3><p>7 hosts 8 for the seventh seed; 9 hosts 10 in an elimination game. The 7–8 loser plays the 9–10 winner for eighth.</p></div></div></div>';}
function players(){
 const cats=[['Scoring','ppg','PPG'],['Rebounds','rpg','RPG'],['Assists','apg','APG'],['Steals','spg','SPG'],['Blocks','bpg','BPG'],['FG Percentage','fg_pct','FG%'],['3PT Percentage','fg3_pct','3PT%'],['Free Throws','ft_pct','FT%']];
 const panels=cats.map(([heading,stat,label])=>'<section class="panel"><h2>'+heading+'</h2>'+table([['Player'],['Team'],['GP','num'],[label,'num']],(data.leaders?.rows||[]).filter(x=>x.stat===stat&&Number.isFinite(x.value)).sort((a,b)=>b.value-a.value).slice(0,10).map(x=>'<tr><td>'+esc(x.player)+'</td><td>'+team(x.team)+'</td><td class="num">'+esc(x.gp)+'</td><td class="num"><strong>'+fmt(x.value,1)+'</strong></td></tr>'))+'</section>').join('');
 let totals=(data.leaders?.season_totals||[]).filter(p=>(p.player+' '+p.team).toLowerCase().includes(playerFilter)).sort((a,b)=>b.ppg-a.ppg).slice(0,70);
 return '<div class="eyebrow">Individual achievement · 2026–27</div><h1>PLAYER LEADERS</h1><p class="nba-note">'+esc(data.leaders?.coverage?.completed_boxscores??0)+' captured completed box scores · '+esc(data.leaders?.coverage?.unique_players??0)+' unique player records. These statistics cover captured games only, not necessarily the complete league schedule.</p><div class="nba-mini-grid">'+panels+'</div><section class="panel">'+section('Player Reference','Search the Statistical Notebook')+'<div class="nba-filters"><label for="nba-player-search">Player or franchise</label><input id="nba-player-search" type="search" placeholder="Search player or team" value="'+esc(playerFilter)+'"></div><div id="nba-player-results">'+table([['Player'],['Team'],['GP','num'],['PTS/G','num'],['REB/G','num'],['AST/G','num'],['FG%','num'],['TS%','num']],totals.map(x=>'<tr><td>'+esc(x.player)+'</td><td>'+team(x.team)+'</td><td class="num">'+x.gp+'</td><td class="num">'+fmt(x.ppg,1)+'</td><td class="num">'+fmt(x.rpg,1)+'</td><td class="num">'+fmt(x.apg,1)+'</td><td class="num">'+fmt(x.fg_pct,1)+'</td><td class="num">'+fmt(x.ts_pct,1)+'</td></tr>'))+'</div><p class="note">Showing '+totals.length+' captured player records. Search to narrow the notebook.</p></section>';}
function matchupCard(g){
 const a=g.teams?.find(t=>t.home_away==='away'),h=g.teams?.find(t=>t.home_away==='home');
 if(!a||!h||!meta[a.code]||!meta[h.code])return '';
 const p=Number.isFinite(rates[h.code])&&Number.isFinite(rates[a.code])?1/(1+Math.pow(10,-(rates[h.code]+45-rates[a.code])/400)):null;
 const isPre=g.state==='pre',v=isPre?'<div class="nba-prob"><span style="width:'+Math.round((1-p)*100)+'%"></span></div><div class="nba-game-meta"><span>'+esc(a.code)+' '+fmt(100*(1-p),0)+'%</span><b>Elo win probability</b><span>'+esc(h.code)+' '+fmt(100*p,0)+'%</span></div>':'<p class="note">'+esc(g.status||'Result')+' · '+esc(a.score)+'–'+esc(h.score)+'</p>';
 return '<div class="nba-game-card"><div class="nba-game-meta"><span>'+date(g.date)+' ET</span><span>'+esc(g.status||g.state)+'</span></div><div class="nba-versus"><div>'+image(a.code)+'<b>'+esc(a.code)+'</b><small>'+rec(a.code)+'</small></div><div class="vs">AT</div><div>'+image(h.code)+'<b>'+esc(h.code)+'</b><small>'+rec(h.code)+'</small></div></div>'+(p!==null?v:'<p class="note">Published current ratings unavailable for probability.</p>')+'<div class="nba-section-links"><a href="nba-live-game.html?game='+encodeURIComponent(g.id)+'">Live Game Center ↗</a><a href="'+(isPre?'nba-matchups.html':'nba-game-center.html?game='+encodeURIComponent(g.id))+'">'+(isPre?'Matchup overview':'Full box score')+' ↗</a></div></div>';
}
function matchups(){
 const games=gamesFor(),upcoming=games.filter(g=>g.state==='pre'&&Date.parse(g.date)>Date.now()).slice(0,24);
 const recently=games.filter(g=>g.state==='post').sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,8);
 return '<div class="eyebrow">Forecast Desk · Independent Elo</div><h1>NBA MATCHUP LAB</h1><p class="nba-note">Pregame Elo probabilities use current published team ratings and a 45-point home advantage. They are an independent rating comparison, not a possession-based score projection. Do not recompute pregame forecasts for games already underway.</p><h2>Upcoming Games</h2><div class="nba-mini-grid">'+(upcoming.map(matchupCard).join('')||blank('No upcoming games available in the published schedule feed.'))+'</div><h2>Recent Finals & Box Scores</h2><div class="nba-mini-grid">'+(recently.map(matchupCard).join('')||blank('No recorded finals in the current schedule window.'))+'</div>';}
function teamDesk(){
 const params=new URLSearchParams(location.search),code=params.get('team')?.toUpperCase();const t=meta[code]?code:'IND';
 const recent=(data.archive?.games||[]).filter(g=>g.teams?.some(x=>x.code===t)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,9);
 const future=gamesFor().filter(g=>g.state==='pre'&&g.teams?.some(x=>x.code===t)).slice(0,7);
 const best=(data.leaders?.season_totals||[]).filter(x=>x.team===t).sort((a,b)=>b.ppg-a.ppg).slice(0,8);
 const article=stories(t),conf=meta[t][1],pct=records[t].w+records[t].l?records[t].w/(records[t].w+records[t].l):0;
 document.title=name(t)+' | The Sporting Life & Times';
 return '<div class="nba-team-identity" style="--team-color:'+meta[t][3]+'">'+image(t)+'<div><div class="eyebrow">'+esc(conf)+'ern Conference · '+esc(meta[t][2])+' Division</div><h1>'+esc(name(t))+'</h1><p>'+rec(t)+' · Independent Elo #'+rank(t)+' · '+fmt(rates[t],1)+' Elo</p><div class="nba-filters"><label for="nba-team-select">Switch team </label><select id="nba-team-select">'+codes.slice().sort((a,b)=>name(a).localeCompare(name(b))).map(x=>'<option value="'+x+'" '+(x===t?'selected':'')+'>'+esc(name(x))+'</option>').join('')+'</select></div></div></div>'+
 '<div class="metrics"><div class="metric"><b>'+rec(t)+'</b><span>Verified record</span></div><div class="metric"><b>#'+rank(t)+'</b><span>USRS Elo rank</span></div><div class="metric"><b>'+fmt(rates[t],0)+'</b><span>Current Elo</span></div><div class="metric"><b>'+fmt(pct*100,1)+'%</b><span>Win percentage</span></div></div>'+
 '<div class="grid"><div class="column"><section class="panel orange">'+section('Franchise Reporting','The Latest '+esc(name(t))+' Stories')+article+'</section></div><div class="column"><section class="panel teal">'+section('Team Results','Recent Final Scores','nba-game-center.html','All box scores →')+(recent.length?recent.map(g=>{const a=g.teams.find(x=>x.home_away==='away'),h=g.teams.find(x=>x.home_away==='home');return '<div class="nba-brand">'+image(a.code)+'<div><b><a href="nba-game-center.html?game='+encodeURIComponent(g.id)+'">'+esc(a.code)+' '+esc(a.score)+' at '+esc(h.code)+' '+esc(h.score)+'</a></b><small>'+date(g.date)+' · Complete player box score ↗</small></div>'+image(h.code)+'</div>'}).join(''):blank('No verified archived games.'))+'</section><section class="panel">'+section('On the Calendar','Upcoming Games')+(future.map(card).join('')||blank('No upcoming games in the current schedule window.'))+'</section></div><div class="column"><section class="panel">'+section('Player Notebook','Captured Season Leaders','nba-players.html','Player archive →')+(best.map(p=>'<div class="nba-leader"><div><b>'+esc(p.player)+'</b><small>'+p.gp+' games · '+fmt(p.rpg,1)+' REB · '+fmt(p.apg,1)+' AST</small></div><strong>'+fmt(p.ppg,1)+'</strong></div>').join('')||blank('Player totals not yet captured.'))+'</section><section class="panel">'+section('Season Trajectory','Elo Then & Now')+'<div class="nba-brand"><div><b>2025–26 final</b><small>'+fmt(prior[t],1)+'</small></div></div><div class="nba-brand"><div><b>2026–27 opening</b><small>'+fmt(seed[t],1)+'</small></div></div><div class="nba-brand"><div><b>Current Elo</b><small>'+fmt(rates[t],1)+'</small></div></div></section></div></div>'+searchLinks();
}
function conference(){
 const params=new URLSearchParams(location.search);const c=params.get('conference')==='West'?'West':'East';const all=stand(c);
 const divs=[...new Set(all.map(t=>meta[t][2]))];
 return '<div class="eyebrow">2026–27 · NBA Conference Desk</div><h1>'+c.toUpperCase()+'ERN CONFERENCE</h1><p class="nba-note">Every club’s record, Elo power position, division race and path into the projected top ten. Ties are ordered here by Elo, not official NBA tiebreakers.</p><div class="nba-mini-grid">'+['East','West'].map(x=>'<a class="nba-static-cover" href="nba-conference.html?conference='+x+'"><h3>'+x+'ern Conference →</h3></a>').join('')+'</div><section class="panel">'+section('Conference Standings','The '+c+' · All 15')+table(standingHeads,standingRows(all))+'</section><h2>Division Desks</h2><div class="nba-mini-grid">'+divs.map(d=>'<div class="nba-division-card"><h3>'+esc(d)+'</h3>'+rankRows(all.filter(t=>meta[t][2]===d))+'</div>').join('')+'</div><section class="panel teal">'+section('Postseason Outlook','Current Top Ten','nba-playoffs.html','Playoff projections →')+rankRows(all.slice(0,10))+'</section>'+directory();}
const page=document.body.dataset.page;
function render(){stamp();const app=$('#app');if(!app)return;
 let html=page==='home'?home():page==='standings'?standings():page==='rankings'?rankings():page==='playoffs'?playoff():page==='players'?players():page==='matchups'?matchups():page==='team'?teamDesk():page==='conference'?conference():home();
 app.innerHTML=html;
 const nav=$('.nav');if(nav){[...nav.querySelectorAll('a')].forEach(a=>{a.removeAttribute('aria-current');if(new URL(a.href).pathname===location.pathname&&!(page==='home'&&a.hash))a.setAttribute('aria-current','page')});}
}
await fetchAll();
if(ordered.length!==30){$('#app').innerHTML='<div class="nba-empty">The published 30-team ratings could not be loaded. Refresh the NBA desk when the data feed is available. <a href="nba-game-center.html">Existing Game Center →</a></div>';return;}
render();
document.addEventListener('input',e=>{
 if(e.target.id==='nba-team-search'){filter=e.target.value.trim().toLowerCase();const el=$('#nba-team-results');if(el){const entries=codes.filter(t=>name(t).toLowerCase().includes(filter)||t.toLowerCase().includes(filter)).sort((a,b)=>name(a).localeCompare(name(b)));el.innerHTML=entries.map(t=>'<a href="'+tl(t)+'" class="nba-team-tile" style="--team-color:'+meta[t][3]+'">'+image(t)+'<b>'+esc(name(t))+'</b><small>'+rec(t)+' · #'+rank(t)+' Elo</small></a>').join('')||blank('No teams match your search.');}}
 if(e.target.id==='nba-player-search'){playerFilter=e.target.value.trim().toLowerCase();const el=$('#nba-player-results');if(el){let tot=(data.leaders?.season_totals||[]).filter(p=>(p.player+' '+p.team).toLowerCase().includes(playerFilter)).sort((a,b)=>b.ppg-a.ppg).slice(0,70);el.innerHTML=table([['Player'],['Team'],['GP','num'],['PTS/G','num'],['REB/G','num'],['AST/G','num'],['FG%','num'],['TS%','num']],tot.map(x=>'<tr><td>'+esc(x.player)+'</td><td>'+team(x.team)+'</td><td class="num">'+x.gp+'</td><td class="num">'+fmt(x.ppg,1)+'</td><td class="num">'+fmt(x.rpg,1)+'</td><td class="num">'+fmt(x.apg,1)+'</td><td class="num">'+fmt(x.fg_pct,1)+'</td><td class="num">'+fmt(x.ts_pct,1)+'</td></tr>'))}}
});
document.addEventListener('change',e=>{if(e.target.id==='nba-team-select')location.href=tl(e.target.value);});
setInterval(async()=>{
 if(document.hidden)return;
 try{const old=data,prev=JSON.stringify({r:data.current?.games_played,s:data.schedule?.updated_at,n:data.news?.updated_at,p:data.leaders?.updated_at});
 await fetchAll();
 const next=JSON.stringify({r:data.current?.games_played,s:data.schedule?.updated_at,n:data.news?.updated_at,p:data.leaders?.updated_at});
 if(prev!==next&&ordered.length===30){const pos=window.scrollY;render();window.scrollTo(0,pos);}else stamp();
 }catch(err){console.warn('NBA refresh skipped:',err);}
},60000);
})();
