(() => {
'use strict';
const get = async path => {
 try {
  const response = await fetch(path, {signal:AbortSignal.timeout(10000)});
  return response.ok ? await response.json() : null;
 } catch { return null; }
};
const nameKey = name => String(name || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const positionKey = position => {
 const text = String(position || '').toUpperCase().trim();
 const positions = {G:'Guard', PG:'Point guard', SG:'Shooting guard', F:'Forward', SF:'Small forward', PF:'Power forward', C:'Center', GUARD:'Guard', FORWARD:'Forward', CENTER:'Center', 'POINT GUARD':'Point guard', 'SHOOTING GUARD':'Shooting guard', 'SMALL FORWARD':'Small forward', 'POWER FORWARD':'Power forward', 'G/F':'Guard / Forward', 'F/G':'Guard / Forward', 'F/C':'Forward / Center', 'C/F':'Forward / Center'};
 return positions[text.replace(/\s*[-/]\s*/g,'/')] || 'Unlisted';
};
async function mount(host, members, gender, espnIds) {
 const {score, format, escape} = window.SLTCBBImpact;
 host.innerHTML = '<section class="panel slt-impact-register"><h2>RETRO Game Impact by Position</h2><p role="status">Loading conference box scores and roster positions…</p></section>';
 const status = host.querySelector('[role=status]');
 const women = gender === 'women';
 const rosters = women ? get('data/ncaaw-rosters-2026-27.json').then(doc => members.map(t => doc?.teams?.[t.team_id])) :
  Promise.all(members.map(t => {
   const id = espnIds.get(t.team_id);
   return id ? get('data/mbb-rosters-2026-27/'+encodeURIComponent(id)+'.json') : null;
  }));
 const [impact, rosterDocs] = await Promise.all([get('data/cbb-game-impact-'+gender+'.json'), rosters]);
 if (!impact?.games || !impact.teams) {
  status.textContent = 'RETRO Game Impact is currently unavailable.';
  return;
 }
 const schools = new Map(members.map((t, i) => {
  const names = new Map();
  const athletes = new Map();
  for (const player of rosterDocs[i]?.players || []) {
   const position = positionKey(player.position);
   const key = nameKey(player.name);
   names.set(key, names.has(key) ? 'Unlisted' : position);
   const id = String(player.headshot_url || '').match(/\/players\/full\/(\d+)\./)?.[1];
   if (id) athletes.set(id, position);
  }
  return [String(t.team_id), {names, athletes}];
 }));
 const players = new Map();
 for (const game of Object.values(impact.games)) {
  for (const [index, side] of ['home','away'].entries()) {
   const [team, school] = impact.teams[game.signature[index]] || [];
   const roster = schools.get(String(team));
   if (!roster) continue;
   for (const [id, name, ...stats] of game[side]) {
    const key = team+':'+id;
    const row = players.get(key) || {id,name,team,school,position:roster.athletes.get(String(id)) || roster.names.get(nameKey(name)) || 'Unlisted',total:0,games:0};
    row.total += score(stats);
    row.games++;
    players.set(key,row);
   }
  }
 }
 if (!players.size) {
  status.textContent = 'No verified box scores for conference members are available yet.';
  return;
 }
 const average = row => row.total / row.games;
 const rows = [...players.values()].sort((a,b) => average(b)-average(a) || b.games-a.games || a.name.localeCompare(b.name));
 const positions = [...new Set(rows.map(row => row.position))].sort();
 const teamURL = row => (women?'ncaaw':'ncaam')+'-team.html?team='+encodeURIComponent(row.team);
 const playerURL = row => 'cbb-player.html?'+new URLSearchParams({player:row.id, season:'2027',gender,name:row.name,team:row.team});
 status.textContent = rows.length+' players with verified box scores. League members only. Impact per game uses all available games, including nonconference play.';
 status.insertAdjacentHTML('afterend','<label>Position <select><option value="">All positions</option>'+positions.map(p=>'<option>'+escape(p)+'</option>').join('')+'</select></label>'+
  '<div class="table-wrap"><table><thead><tr><th scope="col">Place</th><th scope="col">Player / School</th><th scope="col">Position</th><th scope="col">GP</th><th scope="col">Impact / G</th><th scope="col">Total</th></tr></thead><tbody></tbody></table></div>');
 const select=host.querySelector('select'), body=host.querySelector('tbody');
 const render = () => {
  body.innerHTML=rows.filter(row=>!select.value || row.position===select.value).slice(0,25).map((r,i)=>
   '<tr><td>'+(i+1)+'</td><td><a href="'+escape(playerURL(r))+'">'+escape(r.name)+'</a><small><a href="'+teamURL(r)+'">'+escape(r.school)+'</a></small></td><td>'+escape(r.position)+'</td><td>'+r.games+'</td><td><strong>'+format(average(r))+'</strong></td><td>'+format(r.total)+'</td></tr>').join('');
 };
 select.addEventListener('change',render);
 render();
}
window.SLTConferenceImpact = {mount};
})();
