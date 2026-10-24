(()=>{'use strict';
const root=document.getElementById('nba-live-feed');if(!root)return;
const status=document.getElementById('nba-live-status');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=c=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[c]||c.toLowerCase())+'.png';
let lastOK=0;
function render(payload){
 const events=Array.isArray(payload.events)?payload.events:[];
 if(!events.length){root.innerHTML='<p class="hub-small">No NBA games listed for today.</p>';return;}
 const mapped=events.map(e=>{
  const co=e.competitions?.[0]||{};const cs=co.competitors||[];
  const away=cs.find(c=>c.homeAway==='away'),home=cs.find(c=>c.homeAway==='home');
  const st=e.status?.type||{},state=st.state||'pre',label=st.shortDetail||st.description||'Scheduled';
  if(!away||!home)return null;
  const team=c=>({name:c.team?.displayName||c.team?.name||'',code:c.team?.abbreviation||'',score:c.score??'',record:c.records?.find(r=>r.type==='total')?.summary||''});
  return {away:team(away),home:team(home),state,label,date:e.date,id:e.id};
 }).filter(Boolean);
 mapped.sort((a,b)=>({in:0,pre:1,post:2}[a.state]??3)-({in:0,pre:1,post:2}[b.state]??3));
 root.innerHTML=mapped.map(g=>{
  const playing=g.state==='in';const final=g.state==='post';const state=playing?'LIVE · '+g.label:final?'FINAL':new Date(g.date).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET';
  const team=t=>'<div class="nba-live-team"><img src="'+logo(esc(t.code))+'" alt="" loading="lazy"><span><b>'+esc(t.code)+'</b><small>'+esc(t.record)+'</small></span><strong>'+((playing||final)?esc(t.score):'–')+'</strong></div>';
  return '<article class="nba-live-match'+(playing?' playing':'')+'"><div class="nba-live-match-head"><b>'+esc(state)+'</b><span>'+ (playing?'IN PROGRESS':final?'VERIFIED FEED FINAL':'TODAY')+'</span></div>'+team(g.away)+team(g.home)+'</article>'
 }).join('');
}
async function update(){
 try{
  const today=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\D/g,'');
  const url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+today+'&_='+Date.now();
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('score feed '+r.status);
  const p=await r.json();render(p);lastOK=Date.now();
  status.textContent='Live NBA feed · checked '+new Date(lastOK).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET · refreshes every minute';
 }catch(e){status.textContent='Live feed unavailable · last successful check '+(lastOK?new Date(lastOK).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'not yet available')+'. Archive scores below may be older.';if(!lastOK)root.innerHTML='<p class="hub-small">Live scores unavailable. The verified game archive remains below.</p>';}
}
update();setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();