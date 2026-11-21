/* Refresh the Matchday Ledger with ESPN's current Eastern-time slate. */
(()=>{
'use strict';
const rail=document.getElementById('epl-score-rail');
if(!rail)return;
const today=()=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date()).replace(/\D/g,'');
let pending=false;
async function updateLive(){
 if(pending||document.hidden||!window.EPLMatchday)return;
 pending=true;
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates='+today(),{
   cache:'no-store',signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)return;
  const data=await response.json();
  const events=(data.events||[]).flatMap(event=>{
   const match=event.competitions?.[0],type=event.status?.type;
   const away=match?.competitors?.find(team=>team.homeAway==='away');
   const home=match?.competitors?.find(team=>team.homeAway==='home');
   if(!away||!home)return [];
   const club=team=>({id:team.team?.id,name:team.team?.displayName||'Club',
    abbreviation:team.team?.abbreviation,color:'#'+(team.team?.color||'655239')});
   return [{fixture_id:String(event.id),kickoff_utc:event.date,away:club(away),home:club(home),
    away_score:away.score,home_score:home.score,venue:match.venue?.fullName,
    status:type?.shortDetail||type?.description,
    phase:type?.state==='in'?'live':type?.completed?'final':'upcoming'}];
  });
  window.EPLMatchday.updateScores(events);
 }catch(error){
  // Keep the published slate visible if ESPN is unavailable.
 }finally{pending=false;}
}
const observer=new MutationObserver(()=>{
 if(window.EPLMatchday){observer.disconnect();updateLive();}
});
observer.observe(rail,{childList:true});
updateLive();
setInterval(updateLive,60000);
document.addEventListener('visibilitychange',updateLive);
})();
