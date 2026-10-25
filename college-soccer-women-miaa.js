(()=>{'use strict';
const root=document.getElementById('college-soccer-women-miaa');if(!root)return;
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==null&&value!==undefined)n.textContent=String(value);if(cls)n.className=cls;return n};
const get=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p);return r.json()};
const link=(text,url)=>{const a=node('a',text);a.href=url;if(url.startsWith('https:')){a.rel='noopener noreferrer';a.target='_blank'}return a};
const src='https://miaa.org/standings.aspx?path=wsoc';
const P=(a,b,teams)=>{const h=teams.indexOf(a)<teams.indexOf(b)?55:-55;return 1/(1+Math.pow(10,-(Number(a.elo)-Number(b.elo)+h)/400))};
function odds(six){
 const seeds=new Map(six.map((t,i)=>[t.id,i]));
 const win=(a,b)=>{const h=seeds.get(a.id)<seeds.get(b.id)?55:-55;return 1/(1+Math.pow(10,-(a.elo-b.elo+h)/400))};
 const first=(a,b)=>{const p=win(a,b);return [{team:a,p},{team:b,p:1-p}]};
 const semi=(bye,pair)=>{const d=new Map();for(const x of pair){const w=win(bye,x.team);d.set(bye,(d.get(bye)||0)+x.p*w);d.set(x.team,(d.get(x.team)||0)+x.p*(1-w))}return [...d].map(([team,p])=>({team,p}))};
 const left=semi(six[0],first(six[3],six[4])),right=semi(six[1],first(six[2],six[5]));
 const out=new Map(six.map(t=>[t.id,0]));
 for(const a of left)for(const b of right){const p=win(a.team,b.team);out.set(a.team.id,out.get(a.team.id)+a.p*b.p*p);out.set(b.team.id,out.get(b.team.id)+a.p*b.p*(1-p))}
 return six.map(t=>({...t,probability:out.get(t.id)})).sort((a,b)=>b.probability-a.probability);
}
let signature='';
async function render(){
try{
const [c,s,r,rules,branding]=await Promise.all([get('data/college-soccer-conferences.json'),get('data/college-soccer-miaa-women-standings.json'),get('data/college-soccer-elo.json'),get('data/college-soccer-postseason-rules.json'),get('data/college-soccer-team-branding.json').catch(()=>({teams:{}}))]);
const k='women-d3:miaa',ids=c.conferences?.[k]?.teams||[],raw=rules.conferences?.[k],rows=s.rows||[],rated=r.cohorts?.['women-d3']||[];
if(ids.length!==9||rows.length!==9||!raw||raw.tournament.field!==6)throw Error('MIAA Women source and format mismatch');
const byId=new Map(rows.map(x=>[x.team_id,x])),elo=new Map(rated.map(x=>[x.team_id,x]));
if(ids.some(id=>!byId.has(id)||!elo.has(id)))throw Error('MIAA Women school identifiers cannot be reconciled');
const sorted=ids.map(id=>({id,...byId.get(id),team:elo.get(id).team,elo:Number(elo.get(id).elo)})).sort((a,b)=>b.conference_points-a.conference_points||b.elo-a.elo);
const stamp=JSON.stringify([s.checked_at_utc||s.snapshot_checked_date,r.as_of,r.applied_finals_since_baseline]);
if(signature===stamp)return;signature=stamp;
root.replaceChildren();const heading=node('header',null,'cs-wmiaa-head');
heading.append(node('h2','MIAA Women · Conference Tournament Watch'),node('span','2026 WOMEN’S DIVISION III · OFFICIAL TABLE / MODEL PROJECTION'));root.append(heading);
const headline=node('div',null,'cs-wmiaa-mast');headline.append(node('strong','Six-team projection based on 2025 format; top two byes.'),link('Official MIAA Women tournament update ↗',raw.tournament.sources[0]));root.append(headline);
const columns=node('div',null,'cs-wmiaa-columns'),tableWrap=node('section'),forecastWrap=node('section');columns.append(tableWrap,forecastWrap);root.append(columns);
tableWrap.append(node('h3','Race for six'));
const table=node('table',null,'cs-wmiaa-table'),thead=node('thead'),tr=node('tr');
for(const h of ['#','School','Conf.','Pts','Elo'])tr.append(node('th',h));thead.append(tr);
const tbody=node('tbody');sorted.forEach((t,i)=>{
 const row=node('tr');if(i===5)row.className='cs-wmiaa-cutoff';
 row.append(node('td',i<6?String(i+1):'—'));
 const name=node('td');name.append(link(t.team,'college-soccer-team.html?team='+encodeURIComponent('women-d3:'+t.id)));row.append(name);
 row.append(node('td',t.conference_record),node('td',t.conference_points),node('td',t.elo.toFixed(1)));tbody.append(row);
});table.append(thead,tbody);tableWrap.append(table);
tableWrap.append(node('p','Official conference records from '+s.snapshot_checked_date+'. Seed order is provisional: league points, then Elo only to break display ties. Elo is not an official MIAA Women tiebreaker.','cs-wmiaa-note'));
forecastWrap.append(node('h3','If the postseason began today'));
const six=sorted.slice(0,6);
const cupUI=window.CollegeSoccerCupUI;
if(cupUI){cupUI.decorateTable(table,sorted,'women-d3',branding);cupUI.bracket(forecastWrap,six,'women-d3',branding,{q:'OPENING ROUND',s:'SEMIFINALS',f:'CHAMPIONSHIP'});}
else forecastWrap.append(node('p','Bracket artwork unavailable; title probabilities remain below.','cs-wmiaa-note'));
forecastWrap.append(node('h3','Experimental tournament title projection'));
const p=odds(six),total=p.reduce((acc,x)=>acc+x.probability,0);
if(Math.abs(total-1)>1e-8)throw Error('Bracket probability normalization failed');
for(const t of p){const row=node('div',null,'cs-wmiaa-odds'),head=node('div',null,'cs-wmiaa-odds-label');head.append(node('span',t.team),node('strong',(t.probability*100).toFixed(1)+'%'));row.append(head);const track=node('div',null,'cs-wmiaa-odds-track'),bar=node('i');bar.style.width=(t.probability*100)+'%';track.append(bar);row.append(track);forecastWrap.append(row);}
forecastWrap.append(node('p','Hypothetical six-seed bracket with 55 Elo points of home advantage to the higher projected seed and decisive-result logistic probabilities. No simulation of remaining conference matches, penalty shootouts or official seeding tiebreakers. Not calibrated tournament odds.','cs-wmiaa-note'));
root.append(node('p','Six-team field and byes based on the 2025 MIAA Women tournament; 2026 dates published officially. The actual 2026 bracket and tiebreakers are unconfirmed; official records may change. A scheduled game is never treated as final without a verified source.','cs-wmiaa-note'));
}catch(err){root.replaceChildren(node('p','MIAA Women postseason coverage is temporarily unavailable: source data could not be reconciled.','cs-wmiaa-note'));console.error('MIAA Women tournament watch',err)}
}
render();setInterval(()=>{if(document.visibilityState==='visible')render()},15*60*1000);
})();