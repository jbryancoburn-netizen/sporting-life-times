(()=>{'use strict';const mount=document.querySelector('#epl-race-watch');if(!mount)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids={'Arsenal':359,'Aston Villa':362,'Bournemouth':349,'Brentford':337,'Brighton':331,'Chelsea':363,'Coventry':388,'Crystal Palace':384,'Everton':368,'Fulham':370,'Hull':306,'Ipswich':373,'Leeds United':357,'Liverpool':364,'Manchester City':382,'Manchester United':360,'Newcastle United':361,"Nott'm Forest":393,'Sunderland':366,'Tottenham':367};
fetch('data/epl-ratings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
if(!Array.isArray(d.standings)||d.standings.length!==20)throw Error();
const rows=arr=>arr.map(x=>'<div class="epl-race-club"><a class="epl-race-identity" href="epl-club.html?club='+ids[x.club]+'"><img src="https://a.espncdn.com/i/teamlogos/soccer/500/'+ids[x.club]+'.png" alt="" loading="lazy"><span>'+esc(x.club)+'</span></a><strong>'+x.points+' <small>pts</small></strong></div>').join('');
const t=d.standings;
const cards=[['Title pace',t.slice(0,5),'Top five by published league points'],['European chase',t.slice(4,9),'Positions 5–9; qualification depends on season rules'],['Survival watch',t.slice(-5).reverse(),'Bottom five; points shown, not a relegation probability']];
mount.innerHTML='<h2>The Races</h2><div class="epl-race-grid">'+cards.map(([name,teams,note])=>'<section class="epl-race-card"><h3>'+name+'</h3>'+rows(teams)+'<p class="epl-race-context">'+note+'</p></section>').join('')+'</div>';
}).catch(()=>{mount.textContent='Race-watch standings unavailable.'})})();
