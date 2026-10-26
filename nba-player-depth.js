/* NBA player editorial dashboard, driven exclusively by captured game totals. */
(function(w){'use strict';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):'—';
const cats=[['ppg','Scoring','PPG'],['rpg','Rebounding','RPG'],['apg','Assists','APG'],['spg','Steals','SPG'],['bpg','Blocks','BPG'],['fg_pct','Field Goal','FG%'],['fg3_pct','Three-Point','3PT%'],['ft_pct','Free Throw','FT%']];
const rows=(c,k)=>(c.data.leaders?.rows||[]).filter(x=>x.stat===k&&Number.isFinite(Number(x.value))&&c.meta[x.team]).sort((a,b)=>b.value-a.value);
const link=t=>'nba-team-desk.html?team='+encodeURIComponent(t);
const photo=p=>p&&/^\d{2,10}$/.test(String(p.id||''))?'https://a.espncdn.com/i/headshots/nba/players/full/'+p.id+'.png':'';
function card(c,key,title,unit){
 const p=rows(c,key)[0];if(!p)return '';
 const player=(c.data.leaders?.season_totals||[]).find(x=>x.team===p.team&&x.player===p.player),src=photo(player);
 return '<article class="depth-star" style="--depth-club:'+c.meta[p.team][3]+'"><small>'+e(title)+' · CAPTURED SEASON</small><div class="depth-star-top">'+(src?'<img src="'+src+'" alt="" loading="lazy" onerror="this.hidden=true">':'<div class="depth-silhouette"></div>')+'<div><strong>'+n(p.value)+'</strong><span>'+e(unit)+'</span></div></div><h3>'+e(p.player)+'</h3><a href="'+link(p.team)+'">'+e(c.meta[p.team][0])+' ↗</a><p>'+p.gp+' captured appearances</p></article>';
}
function bars(c,key){
 const arr=rows(c,key).slice(0,12),max=Math.max(1,...arr.map(x=>x.value)),unit=cats.find(x=>x[0]===key)?.[2]||key;
 return arr.length?'<div class="depth-bars-guide"><span>PLAYER / CAPTURED GP</span><span>STATISTIC SCALE · ZERO BASELINE</span><span>'+e(unit)+'</span></div>'+arr.map((x,i)=>'<div class="depth-bar-row" style="--depth-club:'+c.meta[x.team][3]+'"><span class="depth-index">'+(i+1)+'</span><a href="'+link(x.team)+'"><b>'+e(x.player)+'</b><small>'+e(x.team)+' · '+x.gp+' GP</small></a><div class="depth-bar-track"><span style="width:'+Math.max(0,Math.min(100,x.value/max*100)).toFixed(2)+'%"></span></div><strong>'+n(x.value)+'</strong></div>').join(''):'<p class="depth-muted">Current captured-game category has no reported leaders.</p>';
}
function render(c){
 const app=document.getElementById('app'),old=app?.querySelector('.nba-mini-grid');
 if(!old)return;
 const board=document.createElement('div');board.id='nba-visual-players';
 board.innerHTML='<div class="depth-star-grid">'+card(c,'ppg','SCORING LEADER','POINTS / GAME')+card(c,'rpg','REBOUND LEADER','REBOUNDS / GAME')+card(c,'apg','ASSIST LEADER','ASSISTS / GAME')+'</div>'+
 '<section class="depth-section"><div class="depth-label">The player stat atlas · 2026–27</div><h2>Who is setting the pace?</h2><p class="depth-muted">'+e(c.data.leaders?.coverage?.completed_boxscores??'—')+' completed games captured, '+e(c.data.leaders?.coverage?.unique_players??'—')+' unique players. These charts are based on captured results, not a certified league-wide leaderboard.</p><div class="depth-stat-tabs" role="group" aria-label="Choose a player statistic">'+cats.map(([key,label],i)=>'<button type="button" data-stat="'+key+'" aria-pressed="'+(i===0)+'">'+e(label)+'</button>').join('')+'</div><div id="depth-stat-bars">'+bars(c,'ppg')+'</div><p class="depth-muted">Each bar begins at zero and is relative to the first displayed player. Shooting percentage categories do not impose attempt thresholds.</p></section>';
 old.replaceWith(board);
 const nav=board.querySelector('.depth-stat-tabs');
 nav.addEventListener('click',event=>{const btn=event.target.closest('button[data-stat]');if(!btn)return;nav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));board.querySelector('#depth-stat-bars').innerHTML=bars(c,btn.dataset.stat)});
 const notebook=app.querySelector('#nba-player-results');if(notebook)notebook.classList.add('depth-notebook');
}
w.NBAPlayerDepth=render;
})(window);
