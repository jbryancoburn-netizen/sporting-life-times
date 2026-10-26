/* Newspaper projections are distinct from the published Elo engine. */
(function(root){
'use strict';
const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[v,...p])):[[]];
const regions=['East','West','South','Midwest'];
const pairs=[[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
const sites=[
 {city:'Pittsburgh',arena:'PPG Paints Arena',days:'March 18 & 20',fri:false},
 {city:'Omaha',arena:'CHI Health Center Omaha',days:'March 18 & 20',fri:false},
 {city:'Fort Worth',arena:'Dickies Arena',days:'March 18 & 20',fri:false},
 {city:'Spokane',arena:'Spokane Veterans Memorial Arena',days:'March 18 & 20',fri:false},
 {city:'Charlotte',arena:'Spectrum Center',days:'March 19 & 21',fri:true},
 {city:'Minneapolis',arena:'Target Center',days:'March 19 & 21',fri:true},
 {city:'Louisville',arena:'KFC Yum! Center',days:'March 19 & 21',fri:true},
 {city:'Sacramento',arena:'Golden 1 Center',days:'March 19 & 21',fri:true}
];
const regionSites={East:'New York · Madison Square Garden',West:'Los Angeles · Crypto.com Arena',South:'San Antonio · Frost Bank Center',Midwest:'Kansas City · T-Mobile Center'};
const id=g=>[g.home_id||g.home,g.away_id||g.away];
function resume(teams,games,net={}){
 const lookup=new Map(teams.map(t=>[t.team_id,t]));
 return teams.map(t=>{
 let wab=0,sos=0,w=0,l=0,road=0;const quadrants=Array.from({length:4},()=>[0,0]);let netGames=0;
 const played=games.filter(g=>id(g).includes(t.team_id));
 for(const g of played){const [h,a]=id(g),home=h===t.team_id,opp=lookup.get(home?a:h);if(!opp)continue;
 const won=Number(home?g.home_score:g.away_score)>Number(home?g.away_score:g.home_score);
 won?w++:l++;if(won&&!home&&g.site!=='neutral')road++;
 const advantage=g.site==='neutral'?0:(home?65:-65);
 wab+=(won?1:0)-1/(1+10**((opp.elo-1650-advantage)/400));sos+=opp.elo;
 const rank=net[opp.team_id];if(rank){netGames++;const cuts=g.site==='neutral'?[50,100,200]:(home?[30,75,160]:[75,135,240]);const q=cuts.findIndex(c=>rank<=c);quadrants[q<0?3:q][won?0:1]++;}
 }
 const n=w+l;return {...t,resume:{w,l,road,wab,n,sos:n?sos/n:null,quadrants,netGames},selectionScore:n?1500+60*wab+0.15*(t.elo-1500):t.elo};
 });
}
function field(teams,games=[]){
 const ranked=resume(teams,games).sort((a,b)=>b.selectionScore-a.selectionScore||a.team.localeCompare(b.team));
 const confs=[...new Set(ranked.map(t=>t.conference).filter(Boolean))];
 if(confs.length!==32)throw Error('The field needs 32 verified conference groups.');
 const auto=confs.map(c=>ranked.find(t=>t.conference===c)).sort((a,b)=>b.selectionScore-a.selectionScore);
 const autoIds=new Set(auto.map(t=>t.team_id));const at=ranked.filter(t=>!autoIds.has(t.team_id)).slice(0,44);
 const selected=[...auto,...at].sort((a,b)=>b.selectionScore-a.selectionScore).map((t,i)=>({...t,trueSeed:i+1,bid:autoIds.has(t.team_id)?'Projected AQ':'At-large'}));
 const selectedMap=new Map(selected.map(t=>[t.team_id,t]));
 const opening=[];const openingIds=new Set();
 for(const [list,bid] of [[auto.slice(-12),'AQ'],[at.slice(-12),'At-large']]){
  let remaining=list.map(t=>selectedMap.get(t.team_id));
  while(remaining.length){const a=remaining.shift();let i=remaining.findIndex(b=>b.conference!==a.conference);if(i<0)i=0;const b=remaining.splice(i,1)[0];openingIds.add(a.team_id);openingIds.add(b.team_id);opening.push({teams:[a,b],trueSeed:Math.min(a.trueSeed,b.trueSeed),bid,opening:true});}
 }
 const slots=[...selected.filter(t=>!openingIds.has(t.team_id)).map(t=>({teams:[t],trueSeed:t.trueSeed,bid:t.bid})),...opening].sort((a,b)=>a.trueSeed-b.trueSeed);
 const bracket=Object.fromEntries(regions.map(r=>[r,{}]));
 const teamConf=s=>s.teams.map(t=>t.conference);
 const byu=s=>s.teams.some(t=>/Brigham Young|^BYU$/.test(t.team));
 const violations=[];
 for(let line=1;line<=16;line++){
  const group=slots.slice((line-1)*4,line*4);let best=null,bestScore=Infinity;
  for(const perm of permutations(group)){
   let cost=0;
   perm.forEach((slot,r)=>{
    const region=regions[r],old=bracket[region];
    if(byu(slot)&&['East','Midwest'].includes(region))cost+=100000;
    if(line<=4)for(const s of Object.values(old))for(const c of teamConf(slot)){const firstFour=slots.slice(0,16).filter(x=>teamConf(x).includes(c)).slice(0,4);if(firstFour.includes(slot)&&teamConf(s).includes(c))cost+=1000;}
    const opponent=old[17-line];if(opponent&&teamConf(opponent).some(c=>teamConf(slot).includes(c)))cost+=10000;
    const preferred=line%2?r:3-r;cost+=Math.abs(group.indexOf(slot)-preferred);
   });
   if(cost<bestScore){bestScore=cost;best=perm;}
  }
  best.forEach((s,i)=>bracket[regions[i]][line]={...s,seed:line});
  if(bestScore>=1000)violations.push('Seed line '+line+' needs conference/region placement review.');
 }
 const usage=new Map(sites.map(s=>[s.city,0]));
 const pods=[];for(const region of regions)for(const seeds of [[1,16,8,9],[4,13,5,12],[3,14,6,11],[2,15,7,10]])pods.push({region,seeds,slots:seeds.map(s=>bracket[region][s])});
 pods.sort((a,b)=>a.slots[0].trueSeed-b.slots[0].trueSeed);
 const preferences={East:['Pittsburgh','Charlotte','Louisville','Minneapolis','Omaha','Fort Worth','Spokane','Sacramento'],West:['Spokane','Sacramento','Omaha','Fort Worth','Minneapolis','Louisville','Charlotte','Pittsburgh'],South:['Fort Worth','Charlotte','Louisville','Omaha','Pittsburgh','Minneapolis','Sacramento','Spokane'],Midwest:['Minneapolis','Omaha','Louisville','Pittsburgh','Fort Worth','Charlotte','Spokane','Sacramento']};
 for(const pod of pods){
  const names=pod.slots.flatMap(s=>s.teams.map(t=>t.team));const noSunday=names.some(n=>/Brigham Young|^BYU$/.test(n));
  const choice=preferences[pod.region].map(c=>sites.find(s=>s.city===c)).find(s=>usage.get(s.city)<2&&(!noSunday||!s.fri)&&!(s.city==='Omaha'&&names.includes('Creighton'))&&!(s.city==='Louisville'&&names.includes('Louisville')));
  if(!choice){violations.push('A pod requires manual site assignment.');continue}usage.set(choice.city,usage.get(choice.city)+1);pod.slots.forEach(s=>s.site=choice);
 }
 opening.forEach((o,i)=>{const target=Object.values(bracket).flatMap(r=>Object.values(r)).find(s=>s.teams[0].team_id===o.teams[0].team_id);Object.assign(o,{seed:target.seed,region:regions.find(r=>Object.values(bracket[r]).includes(target)),site:target.site,openingSite:i%2?'Wichita':'Dayton',openingDate:target.site?.fri?'March 17':'March 16'});});
 return {selected,auto,at,bubble:ranked.filter(t=>!selectedMap.has(t.team_id)).slice(0,8),bracket,opening,violations,mode:games.length?'Experimental résumé forecast':'Preseason Elo field',regions,pairs,regionSites};
}
const api={resume,field,regions,pairs,sites,regionSites};if(typeof module!=='undefined')module.exports=api;root.MBBEngine=api;
})(typeof window!=='undefined'?window:globalThis);
