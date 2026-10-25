(()=>{'use strict';
const root=document.getElementById('cs-today-schedule');if(!root)return;
const dateLabel=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(x=>x.type!=='literal').reduce((a,x)=>(a[x.type]=x.value,a),{});
const day=d=>{const p=dateLabel(d);return [p.year,p.month,p.day].join('-')};
const localDate=()=>day(new Date());
const e=(tag,content)=>{const n=document.createElement(tag);if(content)n.textContent=content;return n};
let selected='men-d1';
async function update(){
try{
const r=await fetch('data/college-soccer-prospective-v2.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('schedule feed HTTP '+r.status);
const d=await r.json(),rows=(d.forecasts||[]).filter(g=>g.cohort===selected&&g.kickoff_utc&&Number.isFinite(Date.parse(g.kickoff_utc))&&day(new Date(g.kickoff_utc))===localDate()).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));
const heading=e('h2','TODAY’S NCAA SOCCER GAMES'),note=e('p','Published schedule listings, not live scores. Eastern Time. Feed updated '+(d.published_at||'unknown')+'.');
const controls=e('div');controls.className='cs-today-controls';
for(const [key,label] of [['men-d1','Men DI'],['men-d2','Men DII'],['men-d3','Men DIII'],['women-d1','Women DI'],['women-d2','Women DII'],['women-d3','Women DIII']]){
const b=e('button',label);b.type='button';b.setAttribute('aria-pressed',String(selected===key));b.onclick=()=>{selected=key;update()};controls.append(b);}
const list=e('div');list.className='cs-today-list';
if(!rows.length)list.append(e('p','No games listed in this published feed for today. This is not a complete NCAA schedule.'));
for(const g of rows){
const link=e('a');link.className='cs-today-game';link.href='college-soccer-match.html?game='+encodeURIComponent(g.match_id);
const t=new Date(g.kickoff_utc).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
link.append(e('span',t+' ET'),e('strong',(g.away_name||g.away_team)+' at '+(g.home_name||g.home_team)));list.append(link);}
root.replaceChildren(heading,note,controls,list);
}catch(err){root.replaceChildren(e('h2','TODAY’S NCAA SOCCER GAMES'),e('p','Schedule feed temporarily unavailable: '+err.message));}
}
update();setInterval(()=>{if(document.visibilityState==='visible')update()},60000);
})();