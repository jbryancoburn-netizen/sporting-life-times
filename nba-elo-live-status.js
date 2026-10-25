(()=>{'use strict';
const label=document.getElementById('nba-elo-update-state');if(!label)return;
let initial=null;
const text=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
async function poll(){
 try{
  const resp=await fetch('data/nba-2026-27-current-provisional.json?fresh='+Date.now(),{cache:'no-store'});
  if(!resp.ok)throw Error('Unavailable');
  const data=await resp.json(),events=Array.isArray(data.events)?data.events:[],last=events.at(-1);
  if(!last){label.textContent='No verified regular-season finals published yet';return}
  const count=events.length;
  const latest=last.away+' '+last.away_score+' – '+last.home+' '+last.home_score;
  const movement=Number(last.home_elo_change);
  const delta=Number.isFinite(movement)?' · Elo: '+last.home+' '+(movement>=0?'+':'')+movement.toFixed(1)+' / '+last.away+' '+(-movement>=0?'+':'')+(-movement).toFixed(1):'';
  const time=last.date?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}).format(new Date(last.date)):'';
  label.textContent=count+' completed games processed · Latest: '+latest+(time?' ('+time+')':'')+delta;
  if(initial!==null&&count>initial){label.textContent+=' · New final processed — updating page';setTimeout(()=>location.reload(),1500)}
  initial=count;
 }catch(_){label.textContent='Elo refresh status temporarily unavailable'}
}
poll();setInterval(poll,60000);
})();