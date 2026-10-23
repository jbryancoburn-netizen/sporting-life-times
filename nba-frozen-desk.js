(()=>{'use strict';
const status=document.getElementById('nba-frozen-status'),root=document.getElementById('nba-frozen-grid');
if(!status||!root)return;
const names={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'Los Angeles Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const logoAlias={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no'};
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+(logoAlias[t]||t.toLowerCase())+'.png';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('data/nba-2025-26-final.json').then(r=>{if(!r.ok)throw Error('Frozen NBA data unavailable');return r.json()}).then(data=>{
const rows=data.rankings;
if(data.league!=='NBA'||data.season!=='2025-26'||data.status!=='2025-26-final'||data.regular_season_games!==1230||data.playoff_games!==85||!Array.isArray(rows)||rows.length!==30||new Set(rows.map(x=>x.team)).size!==30||rows.some(x=>!names[x.team]||!Number.isFinite(x.elo)))throw Error('Invalid frozen final Elo archive');
const sorted=[...rows].sort((a,b)=>b.elo-a.elo);
root.className='nba-current-table-wrap';
root.innerHTML='<table class="nba-current-table nba-archive-table"><caption class="nba-table-caption">Final 2025–26 Elo · All 30 teams</caption><thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Final Elo</th></tr></thead><tbody>'+sorted.map((x,i)=>'<tr><td class="nba-rank">'+(i+1)+'</td><th scope="row"><span class="nba-team-label"><img loading="lazy" src="'+logo(x.team)+'" alt="" onerror="this.hidden=true"><span>'+escape(names[x.team])+'</span></span></th><td class="nba-primary-number">'+x.elo.toFixed(2)+'</td></tr>').join('')+'</tbody></table>';
status.textContent='PERMANENT ARCHIVE · 30 teams · 1,230 regular-season games + 85 playoff games · No 2026–27 adjustments.';
}).catch(()=>{root.replaceChildren();status.textContent='Frozen 2025–26 NBA Elo archive is temporarily unavailable.'});
})();