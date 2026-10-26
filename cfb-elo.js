(()=>{'use strict';
const root=document.getElementById('elo-list');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ratings=new Map(),seen=new Set(),history=new Map(),counts=new Map(),errors=[];const opponents=new Map();const records=new Map();
const initial=1500,K=28,homeEdge=65;const winProbability=(own,opp,edge=0)=>1/(1+Math.pow(10,(opp-own-edge)/400));
const weeks=Array.from({length:18},(_,i)=>i); // Week 0 through Week 17, full replay from 1500
const fetchWeek=async week=>{const u='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2026&seasontype=2&week='+week+'&groups=80&limit=400';const r=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return (await r.json()).events||[]};
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
const expected=winProbability(ra,rb,home),result=sa===sb?.5:sa>sb?1:0;
const multiplier=Math.min(2.5,1+Math.log1p(Math.abs(sa-sb))/3),delta=K*multiplier*(result-expected);
for(const [id,opp,oppElo,edge,won] of [[ia,ib,rb,home,sa>sb],[ib,ia,ra,-home,sb>sa]]){if(!opponents.has(id))opponents.set(id,[]);opponents.get(id).push({id:opp,elo:oppElo,homeEdge:edge});const rec=records.get(id)||{wins:0,losses:0,ties:0};if(sa===sb)rec.ties++;else if(won)rec.wins++;else rec.losses++;records.set(id,rec);}
for(const [side,id,prior,change,opponent,score,against] of [[a,ia,ra,delta,ib,sa,sb],[b,ib,rb,-delta,ia,sb,sa]]){
const next=prior+change;ratings.set(id,{name:side.team.displayName||side.team.name,elo:next,logo:side.team.logo||'',baseline:initial});
counts.set(id,(counts.get(id)||0)+1);if(!history.has(id))history.set(id,[]);
history.get(id).push({gameId:String(e.id),date:e.date,opponent,score,against,before:prior,after:next,change,neutral});
}}
// SOS is average opponent pregame Elo. SOR compares the observed record with
// the probability that a fixed 1500-rated reference team would match or exceed it.
const recordTail=(probabilities,wins)=>{let dp=[1];for(const p of probabilities){const next=Array(dp.length+1).fill(0);for(let i=0;i<dp.length;i++){next[i]+=dp[i]*(1-p);next[i+1]+=dp[i]*p;}dp=next;}return dp.slice(wins).reduce((a,b)=>a+b,0)};
const scheduleMetrics=new Map();
for(const [id,fixtures] of opponents){const record=records.get(id)||{wins:0,losses:0,ties:0};const sos=fixtures.reduce((sum,g)=>sum+g.elo,0)/fixtures.length;const referenceWins=fixtures.map(g=>winProbability(initial,g.elo,g.homeEdge));const expectedWins=referenceWins.reduce((a,b)=>a+b,0);const tail=recordTail(referenceWins,record.wins);scheduleMetrics.set(id,{sos,sor:-Math.log10(Math.max(tail,1e-12)),sorTailProbability:tail,referenceExpectedWins:expectedWins,...record});}
const ranked=[...ratings].sort((a,b)=>b[1].elo-a[1].elo);
window.CFB_ELO_REPLAY={season:2026,baseline:1500,fromWeek:0,completedGames:seen.size,failedWeeks:[...errors],earliestGame:events[0]?.date||null,latestGame:events.at(-1)?.date||null,certified:errors.length===0};
window.CFB_RATINGS=Object.fromEntries(ranked.map(([id,t])=>[id,{...t,games:counts.get(id),history:history.get(id)||[],...scheduleMetrics.get(id),model:'2026-results-only-provisional',rosterAdjusted:false}]));
document.dispatchEvent(new Event('cfb-ratings-ready'));
const note='<p class="data-note">2026 provisional results-based Elo · '+seen.size+' completed games processed chronologically · starting rating 1500 · SOS = average opponent pregame Elo · SOR = rarity of record versus a 1500-rated reference team (higher is stronger) · 2026 ratings use game results only; no roster or external rankings. '+(errors.length?'Unavailable weekly feeds: '+errors.length+'. Ratings may be incomplete.':'Weekly score feeds loaded. Ratings refresh on page reload.')+'</p>';
root.innerHTML=seen.size?note+ranked.slice(0,25).map(([id,t],i)=>'<a class="school-line" href="cfb-team.html?team='+encodeURIComponent(id)+'"><strong style="min-width:25px">'+(i+1)+'</strong><img loading="lazy" alt="" src="'+esc(t.logo)+'"><span style="flex:1">'+esc(t.name)+'</span><small>'+Math.round(t.elo)+' Elo · SOS '+Math.round(scheduleMetrics.get(id)?.sos||1500)+' · SOR '+(scheduleMetrics.get(id)?.sor||0).toFixed(2)+' · '+counts.get(id)+' GP</small></a>').join(''):'<p class="data-note">No completed 2026 games could be verified from the weekly score feeds.</p>';
}).catch(()=>{root.textContent='2026 game history could not be processed; ratings unavailable.'});
})();