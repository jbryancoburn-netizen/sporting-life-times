(()=>{'use strict';
const host=document.getElementById('ncaa-selection-forecast');if(!host)return;
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x};
const file=async path=>{const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path+' unavailable');return r.json()};
let mode='ncaa';
function draw(data,metrics){
 host.replaceChildren();
 const nav=el('div',null,'cs-selection-modes');
 for(const [value,label] of [['ncaa','NCAA COMMITTEE FORECAST'],['usrs','NCAA CRITERIA + USRS ELO']]){
  const b=el('button',label);b.type='button';b.className=mode===value?'active':'';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;draw(data,metrics)};nav.append(b)
 }host.append(nav);
 const summary=el('div',null,'cs-selection-summary');
 for(const [value,label] of [[48,'FIELD'],[23,'AUTOMATIC'],[25,'AT-LARGE'],[24,'SEEDED'],[16,'BYE TEAMS']]){const x=el('div',null,'cs-selection-metric');x.append(el('strong',value),el('span',label));summary.append(x)}host.append(summary);
 if(mode==='ncaa'){
  host.append(el('h2','NCAA CRITERIA FORECAST'));
  host.append(el('p','The NCAA view is built around adjusted RPI, strength of schedule, record, nonconference results, head-to-head, common opponents, selected-opponent results and the final eight matches. It does NOT use USRS Elo.','cs-selection-warning'));
  if(metrics?.status!=='verified_complete'){
   host.append(el('h3','NCAA FIELD NOT YET CERTIFIED'));
   host.append(el('p','A complete 2026 NCAA RPI/résumé dataset is not available in the project. Rather than falsely label Elo selections as an NCAA-style field, this view remains pending until the verified selection metrics are loaded. The at-large bubble and seeds are not calculated from absent data.','cs-selection-warning'));
  }
 }
 const entries=mode==='usrs'?data.field:(Array.isArray(metrics.field)?metrics.field:[]);
 host.append(el('h2',mode==='usrs'?'NCAA FORMAT + YOUR USRS ELO · INITIAL PROXY':'COMMITTEE-CRITERIA FIELD'));
 host.append(el('p',mode==='usrs'?'Your independent USRS ratings replace the committee evaluation tool within the NCAA selection framework. NCAA field sizes, bid allocations, eligibility screening and seed structure remain in force. NCAA hosting/geography rules are not yet fully modeled.':'Selection based on verified NCAA résumé metrics.','cs-selection-warning'));
 const bracket=el('section',null,'ncaa-bracket');
 bracket.append(el('h2',mode==='usrs'?'USRS PROJECTED NCAA BRACKET':'NCAA COMMITTEE BRACKET'));
 bracket.append(el('p',mode==='usrs'?'USRS acts as the hypothetical selection committee: 23 projected automatic bids, 25 eligible at-large picks, 24 seeded teams and 16 byes. The model avoids same-conference first-round matches where feasible; hosting and geography are not yet resolved.':'NCAA résumé metrics are still incomplete. These are 48 structural slots, not invented committee selections.','cs-selection-warning'));
 const entrants=mode==='usrs'?data.field:[];
 const byRank=n=>entrants[n-1]||null;
 const label=n=>byRank(n)?'#'+n+' '+byRank(n).team:'Unassigned slot '+n;
 const win=(a,b)=>a&&b?(a.elo>=b.elo?a:b):null;
 const order=[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11];
 // Assign all 32 first-round competitors; 17-24 are seeded, 25-48 unseeded.
 // For each opening game, preserve the seeded team and swap only unseeded
 // opponents to avoid a same-conference first-round pairing where feasible.
 const opponents=Array.from({length:16},(_,i)=>48-i);
 const conference=n=>byRank(n)?.conference||null;
 const conflicts=(seed,opponent)=>conference(seed)&&conference(seed)===conference(opponent);
 for(let i=0;i<16;i++){
   const home=17+i;
   if(!conflicts(home,opponents[i]))continue;
   let swap=-1;
   for(let j=i+1;j<16;j++){
     if(!conflicts(home,opponents[j])&&!conflicts(17+j,opponents[i])){swap=j;break}
   }
   if(swap>=0)[opponents[i],opponents[swap]]=[opponents[swap],opponents[i]];
 }
 const unresolvedOpening=opponents.reduce((n,op,i)=>n+(conflicts(17+i,op)?1:0),0);
 if(mode==='usrs'&&unresolvedOpening)bracket.append(el('p',unresolvedOpening+' first-round conference conflicts remain; bracket placement is not NCAA compliant.','cs-selection-warning'));
 const pods=order.map((seed,i)=>{const x=17+i,y=opponents[i],opening=win(byRank(x),byRank(y));return {seed,x,y,opening,advance:win(byRank(seed),opening)}});
 const quarters=[];
 for(let q=0;q<4;q++){
  const quadrant=el('section',null,'ncaa-bracket-quadrant');quadrant.append(el('h3','REGION '+(q+1)));
  const podGrid=el('div',null,'ncaa-bracket-pods');
  for(let i=q*4;i<q*4+4;i++){
   const p=pods[i],card=el('article',null,'ncaa-bracket-pod');
   card.append(el('strong','FIRST ROUND · '+p.x+' vs '+p.y));
   card.append(el('div',label(p.x),'ncaa-bracket-team'),el('div',label(p.y),'ncaa-bracket-team'));
   card.append(el('strong','SECOND ROUND · #'+p.seed+' BYE'));
   card.append(el('div',label(p.seed),'ncaa-bracket-team'),el('div',p.opening?'vs '+p.opening.team+' (USRS pick)':'vs first-round winner','ncaa-bracket-team'));
   if(p.advance)card.append(el('small','Advances: '+p.advance.team,'ncaa-bracket-advance'));
   podGrid.append(card);
  }
  quadrant.append(podGrid);
  const thirdA=win(pods[q*4].advance,pods[q*4+1].advance),thirdB=win(pods[q*4+2].advance,pods[q*4+3].advance),quarter=win(thirdA,thirdB);
  const path=el('div',null,'ncaa-bracket-path');path.append(el('strong','THIRD ROUND'),el('p',thirdA?thirdA.team:'Winner of pods 1 and 2'),el('p',thirdB?thirdB.team:'Winner of pods 3 and 4'),el('strong','QUARTERFINAL'),el('p',quarter?quarter.team:'Third-round winners'));quadrant.append(path);
  quarters.push(quarter);bracket.append(quadrant);
 }
 const semiA=win(quarters[0],quarters[1]),semiB=win(quarters[2],quarters[3]),champ=win(semiA,semiB);
 const finish=el('section',null,'ncaa-bracket-finish');finish.append(el('h3','COLLEGE CUP SEMIFINALS'),el('p',semiA?semiA.team:'Semifinal winner TBD'),el('p',semiB?semiB.team:'Semifinal winner TBD'),el('h3','NATIONAL CHAMPIONSHIP'),el('p',champ?'USRS pick: '+champ.team:'Champion TBD'));bracket.append(finish);host.append(bracket);
 const groups=[['FIRST 24 · EXPERIMENTAL ORDER',entries.slice(0,24)],['REMAINING FIELD',entries.slice(24)],['BUBBLE / NEXT FOUR',mode==='usrs'?data.first_four_out_proxy:metrics.first_four_out||[]]];
 for(const [name,rows] of groups){
  const section=el('section',null,'cs-selection-group');section.append(el('h2',name));
  const table=el('table',null,'cs-selection-table');const head=el('tr');
  for(const h of ['#','School','Bid path',mode==='usrs'?'USRS':'Résumé score'])head.append(el('th',h));table.append(head);
  rows.forEach((x,i)=>{const tr=el('tr');for(const v of [x.experimental_strength_order||i+1,x.team,x.bid_type==='projected_aq'?'Projected AQ':'At-large scenario',mode==='usrs'?Math.round(x.elo):x.resume_score??'—'])tr.append(el('td',v));table.append(tr)});
  section.append(table);host.append(section);
 }
}
async function show(){try{const data=await file('data/college-soccer-ncaa-selection-forecast.json');if(data.field?.length!==48)throw Error('Invalid field');const metrics=await file('data/college-soccer-ncaa-criteria.json').catch(()=>({status:'not_ready'}));draw(data,metrics)}catch(e){host.replaceChildren(el('p','Selection forecast unavailable: '+e.message))}}
show();setInterval(show,60000);
})();