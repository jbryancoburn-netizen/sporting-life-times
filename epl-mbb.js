/* EPL front-page score rail: the verified ledger is the fallback. Current matchday
   replaces nothing unless a live scoreboard explicitly returns games for today. */
(()=>{'use strict';
const viewed=document.getElementById('epl-viewed');
const localTime=x=>new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
if(viewed)viewed.textContent='Viewed '+localTime(new Date().toISOString());
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const htmlUrl=x=>{try{let u=new URL(x);return u.protocol==='https:'?u.href:''}catch{return ''}};
const currentDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/[^0-9]/g,'');
let ongoing=false;
async function updateLive(){
 if(ongoing||document.hidden)return;ongoing=true;
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  let response;try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates='+currentDay(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok)return;const d=await response.json();
  if(!Array.isArray(d.events))return;
  const events=d.events.filter(e=>Array.isArray(e.competitions?.[0]?.competitors)&&e.competitions[0].competitors.length>=2);
  const container=document.querySelector('#epl-score-rail .epl-score-rail');if(!container||!events.length)return;
  for(const e of events.slice(0,8).reverse()){
   const game=e.competitions[0];
   const c=[...game.competitors].sort((a,b)=>Number(a.homeAway==='home')-Number(b.homeAway==='home'));
   const state=e.status?.type?.state,phase=state==='in'?'live':state==='post'?'final':'upcoming';
   const status=String(e.status?.type?.shortDetail||e.status?.type?.description||'');
   let row=[...container.querySelectorAll('[data-epl-fixture]')].find(tile=>tile.dataset.eplFixture===String(e.id));
   if(!row){
    row=document.createElement('article');row.className='ledger26-card epl-master-card slt-live-score';row.dataset.eplFixture=String(e.id);
    const side=t=>({name:t.team?.displayName||'Club',score:t.score,
     color:'#'+(t.team?.color||'655239'),record:t.records?.[0]?.summary||'Record unavailable',
     crest:htmlUrl(t.team?.logo)?'<img class="epl-crest" src="'+esc(htmlUrl(t.team.logo))+'" alt="">':''});
    const bug=window.SLTSportsScorebug?.render({phase,status,time:localTime(e.date),away:side(c[0]),home:side(c[1])})||'';
    row.innerHTML='<div class="ledger26-meta"><span>Premier League</span><span>'+esc(localTime(e.date))+'</span></div><details class="ledger26-expand"><summary class="ledger26-summary">'+bug+'<span class="ledger26-instruction">MATCH STATS · CLICK TO EXPAND +</span></summary><div class="ledger26-expanded epl-match-stats" aria-live="polite"><p>Open this game to load match statistics.</p></div></details>';
    container.prepend(row);
   }
   row.dataset.eplToday=String(e.id);
   row.querySelectorAll('.ledger26-points').forEach((node,i)=>{node.textContent=state==='pre'?'—':String(c[i]?.score??'—')});
   const label=row.querySelector('.ledger26-status');
   if(label){label.dataset.phase=phase;label.textContent=state==='pre'?localTime(e.date):(state==='in'?'LIVE · ':'FINAL · ')+status;}
  }
  const note=document.querySelector('#slt-matchday .slt-score-note');
  if(note){const ratings=note.dataset.ratingsLabel||note.textContent.split(' · Live matchday checked')[0];note.dataset.ratingsLabel=ratings;note.textContent=ratings+' · Live matchday checked '+localTime(new Date().toISOString());}
 }catch(e){/* Keep the verified published score ledger instead of fabricating scores. */}
 finally{ongoing=false}
}
const onReady=()=>{const el=document.querySelector('#epl-score-rail .epl-score-rail');if(el){updateLive();return true}return false;};
if(!onReady()){const rail=document.getElementById('epl-score-rail');if(rail){const observer=new MutationObserver(()=>{if(onReady())observer.disconnect()});observer.observe(rail,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),12000);}}
setInterval(updateLive,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateLive()});
})();