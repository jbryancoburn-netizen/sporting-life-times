(()=>{'use strict';
const host=document.getElementById('ncaa-selection-forecast');if(!host)return;
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x};
const file=async path=>{const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path+' unavailable');return r.json()};
let mode='ncaa';
const brandFor=(entry,branding)=>branding?.teams?.['men-d1:'+entry?.team_id]||{};
function schoolRow(entry,branding,kind=''){
 const line=el('div',null,'ncaa-school-row '+kind);
 if(!entry){line.append(el('span','TO BE SELECTED','ncaa-school-placeholder'));return line}
 const crest=el('span',null,'ncaa-school-crest'),brand=brandFor(entry,branding);
 const name=entry.team||entry.team_id,src=brand.logo_url||('https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+entry.team_id+'.svg');
 crest.textContent=name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
 const img=el('img');img.alt='';img.loading='lazy';img.src=src;img.onerror=()=>img.remove();crest.append(img);
 const meta=el('span',null,'ncaa-school-meta');meta.append(el('strong',name),el('small',(entry.conference||'').replace('men-d1:','').toUpperCase()+' · '+(entry.bid_type==='projected_aq'?'AUTO BID':'AT-LARGE')));
 line.append(crest,meta);return line;
}
function draw(data,metrics,branding){
 host.replaceChildren();
 const nav=el('div',null,'cs-selection-modes');
 for(const [value,label] of [['ncaa','NCAA COMMITTEE FORECAST'],['usrs','NCAA CRITERIA + USRS ELO']]){
  const b=el('button',label);b.type='button';b.className=mode===value?'active':'';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;draw(data,metrics,branding)};nav.append(b)
 }host.append(nav);
 if(Array.isArray(metrics?.field)&&metrics.field.length===48){
  const nIds=new Set(metrics.field.map(x=>x.team_id)),uIds=new Set(data.field.map(x=>x.team_id));
  const ncaaOnly=metrics.field.filter(x=>!uIds.has(x.team_id));
  const usrsOnly=data.field.filter(x=>!nIds.has(x.team_id));
  const comparison=el('section',null,'ncaa-selection-comparison');
  comparison.append(el('h2','THE SELECTION SPLIT'));
  const stats=el('div',null,'ncaa-selection-compare-grid');
  const same=el('div',null,'ncaa-selection-compare-metric');same.append(el('strong',48-ncaaOnly.length),el('span','AGREED TEAMS'));
  const different=el('div',null,'ncaa-selection-compare-metric');different.append(el('strong',ncaaOnly.length),el('span','EACH MODEL PICKS DIFFERENTLY'));
  stats.append(same,different);comparison.append(stats);
  const lists=el('div',null,'ncaa-selection-compare-lists');
  for(const [label,rows] of [['NCAA RPI ONLY',ncaaOnly],['USRS ONLY',usrsOnly]]){
   const col=el('section');col.append(el('h3',label));
   for(const x of rows)col.append(schoolRow(x,branding,'ncaa-compare-team'));
   lists.append(col);
  }
  comparison.append(lists);host.append(comparison);
 }
 const summary=el('div',null,'cs-selection-summary');
 for(const [value,label] of [[48,'FIELD'],[23,'AUTOMATIC'],[25,'AT-LARGE'],[24,'SEEDED'],[16,'BYE TEAMS']]){const x=el('div',null,'cs-selection-metric');x.append(el('strong',value),el('span',label));summary.append(x)}host.append(summary);
 if(mode==='ncaa'){
  host.append(el('h2','NCAA CRITERIA FORECAST'));
  host.append(el('p','The NCAA view is built around adjusted RPI, strength of schedule, record, nonconference results, head-to-head, common opponents, selected-opponent results and the final eight matches. It does NOT use USRS Elo.','cs-selection-warning'));
  if(!Array.isArray(metrics?.field)||metrics.field.length!==48){
   host.append(el('h3','NCAA RPI FORECAST SOURCE NOT AVAILABLE'));
   host.append(el('p','The full NCAA résumé data is not available. A provisional NCAA RPI forecast is displayed when the ranking snapshot loads.','cs-selection-warning'));
  }
 }
 const entries=mode==='usrs'?data.field:(Array.isArray(metrics?.field)?metrics.field:[]);
 host.append(el('h2',mode==='usrs'?'USRS SELECTION COMMITTEE · 48-TEAM PROJECTION':'NCAA RPI COMMITTEE FORECAST · 48-TEAM PROJECTION'));
 host.append(el('p',mode==='usrs'?'Your independent USRS ratings replace the committee evaluation tool within the NCAA selection framework. NCAA field sizes, bid allocations, eligibility screening and seed structure remain in force. NCAA hosting/geography rules are not yet fully modeled.':'Projected NCAA committee field from the October 23 RPI table, conference qualification projections and provisional at-large eligibility. It is a forecast, not the official selection committee field.','cs-selection-warning'));
 const bracket=el('section',null,'ncaa-bracket');
 bracket.append(el('h2',mode==='usrs'?'USRS PROJECTED NCAA BRACKET':'NCAA RPI PROJECTED BRACKET'));
 bracket.append(el('p',mode==='usrs'?'USRS acts as the hypothetical selection committee: 23 projected automatic bids, 25 eligible at-large picks, 24 seeded teams and 16 byes. The model avoids same-conference first-round matches where feasible; hosting and geography are not yet resolved.':'NCAA résumé metrics are still incomplete. These are 48 structural slots, not invented committee selections.','cs-selection-warning'));
 const entrants=mode==='usrs'?data.field:(Array.isArray(metrics?.field)?metrics.field:[]);
 const byRank=n=>entrants[n-1]||null;
 const label=n=>byRank(n)?'#'+n+' '+byRank(n).team:'Unassigned slot '+n;
 const win=(a,b)=>a&&b?(a.elo>=b.elo?a:b):null;
 const order=[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11];
 // A 48-team single-elimination field has 16 first-round games.
 // Seeds 1-16 have byes; seeds 17-24 join 24 unseeded teams in round one.
 // Only eight first-round matches contain a 17-24 seed.
 const conference=n=>byRank(n)?.conference||null;
 const conflict=(x,y)=>x&&y&&conference(x)&&conference(x)===conference(y);
 const entrantsPool=Array.from({length:24},(_,i)=>25+i);
 const pairings=[];
 for(let i=0;i<8;i++)pairings.push([17+i,null]);
 for(let i=0;i<8;i++)pairings.push([null,null]);
 // Assign unseeded teams to opening games, preferring no intraconference match.
 for(let i=0;i<16;i++){
   for(let side=0;side<2;side++){
     if(pairings[i][side]!==null)continue;
     const other=pairings[i][1-side];
     let idx=entrantsPool.findIndex(n=>!conflict(n,other));
     if(idx<0)idx=0;
     pairings[i][side]=entrantsPool.splice(idx,1)[0];
   }
 }
 if(entrantsPool.length)throw Error('Unassigned tournament entrants');
 const unresolvedOpening=pairings.filter(([x,y])=>conflict(x,y)).length;
 if(unresolvedOpening)bracket.append(el('p',unresolvedOpening+' same-conference opening-round pairing(s) remain; placement needs review.','cs-selection-warning'));
 const pods=order.map((seed,i)=>{const [x,y]=pairings[i],opening=win(byRank(x),byRank(y));return {seed,x,y,opening,advance:win(byRank(seed),opening)}});
 const quarters=[];
 for(let q=0;q<4;q++){
  const quadrant=el('section',null,'ncaa-bracket-quadrant');quadrant.append(el('h3','REGION '+(q+1)));
  const podGrid=el('div',null,'ncaa-bracket-pods');
  for(let i=q*4;i<q*4+4;i++){
   const p=pods[i],card=el('article',null,'ncaa-bracket-pod');
   const first=el('div',null,'ncaa-round-one');
   first.append(el('strong','FIRST ROUND · '+p.x+' vs '+p.y));
   first.append(schoolRow(byRank(p.x),branding,'ncaa-bracket-team'),schoolRow(byRank(p.y),branding,'ncaa-bracket-team'));
   const second=el('div',null,'ncaa-round-two');
   second.append(el('strong','SECOND ROUND · #'+p.seed+' BYE'));
   second.append(schoolRow(byRank(p.seed),branding,'ncaa-bracket-team'));
   second.append(p.opening?schoolRow(p.opening,branding,'ncaa-bracket-team'):el('div','First-round winner','ncaa-bracket-team'));
   if(p.advance)second.append(el('small','USRS ADVANCES · '+p.advance.team,'ncaa-bracket-advance'));
   card.append(first,second);
   podGrid.append(card);
  }
  quadrant.append(podGrid);
  const thirdA=win(pods[q*4].advance,pods[q*4+1].advance),thirdB=win(pods[q*4+2].advance,pods[q*4+3].advance),quarter=win(thirdA,thirdB);
  const path=el('div',null,'ncaa-bracket-path');path.append(el('strong','THIRD ROUND'),el('p',thirdA?thirdA.team:'Winner of pods 1 and 2'),el('p',thirdB?thirdB.team:'Winner of pods 3 and 4'),el('strong','QUARTERFINAL'),el('p',quarter?quarter.team:'Third-round winners'));quadrant.append(path);
  quarters.push(quarter);bracket.append(quadrant);
 }
 const semiA=win(quarters[0],quarters[1]),semiB=win(quarters[2],quarters[3]),champ=win(semiA,semiB);
 const finish=el('section',null,'ncaa-bracket-finish');finish.append(el('h3','COLLEGE CUP SEMIFINALS'),el('p',semiA?semiA.team:'Semifinal winner TBD'),el('p',semiB?semiB.team:'Semifinal winner TBD'),el('h3','NATIONAL CHAMPIONSHIP'),el('p',champ?'USRS pick: '+champ.team:'Champion TBD'));bracket.append(finish);host.append(bracket);
 const groups=[['FIRST 24 · PROJECTED ORDER',entries.slice(0,24)],['REMAINING FIELD',entries.slice(24)],['BUBBLE / NEXT FOUR',mode==='usrs'?data.first_four_out_proxy:metrics.first_four_out||[]]];
 for(const [name,rows] of groups){
  const section=el('section',null,'cs-selection-group');section.append(el('h2',name));
  const table=el('table',null,'cs-selection-table');const head=el('tr');
  for(const h of ['#','School','Bid path',mode==='usrs'?'USRS':'Résumé score'])head.append(el('th',h));table.append(head);
  rows.forEach((x,i)=>{const tr=el('tr');for(const v of [x.experimental_strength_order||i+1,x.team,x.bid_type==='projected_aq'?'Projected AQ':'At-large scenario',mode==='usrs'?Math.round(x.elo):x.resume_score??'—'])tr.append(el('td',v));table.append(tr)});
  section.append(table);host.append(section);
 }
}
async function show(){try{const data=await file('data/college-soccer-ncaa-selection-forecast.json');if(data.field?.length!==48)throw Error('Invalid field');const metrics=await file('data/college-soccer-ncaa-rpi-forecast-2026.json').catch(()=>({status:'not_ready'}));const branding=await file('data/college-soccer-team-branding.json').catch(()=>({teams:{}}));draw(data,metrics,branding)}catch(e){host.replaceChildren(el('p','Selection forecast unavailable: '+e.message))}}
show();setInterval(show,60000);
})();