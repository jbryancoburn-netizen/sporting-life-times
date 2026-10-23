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
  let items=(payload.articles||[]).filter(a=>String(a.category||'').toUpperCase()==='NBA'||String(a.url||'').includes('/nba/')).filter(a=>String(a.url||'').startsWith('https://')&&a.title).slice(0,60);
  if(!items.length&&payload!==null){const fallback=await fetchJSON('articles.json');items=(fallback.articles||[]).filter(a=>String(a.category||'').toUpperCase()==='NBA').slice(0,60)}
  if(!items.length)throw Error('No attributed NBA headlines');
  const format=window.SportingNewsFormat;
  grid.innerHTML=items.map((a,i)=>'<article class="nba-news-item'+(i===0?' nba-news-lead':'')+'"><p class="nba-news-source">'+newsLogos(a)+(format?.meta?format.meta(a):esc(a.source||'NBA NEWS')+' · '+esc((a.published_at||'').slice(0,10)))+'</p><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+(format?.title?format.title(a):esc(a.title))+'</a></h3>'+(a.summary?'<p class="nba-news-summary">'+(format?.summary?format.summary(a):esc(a.summary))+'</p>':'')+'</article>').join('');
  msg('nba-news-status',items.length+' attributed NBA stories · '+(payload.updated_at||'Dated reporting')+' · Original sources linked');
 }catch(err){msg('nba-news-status','NBA top stories feed unavailable');unavailable('nba-news-grid','NBA reporting temporarily unavailable. <a href="https://www.nba.com/news" target="_blank" rel="noopener noreferrer">NBA.com News ↗</a>')}
}
async function desk(){
 try{const [scores,elo]=await Promise.all([fetchJSON('multi_scoreboards.json'),fetchJSON('data/nba-2026-27-current-provisional.json')]);
 const block=(scores.leagues||[]).find(l=>l.league==='NBA');const games=block?.games||[];const ratings=Object.fromEntries((elo.rankings||[]).map(r=>[r.team,r.elo]));
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
  const homeWon=g.home_score>g.away_score,w=homeWon?g.home:g.away,l=homeWon?g.away:g.home;
  const wScore=Math.max(g.home_score,g.away_score),lScore=Math.min(g.home_score,g.away_score);
  const margin=wScore-lScore;
  const total=g.home_score+g.away_score;
  const stamp=g.date&&Number.isFinite(Date.parse(g.date))?date(g.date):'Date unverified';
  const href='https://www.nba.com/games';
  return '<article class="nba-analysis-brief"><p class="nba-news-source">THE ANALYSIS DESK · '+esc(stamp)+'</p><h3>'+esc(names[w])+' over '+esc(names[l])+', '+wScore+'–'+lScore+'</h3><p>'+esc(w)+' won by '+margin+' points; the teams combined for '+total+'. Current independent Elo: '+esc(w)+' '+ratings[w].toFixed(1)+'; '+esc(l)+' '+ratings[l].toFixed(1)+'. <a href="'+href+'" target="_blank" rel="noopener noreferrer">Official NBA games ↗</a></p></article>';
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
  const delta=Number(g.home_elo_change);
  const homeMove=Number.isFinite(delta)?(delta>0?'+':'')+delta.toFixed(2):'—';
  const awayMove=Number.isFinite(delta)?(-delta>0?'+':'')+(-delta).toFixed(2):'—';
  const teams=t=>'<img loading="lazy" src="'+logo(t)+'" alt="" onerror="this.hidden=true">';
  const stamp=g.date&&Number.isFinite(Date.parse(g.date))?date(g.date):'Date unavailable';
  return '<details class="nba-scorebug"><summary><span class="nba-scorebug-meta">FINAL · '+esc(stamp)+'</span><span class="nba-scorebug-match"><span class="nba-scorebug-team">'+teams(a)+'<b>'+esc(a)+'</b><strong>'+g.away_score+'</strong></span><span class="nba-scorebug-team '+(homeWon?'nba-scorebug-winner':'')+'">'+teams(h)+'<b>'+esc(h)+'</b><strong>'+g.home_score+'</strong></span></span><small>Game details <span aria-hidden="true">▾</span></small></summary><div class="nba-scorebug-details"><p>'+esc(names[homeWon?h:a])+' win '+Math.max(g.home_score,g.away_score)+'–'+Math.min(g.home_score,g.away_score)+'.</p><div><span>'+esc(a)+' Elo '+ratings[a].toFixed(1)+'</span><span>'+esc(h)+' Elo '+ratings[h].toFixed(1)+'</span></div><div><span>'+esc(a)+' Elo change '+esc(awayMove)+'</span><span>'+esc(h)+' Elo change '+esc(homeMove)+'</span></div><p class="nba-scorebug-note">Verified final from the NBA Elo result ledger. Detailed player statistics appear when the official NBA box-score archive is available.</p></div></details>';
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
 $('nba-forecast-games').innerHTML='<div class="nba-prediction-list">'+upcoming.map(g=>{const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away'),hc=code(h?.name),ac=code(a?.name);if(!hc||!ac||!Number.isFinite(ratings[hc])||!Number.isFinite(ratings[ac]))return '';const hp=1/(1+Math.pow(10,-(ratings[hc]+45-ratings[ac])/400));return '<article class="nba-prediction"><p class="nba-news-source">'+esc(date(g.date))+' · '+esc(g.provider||block.provider||'Published fixture')+'</p><div><strong>'+esc(ac)+' @ '+esc(hc)+'</strong><span>'+esc(names[ac])+' '+(100*(1-hp)).toFixed(1)+'% · '+esc(names[hc])+' '+(100*hp).toFixed(1)+'%</span></div><p class="hub-small">Elo '+ratings[ac].toFixed(1)+' / '+ratings[hc].toFixed(1)+' · Home edge +45 · Pregame estimate based on current published ratings; no lineup adjustment.</p></article>'}).join('')+'</div>';
 msg('nba-forecast-status','Model-derived win probabilities for verified upcoming fixtures · Not betting odds · Ratings as published');
 }catch(e){console.error('NBA home desk',e);msg('nba-standings-status','NBA standings source unavailable');unavailable('nba-conference-standings','Unable to verify conference records. See official NBA standings.');msg('nba-yesterday-status','Recent final scores unavailable');unavailable('nba-yesterday-scores','Score feed unavailable.');msg('nba-forecast-status','NBA prediction source unavailable');unavailable('nba-forecast-games','Unable to produce predictions from verified schedule and Elo.')}
}
news().catch(e=>console.error('NBA headlines',e)).finally(()=>desk());
})();