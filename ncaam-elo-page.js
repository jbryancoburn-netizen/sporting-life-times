const tbody=document.getElementById('ratings');
const status=document.getElementById('status');
const note=document.getElementById('source-note');
const search=document.getElementById('team-search');
const conference=document.getElementById('conference-filter');
const version=document.getElementById('rating-version');
const referenceHeading=document.getElementById('reference-heading');
const ratingHeading=document.getElementById('rating-heading');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'—';
const files={
 current:'data/ncaam-2026-27-current-provisional.json',
 roster:'data/ncaam-2026-27-offseason-shadow.json',
 baseline:'data/ncaam-2026-27-preseason-provisional.json'
};
async function load(url){
 try {
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)return null;
  const x=await response.json();
  if(x.season!=='2026-27'||x.team_count<350||x.rankings?.length!==x.team_count||
     !String(x.status).startsWith('provisional-')||
     new Set(x.rankings.map(y=>y.team_id)).size!==x.team_count)return null;
  return x;
 }catch{return null;}
}
function changeMarkup(n){
 if(!Number.isFinite(Number(n)))return '—';
 const x=Number(n);
 if(x===0)return '0.00';
 return '<span class="'+(x>0?'elo-up':'elo-down')+'">'+(x>0?'↑ +':'↓ ')+num(x)+'</span>';
}
try {
 const [current,roster,baseline]=await Promise.all([load(files.current),load(files.roster),load(files.baseline)]);
 if(!baseline)throw Error('Baseline ratings failed integrity checks');
 const available={baseline};
 // Audit hold: roster coefficients yield implausible +100 to +155 Elo jumps.
 // Do not present this experimental model as a validated default.
 const rosterAuditPassed=roster?.audit?.release_approved===true && roster?.production_elo_approved===true && roster?.identity_verified===true && roster?.preseason_information_integrity_verified===true;
 if(roster?.evidence?.roster_programs>=350)available.roster=roster;
 if(current?.games_played>0)available.current=current;
 const defaults=available.current?'current':rosterAuditPassed&&available.roster?'roster':'baseline';
 const labels={current:'Current season Elo',roster:'Experimental 2026–27 roster Elo (unverified)',baseline:'Historical carryover baseline'};
 for(const choice of ['current','roster','baseline']){
  if(!available[choice])continue;
  const option=document.createElement('option');option.value=choice;option.textContent=labels[choice];
  version.append(option);
 }
 const matchupA=document.getElementById('matchup-a');
 const matchupB=document.getElementById('matchup-b');
 const matchupVenue=document.getElementById('matchup-venue');
 const matchupResult=document.getElementById('matchup-result');
 const initial=available[defaults];
 const teamsAlphabetical=[...initial.rankings].sort((a,b)=>a.team.localeCompare(b.team));
 for(const team of teamsAlphabetical){
  for(const select of [matchupA,matchupB]){
   const option=document.createElement('option');
   option.value=team.team_id;option.textContent=team.team;select.append(option);
  }
 }
 const indiana=teamsAlphabetical.find(t=>t.team.toLowerCase()==='indiana');
 const purdue=teamsAlphabetical.find(t=>t.team.toLowerCase()==='purdue');
 matchupA.value=indiana?.team_id||teamsAlphabetical[0]?.team_id;
 matchupB.value=purdue?.team_id||teamsAlphabetical[1]?.team_id;
 function renderMatchup(){
  const choice=version.value==='auto'?defaults:version.value;
  const data=available[choice]||available[defaults];
  const byId=new Map(data.rankings.map(r=>[r.team_id,r]));
  const a=byId.get(matchupA.value),b=byId.get(matchupB.value);
  if(!a||!b||a.team_id===b.team_id){
   matchupResult.textContent='Choose two different programs.';return;
  }
  const venue=matchupVenue.value;
  const advantage=venue==='a'?65:venue==='b'?-65:0;
  const p=100/(1+10**(-((a.elo-b.elo+advantage)/400)));
  matchupResult.textContent=a.team+' '+p.toFixed(1)+'% · '+b.team+' '+(100-p).toFixed(1)+'% — '+(venue==='neutral'?'neutral court':venue==='a'?a.team+' home':b.team+' home')+' · Elo difference '+(a.elo-b.elo).toFixed(1);
 }
 matchupA.addEventListener('change',renderMatchup);
 matchupB.addEventListener('change',renderMatchup);
 matchupVenue.addEventListener('change',renderMatchup);

 for(const name of [...new Set(initial.rankings.map(r=>r.conference).filter(Boolean))].sort()){
  const option=document.createElement('option');option.value=name;option.textContent=name;conference.append(option);
 }
 const initialById=new Map((available.roster||baseline).rankings.map(r=>[r.team_id,r]));
 function render(){
  const choice=version.value==='auto'?defaults:version.value;
  const data=available[choice]||available[defaults];
  const q=search.value.trim().toLowerCase();
  const c=conference.value;
  const rows=data.rankings.filter(r=>(!q||r.team.toLowerCase().includes(q))&&(!c||r.conference===c));
  if(choice==='roster'){
   status.textContent='EXPERIMENTAL · 2026–27 roster-adjusted preseason · '+data.team_count+' programs · 0 games';
   note.textContent='NOT APPROVED for official rankings or betting. '+data.evidence.roster_programs+'/'+data.team_count+' programs with roster evidence; '+(data.evidence.player_matches?.exact_id_matches??0)+' exact cross-provider player IDs; historical roster timing unverified. Estimates may shift sharply.';
   referenceHeading.textContent='Roster adjustment';
  }else if(choice==='current'){
   status.textContent='2026–27 current-season Elo · '+data.games_played+' completed games';
   note.textContent='Verified game results replayed from the approved preseason opening Elo. Venue-neutral until court-data calibration.';
   referenceHeading.textContent='Opening Elo';
  }else{
   status.textContent='2026–27 historical carryover baseline · '+data.team_count+' programs';
   note.textContent='Independent 2025–26 Elo with 65% carryover. Experimental 2026–27 player and transfer adjustments are available separately, not as official rankings.';
   referenceHeading.textContent='2025–26 final Elo';
  }
  renderMatchup();
  ratingHeading.textContent=choice==='current'?'Current Elo':'Preseason Elo';
  tbody.innerHTML=rows.length?rows.map(r=>{
   let reference='—';
   if(choice==='roster')reference=changeMarkup(r.offseason_adjustment);
   else if(choice==='baseline')reference=num(r.last_season_elo);
   else reference=num(initialById.get(r.team_id)?.elo);
   return '<tr><td>'+r.rank+'</td><td class="team">'+safe(r.team)+'</td><td>'+safe(r.conference)+'</td><td class="number elo-standout">'+num(r.elo)+'</td><td class="number">'+reference+'</td><td class="number">'+(r.season_games??r.games??0)+'</td></tr>';
  }).join(''):'<tr><td colspan="6">No matching teams.</td></tr>';
 }
 search.addEventListener('input',render);
 conference.addEventListener('change',render);
 version.addEventListener('change',render);
 render();
}catch(err){
 status.textContent='College Elo data temporarily unavailable';
 note.textContent=String(err.message);
 tbody.innerHTML='<tr><td colspan="6">Cannot show verified ratings.</td></tr>';
}
