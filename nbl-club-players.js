(()=>{'use strict';const root=document.getElementById('nbl-club-players');if(!root)return;
const teams=['Adelaide 36ers','Brisbane Bullets','Cairns Taipans','Illawarra Hawks','Melbourne United','New Zealand Breakers','Perth Wildcats','South East Melbourne Phoenix','Sydney Kings','Tasmania JackJumpers'];
const query=new URLSearchParams(location.search).get('team');const selected=teams.find(x=>x===query)||'Sydney Kings';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path=t=>'assets/nbl-logos/'+t.toLowerCase().replace(/[^a-z0-9]/g,'')+'.png';
const face=p=>{const initials=esc(p.name.split(' ').map(x=>x[0]).slice(0,2).join(''));const url=typeof p.headshot==='string'&&/^https:\/\/[^"'<>]+$/.test(p.headshot)?p.headshot:null;return '<span class="club-face">'+(url?'<img loading="lazy" src="'+esc(url)+'" alt="" onerror="this.remove();this.parentNode.querySelector(\'.club-face-initials\').hidden=false">':'')+'<span class="club-face-initials"'+(url?' hidden':'')+'>'+initials+'</span></span>'};
const number=(n)=>Number(n).toFixed(1);
fetch('data/nbl-player-boxscores.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Player archive unavailable');return r.json()}).then(data=>{
const games=data.games.filter(g=>g.home===selected||g.away===selected),players=new Map();
for(const game of games){const team=game.teams.find(t=>t.team===selected);if(!team)continue;for(const athlete of team.players){
 const key=athlete.id||athlete.name;const stats=athlete.stats||{};const pts=Number(stats.points),reb=Number(stats.rebounds),ast=Number(stats.assists),stl=Number(stats.steals),blk=Number(stats.blocks),mins=Number(stats.minutes);
 if(![pts,reb,ast].every(Number.isFinite))continue;
 const p=players.get(key)||{id:athlete.id,name:athlete.name,headshot:athlete.headshot||null,gp:0,pts:0,reb:0,ast:0,stl:0,blk:0,min:0};
 if(!p.headshot&&athlete.headshot)p.headshot=athlete.headshot;p.gp++;p.pts+=pts;p.reb+=reb;p.ast+=ast;p.stl+=Number.isFinite(stl)?stl:0;p.blk+=Number.isFinite(blk)?blk:0;p.min+=Number.isFinite(mins)?mins:0;players.set(key,p);
}}
const eligible=[...players.values()].filter(p=>p.gp>=Math.max(2,Math.floor(games.length*.35)));
if(!eligible.length){root.textContent='Player statistics are awaiting sufficient games.';return}
const avg=(p,k)=>p[k]/p.gp;const sorted=k=>[...eligible].sort((a,b)=>avg(b,k)-avg(a,k)||b.gp-a.gp).slice(0,3);
const maxGames=Math.max(...eligible.map(p=>p.gp));
/* Editorial MVP index: measured contribution and availability, not a certified award. */
for(const p of eligible){p.mvpIndex=(avg(p,'pts')+1.2*avg(p,'reb')+1.5*avg(p,'ast')+2*avg(p,'stl')+2*avg(p,'blk'))*(.7+.3*p.gp/maxGames)}
const mvp=[...eligible].sort((a,b)=>b.mvpIndex-a.mvpIndex)[0];
const card=(p,i,key,label)=>'<article class="club-player-card"><div class="club-player-top">'+face(p)+'<div><small class="club-player-rank">#'+(i+1)+' · '+esc(label)+'</small><h3>'+esc(p.name)+'</h3><small>'+p.gp+' GP</small></div></div><div class="club-player-scoring"><strong>'+number(avg(p,key))+'</strong><span>'+esc(label)+' / GAME</span></div><div class="club-player-ministats"><div><b>'+number(avg(p,'pts'))+'</b><small>PTS</small></div><div><b>'+number(avg(p,'reb'))+'</b><small>REB</small></div><div><b>'+number(avg(p,'ast'))+'</b><small>AST</small></div></div></article>';
const block=(key,title,label)=>'<section class="club-leader-group"><div class="club-group-head"><h3>'+title+'</h3><small>TOP THREE · '+label+'</small></div><div class="club-player-cards">'+sorted(key).map((p,i)=>card(p,i,key,label)).join('')+'</div></section>';
root.innerHTML='<div class="nbl-feature-head"><div><p class="club-roster-kicker">THE PERSONNEL DESK · 2026–27</p><h2>Players driving the season.</h2></div><a class="club-roster-all" href="nbl-players.html">League leaders ↗</a></div><p class="hub-small">'+games.length+' completed games in the available player archive · Rankings update with new box scores</p>'+
'<section class="club-mvp"><div class="club-mvp-face">'+face(mvp)+'</div><div><span class="club-mvp-kicker">THE TEAM MVP · USRS EDITORIAL INDEX</span><h3>'+esc(mvp.name)+'</h3><p>Our statistical standout so far, based on scoring, rebounds, assists, defensive box-score contributions, and games played.</p><div class="club-mvp-numbers"><b>'+number(avg(mvp,'pts'))+' <small>PPG</small></b><b>'+number(avg(mvp,'reb'))+' <small>RPG</small></b><b>'+number(avg(mvp,'ast'))+' <small>APG</small></b></div></div></section>'+
block('pts','The scoring leaders','POINTS')+block('reb','Owning the glass','REBOUNDS')+block('ast','The playmakers','ASSISTS')+
'<details class="club-roster-details"><summary>Complete roster statistics <span>('+eligible.length+' eligible players)</span></summary><div class="table-wrap"><table class="nbl-player-table"><thead><tr><th>Player</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th></tr></thead><tbody>'+[...players.values()].sort((a,b)=>avg(b,'pts')-avg(a,'pts')).map(p=>'<tr><th>'+esc(p.name)+'</th><td>'+p.gp+'</td><td>'+number(avg(p,'pts'))+'</td><td>'+number(avg(p,'reb'))+'</td><td>'+number(avg(p,'ast'))+'</td><td>'+number(avg(p,'stl'))+'</td><td>'+number(avg(p,'blk'))+'</td></tr>').join('')+'</tbody></table></div></details><p class="club-roster-links"><a href="nbl-players.html">All-NBL leaders ↗</a><a href="nbl-boxscores.html">Game-by-game stats ↗</a><a href="nbl-methodology.html">MVP method ↗</a></p>';
}).catch(()=>{root.textContent='Player data is temporarily unavailable.'});
})();