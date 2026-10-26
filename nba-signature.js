(()=>{'use strict';
const $=id=>document.getElementById(id);
const codes={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'};
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+(codes[t]||t.toLowerCase())+'.png';
const color={BOS:'#007A33',NYK:'#006BB6',LAL:'#552583',GSW:'#1D428A',DEN:'#0E2240',OKC:'#007AC1',CLE:'#860038',PHI:'#006BB6',SAS:'#C4CED4',DET:'#C8102E',TOR:'#CE1141',MIL:'#00471B',HOU:'#CE1141',MIN:'#236192',ORL:'#0077C0',MIA:'#98002E',PHX:'#E56020',DAL:'#00538C'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=t=>({GSW:'Warriors',OKC:'Thunder',NYK:'Knicks',NOP:'Pelicans',SAS:'Spurs',LAC:'Clippers',LAL:'Lakers',PHX:'Suns',PHI:'76ers',BOS:'Celtics',CLE:'Cavaliers',DEN:'Nuggets',MIL:'Bucks',MIN:'Timberwolves',ORL:'Magic',TOR:'Raptors',CHA:'Hornets',MEM:'Grizzlies',IND:'Pacers',HOU:'Rockets',BKN:'Nets',UTA:'Jazz',POR:'Trail Blazers',ATL:'Hawks',SAC:'Kings',DET:'Pistons',WAS:'Wizards',CHI:'Bulls',DAL:'Mavericks',MIA:'Heat'})[t]||t;
function gameTeams(g){const ts=g.teams||[];return {a:ts.find(t=>t.home_away==='away'),h:ts.find(t=>t.home_away==='home')}}
const easternDay=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
async function update(){
 const box=$('nba-signature-dashboard');if(!box)return;
 try{
 const [er,gr,sr]=await Promise.all(['data/nba-2026-27-current-provisional.json','data/nba-game-center.json','data/nba-upcoming-schedule.json'].map(p=>fetch(p+'?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(p);return r.json()})));
 const ratings=(er.rankings||[]).filter(x=>Number.isFinite(x.elo)).sort((a,b)=>b.elo-a.elo);
 const finals=(gr.games||[]).filter(g=>g.state==='post').sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const today=easternDay(Date.now());
 const scheduled=(sr.games||[]).filter(g=>g.state==='pre'&&easternDay(g.date)===today);
 const todayFinals=finals.filter(g=>easternDay(g.date)===today);
 const best=ratings[0],worst=ratings[ratings.length-1];
 const events=er.events||[];
 const records={};for(const g of events){records[g.home]??={w:0,l:0};records[g.away]??={w:0,l:0};if(g.home_score>g.away_score){records[g.home].w++;records[g.away].l++}else{records[g.away].w++;records[g.home].l++}}
 const movement=er.movement?.daily_change||{};
 const movers=ratings.filter(r=>Number.isFinite(movement[r.team])).sort((a,b)=>movement[b.team]-movement[a.team]);
 const leader=movers[0],fall=movers[movers.length-1];
 const latest=finals[0],last=latest?gameTeams(latest):null;
 const tiles=[
 ['GAMES TODAY',String(scheduled.length+todayFinals.length),'Upcoming + completed on today’s slate','#0d8d9b'],
 ['VERIFIED FINALS',String(events.length),'Included in current-season Elo','#dd6a38'],
 ['ELO LEADER',best?name(best.team):'—',best?best.elo.toFixed(1)+' Elo':'Ratings unavailable','#523aa2'],
 ['BIGGEST ELO RISE',leader?name(leader.team):'—',leader?'Change '+movement[leader.team].toFixed(1):'Awaiting movement','#15815b']
 ];
 const max=best?.elo||1600,min=worst?.elo||1400,span=Math.max(1,max-min);
 const leaders=ratings.slice(0,6).map((r,i)=>'<div class="nba-signature-team"><b style="width:15px">'+(i+1)+'</b><img loading="lazy" alt="" src="'+logo(r.team)+'"><div class="club">'+esc(name(r.team))+'<small>'+esc(r.team)+' · '+(records[r.team]?.w||0)+'–'+(records[r.team]?.l||0)+'</small><div class="nba-signature-bar"><span style="width:'+Math.max(8,(r.elo-min)/span*100).toFixed(1)+'%;--bar-color:'+(color[r.team]||'#197ba3')+'"></span></div></div><span class="elo">'+r.elo.toFixed(0)+'</span></div>').join('');
 const insights=[
  latest&&last?'**LATEST FINAL** '+esc(last.a?.code||'')+' '+esc(last.a?.score??'')+' – '+esc(last.h?.code||'')+' '+esc(last.h?.score??''):'',
  fall&&Number.isFinite(movement[fall.team])?'**BIGGEST ELO DROP** '+esc(name(fall.team))+' ('+movement[fall.team].toFixed(1)+')':'',
  scheduled.length?'**UP NEXT** '+esc(name(gameTeams(scheduled[0]).a?.code||''))+' at '+esc(name(gameTeams(scheduled[0]).h?.code||'')):'',
  '**POWER vs RECORD** Rankings use independent USRS Elo; standings are verified W–L'
 ].filter(Boolean).map(x=>'<div class="nba-signature-insight">'+x.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')+'</div>').join('');
 box.innerHTML='<div class="nba-signature-head"><div><p class="nba-signature-kicker">THE SPORTING LIFE & TIMES · BASKETBALL INTELLIGENCE</p><h2>THE NBA PULSE</h2><p>Live scores above · independent ratings · results · signals worth watching</p></div><a class="nba-signature-link" href="nba-game-center.html">EXPLORE GAME CENTER</a></div><div class="nba-signature-grid">'+tiles.map(([a,b,c,d])=>'<div class="nba-signature-tile" style="--tile-accent:'+d+'"><small>'+esc(a)+'</small><strong>'+esc(b)+'</strong><span>'+esc(c)+'</span></div>').join('')+'</div><div class="nba-signature-spotlight"><section class="nba-signature-panel"><h3>THE POWER SIX · USRS ELO</h3>'+leaders+'<a href="#nba-current-elo" style="font-size:12px;font-weight:800">All 30 teams & rankings</a></section><section class="nba-signature-panel"><h3>AROUND THE ASSOCIATION</h3>'+insights+'<p style="font-size:11px;color:#687587;margin:12px 0 0">Based on published snapshots · no invented live stats or predictions</p></section></div>';
 }catch(err){console.warn('NBA Pulse unavailable',err);box.innerHTML='<div class="nba-signature-head"><div><p class="nba-signature-kicker">THE NBA PULSE</p><h2>THE BASKETBALL DESK</h2><p>Data temporarily unavailable · live scoreboard and news remain accessible below.</p></div></div>'}
}
update();setInterval(()=>{if(!document.hidden)update()},60000);
})();
