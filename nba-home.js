(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const east=new Set(['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS']);
const aliases={'LA Clippers':'LAC','Los Angeles Clippers':'LAC','New York Knicks':'NYK','Golden State Warriors':'GSW','New Orleans Pelicans':'NOP','San Antonio Spurs':'SAS','Portland Trail Blazers':'POR','Philadelphia 76ers':'PHI','Utah Jazz':'UTA','Washington Wizards':'WAS'};
const code=n=>aliases[n]||Object.keys(names).find(k=>names[k]===n)||null;
const fetchJSON=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
const msg=(id,t)=>{if($(id))$(id).textContent=t};
const unavailable=(id,message)=>{if($(id))$(id).innerHTML='<p class="hub-small">'+esc(message)+'</p>'};
const date=s=>{const n=Date.parse(s);return Number.isFinite(n)?new Date(n).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unverified'};
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no'}[t]||t.toLowerCase())+'.png';
const newsLogos=a=>{
 const text=(String(a.title||'')+' '+String(a.summary||'')).toLowerCase();
 const found=Object.entries(names).filter(([t,name])=>text.includes(name.toLowerCase())||(t==='LAC'&&text.includes('la clippers'))).map(([t])=>t).slice(0,2);
 return '<span class="nba-story-logos">'+(found.length?found.map(t=>'<img loading="lazy" alt="'+esc(names[t])+'" title="'+esc(names[t])+'" src="'+logo(t)+'" onerror="this.hidden=true">').join(''):'<img class="nba-story-logo nba-story-nba" loading="lazy" src="https://commons.wikimedia.org/wiki/Special:FilePath/National_Basketball_Association_logo_2017-present.svg" alt="NBA" title="NBA league-wide story" onerror="this.hidden=true">')+'</span>';
};
async function news(){
 const grid=$('nba-news-grid');if(!grid)return;
 try{
  let payload;
  try{payload=await fetchJSON('data/nba-top-stories.json')}
  catch(err){payload=await fetchJSON('articles.json')}
  const editorial=a=>!/(?:betmgm|draftkings|fanduel|caesars sportsbook|bet365|sportsbook|bonus (?:bet|code|offer)|promo code|promotional code|free bet|bonus bets?|best bets?|player props?|same.game parlay|parlay|odds boost|betting picks?|wager|risk.free|sports betting|fantasy basketball|pick(?:s)? against the spread|world series|brewers|rays)/i.test([a.title,a.summary,a.url].join(' '));
  let items=(payload.articles||[]).filter(a=>String(a.category||'').toUpperCase()==='NBA'||String(a.url||'').includes('/nba/')).filter(a=>String(a.url||'').startsWith('https://')&&a.title&&editorial(a)).slice(0,60);
  const ranked=items.map((a,index)=>({a,index,weight:(/^(?:NBA.com|Reuters|ESPN NBA|CBS Sports NBA)$/i.test(a.source||'')?2:0)+( /\\b(?:76ers|Thunder|NBA|LeBron|Knicks|Celtics|trade|injur|season|comeback)\\b/i.test(a.title||'')?1:0)})).sort((x,y)=>y.weight-x.weight||x.index-y.index);
  items=ranked.map(x=>x.a).slice(0,36);
  if(!items.length&&payload!==null){const fallback=await fetchJSON('articles.json');items=(fallback.articles||[]).filter(a=>String(a.category||'').toUpperCase()==='NBA'&&editorial(a)).slice(0,60)}
  if(!items.length)throw Error('No attributed NBA headlines');
  const format=window.SportingNewsFormat;
  const newsItem=(a,i)=>'<article class="nba-news-item'+(i===0?' nba-news-lead':'')+'"><p class="nba-news-source">'+newsLogos(a)+(format?.meta?format.meta(a):esc(a.source||'NBA NEWS')+' · '+esc((a.published_at||'').slice(0,10)))+'</p><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+(format?.title?format.title(a):esc(a.title))+'</a></h3>'+(a.summary?'<p class="nba-news-summary">'+(format?.summary?format.summary(a):esc(a.summary))+'</p>':'')+'</article>';
  const featured=items.slice(0,11),more=items.slice(11);
  grid.innerHTML=featured.map(newsItem).join('')+(more.length?'<details class="nba-more-stories"><summary>MORE NBA HEADLINES · '+more.length+' ADDITIONAL STORIES</summary><div class="nba-more-list">'+more.map((a,i)=>newsItem(a,i+featured.length)).join('')+'</div></details>':'');
  msg('nba-news-status',items.length+' attributed NBA stories · '+(payload.updated_at||'Dated reporting')+' · Original sources linked');
 }catch(err){msg('nba-news-status','NBA top stories feed unavailable');unavailable('nba-news-grid','NBA reporting temporarily unavailable. <a href="https://www.nba.com/news" target="_blank" rel="noopener noreferrer">NBA.com News ↗</a>')}
}
async function desk(){
 try{
 const [elo,gameCenter]=await Promise.all([
  fetchJSON('data/nba-2026-27-current-provisional.json'),
  fetchJSON('data/nba-game-center.json')
 ]);
 let schedule;
 try{schedule=await fetchJSON('data/nba-upcoming-schedule.json')}
 catch(e){
  // Never display a static previous-day schedule as current. The archive and
  // independent Elo ledger still work when the upcoming feed is unavailable.
  schedule={games:[],source:'Upcoming schedule temporarily unavailable'};
 }
 const archiveGames=(gameCenter.games||[]).filter(g=>g.state==='post');
 const gameById=new Map(archiveGames.map(g=>[g.id,g]));
 for(const g of schedule.games||[]){
  if(!g?.id||!g.date)continue;
  const previous=gameById.get(g.id);
  if(previous?.state==='post')continue;
  if(g.state==='pre'&&Date.parse(g.date)<Date.now()-15*60*1000)continue;
  gameById.set(g.id,g);
 }
 const games=[...gameById.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const block={provider:'Verified ESPN game boxes and dated NBA schedule'};
 const ratings=Object.fromEntries((elo.rankings||[]).map(r=>[r.team,r.elo]));
 if(Object.keys(ratings).length!==30)throw Error('Incomplete current-season Elo');
 const snapshot=elo.movement;
 const verifiedSnapshot=snapshot&&/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of_eastern_date||'')&&
  Object.keys(snapshot.daily_change||{}).length===30&&Object.keys(snapshot.last_week_elo||{}).length===30;
 const movement=verifiedSnapshot?{available:true,day:snapshot.as_of_eastern_date,weekDate:snapshot.last_week_eastern_date,
  daily:snapshot.daily_change,lastWeek:snapshot.last_week_elo}:
  (window.NBAEloMovement?.compute(elo)||{available:false,reason:'Published daily Elo movement unavailable'});
 const dailyMarkup=n=>{
  if(!Number.isFinite(n))return 'N/A';
  if(n>.0005)return '<span class="nba-elo-positive">▲ +'+n.toFixed(3)+'</span>';
  if(n<-.0005)return '<span class="nba-elo-negative">▼ '+n.toFixed(3)+'</span>';
  return '<span class="nba-elo-flat">—</span>';
 };
 const daily=t=>movement.available?dailyMarkup(movement.daily[t]):'N/A';
 const records=Object.fromEntries(Object.keys(names).map(t=>[t,{w:0,l:0}]));
 const ledger=(elo.events||[]).filter(g=>Number.isFinite(g.home_score)&&Number.isFinite(g.away_score));
 for(const g of ledger){if(!records[g.home]||!records[g.away])continue;const winner=g.home_score>g.away_score?g.home:g.away,loser=winner===g.home?g.away:g.home;records[winner].w++;records[loser].l++}

 const analyses=ledger.slice(-8).reverse().map(g=>{
  const away=g.away,home=g.home,homeWon=g.home_score>g.away_score;
  const winner=homeWon?home:away;
  const margin=Math.abs(g.home_score-g.away_score),total=g.home_score+g.away_score;
  const stamp=g.date&&Number.isFinite(Date.parse(g.date))?date(g.date):'Date unavailable';
  const panel=(t,score,won)=>'<div class="nba-analysis-team'+(won?' is-winner':'')+'"><img src="'+logo(t)+'" alt="" loading="lazy" onerror="this.hidden=true"><span class="nba-analysis-team-label"><b>'+esc(t)+'</b><small>'+esc(names[t])+'</small></span><strong>'+score+'</strong></div>';
  return '<article class="nba-analysis-brief"><p class="nba-news-source">FINAL · '+esc(stamp)+'</p><div class="nba-analysis-match">'+panel(away,g.away_score,!homeWon)+'<span class="nba-analysis-vs">–</span>'+panel(home,g.home_score,homeWon)+'</div><div class="nba-analysis-facts"><span>Margin <b>'+margin+'</b></span><span>Total <b>'+total+'</b></span><span>Winner Elo <b>'+ratings[winner].toFixed(1)+'</b></span></div></article>';
 }).join('');
 if($('nba-game-analysis-grid'))$('nba-game-analysis-grid').innerHTML=analyses||'<p class="hub-small">No completed NBA finals verified in the published season ledger.</p>';
 msg('nba-game-analysis-status',Math.min(8,ledger.length)+' results · Original calculations from published final scores · Not syndicated news');
 const teamRows=Object.fromEntries(Object.keys(names).map(t=>[t,{team:t,gp:0,pf:0,pa:0}]));
 for(const g of ledger){
  if(!teamRows[g.home]||!teamRows[g.away])continue;
  for(const [t,pts,opp] of [[g.home,g.home_score,g.away_score],[g.away,g.away_score,g.home_score]]){
   const row=teamRows[t];row.gp++;row.pf+=pts;row.pa+=opp;
  }
 }
 const leaders=Object.values(teamRows).filter(t=>t.gp>0);
 const top=(key,desc=true)=>[...leaders].sort((a,b)=>(desc?b[key]/b.gp-a[key]/a.gp:a[key]/a.gp-b[key]/b.gp)||a.team.localeCompare(b.team)).slice(0,5);
 const leaderRows=(title,arr,key)=>'<div class="nba-early-leader"><h3>'+title+'</h3><table class="nba-mini-table"><thead><tr><th>Team</th><th>GP</th><th>Avg</th></tr></thead><tbody>'+arr.map(t=>'<tr><th>'+esc(t.team)+'</th><td>'+t.gp+'</td><td>'+(t[key]/t.gp).toFixed(1)+'</td></tr>').join('')+'</tbody></table></div>';
 if($('nba-captured-leaders'))$('nba-captured-leaders').innerHTML='<div class="nba-early-leader-grid">'+leaderRows('Points per game',top('pf'),'pf')+leaderRows('Fewest allowed / game',top('pa',false),'pa')+'</div>';
 msg('nba-captured-leaders-status',ledger.length+' captured final games · Small, uneven team samples · Not official full-season NBA leaders');
 const finals=games.filter(g=>g.state==='post'||/final/i.test(g.status||''));
 const ledgerKeys=new Set(ledger.map(g=>[g.home,g.away,g.home_score,g.away_score].join('|')));
 const pending=finals.filter(g=>{const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away');const hc=code(h?.name),ac=code(a?.name);return hc&&ac&&Number.isFinite(Number(h?.score))&&Number.isFinite(Number(a?.score))&&!ledgerKeys.has([hc,ac,Number(h.score),Number(a.score)].join('|'))});
 const syncLabel=pending.length?' · '+pending.length+' final game(s) awaiting Elo/standings synchronization':' · Verified Elo ledger aligned with available finals';

 const divisions=[
 ['ATLANTIC',['BOS','BKN','NYK','PHI','TOR']],
 ['CENTRAL',['CHI','CLE','DET','IND','MIL']],
 ['SOUTHEAST',['ATL','CHA','MIA','ORL','WAS']],
 ['NORTHWEST',['DEN','MIN','OKC','POR','UTA']],
 ['PACIFIC',['GSW','LAC','LAL','PHX','SAC']],
 ['SOUTHWEST',['DAL','HOU','MEM','NOP','SAS']]
 ];
 const division=(label,keys)=>{const arr=[...keys].sort((a,b)=>{const x=records[a],y=records[b];return y.w-x.w||x.l-y.l||ratings[b]-ratings[a]});return '<section class="nba-division"><h3>'+label+'</h3><table class="nba-mini-table"><thead><tr><th>#</th><th>Club</th><th>W</th><th>L</th><th>PCT</th><th>Elo</th><th>Daily Δ</th></tr></thead><tbody>'+arr.map((t,i)=>{const r=records[t];return '<tr><td>'+(i+1)+'</td><th><abbr title="'+esc(names[t])+'">'+esc(t)+'</abbr></th><td>'+r.w+'</td><td>'+r.l+'</td><td>'+(r.w+r.l?(r.w/(r.w+r.l)).toFixed(3):'—')+'</td><td>'+ratings[t].toFixed(0)+'</td><td>'+daily(t)+'</td></tr>'}).join('')+'</tbody></table></section>'};
 $('nba-conference-standings').innerHTML='<p class="hub-small">'+(pending.length?'<strong>UPDATE PENDING: '+pending.length+' reported finals are not yet reflected in W–L or Elo.</strong> ':'')+'Six NBA divisions · Provisional records from '+ledger.length+' verified completed games in the Elo ledger. <strong>Not full official season standings.</strong> Elo is independent of W–L. <a href="https://www.nba.com/standings">Official NBA standings ↗</a></p><div class="nba-divisions">'+divisions.map(([label,keys])=>division(label,keys)).join('')+'</div>';
 const results=ledger.slice(-16).reverse().map(g=>{
  const h=g.home,a=g.away,homeWon=g.home_score>g.away_score;
  const delta=Number(g.home_elo_change),stamp=g.date&&Number.isFinite(Date.parse(g.date))?date(g.date):'Date unavailable';
  const bug=window.SLTScorebug.render({mode:'final',subtitle:stamp,away:{code:a,name:names[a],logo:logo(a)},home:{code:h,name:names[h],logo:logo(h)},awayScore:g.away_score,homeScore:g.home_score,winner:homeWon?h:a});
  const movement=Number.isFinite(delta)?'<div><span>'+esc(a)+' Elo '+(-delta>=0?'+':'')+(-delta).toFixed(2)+'</span><span>'+esc(h)+' Elo '+(delta>=0?'+':'')+delta.toFixed(2)+'</span></div>':'';
  return '<details class="nba-scorebug"><summary>'+bug+'<span class="slt-scorebug-expand">Game details ▾</span></summary><div class="nba-scorebug-details">'+movement+'<p>Independent Elo: '+esc(a)+' '+ratings[a].toFixed(1)+' · '+esc(h)+' '+ratings[h].toFixed(1)+'</p></div></details>';
 }).join('');
 if($('nba-results-rail'))$('nba-results-rail').innerHTML=results||'<p class="hub-small">No verified finals in the published NBA Elo ledger.</p>';
 msg('nba-results-status',ledger.length+' verified final games · Latest 16 shown · Expand a game for Elo and result detail.');
 if($('nba-news-status').textContent==='NBA headlines unavailable')msg('nba-news-status','NBA reporting feed pending · Verified finals available in the Results Desk at right');

 msg('nba-standings-status','Results updated through the latest verified Elo ledger · '+ledger.length+' completed games · '+(movement.available?'Daily Elo changes: '+movement.day+' Eastern':'Daily Elo movement unavailable')+syncLabel);

 const easternDay=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
 const dated=ledger.filter(g=>g.date&&Number.isFinite(Date.parse(g.date)));
 const days=[...new Set(dated.map(g=>easternDay(g.date)))].sort().reverse();
 const lastDay=days[0];
 const nowET=easternDay(Date.now());
 const lastNight=new Date(Date.now()-24*3600*1000);
 const yesterdayET=easternDay(lastNight);
 const yesterdayGames=dated.filter(g=>easternDay(g.date)===yesterdayET);
 const snapshotFinals=finals.filter(g=>g.date&&Number.isFinite(Date.parse(g.date)));const snapshotDays=[...new Set(snapshotFinals.map(g=>easternDay(g.date)))].sort().reverse();const fallbackDay=snapshotDays[0];const snapshotGames=snapshotFinals.filter(g=>easternDay(g.date)===yesterdayET);const selectedSnapshot=snapshotGames.length?snapshotGames:snapshotFinals.filter(g=>easternDay(g.date)===fallbackDay);const useLedger=dated.length>0;const recentGames=useLedger?(yesterdayGames.length?yesterdayGames:dated.filter(g=>easternDay(g.date)===lastDay)):selectedSnapshot;
 $('nba-yesterday-scores').innerHTML=recentGames.length?'<div class="nba-lastnight-grid">'+recentGames.map(g=>{const a=useLedger?{name:g.away,score:g.away_score}:g.teams?.find(t=>t.home_away==='away');const h=useLedger?{name:g.home,score:g.home_score}:g.teams?.find(t=>t.home_away==='home');return '<div class="nba-lastnight-row"><span>'+esc(code(a?.name)||a?.name||'Away')+'</span><strong>'+esc(a?.score??'—')+'–'+esc(h?.score??'—')+'</strong><span>'+esc(code(h?.name)||h?.name||'Home')+'</span></div>'}).join('')+'</div>':'<p class="hub-small">No dated verified final scores in the Elo ledger.</p>';
 msg('nba-yesterday-status',useLedger?(yesterdayGames.length?'Previous Eastern calendar day · '+yesterdayET+' · '+yesterdayGames.length+' verified finals':lastDay?'No verified finals for '+yesterdayET+' · Latest dated ledger: '+lastDay:'No dated ledger events available'):(snapshotGames.length?'Previous Eastern calendar day · '+yesterdayET+' · Scoreboard snapshot':fallbackDay?'Latest scoreboard snapshot: '+fallbackDay+' · Full-season dated ledger not yet published':'No dated final scores available'));
 const upcoming=games.filter(g=>g.state==='pre'||/scheduled/i.test(g.status||'')).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,18);
 if(!upcoming.length){msg('nba-forecast-status','No future NBA games in the current published schedule snapshot');unavailable('nba-forecast-games','Upcoming predictions appear when verified future fixtures are available.');return}
 $('nba-forecast-games').innerHTML='<div class="nba-prediction-list">'+upcoming.map(g=>{
  const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away');
  const hc=code(h?.name)||h?.code,ac=code(a?.name)||a?.code;
  if(!hc||!ac||!Number.isFinite(ratings[hc])||!Number.isFinite(ratings[ac]))return '';
  const hp=1/(1+Math.pow(10,-(ratings[hc]+45-ratings[ac])/400));
  const bug=window.SLTScorebug.render({mode:'upcoming',subtitle:date(g.date),away:{code:ac,name:names[ac],logo:logo(ac)},home:{code:hc,name:names[hc],logo:logo(hc)},footer:'<span>'+esc(ac)+' '+((1-hp)*100).toFixed(1)+'%</span><span>'+esc(hc)+' '+(hp*100).toFixed(1)+'%</span>'});
  return '<article class="nba-prediction">'+bug+'<p class="hub-small">Elo '+ratings[ac].toFixed(0)+' / '+ratings[hc].toFixed(0)+'</p></article>';
 }).join('')+'</div>';

 msg('nba-forecast-status','Model-derived win probabilities for verified upcoming fixtures · Not betting odds · Ratings as published');
 }catch(e){console.error('NBA home desk',e);msg('nba-standings-status','NBA standings source unavailable');unavailable('nba-conference-standings','Unable to verify conference records. See official NBA standings.');msg('nba-yesterday-status','Recent final scores unavailable');unavailable('nba-yesterday-scores','Score feed unavailable.');msg('nba-forecast-status','NBA prediction source unavailable');unavailable('nba-forecast-games','Unable to produce predictions from verified schedule and Elo.')}
}
news().catch(e=>console.error('NBA headlines',e)).finally(()=>desk());
// The newspaper stays current in an open tab; GitHub data is read without cache.
setInterval(()=>{if(!document.hidden)desk()},3*60*1000);
setInterval(()=>{if(!document.hidden)news()},15*60*1000);
})();