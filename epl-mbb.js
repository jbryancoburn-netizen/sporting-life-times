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
  container.querySelectorAll('[data-epl-today]').forEach(n=>n.remove());
  const existingIds=new Set([...container.querySelectorAll('a.epl-score-tile[href]')].map(a=>{try{return new URL(a.href).searchParams.get('game')}catch{return null}}).filter(Boolean));
  for(const e of events.slice(0,8)){
   if(existingIds.has(String(e.id)))continue;
   const c=[...e.competitions[0].competitors].sort((a,b)=>Number(a.homeAway==='home')-Number(b.homeAway==='home'));
   const row=document.createElement('div');row.className='epl-score-tile slt-live-score';row.dataset.eplToday=e.id||'today';
   const status=String(e.status?.type?.shortDetail||e.status?.type?.description||'Scheduled');
   const state=e.status?.type?.state;
   const head=document.createElement('span');head.className='epl-score-date';head.textContent=(state==='in'?'LIVE · ':state==='post'?'FINAL · ':'TODAY · ')+status;
   row.appendChild(head);
   for(const t of c){
    const line=document.createElement('div');const left=document.createElement('span');left.className='epl-team';
    const imgUrl=htmlUrl(t.team?.logo||t.team?.logos?.[0]?.href);
    if(imgUrl){const img=document.createElement('img');img.className='epl-crest';img.alt='';img.loading='lazy';img.src=imgUrl;left.append(img);}
    const name=document.createElement('span');name.textContent=t.team?.shortDisplayName||t.team?.displayName||'Club';left.appendChild(name);
    const value=document.createElement('b');value.textContent=state==='pre'?'':String(t.score??'');
    line.append(left,value);row.appendChild(line);
   }
   container.prepend(row);
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