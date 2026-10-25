(async()=>{
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const get=async path=>{try{let r=await fetch(path,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}};
const [initial,current,schedule,ledger,xwalk]=await Promise.all([
get("data/ncaam-2026-27-preseason-player-quality-live.json"),
get("data/ncaam-2026-27-current-provisional.json"),
get("data/ncaam-2026-27-upcoming-forecasts.json"),
get("data/ncaam-2026-27-game-ledger.json"),
get("data/ncaam-2026-27-espn-team-crosswalk.json")]);
if(!initial||initial.rankings?.length!==365){$("meta").textContent="Verified preseason ratings unavailable.";return}
const live=current?.games_played>0&&current.preseason_seed==="data/ncaam-2026-27-preseason-player-quality-live.json"&&current.rankings?.length===365;
const rating=live?current:initial;
const prev=new Map(initial.rankings.map(t=>[t.team_id,t]));
const teams=rating.rankings.map(t=>({...prev.get(t.team_id),...t}));
const byId=new Map(teams.map(t=>[t.team_id,t]));
const badges=new Map((xwalk?.teams||[]).map(t=>[t.id,t.espn_id]));
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();
const params=new URLSearchParams(location.search),wanted=params.get("conference");
let conf=confs.includes(wanted)?wanted:"Big Ten";
const selector=$("conference");
selector.innerHTML=confs.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
selector.value=conf;selector.addEventListener("change",()=>{location.href="ncaam-conference.html?conference="+encodeURIComponent(selector.value)});
const teamName=t=>{let id=badges.get(t.team_id);return '<span class="team">'+(id?'<img loading="lazy" alt="" src="https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(id)+'.png">':"")+esc(t.team)+"</span>"};
const scores=(a,b)=>{
 // Research estimate pending possession/venue calibration; both sides share a neutral-tempo center.
 const difference=Math.max(-28,Math.min(28,(a.elo-b.elo)/25));
 const h=Math.round(72+difference/2),v=Math.round(72-difference/2);
 return [h,v];
};
const prob=(a,b)=>1/(1+Math.pow(10,-(a.elo-b.elo)/400));
const played=ledger?.games||[];
function render(){
$("heading").textContent=conf+" Basketball";
document.title=conf+" Basketball | The Sporting Life & Times";
const members=teams.filter(t=>t.conference===conf);
const sorted=[...members].sort((a,b)=>(b.conference_wins||0)-(a.conference_wins||0)||(a.conference_losses||0)-(b.conference_losses||0)||b.elo-a.elo);
$("meta").textContent=members.length+" teams · "+(live?rating.games_played+" final games in current Elo":"2026–27 preseason Elo")+" · Updated automatically from verified finals";
const rows=sorted.map((t,i)=>'<tr><td>'+teamName(t)+'</td><td class="num">'+(t.wins||0)+'–'+(t.losses||0)+'</td><td class="num">'+(t.conference_wins||0)+'–'+(t.conference_losses||0)+'</td><td class="num">'+t.elo.toFixed(1)+'</td><td class="num">#'+(i+1)+'</td></tr>').join("");
$("standings").innerHTML='<table class="table"><thead><tr><th>Team</th><th>Overall</th><th>Conf.</th><th>Elo</th><th>Projected seed*</th></tr></thead><tbody>'+rows+'</tbody></table><p class="deck">*Projected seed is provisional Elo order, not an official conference tiebreak calculation. Actual records are displayed separately.</p>';
const projected=[...members].sort((a,b)=>b.elo-a.elo);
$("postseason").innerHTML='<p class="tag">Illustrative projected seed order</p><div class="deck">'+projected.map((t,i)=>'<div class="fixture"><strong>'+(i+1)+'. '+esc(t.team)+'</strong>Elo '+t.elo.toFixed(1)+(i===0?' · Current model favorite':'')+'</div>').join("")+'</div>';
const games=(schedule?.games||[]).filter(g=>g.date>=new Date().toISOString().slice(0,10)&&((byId.get(g.home_id)?.conference===conf)||(byId.get(g.away_id)?.conference===conf))).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);
$("games").innerHTML=games.length?games.map(g=>{const h=byId.get(g.home_id),a=byId.get(g.away_id);if(!h||!a)return"";let p=prob(h,a),s=scores(h,a);return '<div class="fixture"><span class="tag">'+esc(g.date)+' · Projected</span><strong>'+esc(a.team)+' '+s[1]+' — '+s[0]+' '+esc(h.team)+'</strong><div>'+esc(h.team)+' '+(p*100).toFixed(1)+'% to win · '+esc(a.team)+' '+((1-p)*100).toFixed(1)+'%</div><div class="meter"><span style="width:'+(p*100).toFixed(1)+'%"></span></div></div>'}).join(""):'<p class="deck">No upcoming games for this conference in the currently published schedule snapshot. No fixtures invented.</p>';
$("directory").innerHTML=confs.map(c=>'<a class="fixture" style="display:block;color:inherit" href="ncaam-conference.html?conference='+encodeURIComponent(c)+'">'+esc(c)+'</a>').join("");
}
render();
})();