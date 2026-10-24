(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=new URLSearchParams(location.search).get('game');if(!id||!/^[0-9]{7,12}$/.test(id)){$('score').textContent='Choose a game from the NBA live scoreboard.';return}
let lastGood=0;
const logo=c=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[c]||String(c||'').toLowerCase())+'.png';
function render(x){
 const event=x.header?.competitions?.[0]||{},teams=event.competitors||[],away=teams.find(z=>z.homeAway==='away'),home=teams.find(z=>z.homeAway==='home');
 const state=x.header?.competitions?.[0]?.status||x.header?.status||{},detail=state.type?.shortDetail||state.type?.description||state.displayClock||'Game';
 if(!away||!home)throw Error('Score details are unavailable');
 const team=z=>{const c=z.team||{};return '<div class="team" style="--team-color:'+esc(c.color?'#'+c.color:'#293448')+'"><img src="'+logo(c.abbreviation)+'" alt=""><span class="name">'+esc(c.displayName||c.name)+'</span><b>'+esc(z.score??'—')+'</b></div>'};
 $('score').innerHTML='<div class="game-state">'+esc(detail)+'</div><div class="teams">'+team(away)+team(home)+'</div>';
 const periods=Math.max(...teams.map(z=>(z.linescores||[]).length),4),cols=Array.from({length:periods},(_,i)=>i<4?'Q'+(i+1):'OT'+(i-3));
 $('quarters').innerHTML='<table><thead><tr><th>TEAM</th>'+cols.map(c=>'<th>'+c+'</th>').join('')+'<th>TTL</th></tr></thead><tbody>'+[away,home].map(z=>'<tr><td>'+esc(z.team?.abbreviation)+'</td>'+cols.map((_,i)=>'<td>'+esc(z.linescores?.[i]?.displayValue??z.linescores?.[i]?.value??'–')+'</td>').join('')+'<td><b>'+esc(z.score)+'</b></td></tr>').join('')+'</tbody></table>';
 const pair=x.boxscore?.teams||[];
 const stats=new Map();for(const side of pair){const code=side.team?.abbreviation;for(const v of side.statistics||[]){const k=v.label||v.name||v.abbreviation;if(!stats.has(k))stats.set(k,{});stats.get(k)[code]=v.displayValue??v.value??''}}
 const ac=away.team?.abbreviation,hc=home.team?.abbreviation;
 $('team-stats').innerHTML=stats.size?'<table><thead><tr><th>STAT</th><th>'+esc(ac)+'</th><th>'+esc(hc)+'</th></tr></thead><tbody>'+[...stats].map(([n,v])=>'<tr><td>'+esc(n)+'</td><td>'+esc(v[ac]??'—')+'</td><td>'+esc(v[hc]??'—')+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Live team stats not yet available.</p>';
 const groups=x.boxscore?.players||[];
 $('players').innerHTML=groups.length?groups.map(group=>{const stats=group.statistics?.[0],keys=stats?.labels||[],athletes=stats?.athletes||[];return '<h4>'+esc(group.team?.displayName||group.team?.name||'Team')+'</h4><div class="scroll"><table><thead><tr><th>PLAYER</th>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+athletes.map(p=>'<tr><td>'+esc(p.athlete?.displayName||'')+'</td>'+(p.stats||[]).map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}).join(''):'<p class="muted">Player box scores will appear when the source supplies them.</p>';
 const plays=x.plays||x.scoringPlays||[];
 $('plays').innerHTML=plays.length?'<ol class="plays">'+plays.slice(-35).reverse().map(p=>'<li><b>'+esc(p.clock?.displayValue||'')+'</b> '+esc(p.text||p.type?.text||'')+'</li>').join('')+'</ol>':'<p class="muted">Play-by-play not available for this game.</p>';
}
async function update(){
 try{const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+encodeURIComponent(id)+'&_='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const x=await r.json();render(x);lastGood=Date.now();$('updated').textContent='Last checked '+new Date(lastGood).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET · auto-refresh 60 sec'}catch(e){$('updated').textContent='Live update failed'+(lastGood?' · showing last received data':' · data unavailable');if(!lastGood)$('score').textContent='Could not retrieve game details. '+e.message}
}
update();setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();