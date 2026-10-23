// Shared NBA Elo view model. ESPN supplies fixtures/results only; USRS owns all ratings.
export const codes={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const aliases={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no'};
export const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+(aliases[t]||t.toLowerCase())+'.png';
export const eloWin=(home,away)=>1/(1+10**(-(home+45-away)/400));
const load=async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error(file+' '+r.status);return r.json()};
const map=d=>Object.fromEntries(d.rankings.map(r=>[r.team,r.elo]));
export async function model(){
 const [pre,cur]=await Promise.all([load('data/nba-2026-27-preseason-provisional.json'),load('data/nba-2026-27-current-provisional.json')]);
 if(pre.rankings?.length!==30||cur.rankings?.length!==30||cur.events?.length!==cur.games_played)throw Error('Incomplete NBA Elo');
 const ratings={...map(pre)},start={...ratings},ledger=[],K=pre.parameters.k,H=pre.parameters.home_elo,M=pre.parameters.mov_weight;
 // Old ledger has no verified timestamps. Compare previous snapshot to most recent event,
 // but NEVER invent a seven-day earlier state.
 for(const game of cur.events){
  const prob=1/(1+10**(-(ratings[game.home]+H-ratings[game.away])/400));
  const delta=K*(1+M*Math.log10(1+Math.abs(game.home_score-game.away_score)))*((game.home_score>game.away_score?1:0)-prob);
  if(Math.abs(delta-game.home_elo_change)>.00001)throw Error('NBA event inconsistent');
  ledger.push({id:game.id,home:game.home,away:game.away,home_before:ratings[game.home],away_before:ratings[game.away],home_change:delta});
  ratings[game.home]+=delta;ratings[game.away]-=delta;
 }
 for(const r of cur.rankings)if(Math.abs(ratings[r.team]-r.elo)>.0011)throw Error('NBA current Elo mismatch');
 let beforeLast={...ratings},last=ledger.at(-1);
 if(last){beforeLast[last.home]-=last.home_change;beforeLast[last.away]+=last.home_change}
 // No timestamps means a valid weekly baseline does not exist yet.
 return {start,current:ratings,beforeLast,last,ledger,season:cur.season,games:cur.games_played,weekly:null,weeklyReason:'Historical game ledger lacks reliable final timestamps'};
}
export function changeTag(n){if(n>0.0005)return '<span class="nba-up" aria-label="up">▲ +'+n.toFixed(2)+'</span>';if(n<-.0005)return '<span class="nba-down" aria-label="down">▼ '+n.toFixed(2)+'</span>';return '<span class="nba-flat">—</span>'}
export const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
