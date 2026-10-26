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
if(!window.NCAAMScores||typeof window.NCAAMScores.predict!=="function"){window.NCAAMScores={configure:()=>false,configureProfiles:()=>false,predict:(a,b)=>{const d=a.elo-b.elo,p=1/(1+Math.pow(10,-d/400)),m=Math.max(-28,Math.min(28,d/25));let h=Math.round(72+m/2),v=Math.round(72-m/2);if(h===v){if(d>=0)h++;else v++}return {homeScore:h,awayScore:v,homeProbability:p,awayProbability:1-p,expectedMargin:m,expectedTotal:144,scoringStatus:"FALLBACK"}}}}
const calibrated=window.NCAAMScores.configure(calibration);
const scoringProfiles=await get("data/ncaam-team-scoring-profiles.json");
const profilesLoaded=window.NCAAMScores.configureProfiles(scoringProfiles);
const volatility=await get("data/ncaam-2026-27-preseason-uncertainty-features.json");
const volatilityMap=new Map((volatility?.teams||[]).map(x=>[x.team_id,x]));
const modelPartsMissing=[!scoringProfiles?"historical team scoring profiles":null,!calibration?"historical margin calibration":null].filter(Boolean);
$("state").textContent=(isLive?currentRatings.games_played+" verified results incorporated":"2026–27 preseason")+" · "+(profilesLoaded?"historical team scoring profiles loaded":"historical scoring profiles pending")+" · "+(calibrated?"calibrated point margin":"score calibration pending")+(modelPartsMissing.length?" · Missing: "+modelPartsMissing.join(", "):"");
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
 const favoriteA=p.homeProbability>=.5;
 const favorite=favoriteA?a:b;
 $("blowout-favorite").textContent="Chance that "+favorite.team+" wins by at least the listed number of points";
 const tail=favoriteA?p.homeWinBy:p.awayWinBy;
 for(const n of [10,20,30])$("blowout-"+n).textContent=tail?num(100*tail[n])+"%":"Not modeled";
 $("wintext").textContent=a.team+" "+num(p.homeProbability*100)+"% · "+b.team+" "+num(p.awayProbability*100)+"% (neutral-site estimate)";
 $("probbar").style.width=num(p.homeProbability*100)+"%";
 const noQualityA={...a,elo:a.elo-(Number(a.quality_component)||0)};
 const noQualityB={...b,elo:b.elo-(Number(b.quality_component)||0)};
 const without=window.NCAAMScores.predict(noQualityA,noQualityB);
 const noRosterA={...a,elo:a.elo-(Number(a.offseason_adjustment)||0)};
 const noRosterB={...b,elo:b.elo-(Number(b.offseason_adjustment)||0)};
 const baseline=window.NCAAMScores.predict(noRosterA,noRosterB);
 const scenarios=[["Published player-quality Elo",p],["Without scoring-quality adjustments",without],["Previous team-strength baseline",baseline]];
 $("sensitivity").innerHTML=scenarios.map(([name,r])=>'<div class="factor"><strong>'+safe(name)+'</strong> · '+safe(a.team)+' '+num(r.homeProbability*100)+'% / '+safe(b.team)+' '+num(r.awayProbability*100)+'% · expected margin '+num(r.expectedMargin)+' points</div>').join("");

 $("roster-name-a").textContent=a.team;$("roster-name-b").textContent=b.team;
 $("roster-a").innerHTML=impact(a);$("roster-b").innerHTML=impact(b);
 const teamVol=t=>{
   const v=volatilityMap.get(t.team_id);
   if(!v)return '<div class="mini"><h3>'+safe(t.team)+'</h3><p class="fine">No verified roster continuity record.</p></div>';
   const pct=x=>Number.isFinite(Number(x))?(Number(x)*100).toFixed(1)+'%':'Unavailable';
   return '<div class="mini"><h3>'+safe(t.team)+'</h3><div class="impact"><span>Returning prior minutes</span><strong>'+pct(v.observed_roster_churn_share===null?null:1-v.observed_roster_churn_share)+'</strong></div><div class="impact"><span>Observed roster turnover</span><strong>'+pct(v.observed_roster_churn_share)+'</strong></div><div class="impact"><span>Verified prior players</span><strong>'+Number(v.verified_prior_player_count||0)+'</strong></div><div class="impact"><span>Linked transfers with source Elo</span><strong>'+Number(v.linked_transfers_with_source_elo||0)+'</strong></div></div>';
 };
 $("roster-volatility").innerHTML=teamVol(a)+teamVol(b);

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
 $("uncertainty").textContent=(modelPartsMissing.length?"Model data publication incomplete: "+modelPartsMissing.join(", ")+". The displayed score is a fallback estimate. ":"")+"Verified historical-minute evidence: "+a.team+" "+counts[0]+" players; "+b.team+" "+counts[1]+" players. "+(cov.length?"Incomplete roster evidence for "+cov.join(" and ")+". ":"")+
 "Evidence counts are not a calibrated probability-confidence score. Venue, injuries, lineup availability and team-specific pace are currently unmodeled.";
 const url=new URL(location.href);url.searchParams.set("a",a.team_id);url.searchParams.set("b",b.team_id);
 history.replaceState(null,"",url);
}
for(const x of [$("team-a"),$("team-b")])x.addEventListener("change",()=>{try{render()}catch(err){console.error(err);$("state").textContent="Prediction error: "+String(err.message||err)}});
$("copy-link").addEventListener("click",()=>{const url=location.href;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(()=>{$("copy-link").textContent="Copied matchup link"}).catch(()=>{prompt("Copy matchup URL",url)});else prompt("Copy matchup URL",url)});
try{render()}catch(err){console.error(err);$("state").textContent="Matchup render error: "+String(err.message||err);$("model-grade").textContent="Rendering error"}
})();