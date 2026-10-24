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
 roster:'data/ncaam-2026-27-preseason-roster-informed.json',
 quality:'data/ncaam-2026-27-scoring-quality-shadow.json',
 shadow:'data/ncaam-2026-27-offseason-shadow.json',
 baseline:'data/ncaam-2026-27-preseason-provisional.json'
};
async function load(url){
 try {
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)return null;
  const x=await response.json();
  if(x.season!=='2026-27'||x.team_count!==365||x.rankings?.length!==365||
     !String(x.status).startsWith('provisional-')||
     new Set(x.rankings.map(y=>y.team_id)).size!==365||
     x.rankings.some((y,i)=>y.rank!==i+1||!Number.isFinite(Number(y.elo))||
      (i>0&&y.elo>x.rankings[i-1].elo)))return null;
  return x;
 }catch{return null;}
}
async function loadQuality(url){
 try {
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)return null;
  const x=await response.json();
  if(x.season!=='2026-27'||x.team_count!==365||x.season_games!==0||
     x.status!=='SHADOW_ONLY_DO_NOT_PROMOTE'||
     x.production_elo_approved!==false||x.preseason_asof_certified!==false||
     !Array.isArray(x.rankings)||x.rankings.length!==365||
     !Number.isFinite(Number(x.source_integrity?.quality_beta))||
     x.source_integrity?.matched_verified_history<2500||
     new Set(x.rankings.map(r=>r.team_id)).size!==365||
     x.rankings.some((r,i)=>r.rank!==i+1||
        !Number.isFinite(Number(r.elo))||
        !Number.isFinite(Number(r.experimental_scoring_quality_adjustment))||
        !Number.isFinite(Number(r.roster_informed_elo))||
        Math.abs(Number(r.elo)-Number(r.roster_informed_elo)-Number(r.experimental_scoring_quality_adjustment))>.001||
        (i>0&&Number(r.elo)>Number(x.rankings[i-1].elo))))return null;
  return x;
 }catch{return null;}
}
function compatibleQuality(quality,roster){
 if(!quality||!roster)return false;
 const indexed=new Map(roster.rankings.map(r=>[r.team_id,r]));
 return quality.rankings.every(r=>{
  const existing=indexed.get(r.team_id);
  return existing && existing.team===r.team &&
    existing.conference===r.conference &&
    Math.abs(existing.elo-r.roster_informed_elo)<.001;
 });
}
function changeMarkup(n){
 if(!Number.isFinite(Number(n)))return '—';
 const x=Number(n);
 if(x===0)return '0.00';
 return '<span class="'+(x>0?'elo-up':'elo-down')+'">'+(x>0?'↑ +':'↓ ')+num(x)+'</span>';
}
try {
 const [current,roster,quality,shadow,baseline]=await Promise.all([load(files.current),load(files.roster),loadQuality(files.quality),load(files.shadow),load(files.baseline)]);
 if(!baseline)throw Error('Baseline ratings failed integrity checks');
 const available={baseline};
 // This preseason edition is provisional: identity-linked historical minutes
 // are used when supported, with explicit baseline fallback and no invented player value.
 if(roster?.preseason_roster_informed===true && roster?.evidence?.roster_programs===364 &&
    roster?.evidence?.players_with_verified_historical_minutes>=2500)available.roster=roster;
 if(compatibleQuality(quality,available.roster))available.quality=quality;
 if(shadow?.evidence?.roster_programs>=350)available.shadow=shadow;
 if(current?.games_played>0)available.current=current;
 const defaults=available.current?'current':available.roster?'roster':'baseline';
 const labels={current:'Current season Elo',roster:'New roster-informed preseason (provisional)',quality:'Player scoring quality (experimental · not certified)',shadow:'Previous experimental roster model',baseline:'Historical carryover baseline'};
 for(const choice of ['current','roster','quality','shadow','baseline']){
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
  matchupResult.textContent=(choice==='quality'?'Experimental research only · ':'')+a.team+' '+p.toFixed(1)+'% · '+b.team+' '+(100-p).toFixed(1)+'% — '+(venue==='neutral'?'neutral court':venue==='a'?a.team+' home':b.team+' home')+' · Elo difference '+(a.elo-b.elo).toFixed(1);
 }
 matchupA.addEventListener('change',renderMatchup);
 matchupB.addEventListener('change',renderMatchup);
 matchupVenue.addEventListener('change',renderMatchup);

 for(const name of [...new Set(initial.rankings.map(r=>r.conference).filter(Boolean))].sort()){
  const option=document.createElement('option');option.value=name;option.textContent=name;conference.append(option);
 }
 const initialById=new Map((available.roster||baseline).rankings.map(r=>[r.team_id,r]));
 const rankedById=new Map((available.roster||baseline).rankings.map(r=>[r.team_id,r.rank]));
 const comparison=document.getElementById('elo-quality-comparison');
 const modelPill=document.getElementById('elo-model-pill');
 function render(){
  const choice=version.value==='auto'?defaults:version.value;
  const data=available[choice]||available[defaults];
  const q=search.value.trim().toLowerCase();
  const c=conference.value;
  const rows=data.rankings.filter(r=>(!q||r.team.toLowerCase().includes(q))&&(!c||r.conference===c));
  if(choice==='roster'){
   status.textContent='2026–27 roster-informed preseason Elo · '+data.team_count+' teams · provisional';
   note.textContent='Updated for 2026–27 rosters: '+data.evidence.source_linked_player_ids+' linked NCAA/ESPN player IDs; '+data.evidence.players_with_verified_historical_minutes+' players contributing documented prior minutes; '+data.evidence.roster_programs+'/'+data.team_count+' teams covered. Unverified players are not assigned invented production. Historical roster timing and independent model calibration remain provisional.';
   referenceHeading.textContent='Roster adjustment';
  }else if(choice==='quality'){
   status.textContent='EXPERIMENTAL RESEARCH · 2026–27 player-scoring Elo · '+data.team_count+' teams';
   note.textContent='Comparison only, not the default: scoring adjustment from '+data.source_integrity.matched_verified_history+' linked historical player records. A 1,596-game test AFTER two weeks of observed rosters improved prediction accuracy. That does NOT validate the adjustment for opening day; preseason roster archives are incomplete.';
   referenceHeading.textContent='Δ vs roster Elo';
  }else if(choice==='shadow'){
   status.textContent='RESEARCH · Earlier experimental roster Elo · '+data.team_count+' programs';
   note.textContent='Older exact-name-match model; available for comparison only. Its identity evidence is weaker than the newer roster-informed edition.';
   referenceHeading.textContent='Research adjustment';
  }else if(choice==='current'){
   status.textContent='2026–27 current-season Elo · '+data.games_played+' completed games';
   note.textContent='Completed game results independently replayed from the roster-informed provisional preseason Elo. Venue-neutral until court-data calibration. Verify source coverage for each reporting day.';
   referenceHeading.textContent='Opening Elo';
  }else{
   status.textContent='2026–27 historical carryover baseline · '+data.team_count+' programs';
   note.textContent='Independent 2025–26 Elo with 65% carryover, without player adjustments. The updated 2026–27 roster-informed edition is available separately.';
   referenceHeading.textContent='2025–26 final Elo';
  }
  renderMatchup();
  ratingHeading.textContent=choice==='current'?'Current Elo':choice==='quality'?'Research Elo':'Preseason Elo';
  if(comparison){
   comparison.hidden=choice!=='quality';
  }
  if(modelPill){
   modelPill.textContent=choice==='quality'?'EXPERIMENTAL':'PROVISIONAL';
   modelPill.dataset.status=choice==='quality'?'experimental':'provisional';
  }
  tbody.innerHTML=rows.length?rows.map(r=>{
   let reference='—';
   if(choice==='quality')reference=changeMarkup(r.experimental_scoring_quality_adjustment);
   else if(choice==='roster'||choice==='shadow')reference=changeMarkup(r.offseason_adjustment);
   else if(choice==='baseline')reference=num(r.last_season_elo);
   else reference=num(initialById.get(r.team_id)?.elo);
   const baselineRank=rankedById.get(r.team_id);
   const move=choice==='quality'&&Number.isInteger(baselineRank)&&baselineRank!==r.rank?
    '<span class="elo-rank-move" aria-label="'+Math.abs(baselineRank-r.rank)+' rank places '+(baselineRank>r.rank?'up':'down')+'">'+
    (baselineRank>r.rank?'↑':'↓')+Math.abs(baselineRank-r.rank)+'</span>':'';
   return '<tr><td>'+r.rank+move+'</td><td class="team">'+safe(r.team)+'</td><td>'+safe(r.conference)+'</td><td class="number elo-standout">'+num(r.elo)+'</td><td class="number">'+reference+'</td><td class="number">'+(r.season_games??r.games??0)+'</td></tr>';
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
