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
 if(roster?.evidence?.roster_programs>=350)available.roster=roster;
 if(current?.games_played>0)available.current=current;
 const defaults=available.current?'current':available.roster?'roster':'baseline';
 const labels={current:'Current season Elo',roster:'Roster-adjusted preseason',baseline:'Historical carryover baseline'};
 for(const choice of ['current','roster','baseline']){
  if(!available[choice])continue;
  const option=document.createElement('option');option.value=choice;option.textContent=labels[choice];
  version.append(option);
 }
 const initial=available[defaults];
 for(const name of [...new Set(initial.rankings.map(r=>r.conference).filter(Boolean))].sort()){
  const option=document.createElement('option');option.value=name;option.textContent=name;conference.append(option);
 }
 const initialById=new Map((roster||baseline).rankings.map(r=>[r.team_id,r]));
 function render(){
  const choice=version.value==='auto'?defaults:version.value;
  const data=available[choice]||available[defaults];
  const q=search.value.trim().toLowerCase();
  const c=conference.value;
  const rows=data.rankings.filter(r=>(!q||r.team.toLowerCase().includes(q))&&(!c||r.conference===c));
  if(choice==='roster'){
   status.textContent='2026–27 roster-adjusted preseason · '+data.team_count+' programs · 0 games';
   note.textContent='Independently backtested transfer + returning-minutes Elo · '+data.evidence.roster_programs+'/'+data.team_count+' teams with observed historical/current roster evidence · NCAA-origin player minutes; ESPN current rosters · Provisional';
   referenceHeading.textContent='Roster adjustment';
  }else if(choice==='current'){
   status.textContent='2026–27 current-season Elo · '+data.games_played+' completed games';
   note.textContent='Verified results replayed from roster-adjusted opening Elo where available. Model venue-neutral until court-data calibration.';
   referenceHeading.textContent='Opening Elo';
  }else{
   status.textContent='2026–27 historical carryover baseline · '+data.team_count+' programs';
   note.textContent='Independent 2025–26 Elo with 65% carryover. No player movements incorporated in this comparison.';
   referenceHeading.textContent='2025–26 final Elo';
  }
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
