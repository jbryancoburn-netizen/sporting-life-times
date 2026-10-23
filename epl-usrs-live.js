(()=>{'use strict';
const target=document.getElementById('usrs-live-ratings');
const status=document.getElementById('usrs-live-status');
if(!target||!status)return;
const endpoint='https://raw.githubusercontent.com/jbryancoburn-netizen/universal-sports-rating-system/main/newspaper-feed/epl.json';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
(async()=>{try{
const response=await fetch(endpoint,{cache:'no-store'});
if(!response.ok)throw Error('No published independent EPL feed');
const data=await response.json();
if(!/^20\d\d-\d\d-\d\d$/.test(data.as_of_date)||!data.ratings||Object.keys(data.ratings).length!==20||!data.provenance||!data.provenance.source_sha256)throw Error('Invalid USRS provenance');
const rows=Object.entries(data.ratings);
if(rows.some(([name,value])=>!name||typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid Elo rating');
rows.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const age=(Date.now()-Date.parse(data.as_of_date+'T00:00:00Z'))/86400000;
const freshness=age>2?'Archived snapshot':'Latest published snapshot';
target.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr><th scope="col">Rank</th><th scope="col">Club</th><th scope="col">Independent Elo</th></tr></thead><tbody>'+rows.map(([club,elo],i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(club)+'</td><td>'+elo.toFixed(1)+'</td></tr>').join('')+'</tbody></table>';
status.textContent=freshness+' · As of '+data.as_of_date+' · '+data.completed_matches+' verified results · '+(data.provenance.rating_origin||'Rating initialization not disclosed')+'. Date-only calculations exclude same-day scores. Predictions appear only for verified source-listed future fixtures.';
}catch(error){status.textContent='The independent live Elo feed has not been published or cannot be verified. Existing historical rankings remain available.';target.replaceChildren();}
})();
})();
