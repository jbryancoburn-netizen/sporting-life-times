(()=>{'use strict';
const root=document.getElementById('elo-list');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ratings=new Map(),seen=new Set(),history=new Map(),counts=new Map(),errors=[];
const initial=1500,K=28,homeEdge=65;
const weeks=Array.from({length:19},(_,i)=>{const d=new Date(Date.UTC(2026,7,22+i*7));return d.toISOString().slice(0,10).replace(/-/g,'')});
const fetchWeek=async date=>{const u='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates='+date+'&groups=80&limit=400';const r=await fetch(u);if(!r.ok)throw Error('HTTP '+r.status);return (await r.json()).events||[]};
const complete=e=>e.status?.type?.completed===true;
const all=[];
Promise.allSettled(weeks.map(fetchWeek)).then(results=>{
results.forEach((r,i)=>{if(r.status==='fulfilled')all.push(...r.value);else errors.push(weeks[i])});
const events=[...new Map(all.filter(complete).map(e=>[String(e.id),e])).values()].sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id)));
for(const e of events){if(seen.has(e.id))continue;const c=e.competitions?.[0],s=c?.competitors||[];if(s.length!==2)continue;
const a=s[0],b=s[1],ia=String(a.team?.id||''),ib=String(b.team?.id||''),sa=Number(a.score),sb=Number(b.score);
if(!ia||!ib||!Number.isFinite(sa)||!Number.isFinite(sb))continue;
seen.add(e.id);const ra=ratings.get(ia)?.elo??initial,rb=ratings.get(ib)?.elo??initial;
const neutral=c.neutralSite===true;const home=neutral?0:a.homeAway==='home'?homeEdge:b.homeAway==='home'?-homeEdge:0;
const expected=1/(1+Math.pow(10,(rb-ra-home)/400)),result=sa===sb?.5:sa>sb?1:0;
const multiplier=Math.min(2.5,1+Math.log1p(Math.abs(sa-sb))/3),delta=K*multiplier*(result-expected);
for(const [side,id,prior,change,opponent,score,against] of [[a,ia,ra,delta,ib,sa,sb],[b,ib,rb,-delta,ia,sb,sa]]){
const next=prior+change;ratings.set(id,{name:side.team.displayName||side.team.name,elo:next,logo:side.team.logo||'',baseline:initial});
counts.set(id,(counts.get(id)||0)+1);if(!history.has(id))history.set(id,[]);
history.get(id).push({gameId:String(e.id),date:e.date,opponent,score,against,before:prior,after:next,change,neutral});
}}
const ranked=[...ratings].sort((a,b)=>b[1].elo-a[1].elo);
window.CFB_RATINGS=Object.fromEntries(ranked.map(([id,t])=>[id,{...t,games:counts.get(id),history:history.get(id)||[],model:'2026-results-only-provisional',rosterAdjusted:false}]));
document.dispatchEvent(new Event('cfb-ratings-ready'));
const note='<p class="data-note">2026 provisional results-based Elo · '+seen.size+' completed games processed chronologically · starting rating 1500 · roster adjustments not yet applied. '+(errors.length?'Unavailable weekly feeds: '+errors.length+'. Ratings may be incomplete.':'Weekly score feeds loaded.')+'</p>';
root.innerHTML=seen.size?note+ranked.slice(0,25).map(([id,t],i)=>'<a class="school-line" href="cfb-team.html?team='+encodeURIComponent(id)+'"><strong style="min-width:25px">'+(i+1)+'</strong><img loading="lazy" alt="" src="'+esc(t.logo)+'"><span style="flex:1">'+esc(t.name)+'</span><small>'+Math.round(t.elo)+' · '+counts.get(id)+' GP</small></a>').join(''):'<p class="data-note">No completed 2026 games could be verified from the weekly score feeds.</p>';
}).catch(()=>{root.textContent='2026 game history could not be processed; ratings unavailable.'});
})();