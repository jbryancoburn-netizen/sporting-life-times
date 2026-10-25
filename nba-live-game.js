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
function renderNba(payload){
 const g=payload.game||payload;if(!g.homeTeam||!g.awayTeam)throw Error('NBA box score incomplete');
 const teams=[g.awayTeam,g.homeTeam];
 const team=t=>'<div class="team" style="--team-color:#293448"><img src="'+logo(t.teamTricode)+'" alt=""><span class="name">'+esc(((t.teamCity||'')+' '+(t.teamName||'')).trim()||t.teamTricode)+'</span><b>'+esc(t.score??'—')+'</b></div>';
 $('score').innerHTML='<div class="game-state">'+esc(g.gameStatusText||'NBA LIVE')+'</div><div class="teams">'+teams.map(team).join('')+'</div>';
 const max=Math.max(4,...teams.map(t=>(t.periods||[]).length));
 $('quarters').innerHTML='<table><thead><tr><th>TEAM</th>'+Array.from({length:max},(_,i)=>'<th>'+(i<4?'Q'+(i+1):'OT'+(i-3))+'</th>').join('')+'<th>TTL</th></tr></thead><tbody>'+teams.map(t=>'<tr><td>'+esc(t.teamTricode)+'</td>'+Array.from({length:max},(_,i)=>'<td>'+esc(t.periods?.[i]?.score??'–')+'</td>').join('')+'<td>'+esc(t.score)+'</td></tr>').join('')+'</tbody></table>';
 const keys=[['pointsInThePaint','Paint points'],['pointsSecondChance','Second-chance'],['pointsFastBreak','Fast-break'],['reboundsTotal','Rebounds'],['assists','Assists'],['turnovers','Turnovers'],['blocks','Blocks'],['steals','Steals']];
 $('team-stats').innerHTML='<table><thead><tr><th>STAT</th>'+teams.map(t=>'<th>'+esc(t.teamTricode)+'</th>').join('')+'</tr></thead><tbody>'+keys.map(([key,label])=>'<tr><td>'+label+'</td>'+teams.map(t=>'<td>'+esc(t.statistics?.[key]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 $('players').innerHTML=teams.map(t=>'<h4>'+esc(t.teamTricode)+'</h4><div class="scroll"><table><thead><tr><th>PLAYER</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>3PT</th></tr></thead><tbody>'+(t.players||[]).map(p=>{let q=p.statistics||{};return '<tr><td>'+esc(p.name||p.nameI||'')+'</td><td>'+esc(q.minutes||'—')+'</td><td>'+esc(q.points??'—')+'</td><td>'+esc(q.reboundsTotal??'—')+'</td><td>'+esc(q.assists??'—')+'</td><td>'+esc((q.fieldGoalsMade??'—')+'/'+(q.fieldGoalsAttempted??'—'))+'</td><td>'+esc((q.threePointersMade??'—')+'/'+(q.threePointersAttempted??'—'))+'</td></tr>'}).join('')+'</tbody></table></div>').join('');
 $('plays').innerHTML='<p class="muted">Play-by-play is unavailable from this NBA box-score endpoint.</p>';
}
async function update(){
 const sources=id.startsWith('00')?[
  ['NBA live box score','https://cdn.nba.com/static/json/liveData/boxscore/boxscore_'+id+'.json',renderNba],
  ['ESPN game summary','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+id,render]
 ]:[
  ['ESPN game summary','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+id,render],
  ['NBA live box score','https://cdn.nba.com/static/json/liveData/boxscore/boxscore_'+id+'.json',renderNba]
 ];
 for(const [name,url,show] of sources){
  try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);let response;try{response=await fetch(url+(url.includes('?')?'&':'?')+'_='+Date.now(),{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}if(!response.ok)throw Error('HTTP '+response.status);
   const json=await response.json();show(json);lastGood=Date.now();
   $('updated').textContent=name+' · checked '+new Date(lastGood).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET · refresh 60 sec';return;
  }catch(e){console.warn(name+' unavailable:',e.message)}
 }
 $('updated').textContent='Live game sources unavailable'+(lastGood?' · showing last received data':'');
 if(!lastGood)$('score').innerHTML='<p class="muted">Game details could not be verified from either source. <a href="nba.html">Return to NBA scores</a>.</p>';
}
update();setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();