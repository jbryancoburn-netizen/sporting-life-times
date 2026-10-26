(()=>{'use strict';
const root=document.getElementById('elo-list');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ratings=new Map(),seen=new Set(),history=new Map(),counts=new Map(),errors=[];const opponents=new Map();const records=new Map();
const initial=1500,K=28,homeEdge=65;const winProbability=(own,opp,edge=0)=>1/(1+Math.pow(10,(opp-own-edge)/400));

const all=[];const duplicateConflicts=[];
fetch('data/cfb-2026-results.json',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(payload=>{
if(payload.audit?.season!==2026||payload.audit?.baseline!==1500||payload.audit?.complete!==true||payload.audit?.errors?.length)throw Error('Unverified ESPN results snapshot');
const byId=new Map();for(const game of payload.games||[]){if(!game.id||!game.date||game.teams?.length!==2)continue;const id=String(game.id);const prior=byId.get(id);if(prior&&JSON.stringify(prior)!==JSON.stringify(game))duplicateConflicts.push(id);byId.set(id,game);}
if(byId.size!==payload.audit.games||duplicateConflicts.length)throw Error('Results count or duplicate conflict');
const events=[...byId.values()].sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id))).map(g=>({id:String(g.id),date:g.date,competitions:[{neutralSite:g.neutral,competitors:g.teams.map(t=>({team:{id:t.id,displayName:t.name,name:t.name,logo:'https://a.espncdn.com/i/teamlogos/ncaa/500/'+t.id+'.png'},score:t.score,homeAway:t.homeAway}))}]}));
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
// Re-evaluate the complete schedule graph, not only the two teams in the latest final.
// Every team's opponent rating is revised in simultaneous bounded passes. This
// adjusted power rating is distinct from the immutable chronological Elo ledger.
const current=new Map([...ratings].map(([id,t])=>[id,t.elo]));
const retrospective=new Map(current);
const graph=[...opponents].map(([id,games])=>[id,games.map(g=>({id:g.id,edge:g.homeEdge}))]);
for(let pass=0;pass<12;pass++){
 const next=new Map();
 for(const [id,games] of graph){
  const own=current.get(id)??initial;
  const oppAverage=games.reduce((sum,g)=>sum+(retrospective.get(g.id)??initial),0)/games.length;
  const originalAverage=games.reduce((sum,g)=>sum+(current.get(g.id)??initial),0)/games.length;
  // Damped and capped opponent-strength correction; prevents runaway feedback.
  const correction=Math.max(-100,Math.min(100,(oppAverage-originalAverage)*0.35));
  next.set(id,own+correction);
 }
 for(const [id,value] of next)retrospective.set(id,value);
}
for(const [id,fixtures] of opponents){
 const old=scheduleMetrics.get(id);
 if(!old)continue;
 const sosCurrent=fixtures.reduce((sum,g)=>sum+(retrospective.get(g.id)??initial),0)/fixtures.length;
 const referenceWins=fixtures.map(g=>winProbability(initial,retrospective.get(g.id)??initial,g.homeEdge));
 const expectedWins=referenceWins.reduce((a,b)=>a+b,0);
 const tail=recordTail(referenceWins,old.wins);
 scheduleMetrics.set(id,{...old,sos:sosCurrent,sor:-Math.log10(Math.max(tail,1e-12)),sorTailProbability:tail,referenceExpectedWins:expectedWins,originalSOS:old.sos});
}
const ranked=[...ratings].sort((a,b)=>(retrospective.get(b[0])??b[1].elo)-(retrospective.get(a[0])??a[1].elo));
window.CFB_ELO_REPLAY={season:2026,baseline:1500,fromWeek:0,completedGames:seen.size,failedWeeks:[...errors],duplicateConflicts:[...new Set(duplicateConflicts)],earliestGame:events[0]?.date||null,latestGame:events.at(-1)?.date||null,certified:true};
window.CFB_RATINGS=Object.fromEntries(ranked.map(([id,t])=>[id,{...t,adjustedElo:retrospective.get(id)??t.elo,retrospectiveAdjustment:(retrospective.get(id)??t.elo)-t.elo,games:counts.get(id),history:history.get(id)||[],...scheduleMetrics.get(id),model:'2026-results-only',rosterAdjusted:false}]));
document.dispatchEvent(new Event('cfb-ratings-ready'));
const note='<p class="data-note">2026 adjusted power ranking with chronological Elo · '+seen.size+' completed games processed chronologically · starting rating 1500 · SOS = average opponent pregame Elo · SOR = rarity of record versus a 1500-rated reference team (higher is stronger) · 2026 ratings use game results only; no roster or external rankings. '+(errors.length?'Unavailable weekly feeds: '+errors.length+'. Ratings may be incomplete.':'ESPN saved results snapshot loaded. Ratings recalculate on page reload.')+'</p>';
root.innerHTML=seen.size?note+ranked.slice(0,25).map(([id,t],i)=>'<a class="school-line" href="cfb-team.html?team='+encodeURIComponent(id)+'"><strong style="min-width:25px">'+(i+1)+'</strong><img loading="lazy" alt="" src="'+esc(t.logo)+'"><span style="flex:1">'+esc(t.name)+'</span><small>'+Math.round(retrospective.get(id)??t.elo)+' adjusted · '+Math.round(t.elo)+' Elo · SOS '+Math.round(scheduleMetrics.get(id)?.sos||1500)+' · SOR '+(scheduleMetrics.get(id)?.sor||0).toFixed(2)+' · '+counts.get(id)+' GP</small></a>').join(''):'<p class="data-note">No completed 2026 games could be verified from the weekly score feeds.</p>';
}).catch(()=>{root.textContent='2026 game history could not be processed; ratings unavailable.'});
})();