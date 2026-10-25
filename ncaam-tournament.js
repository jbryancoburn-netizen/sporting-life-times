(async()=>{const get=async p=>{try{const r=await fetch(p,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}};
const [p,c]=await Promise.all([get("data/ncaam-2026-27-preseason-player-quality-live.json"),get("data/ncaam-2026-27-current-provisional.json")]);
const valid=x=>x?.rankings?.length===365&&new Set(x.rankings.map(t=>t.team_id)).size===365;
if(!valid(p)){document.getElementById("status").textContent="Verified ratings unavailable";return}
const data=valid(c)&&c.games_played>0&&c.preseason_seed==="data/ncaam-2026-27-preseason-player-quality-live.json"?c:p;
const teams=[...data.rankings].sort((a,b)=>b.elo-a.elo);
const grouped=new Map();for(const t of teams)if(t.conference&&!grouped.has(t.conference))grouped.set(t.conference,t);
const auto=[...grouped.values()].sort((a,b)=>b.elo-a.elo),chosen=new Set(auto.map(t=>t.team_id));
const at=teams.filter(t=>!chosen.has(t.team_id)).slice(0,Math.max(0,68-auto.length));
const infield=new Set([...auto,...at].map(t=>t.team_id));
const bubble=teams.filter(t=>!infield.has(t.team_id)).slice(0,12);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const row=(t,detail)=>'<div class="line"><strong>'+esc(t.team)+'</strong><span>'+esc(detail)+' · <span class="num">'+t.elo.toFixed(1)+'</span></span></div>';
document.getElementById("auto").innerHTML=auto.map(t=>row(t,t.conference)).join("");
document.getElementById("atlarge").innerHTML=at.map((t,i)=>row(t,'At-large '+(i+1))).join("");
document.getElementById("bubble").innerHTML=bubble.map(t=>row(t,t.conference)).join("");
document.getElementById("status").textContent=data.games_played+' played games in active Elo · '+grouped.size+' conferences · '+auto.length+' projected conference representatives · '+at.length+' Elo-based at-large selections · 68 projected teams';
})();