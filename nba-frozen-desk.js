(()=>{'use strict';
const status=document.getElementById('nba-frozen-status'),root=document.getElementById('nba-frozen-grid');
if(!status||!root)return;
const names={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'Los Angeles Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('data/nba-2025-26-final.json').then(r=>{if(!r.ok)throw Error('Frozen NBA data unavailable');return r.json()}).then(data=>{
const rows=data.rankings;
if(data.league!=='NBA'||data.season!=='2025-26'||data.status!=='2025-26-final'||data.regular_season_games!==1230||data.playoff_games!==85||!Array.isArray(rows)||rows.length!==30||new Set(rows.map(x=>x.team)).size!==30||rows.some(x=>!names[x.team]||!Number.isFinite(x.elo)))throw Error('Invalid frozen final Elo archive');
const sorted=[...rows].sort((a,b)=>b.elo-a.elo);
const lo=Math.min(...sorted.map(r=>r.elo)),hi=Math.max(...sorted.map(r=>r.elo));
root.innerHTML=sorted.map((x,i)=>'<article class="forecast-card hub-nba-team"><div class="hub-nba-heading"><span class="hub-rank">#'+(i+1)+'</span><img loading="lazy" src="https://a.espncdn.com/i/teamlogos/nba/500/'+encodeURIComponent(x.team.toLowerCase())+'.png" alt="" onerror="this.style.display=\'none\'"></div><h3>'+escape(names[x.team])+'</h3><div class="forecast-line"><span>Final 2025–26 Elo</span><strong>'+x.elo.toFixed(3)+'</strong></div><div class="hub-rating-track"><span style="width:'+Math.max(5,100*(x.elo-lo)/Math.max(1,hi-lo)).toFixed(1)+'%"></span></div></article>').join('');
status.textContent='PERMANENT ARCHIVE · 30 teams · 1,230 regular-season games + 85 playoff games · No 2026–27 adjustments.';
}).catch(()=>{root.replaceChildren();status.textContent='Frozen 2025–26 NBA Elo archive is temporarily unavailable.'});
})();