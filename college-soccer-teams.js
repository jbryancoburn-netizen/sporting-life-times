(async()=>{'use strict';
const search=document.getElementById('college-team-search'),results=document.getElementById('college-team-results'),profile=document.getElementById('college-team-profile');
if(!search)return;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
try{
const [r,f]=await Promise.all([fetch('data/college-soccer-elo.json',{cache:'no-store'}),fetch('data/college-soccer-elo-final-ledger.json',{cache:'no-store'})]);
if(!r.ok||!f.ok)throw Error('Team feeds unavailable');
const data=await r.json(),ledger=(await f.json()).results||[];
const teams=Object.entries(data.cohorts).flatMap(([cohort,rows])=>rows.map(t=>({...t,cohort})));
const params=new URLSearchParams(location.search);
function open(t){
profile.replaceChildren();const title=el('h2',t.team+' · '+(t.cohort.startsWith('women')?"Women's":"Men's")+' Division '+['','I','II','III'][Number(t.cohort.slice(-1))]);profile.append(title);
const summary=el('p','Elo '+Number(t.elo).toFixed(1)+' · Rank #'+t.rank+' · Record '+t.record+' · Goal difference '+(t.gd>0?'+':'')+t.gd);profile.append(summary);
const note=el('p','Provisional independent Elo. Recent scores below come from the published verified final ledger, not necessarily the full season.');note.className='hub-small';profile.append(note);
const games=ledger.filter(g=>g.match_id.startsWith(t.cohort.startsWith('women')?'women-':'men-')&&(g.home_team===t.team_id||g.away_team===t.team_id)).slice().reverse().slice(0,20);
const h=el('h3','Recent verified finals');profile.append(h);
if(!games.length)profile.append(el('p','No matching finals in the current published ledger.'));
for(const g of games){const line=el('p');const a=el('a',g.date+' · '+g.away_team+' '+g.away_goals+' – '+g.home_goals+' '+g.home_team);a.href=g.source_game;a.target='_blank';a.rel='noopener noreferrer';line.append(a);profile.append(line);}
const link=el('a','Share this team page ↗');link.href='?team='+encodeURIComponent(t.cohort+':'+t.team_id)+'#college-team-finder';profile.append(link);
history.replaceState(null,'',link.href);
}
function render(){const q=search.value.trim().toLowerCase();results.replaceChildren();if(q.length<2)return;const matches=teams.filter(t=>t.team.toLowerCase().includes(q)).slice(0,30);for(const t of matches){const b=el('button',t.team+' · '+t.cohort.replace('-d',' Division '));b.type='button';b.style.cssText='display:block;margin:6px 0;padding:8px 12px;text-align:left;width:100%;max-width:480px';b.onclick=()=>open(t);results.append(b);}if(!matches.length)results.append(el('p','No school found. Try a shorter name.'));}
search.addEventListener('input',render);
const target=params.get('team');if(target){const t=teams.find(x=>x.cohort+':'+x.team_id===target);if(t){search.value=t.team;render();open(t);}}
}catch(e){results.textContent='Team search is temporarily unavailable.';}
})();