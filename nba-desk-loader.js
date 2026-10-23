(()=>{'use strict';
const $=id=>document.getElementById(id);
const names={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const alias={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=(t,compact=false)=>'<span class="nba-team-label"><img loading="lazy" alt="" src="https://a.espncdn.com/i/teamlogos/nba/500/'+(alias[t]||t.toLowerCase())+'.png" onerror="this.hidden=true"><span>'+esc(compact?t:names[t])+'</span></span>';
const map=d=>Object.fromEntries(d.rankings.map(r=>[r.team,r.elo]));
const order=m=>Object.keys(m).sort((a,b)=>m[b]-m[a]);
const load=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()};
const table=(headers,rows,cls='nba-current-table')=>'<div class="nba-current-table-wrap"><table class="'+cls+'"><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const row=(cells)=>'<tr>'+cells.map((v,i)=>i===1?'<th scope="row">'+v+'</th>':'<td>'+v+'</td>').join('')+'</tr>';
const msg=(id,value)=>{if($(id))$(id).textContent=value};
const put=(id,html)=>{if($(id))$(id).innerHTML=html};
const error=e=>{console.error('NBA desk load error',e);for(const id of ['nba-elo-status','nba-score-status','nba-frozen-status'])msg(id,'Unable to load verified NBA data: '+e.message);for(const id of ['nba-elo-grid','nba-elo-standings','nba-elo-comparison','nba-season-records','nba-elo-scoreboard'])if($(id))$(id).innerHTML='<p class="nba-error">The NBA data is unavailable. Refresh the page or try again later.</p>'};
async function render(){
 const [pre,cur,old]=await Promise.all([load('data/nba-2026-27-preseason-provisional.json'),load('data/nba-2026-27-current-provisional.json'),load('data/nba-2025-26-final.json')]);
 if([pre,cur,old].some(d=>!Array.isArray(d.rankings)||d.rankings.length!==30)||!Array.isArray(cur.events)||cur.events.length!==cur.games_played)throw Error('NBA data completeness check failed');
 const current=map(cur),start=map(pre),frozen=map(old),sorted=order(current);
 const movement=window.NBAEloMovement?.compute(cur)||{available:false,reason:'Daily Elo module unavailable'};
 const daily=t=>movement.available?window.NBAEloMovement.format(movement.daily[t]):'N/A';
 const lastWeek=t=>movement.available?movement.lastWeek[t].toFixed(2):'N/A';
 $('nba-elo-grid').innerHTML=table(['#','Team','Offseason','Last week','Current Elo','Daily Δ'],sorted.map((t,i)=>row([i+1,badge(t),start[t].toFixed(2),lastWeek(t),'<strong>'+current[t].toFixed(2)+'</strong>',daily(t)])));
 msg('nba-elo-status',cur.games_played+' verified finals · Current-season Elo · '+(movement.available?'Daily movement from completed games on '+movement.day+' (Eastern) · Last-week snapshot: '+movement.weekDate:movement.reason));
 put('nba-elo-standings',table(['Rank','Team','Elo'],sorted.map((t,i)=>row([i+1,badge(t),current[t].toFixed(1)]))));
 $('nba-elo-comparison').innerHTML='<div class="nba-snapshot-grid">'+[['2026–27 CURRENT',current],['2026–27 OPENING',start],['2025–26 FINAL',frozen]].map(([title,m])=>'<section class="nba-snapshot"><h3>'+title+'</h3><table class="nba-mini-table"><thead><tr><th>#</th><th>Club</th><th>Elo</th></tr></thead><tbody>'+order(m).map((t,i)=>row([i+1,badge(t,true),m[t].toFixed(1)])).join('')+'</tbody></table></section>').join('')+'</div>';
 const records=Object.fromEntries(Object.keys(names).map(t=>[t,{w:0,l:0}]));
 for(const g of cur.events){if(!records[g.home]||!records[g.away]||!Number.isFinite(g.home_score)||!Number.isFinite(g.away_score))continue;const winner=g.home_score>g.away_score?g.home:g.away;const loser=winner===g.home?g.away:g.home;records[winner].w++;records[loser].l++}
 const byWins=Object.keys(records).sort((a,b)=>records[b].w-records[a].w||records[a].l-records[b].l||current[b]-current[a]);
 put('nba-season-records','<p class="hub-small">Partial records from '+cur.games_played+' verified Elo-ledger finals; not official NBA conference standings.</p>'+table(['#','Team','W','L','PCT','Elo'],byWins.map((t,i)=>{const r=records[t],n=r.w+r.l;return row([i+1,badge(t),r.w,r.l,n?(r.w/n).toFixed(3):'—',current[t].toFixed(1)])})));
 const recent=cur.events.slice(-12).reverse();
 $('nba-elo-scoreboard').innerHTML='<div class="nba-results-ledger">'+recent.map(g=>'<div class="nba-result-line"><span class="nba-result-date">FINAL</span><span class="nba-result-team">'+badge(g.away,true)+'</span><strong class="nba-result-score">'+esc(g.away_score)+'</strong><span class="nba-result-separator">–</span><strong class="nba-result-score">'+esc(g.home_score)+'</strong><span class="nba-result-team">'+badge(g.home,true)+'</span><span class="nba-result-elo" title="Current independent Elo">'+current[g.away].toFixed(0)+' / '+current[g.home].toFixed(0)+'</span></div>').join('')+'</div>'||'<p>No verified finals yet.</p>';
 msg('nba-score-status','Recent verified final results. Live and upcoming fixtures are not included in this Elo ledger.');
 msg('nba-frozen-status','2025–26 historical final Elo · 30 teams · 1,230 regular-season games + 85 playoff games.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>render().catch(error),{once:true});else render().catch(error);
})();