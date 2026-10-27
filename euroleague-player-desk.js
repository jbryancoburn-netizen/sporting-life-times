(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['points','SCORING','PPG'],['rebounds','REBOUNDING','RPG'],['assists','PLAYMAKING','APG'],['pir','PERFORMANCE INDEX','PIR']];
let last='';
async function render(){
 try{
  const response=await fetch('data/euroleague-player-leaders.json?ts='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('Not yet published');
  const d=await response.json();
  if(d.season!=='2026-27'||!d.leaders||categories.some(([key])=>!Array.isArray(d.leaders[key])||d.leaders[key].length<5))throw Error('Unverified or incomplete player leaderboard');
  if(last===d.updated_at)return;
  $('el-player-leaders').innerHTML=categories.map(([key,title,unit])=>'<article class="el-player-category"><header><h3>'+title+'</h3><small>'+unit+' · season average</small></header>'+
    d.leaders[key].slice(0,5).map((p,i)=>{
      const photo=typeof p.photo==='string'&&p.photo.startsWith('https://')?'<img class="el-player-photo" src="'+esc(p.photo)+'" alt="" loading="lazy" onerror="this.hidden=true">':'';
      return '<div class="el-player-row"><b class="el-player-rank">'+(i+1)+'</b><div class="el-player-avatar">'+photo+'<span aria-hidden="true">●</span></div><div class="el-player-name"><strong>'+esc(p.name)+'</strong><small>'+esc(p.club)+' · '+(p.games===null?'Games unreported':p.games+' GP')+'</small></div><strong class="el-player-value">'+Number(p[key]).toFixed(1)+'</strong></div>';
    }).join('')+'</article>').join('');
  $('el-player-status').textContent='Official EuroLeague season statistics · '+d.players_parsed+' player records · Updated '+new Date(d.updated_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
  last=d.updated_at;
 }catch(e){
  if(!last){$('el-player-status').textContent='Official player statistics are being verified; no estimated player rankings are displayed.';$('el-player-leaders').innerHTML='<p class="hub-small">Player leaderboards will appear once the official 2026–27 data passes validation.</p>';}
 }
}
render();setInterval(()=>{if(!document.hidden)render()},120000);
})();