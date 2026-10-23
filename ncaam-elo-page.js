const tbody=document.getElementById('ratings');
const status=document.getElementById('status');
const note=document.getElementById('source-note');
const search=document.getElementById('team-search');
const conference=document.getElementById('conference-filter');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toFixed(2);
try {
 const current=await fetch('data/ncaam-2026-27-current-provisional.json',{cache:'no-store'});\n const file=current.ok?'data/ncaam-2026-27-current-provisional.json':'data/ncaam-2026-27-preseason-provisional.json';\n const response=current.ok?current:await fetch(file,{cache:'no-store'});
 if(!response.ok)throw Error('Ratings file unavailable ('+response.status+')');
 const data=await response.json();
 if(data.team_count!==365||data.rankings?.length!==365||!String(data.status).startsWith('provisional-'))throw Error('Invalid or unverified publication data');
 const rows=data.rankings;
 for(const name of [...new Set(rows.map(r=>r.conference).filter(Boolean))].sort()){
   const option=document.createElement('option');option.value=name;option.textContent=name;conference.append(option);
 }
 status.textContent=`2026–27 opening rankings · ${data.team_count} teams · 0 completed games`;
 note.textContent=data.games_played?'Verified completed games replayed · Venue-neutral provisional model · Forecast calibration pending':'2025–26 historical carryover: '+Math.round(data.carryover*100)+'% · Court and membership verification pending';
 const render=()=>{
   const q=search.value.trim().toLowerCase();const c=conference.value;
   const filtered=rows.filter(r=>(!q||r.team.toLowerCase().includes(q))&&(!c||r.conference===c));
   tbody.innerHTML=filtered.length?filtered.map(r=>`<tr><td>${r.rank}</td><td class="team">${safe(r.team)}</td><td>${safe(r.conference)}</td><td class="number elo-standout">${num(r.elo)}</td><td class="number">${num(r.last_season_elo??r.start_elo)}</td><td class="number">${r.season_games}</td></tr>`).join(''):'<tr><td colspan="6">No matching teams.</td></tr>';
 };
 search.addEventListener('input',render);conference.addEventListener('change',render);render();
} catch(err){
 status.textContent='College Elo data temporarily unavailable';
 note.textContent=String(err.message);
 tbody.innerHTML='<tr><td colspan="6">Cannot show unverified rankings.</td></tr>';
}
