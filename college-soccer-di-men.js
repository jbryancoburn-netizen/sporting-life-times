(()=>{'use strict';
const root=document.getElementById('di-men-brackets');if(!root)return;
const E=(t,c,s)=>{const n=document.createElement(t);if(c)n.className=c;if(s!==undefined)n.textContent=String(s);return n};
const get=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p+': '+r.status);return r.json()};
const label=t=>t?.name||t?.short||'Conference';
const division='men-d1';
async function render(){
try{
const [directory,elo,rules,branding]=await Promise.all([get('data/college-soccer-conferences.json'),get('data/college-soccer-elo.json'),get('data/college-soccer-postseason-rules.json'),get('data/college-soccer-team-branding.json').catch(()=>({teams:{}}))]);
const entries=Object.entries(directory.conferences||{}).filter(([k,x])=>k.startsWith(division+':')&&x.page&&x.teams?.length);
const ratings=new Map((elo.cohorts?.[division]||[]).map(x=>[x.team_id,x]));
const controls=E('div','dim-controls'),summary=E('p','dim-summary'),grid=E('div','dim-grid');
const input=E('input');input.type='search';input.placeholder='Find a conference';input.setAttribute('aria-label','Find Division I mens soccer conference');controls.append(input);
root.replaceChildren(summary,controls,grid);
const report={complete:0,limited:0};
await Promise.all(entries.map(async ([key,meta])=>{
const article=E('article','dim-conference');article.dataset.query=(key+' '+label(meta)).toLowerCase();
const head=E('header','dim-head'),h2=E('h2',null,label(meta)),visit=E('a',null,'OPEN CONFERENCE DESK');visit.href=meta.page;
head.append(h2,visit);article.append(head);
const rule=rules.conferences?.[key]?.tournament||{};
try {
if(!meta.standings_feed)throw Error('Official standings feed not available');
const table=await get(meta.standings_feed);
const rows=table.rows||[];
const known=new Map(rows.map(x=>[x.team_id,x]));
if(!meta.teams.every(id=>known.has(id))||meta.teams.length!==rows.length)throw Error('Standings / membership mismatch');
const field=Number(rule.field)||0,certified=field>0&&!/inferred from|based on official 2025/i.test(rule.status||'');
const officialSeeds=Array.isArray(table.tournament_seeds)&&table.tournament_seeds.length===field?table.tournament_seeds:null;
const selected=officialSeeds?officialSeeds.map(id=>known.get(id)):rows.slice(0,field);
const teams=selected.map((x,i)=>({id:x.team_id,name:ratings.get(x.team_id)?.team||x.team_id.replaceAll('-',' '),elo:ratings.get(x.team_id)?.elo,seed:i+1}));
article.append(E('p','dim-note','Official table checked: '+(table.checked_at_utc||table.snapshot_checked_date||'date unverified')+' · '+(officialSeeds?'Conference-supplied seeds':'Provisional published table order')));
if(certified&&[6,8,15].includes(field)&&teams.length===field&&teams.every(t=>typeof t.elo==='number'&&Number.isFinite(t.elo))&&window.CollegeSoccerCupUI?.predictiveBracket){
window.CollegeSoccerCupUI.predictiveBracket(article,teams,division,branding);
report.complete++;
}else{
article.append(E('p','dim-pending','Predicted bracket awaiting verified tournament format or complete team ratings. Conference standings and confirmed rules are still available on the desk.'));
report.limited++;
}
}catch(err){article.append(E('p','dim-pending','Bracket unavailable: '+err.message));report.limited++}
grid.append(article);
}));
const count=new Set(entries.flatMap(([,v])=>v.teams)).size;
summary.textContent=entries.length+' mapped Division I men’s conference desks · '+count+' unique programs mapped · '+report.complete+' complete predictive brackets · '+report.limited+' pending verification. More conferences are not represented as complete.';
input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();for(const x of grid.children)x.hidden=!x.dataset.query.includes(q)});
}catch(err){root.replaceChildren(E('p','dim-pending','Division I championship forecasts are temporarily unavailable: '+err.message))}
}
render();setInterval(()=>{if(document.visibilityState==='visible')render()},60000);
})();