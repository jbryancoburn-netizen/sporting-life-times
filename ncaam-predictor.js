(async()=>{"use strict";
const $=id=>document.getElementById(id);
const get=async path=>{try{const r=await fetch(path,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}};
const [pre,current,calibration,crosswalk]=await Promise.all([
 get("data/ncaam-2026-27-preseason-player-quality-live.json"),
 get("data/ncaam-2026-27-current-provisional.json"),
 get("data/ncaam-score-calibration.json"),
 get("data/ncaam-2026-27-espn-team-crosswalk.json")]);
const verified=x=>x?.rankings?.length===365&&new Set(x.rankings.map(t=>t.team_id)).size===365;
if(!verified(pre)){$("state").textContent="Verified 365-team Elo data unavailable.";return}
const isLive=verified(current)&&current.games_played>0&&current.preseason_seed==="data/ncaam-2026-27-preseason-player-quality-live.json";
const currentRatings=isLive?current:pre;
const original=new Map(pre.rankings.map(t=>[t.team_id,t]));
const teams=currentRatings.rankings.map(t=>({...original.get(t.team_id),...t})).sort((a,b)=>a.team.localeCompare(b.team));
const map=new Map(teams.map(t=>[t.team_id,t]));
const logoIds=new Map((crosswalk?.teams||[]).map(t=>[t.id,String(t.espn_id||"")]));
const num=x=>Number(x).toFixed(1);
const signed=x=>(x>=0?"+":"")+num(x);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const params=new URLSearchParams(location.search);
for(const select of [$("team-a"),$("team-b")]){
 for(const t of teams){let opt=document.createElement("option");opt.value=t.team_id;opt.textContent=t.team;select.appendChild(opt)}
}
$("team-a").value=map.has(params.get("a"))?params.get("a"):(teams.find(t=>t.team==="Indiana")||teams[0]).team_id;
$("team-b").value=map.has(params.get("b"))?params.get("b"):(teams.find(t=>t.team==="Purdue")||teams[1]).team_id;
const calibrated=window.NCAAMScores.configure(calibration);
$("state").textContent=(isLive?currentRatings.games_played+" verified results incorporated":"2026–27 preseason")+" · "+(calibrated?"historically tested score model":"historical scoring calibration pending");
$("model-grade").textContent=calibrated?"Historical scoring test passed":"Preliminary scoring estimates";
$("caveat").textContent=calibrated?
 "Historical scores passed a holdout comparison; current forecast remains venue-neutral and cannot account for current injuries, pace or lineups.":
 "Win probability is based on selected Elo. Scores use a temporary 72-point-per-team baseline pending historical validation; they are not yet a team-specific offense/defense forecast.";
const impact=(t)=>[['Returning minutes',t.retention_component],['Transfer minutes',t.transfer_component],['Player scoring quality',t.quality_component]].map(([title,v])=>
 '<div class="impact"><span>'+title+'</span><strong>'+ (Number.isFinite(Number(v))?signed(v):"Not available")+' Elo</strong></div>').join("");
function image(team,key){const id=logoIds.get(team.team_id);const el=$("logo-"+key);if(id&&/^\d+$/.test(id)){el.src="https://a.espncdn.com/i/teamlogos/ncaa/500/"+id+".png";el.hidden=false;el.onerror=()=>{el.hidden=true}}else{el.removeAttribute("src");el.hidden=true}}
function render(){
 const a=map.get($("team-a").value),b=map.get($("team-b").value);
 if(!a||!b)return;
 if(a.team_id===b.team_id){$("wintext").textContent="Choose two different teams.";return}
 const p=window.NCAAMScores.predict(a,b),fav=p.homeProbability>=.5?a:b,und=fav===a?b:a;
 $("name-a").textContent=a.team;$("name-b").textContent=b.team;
 image(a,"a");image(b,"b");
 $("score-a").textContent=p.homeScore;$("score-b").textContent=p.awayScore;
 $("elo-a").textContent=num(a.elo);$("elo-b").textContent=num(b.elo);
 $("margin").textContent=num(Math.abs(p.expectedMargin))+" pts";
 $("elo-gap").textContent=num(Math.abs(a.elo-b.elo));
 $("verified-total").textContent=String((Number(a.verified_player_count??a.evidence_player_count)||0)+(Number(b.verified_player_count??b.evidence_player_count)||0));
 $("wintext").textContent=a.team+" "+num(p.homeProbability*100)+"% · "+b.team+" "+num(p.awayProbability*100)+"% (neutral-site estimate)";
 $("probbar").style.width=num(p.homeProbability*100)+"%";
 $("roster-name-a").textContent=a.team;$("roster-name-b").textContent=b.team;
 $("roster-a").innerHTML=impact(a);$("roster-b").innerHTML=impact(b);
 const delta=Math.abs(a.elo-b.elo);
 const favQuality=Number(fav.quality_component)||0,undQuality=Number(und.quality_component)||0;
 const lines=[
 "The model gives "+safe(fav.team)+" a "+num(Math.max(p.homeProbability,p.awayProbability)*100)+"% win probability because its current Elo exceeds "+safe(und.team)+" by "+num(delta)+" points.",
 "Of "+safe(fav.team)+"'s original preseason adjustment, "+signed(favQuality)+" Elo came from verified player scoring quality versus "+signed(undQuality)+" for "+safe(und.team)+". This is already included in the current rating.",
 "The projected "+num(Math.abs(p.expectedMargin))+"-point margin is "+(calibrated?"derived from a historical scoring fit.":"a preliminary Elo-to-points estimate; it has not passed a historical score calibration.")
 ];
 $("key-factors").innerHTML=lines.map(s=>'<div class="factor">'+s+'</div>').join("");
 const counts=[a,b].map(t=>Number(t.verified_player_count??t.evidence_player_count??0));
 const cov=[a,b].filter(t=>t.roster_coverage!=="source-confirmed-prior-minutes").map(t=>t.team);
 $("uncertainty").textContent="Verified historical-minute evidence: "+a.team+" "+counts[0]+" players; "+b.team+" "+counts[1]+" players. "+(cov.length?"Incomplete roster evidence for "+cov.join(" and ")+". ":"")+
 "Evidence counts are not a calibrated probability-confidence score. Venue, injuries, lineup availability and team-specific pace are currently unmodeled.";
 const url=new URL(location.href);url.searchParams.set("a",a.team_id);url.searchParams.set("b",b.team_id);
 history.replaceState(null,"",url);
}
for(const x of [$("team-a"),$("team-b")])x.addEventListener("change",render);
$("copy-link").addEventListener("click",()=>{const url=location.href;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(()=>{$("copy-link").textContent="Copied matchup link"}).catch(()=>{prompt("Copy matchup URL",url)});else prompt("Copy matchup URL",url)});
render();
})();