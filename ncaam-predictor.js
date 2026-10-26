(async()=>{"use strict";const $=x=>document.getElementById(x);async function get(p){try{const r=await fetch(p,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}}
const [start,current,calibration]=await Promise.all([get("data/ncaam-2026-27-preseason-player-quality-live.json"),get("data/ncaam-2026-27-current-provisional.json"),get("data/ncaam-score-calibration.json")]);
if(start?.rankings?.length!==365){$("state").textContent="Verified Elo data unavailable.";return}
const live=current?.rankings?.length===365&&current.games_played>0&&current.preseason_seed==="data/ncaam-2026-27-preseason-player-quality-live.json";
const data=live?current:start;
const teams=[...data.rankings].sort((a,b)=>a.team.localeCompare(b.team)),map=new Map(teams.map(t=>[t.team_id,t]));
const options=teams.map(t=>{const n=document.createElement("option");n.value=t.team_id;n.textContent=t.team;return n});
for(const select of [$("team-a"),$("team-b")])for(const opt of options)select.appendChild(opt.cloneNode(true));
$("team-a").value=teams.find(x=>x.team==="Indiana")?.team_id||teams[0].team_id;
$("team-b").value=teams.find(x=>x.team==="Purdue")?.team_id||teams[1].team_id;
const calibrated=window.NCAAMScores.configure(calibration);
$("state").textContent=(live?data.games_played+" verified games incorporated":"2026–27 preseason")+" · "+(calibrated?"historically tested scoring model":"score calibration pending");
$("caveat").textContent=calibrated?"Score model passed the historical holdout release gate. Neutral venue assumed; no player availability or verified venue effects are included.":"Projected scores are preliminary, not historically calibrated. Venue effects, injuries, and tempo differences are not yet modeled.";
const format=x=>Number(x).toFixed(1);
function render(){const a=map.get($("team-a").value),b=map.get($("team-b").value);if(!a||!b)return;if(a.team_id===b.team_id){$("wintext").textContent="Choose two different teams.";return}
const forecast=window.NCAAMScores.predict(a,b);$("name-a").textContent=a.team;$("name-b").textContent=b.team;$("score-a").textContent=forecast.homeScore;$("score-b").textContent=forecast.awayScore;$("elo-a").textContent=format(a.elo);$("elo-b").textContent=format(b.elo);$("margin").textContent=format(Math.abs(forecast.expectedMargin))+" pts";
$("wintext").textContent=a.team+" "+format(forecast.homeProbability*100)+"% to win · "+b.team+" "+format(forecast.awayProbability*100)+"% to win (neutral court)";
$("probbar").style.width=format(100*forecast.homeProbability)+"%";
}for(const s of [$("team-a"),$("team-b")])s.addEventListener("change",render);render();
})();