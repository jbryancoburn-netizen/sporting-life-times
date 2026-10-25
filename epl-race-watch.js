(()=>{'use strict';const mount=document.querySelector('#epl-race-watch');if(!mount)return;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('data/epl-ratings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
if(!Array.isArray(d.standings)||d.standings.length!==20)throw Error();
const t=d.standings;const max=Math.max(1,...t.map(x=>x.points));
const rows=(arr)=>arr.map(x=>'<div class="epl-race-club"><span>'+e(x.club)+'</span><span class="epl-race-bar" style="--club:'+(x.gd>=0?'#3e775c':'#b55b4c')+'"><i style="width:'+Math.max(2,100*x.points/max)+'%"></i></span><strong>'+x.points+' pts</strong></div>').join('');
const cards=[['Title pace',t.slice(0,5),'Top five by published league points'],['European chase',t.slice(4,9),'Positions 5–9; qualification depends on season rules'],['Survival watch',t.slice(-5).reverse(),'Bottom five; points shown, not a relegation probability']];
mount.innerHTML='<h2>THE RACES</h2><div class="epl-race-grid">'+cards.map(([name,teams,note])=>'<section><h3>'+name+'</h3>'+rows(teams)+'<p class="epl-race-context">'+note+'</p></section>').join('')+'</div>';
}).catch(()=>{mount.textContent='Race-watch standings unavailable.'})})();