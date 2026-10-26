(()=>{'use strict';
const host=document.getElementById('ncaa-selection-forecast');if(!host)return;
const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined&&txt!==null)e.textContent=String(txt);if(cls)e.className=cls;return e};
async function show(){
 try{
  const r=await fetch('data/college-soccer-ncaa-selection-forecast.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Forecast data is unavailable');
  const d=await r.json();if(d.field?.length!==48||d.automatic_bid_scenarios?.length!==23||d.at_large_proxy?.length!==25)throw Error('Invalid selection forecast field');
  host.replaceChildren();
  const headline=el('div',null,'cs-selection-summary');
  for(const [value,label] of [[48,'FIELD'],[23,'AUTO BIDS'],[25,'AT-LARGE'],[24,'SEEDED'],[16,'BYE TEAMS']]){const x=el('div',null,'cs-selection-metric');x.append(el('strong',value),el('span',label));headline.append(x)}host.append(headline);
  host.append(el('p','EXPERIMENTAL FORECAST · '+d.rating_cutoff+' · Conference champions and at-large entries are illustrative Elo scenarios, not NCAA RPI, committee selections, official seeds or selection probabilities.','cs-selection-warning'));
  const groups=[['EXPERIMENTAL TOP 24 · NOT NCAA SEEDS',d.field.slice(0,24)],['PROJECTED FIELD · REMAINING 24',d.field.slice(24)],['BUBBLE · FIRST FOUR OUT (ELO PROXY)',d.first_four_out_proxy]];
  for(const [heading,rows] of groups){const block=el('section',null,'cs-selection-group');block.append(el('h2',heading));const table=el('table',null,'cs-selection-table');const head=el('tr');for(const name of ['#','School','Route','USRS'])head.append(el('th',name));table.append(head);
   rows.forEach((entry,i)=>{const tr=el('tr');tr.append(el('td',entry.experimental_strength_order||i+49),el('td',entry.team),el('td',entry.bid_type==='projected_aq'?'AQ scenario':entry.bid_type==='elo_proxy_at_large'?'At-large proxy':'Bubble'),el('td',Math.round(entry.elo)));table.append(tr)});block.append(table);host.append(block)}
  const source=el('p','Official NCAA selection criteria require RPI, strength of schedule, quality of results, head-to-head, common opponents and eligibility review. These cannot be substituted with Elo. NCAA selection is November 16.','cs-selection-warning');host.append(source);
 }catch(error){host.replaceChildren(el('p','NCAA selection model could not load: '+error.message,'cs-selection-warning'))}
}show();setInterval(show,60000);
})();
