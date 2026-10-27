// Shared NBA Elo view model. ESPN supplies fixtures/results only; USRS owns all ratings.
export const codes={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const aliases={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no'};
export const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+(aliases[t]||t.toLowerCase())+'.png';
export const eloWin=(home,away)=>1/(1+10**(-(home+40-away)/400));
const load=async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error(file+' '+r.status);return r.json()};
const map=d=>Object.fromEntries(d.rankings.map(r=>[r.team,r.elo]));
export async function model(){
 const cur=await load('data/nba-elo-shadow-2026-27.json');
 if(cur.status!=='shadow_not_published'||cur.rankings?.length!==30||cur.events?.length!==cur.games_played)throw Error('Incomplete NBA 1500-reset Elo');
 const start=Object.fromEntries(cur.rankings.map(r=>[r.team,1500]));
 const ratings={...start},ledger=[];
 const dated=cur.events.every(e=>typeof e.date==='string'&&Number.isFinite(Date.parse(e.date)));
 if(!dated)throw Error('NBA shadow events missing dates');
 const lastDate=cur.events.length?Math.max(...cur.events.map(e=>Date.parse(e.date))):null;
 const weeklyCutoff=lastDate===null?null:lastDate-7*86400000;
 const dailyCutoff=lastDate===null?null:lastDate-86400000;
 let weekly=null,daily=null;
 for(const game of cur.events){
  if(weekly===null&&Date.parse(game.date)>weeklyCutoff)weekly={...ratings};
  if(daily===null&&Date.parse(game.date)>dailyCutoff)daily={...ratings};
  const p=1/(1+10**((ratings[game.away]-ratings[game.home]-40)/400));
  const delta=24*Math.sqrt(Math.max(1,Math.abs(game.home_score-game.away_score))/10)*((game.home_score>game.away_score?1:0)-p);
  if(Math.abs(delta-game.home_elo_change)>1e-7)throw Error('NBA shadow event inconsistent '+game.id);
  ledger.push({id:game.id,home:game.home,away:game.away,home_before:ratings[game.home],away_before:ratings[game.away],home_change:delta});
  ratings[game.home]+=delta;ratings[game.away]-=delta;
 }
 weekly??={...ratings};daily??={...ratings};
 for(const row of cur.rankings)if(Math.abs(ratings[row.team]-row.elo)>.0011)throw Error('NBA shadow rating mismatch '+row.team);
 let beforeLast={...ratings},last=ledger.at(-1);
 if(last){beforeLast[last.home]-=last.home_change;beforeLast[last.away]+=last.home_change}
 return {start,current:ratings,beforeLast,last,ledger,rawEvents:cur.events,season:cur.season,games:cur.games_played,weekly,daily,weeklyReason:null};
}
export function changeTag(n){if(n>0.0005)return '<span class="nba-up" aria-label="up">▲ +'+n.toFixed(2)+'</span>';if(n<-.0005)return '<span class="nba-down" aria-label="down">▼ '+n.toFixed(2)+'</span>';return '<span class="nba-flat">—</span>'}
export const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
