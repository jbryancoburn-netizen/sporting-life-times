(()=>{'use strict';
const urls=['data/epl-ratings.json','data/epl-match-center.json','multi_scoreboards.json'];
const node=document.createElement('div');node.id='epl-feed-health';node.setAttribute('role','status');node.style.cssText='padding:9px 15px;margin:10px auto;max-width:1120px;border:1px solid #b7aa91;background:#f5f1e8;color:#222;font:12px Arial,sans-serif;line-height:1.5';
document.querySelector('main')?.prepend(node);
let previous=null;let first=true;
const extract=d=>[d.as_of_date,d.completed_matches,d.issued_at_utc,d.updated_at,d.provenance?.source_sha256];
async function check(){try{
const results=await Promise.all(urls.map(async u=>{const r=await fetch(u+'?health='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(u+' '+r.status);return r.json()}));
const [rating,forecast,scores]=results;
const stamps=[rating.as_of_date,forecast.issued_at_utc,scores.updated_at];
const key=JSON.stringify(results.map(extract));
const last=Date.parse(forecast.issued_at_utc||'');
const age=Number.isFinite(last)?Math.round((Date.now()-last)/60000):null;
const stale=age===null||age>120;
node.textContent='EPL FEED CHECK · Elo '+(stamps[0]||'unknown')+' ('+(rating.completed_matches??'?')+' finals) · Forecast '+(stamps[1]||'unknown')+' · Scoreboard '+(stamps[2]||'unknown')+(stale?' · WARNING: forecast export is stale; predictions may not reflect completed matches.':' · Forecast export recent.');
node.style.borderColor=stale?'#ad5a3b':'#6b8871';
if(!first&&previous!==null&&key!==previous&&document.visibilityState==='visible')location.reload();
previous=key;first=false;
}catch(e){node.textContent='EPL FEED WARNING · One or more published data feeds cannot be checked. Current information is not verified.';node.style.borderColor='#ad5a3b'}}
check();setInterval(()=>{if(document.visibilityState==='visible')check()},60000);
})();