(()=>{'use strict';
const urls=['data/epl-ratings.json','data/epl-match-center.json','multi_scoreboards.json','data/epl-pipeline-status.json'];
const node=document.getElementById('epl-feed-health')||document.createElement('div');node.id='epl-feed-health';node.setAttribute('role','status');
if(!node.isConnected)(document.querySelector('.slt-stamp')||document.querySelector('main'))?.appendChild(node);
let previous=null,checking=false;
const time=x=>Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'unavailable';
async function check(){if(checking)return;checking=true;try{
const [rating,forecast,scores,pipeline]=await Promise.all(urls.map(async u=>{const r=await fetch(u+'?health='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(u);return r.json()}));
const board=scores.leagues?.find(x=>x.league==='Premier League');
const age=(Date.now()-Date.parse(forecast.issued_at_utc))/60000;
const stale=!Number.isFinite(age)||age>60||pipeline.job_status!=='success';
node.dataset.stale=String(stale);
node.textContent='Ratings & table: '+time(forecast.issued_at_utc)+' · '+(rating.completed_matches??'?')+' verified finals · Live scores check every minute · '+(stale?'Ratings refresh delayed; live scores may be ahead of the table.':'Automatic data refresh active.');
node.title='EPL scoreboard: '+time(board?.updated_at)+' · Last scheduler check: '+time(pipeline.checked_at_utc)+' · '+pipeline.job_status;
// Only changed football results/forecasts trigger a new edition. Heartbeats do not.
const key=JSON.stringify([rating.provenance?.source_sha256,forecast.fixtures]);
if(previous!==null&&previous!==key&&!document.hidden)location.reload();
previous=key;
}catch(e){node.textContent='Published data refresh unavailable. Displayed ratings may be delayed.';node.dataset.stale='true'}finally{checking=false}}
check();setInterval(()=>{if(!document.hidden)check()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
