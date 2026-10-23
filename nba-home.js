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
async function news(){
 try{const data=await fetchJSON('articles.json');const items=(data.articles||[]).filter(a=>{const c=String(a.category||'').toLowerCase(),u=String(a.url||'').toLowerCase(),s=String(a.source||'').toLowerCase();return c==='nba'||s.includes('nba')||u.includes('/nba/')||u.includes('/basketball/nba/')}).filter(a=>/^https:\/\//.test(a.url)&&a.title).slice(0,72);
 if(!items.length)throw Error('No verified NBA headlines in this edition');
 $('nba-news-grid').innerHTML=items.map((a,i)=>'<article class="nba-news-item'+(i===0?' nba-news-lead':'')+'"><p class="nba-news-source">'+esc(a.source)+' · '+esc(a.published_at||'Date unavailable')+'</p><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3>'+(a.summary?'<p>'+esc(a.summary.slice(0,i===0?210:100))+'</p>':'')+'</article>').join('');
 msg('nba-news-status',items.length+' attributed national and local headlines · Published sources · Updated '+esc(data.updated_at||'when feed refreshes'));
 }catch(e){msg('nba-news-status','NBA headlines unavailable');unavailable('nba-news-grid','The current feed has no verified NBA headlines. No invented stories are shown.')}
}
async function desk(){
 try{const [scores,elo]=await Promise.all([fetchJSON('multi_scoreboards.json'),fetchJSON('data/nba-2026-27-current-provisional.json')]);
 const block=(scores.leagues||[]).find(l=>l.league==='NBA');const games=block?.games||[];const ratings=Object.fromEntries((elo.rankings||[]).map(r=>[r.team,r.elo]));
 if(Object.keys(ratings).length!==30)throw Error('Incomplete current-season Elo');
 const records=Object.fromEntries(Object.keys(names).map(t=>[t,{w:0,l:0}]));
 const ledger=(elo.events||[]).filter(g=>Number.isFinite(g.home_score)&&Number.isFinite(g.away_score));
 for(const g of ledger){if(!records[g.home]||!records[g.away])continue;const winner=g.home_score>g.away_score?g.home:g.away,loser=winner===g.home?g.away:g.home;records[winner].w++;records[loser].l++}

 const finals=games.filter(g=>g.state==='post'||/final/i.test(g.status||''));
 const divisions=[
 ['ATLANTIC',['BOS','BKN','NYK','PHI','TOR']],
 ['CENTRAL',['CHI','CLE','DET','IND','MIL']],
 ['SOUTHEAST',['ATL','CHA','MIA','ORL','WAS']],
 ['NORTHWEST',['DEN','MIN','OKC','POR','UTA']],
 ['PACIFIC',['GSW','LAC','LAL','PHX','SAC']],
 ['SOUTHWEST',['DAL','HOU','MEM','NOP','SAS']]
 ];
 const division=(label,keys)=>{const arr=[...keys].sort((a,b)=>{const x=records[a],y=records[b];return y.w-x.w||x.l-y.l||ratings[b]-ratings[a]});return '<section class="nba-division"><h3>'+label+'</h3><table class="nba-mini-table"><thead><tr><th>#</th><th>Club</th><th>W</th><th>L</th><th>PCT</th><th>Elo</th></tr></thead><tbody>'+arr.map((t,i)=>{const r=records[t];return '<tr><td>'+(i+1)+'</td><th><abbr title="'+esc(names[t])+'">'+esc(t)+'</abbr></th><td>'+r.w+'</td><td>'+r.l+'</td><td>'+(r.w+r.l?(r.w/(r.w+r.l)).toFixed(3):'—')+'</td><td>'+ratings[t].toFixed(0)+'</td></tr>'}).join('')+'</tbody></table></section>'};
 $('nba-conference-standings').innerHTML='<p class="hub-small">Six NBA divisions · Provisional records from '+ledger.length+' verified completed games in the Elo ledger. <strong>Not full official season standings.</strong> Elo is independent of W–L. <a href="https://www.nba.com/standings">Official NBA standings ↗</a></p><div class="nba-divisions">'+divisions.map(([label,keys])=>division(label,keys)).join('')+'</div>';
 const briefs=ledger.slice(-9).reverse().map(g=>{const winner=g.home_score>g.away_score?g.home:g.away,loser=winner===g.home?g.away:g.home,ws=Math.max(g.home_score,g.away_score),ls=Math.min(g.home_score,g.away_score);return '<article class="nba-news-item nba-results-brief"><p class="nba-news-source">THE RESULTS DESK · VERIFIED FINAL</p><h3>'+esc(names[winner])+' defeat '+esc(names[loser])+', '+ws+'–'+ls+'</h3><p>'+esc(winner)+' '+ratings[winner].toFixed(0)+' Elo · '+esc(loser)+' '+ratings[loser].toFixed(0)+' Elo (current ratings)</p></article>'}).join('');if(briefs){$('nba-news-grid').insertAdjacentHTML('beforeend',briefs);msg('nba-news-status',$('nba-news-status').textContent+' · Plus '+Math.min(9,ledger.length)+' original results briefs')}
 msg('nba-standings-status','Results updated through the latest verified Elo ledger · '+ledger.length+' completed games');

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