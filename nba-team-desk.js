(()=>{'use strict';
const names={"ATL":"Atlanta Hawks","BOS":"Boston Celtics","BKN":"Brooklyn Nets","CHA":"Charlotte Hornets","CHI":"Chicago Bulls","CLE":"Cleveland Cavaliers","DAL":"Dallas Mavericks","DEN":"Denver Nuggets","DET":"Detroit Pistons","GSW":"Golden State Warriors","HOU":"Houston Rockets","IND":"Indiana Pacers","LAC":"LA Clippers","LAL":"Los Angeles Lakers","MEM":"Memphis Grizzlies","MIA":"Miami Heat","MIL":"Milwaukee Bucks","MIN":"Minnesota Timberwolves","NOP":"New Orleans Pelicans","NYK":"New York Knicks","OKC":"Oklahoma City Thunder","ORL":"Orlando Magic","PHI":"Philadelphia 76ers","PHX":"Phoenix Suns","POR":"Portland Trail Blazers","SAC":"Sacramento Kings","SAS":"San Antonio Spurs","TOR":"Toronto Raptors","UTA":"Utah Jazz","WAS":"Washington Wizards"};
const colors={BOS:'#007A33',IND:'#002D62',NYK:'#006BB6',LAL:'#552583',CHI:'#CE1141',MIA:'#98002E',GSW:'#1D428A',OKC:'#007AC1',DET:'#C8102E',PHI:'#006BB6',MIL:'#00471B',SAS:'#000000',DAL:'#00538C',DEN:'#0E2240',HOU:'#CE1141',MIN:'#0C2340',LAC:'#C8102E',POR:'#E03A3E',SAC:'#5A2D81',PHX:'#1D1160',ORL:'#0077C0',CLE:'#860038',MEM:'#5D76A9',ATL:'#E03A3E',CHA:'#1D1160',NOP:'#0C2340',TOR:'#CE1141',UTA:'#002B5C',WAS:'#002B5C',BKN:'#242424'};
const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[t]||t.toLowerCase())+'.png';
const get=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+': '+r.status);return r.json()};
const codeFromGame=(g,side)=>g.teams?.find(t=>t.home_away===side)?.code;
const d=s=>{if(!s||!Number.isFinite(Date.parse(s)))return '';return new Date(s).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'})};
const opts=$('teams');for(const [code,name] of Object.entries(names).sort((a,b)=>a[1].localeCompare(b[1]))){const o=document.createElement('option');o.value=code;o.textContent=name;opts.append(o)}
const chosen=new URLSearchParams(location.search).get('team')?.toUpperCase();opts.value=names[chosen]?chosen:'IND';
const data=Promise.allSettled([get('data/nba-top-stories.json'),get('data/nba-2026-27-current-provisional.json'),get('data/nba-game-center.json'),get('data/nba-upcoming-schedule.json')]);
function render(a){
 const t=opts.value;history.replaceState(null,'','?team='+encodeURIComponent(t));$('team-name').textContent=names[t];document.title=names[t]+' | The Sporting Life & Times';$('crest').src=logo(t);$('crest').alt=names[t]+' logo';$('identity').style.setProperty('--team-color',colors[t]||'#333');
 const value=i=>a[i].status==='fulfilled'?a[i].value:null;
 const elo=value(1),archive=value(2),schedule=value(3),news=value(0);
 const events=elo?.events||[],teamEvents=events.filter(e=>e.home===t||e.away===t),wins=teamEvents.filter(e=>(e.home===t&&e.home_score>e.away_score)||(e.away===t&&e.away_score>e.home_score)).length;
 const rank=elo?.rankings?.findIndex(e=>e.team===t)??-1,score=rank>=0?elo.rankings[rank].elo:null;
 const facts=[['W–L',elo?wins+'–'+(teamEvents.length-wins):'—'],['ELO',Number.isFinite(score)?score.toFixed(1):'—'],['ELO RANK',rank>=0?'#'+(rank+1):'—']];
 $('facts').innerHTML=facts.map(([label,v])=>'<div class="fact"><b>'+esc(v)+'</b><small>'+esc(label)+'</small></div>').join('');
 if($('facts-front'))$('facts-front').innerHTML=$('facts').innerHTML;
 const completed=(archive?.games||[]).filter(g=>g.state==='post'&&g.teams?.some(z=>z.code===t)).sort((x,y)=>Date.parse(y.date)-Date.parse(x.date));
 const latestGame=completed[0];
 if($('team-scorebug')){
  if(latestGame&&window.SLTScorebug){
   const a=latestGame.teams.find(z=>z.home_away==='away'),h=latestGame.teams.find(z=>z.home_away==='home');
   $('team-scorebug').innerHTML=a&&h?window.SLTScorebug.render({mode:'final',away:a,home:h,awayScore:Number(a.score),homeScore:Number(h.score),winner:Number(a.score)>Number(h.score)?a.code:h.code,subtitle:d(latestGame.date)}):'<p class="muted">Game scores unavailable.</p>';
  }else $('team-scorebug').innerHTML='<p class="muted">No verified completed game available.</p>';
 }
 const playerTotals=new Map();
 for(const game of completed){
  for(const p of game.players||[]){
   if(p.team!==t||!p.id)continue;
   const old=playerTotals.get(String(p.id))||{name:p.name,gp:0,pts:0,reb:0,ast:0};
   old.gp++;old.pts+=Number(p.pts)||0;old.reb+=Number(p.reb)||0;old.ast+=Number(p.ast)||0;
   playerTotals.set(String(p.id),old);
  }
 }
 const leaders=[...playerTotals.values()].sort((a,b)=>b.pts/b.gp-a.pts/a.gp).slice(0,6);
 $('team-leaders').innerHTML=leaders.length?'<table class="leader-table"><thead><tr><th>PLAYER</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead><tbody>'+leaders.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+p.gp+'</td><td>'+ (p.pts/p.gp).toFixed(1)+'</td><td>'+(p.reb/p.gp).toFixed(1)+'</td><td>'+(p.ast/p.gp).toFixed(1)+'</td></tr>').join('')+'</tbody></table><small class="muted">Per game · captured verified games only ('+completed.length+' team games)</small>':'<p class="muted">Player box-score data unavailable.</p>';
 const lastFive=teamEvents.slice(-5).reverse();
 $('team-form').innerHTML=lastFive.length?'<div class="form-line">'+lastFive.map(e=>{const win=e.home===t?e.home_score>e.away_score:e.away_score>e.home_score;return '<span class="'+(win?'win':'loss')+'">'+(win?'W':'L')+' · '+esc((e.home===t?e.away:e.home))+'</span>'}).join('')+'</div>':'<p class="muted">No verified season results.</p>';
 const rows=(archive?.games||[]).filter(g=>g.teams?.some(e=>e.code===t)&&g.state==='post').slice(0,8);
 $('results').innerHTML=rows.length?rows.map(g=>{const h=g.teams.find(z=>z.home_away==='home'),aw=g.teams.find(z=>z.home_away==='away');return '<tr><td>'+esc(d(g.date))+'</td><td>'+esc(aw?.code)+' '+esc(aw?.score)+' – '+esc(h?.code)+' '+esc(h?.score)+'</td><td>Final</td></tr>'}).join(''):'<tr><td>Verified results unavailable</td></tr>';
 const future=(schedule?.games||[]).filter(g=>g.state==='pre'&&g.teams?.some(z=>z.code===t)).slice(0,8);
 $('upcoming').innerHTML=future.length?future.map(g=>'<tr><td>'+esc(d(g.date))+'</td><td>'+esc(g.teams.find(z=>z.home_away==='away')?.code)+' @ '+esc(g.teams.find(z=>z.home_away==='home')?.code)+'</td></tr>').join(''):'<tr><td>Upcoming schedule unavailable</td></tr>';
 const token=names[t].toLowerCase(),city=token.split(' ').slice(0,-1).join(' '),nickname=token.split(' ').at(-1);
 const articles=(news?.articles||[]).filter(x=>{const title=String(x.title||'').toLowerCase(),sum=String(x.summary||'').toLowerCase(),combined=title+' '+sum;return (combined.includes(token)||title.includes(nickname)||(city.length>7&&title.includes(city)))&&String(x.url||'').startsWith('https://')&&x.title}).slice(0,24);
 $('articles').innerHTML=articles.length?articles.map(x=>'<article class="story"><h3><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a></h3>'+(x.summary?'<p>'+esc(x.summary)+'</p>':'')+'<small>'+esc(x.source||'Source')+' · '+esc(d(x.published_at||x.date||x.pubDate))+'</small></article>').join(''):'<p class="muted">No verified recent team-specific articles were found in the current NBA news feed.</p>';
}
data.then(a=>{render(a);opts.addEventListener('change',()=>render(a))});
})();