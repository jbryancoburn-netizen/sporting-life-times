(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const stats = {
    avgPoints: 'PTS/G', avgRebounds: 'REB/G', avgAssists: 'AST/G', avgSteals: 'STL/G',
    avgBlocks: 'BLK/G', avgMinutes: 'MIN/G', fieldGoalPct: 'FG%',
    threePointFieldGoalPct: '3P%', freeThrowPct: 'FT%'
  };
  const seasonLabel = y => (Number(y) - 1) + '–' + String(y).slice(2);
  const get = async url => {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
      return response.ok ? await response.json() : null;
    } catch { return null; }
  };
  const schoolLink = (team, label, gender) => {
    if (!team?.[0]) return escape(label);
    const prefix = gender === 'women' ? 'ncaaw' : 'ncaam';
    return '<a href="' + prefix + '-team.html?team=' + encodeURIComponent(team[0]) + '">' + escape(label) + '</a>';
  };
  const table = (heading, columns, rows) =>
    '<h2>' + escape(heading) + '</h2><div class="player-reference-scroll" tabindex="0" aria-label="' +
    escape(heading) + '"><table class="player-log-table player-reference-table"><thead><tr>' +
    columns.map(value => '<th scope="col">' + escape(value) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(([label,...cells]) => '<tr><th scope="row">' + label + '</th>' +
      cells.map(value=>'<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';

  function renderRankings(cohort, context) {
    const {player, year, gender} = context;
    const node = el('player-rankings');
    if (cohort?.season !== Number(year) || cohort.gender !== gender) {
      node.innerHTML = '<h2>Stat rankings</h2><p>Rankings are unavailable for this season.</p>';
      return;
    }
    const row = cohort.players[player];
    if (!row) {
      node.innerHTML = '<h2>Stat rankings</h2><p>No ranking in this snapshot. Rankings require ' +
        escape(cohort.minimumGames) + ' reported games for a single Division I team.</p>';
      return;
    }
    const team = cohort.teams[row[0]];
    const entries = Object.values(cohort.players);
    const teammates = entries.filter(other => other[0] === row[0]);
    const conference = team?.[2] ? entries.filter(other => cohort.teams[other[0]]?.[2] === team[2]) : [];
    const rank = (group, index) => {
      const value = row[index];
      if (!Number.isFinite(value)) return '—';
      const pool = group.map(other => other[index]).filter(Number.isFinite);
      if (!pool.length) return '—';
      const tied = pool.filter(other => other === value).length > 1;
      return (tied ? 'T-' : '') + (1 + pool.filter(other => other > value).length) +
        ' <small>/ ' + pool.length + '</small>';
    };
    node.innerHTML = table('Stat rankings', ['Stat','Average','Team','Conference','Division I'],
      cohort.metrics.map((metric, i) => [escape(stats[metric] || metric),
        Number.isFinite(row[i+1]) ? row[i+1].toFixed(1) : '—',
        rank(teammates, i+1), rank(conference, i+1), rank(entries, i+1)])) +
      '<p class="player-method">Games played for one Division I team · minimum ' + escape(cohort.minimumGames) +
      ' games · ties at the displayed precision. Snapshot ' + escape(new Date(cohort.asOf).toLocaleString('en-US', {
        timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'
      })) + '.</p>';
  }

  function renderHistory(data, cohort, crosswalk, context) {
    const {year, gender} = context;
    const node = el('player-history');
    const category = data?.categories?.find(item => item.name === 'averages');
    const rows = category?.statistics?.filter(row => row.season?.year && Array.isArray(row.stats)) || [];
    if (!rows.length) {
      node.innerHTML = '<h2>Year by year</h2><p>Season averages are unavailable.</p>';
      return;
    }
    rows.sort((a,b)=>Number(b.season.year)-Number(a.season.year));
    const names = ['gamesPlayed','gamesStarted',...Object.keys(stats)].filter(key=>category.names.includes(key));
    const columns = names.map(key => ({key,label: key==='gamesPlayed'?'GP':key==='gamesStarted'?'GS':stats[key],
      index:category.names.indexOf(key)}));
    const yearLink = entry => {
      const params = new URLSearchParams(location.search);
      params.set('season', entry.season.year);
      const label = escape(seasonLabel(entry.season.year));
      return String(entry.season.year)===year ? label : '<a href="cbb-player.html?' + escape(params) + '">' + label + '</a>';
    };
    const schools = new Map(crosswalk?.teams?.map(t=>[String(t.espn_id), t.id]));
    const school = entry => {
      const id = String(entry.teamId);
      const label = data.teams?.[entry.teamSlug]?.shortDisplayName || data.teams?.[entry.teamSlug]?.displayName;
      const directory = cohort?.teams?.[id];
      const team = directory || (gender==='men' ? [schools.get(id)] : null);
      return schoolLink(team, label || directory?.[1] || '—', gender);
    };
    const body = rows.map(row=>[yearLink(row),school(row),...columns.map(col=>escape(row.stats[col.index]??'—'))]);
    const current = rows.filter(row=>Number(row.season.year)===Number(year));
    const previous = rows.filter(row=>Number(row.season.year)===Number(year)-1);
    if (current.length===1 && previous.length===1) {
      body.push(['Year-over-year change', '—', ...columns.map(({key,index})=>{
        if (key==='gamesPlayed'||key==='gamesStarted') return '—';
        const a = current[0].stats[index], b = previous[0].stats[index];
        if (!/^\d+(?:\.\d+)?$/.test(String(a)) || !/^\d+(?:\.\d+)?$/.test(String(b))) return '—';
        const delta = (Number(a)-Number(b)).toFixed(1);
        return (Number(delta)>0?'+':'') + delta + (key.endsWith('Pct')?' pp':'');
      })]);
    }
    node.innerHTML = table('Year by year', ['Season','Team',...columns.map(col=>col.label)], body) +
      '<p class="player-method">Select an earlier season to open its game log. An in-progress season reflects games played so far.</p>';
  }

  function renderProfile(data, cohort, crosswalk, {player, gender, league, year}) {
    const athlete = data?.athlete;
    if (String(athlete?.id)!==player || data.league?.slug!==league) return;
    el('player-name').textContent = athlete.displayName || 'Player season log';
    const portrait = el('player-portrait');
    try {
      const url = new URL(athlete.headshot?.href);
      if (url.origin === 'https://a.espncdn.com' && url.pathname.endsWith('/'+player+'.png')) {
        portrait.alt = athlete.displayName;
        portrait.addEventListener('error', () => { portrait.hidden = true; }, {once:true});
        portrait.src = url.href;
        portrait.hidden = false;
      }
    } catch {}
    const school = athlete.team;
    const team = cohort?.teams?.[school?.id] ||
      (gender==='men'?[crosswalk?.teams?.find(t=>String(t.espn_id)===String(school?.id))?.id]:
        school?.groups?.parent?.id==='50'?[school.id]:null);
    const conference = team?.[2] || school?.groups?.name;
    const prefix = gender==='women'?'ncaaw':'ncaam';
    if (String(data.season?.year)===year && school?.displayName) {
      el('player-affiliation').innerHTML = schoolLink(team,school.displayName,gender) +
        (conference ? ' · <a href="' + prefix + '-conference.html?conference=' +
          encodeURIComponent(conference) + '">' + escape(conference) + '</a>' : '');
    } else if (school?.displayName) {
      el('player-affiliation').innerHTML = 'Latest roster: ' + schoolLink(team,school.displayName,gender);
    }
    el('player-bio').textContent = [athlete.jersey ? '#'+athlete.jersey : '', athlete.position?.displayName,
      athlete.displayExperience, athlete.displayHeight, athlete.displayWeight, athlete.displayBirthPlace]
      .filter(Boolean).join(' · ');
  }

  async function load(context) {
    const endpoint = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/' +
      context.league + '/athletes/' + context.player;
    const [profile, history, cohort, crosswalk] = await Promise.all([
      get(endpoint), get(endpoint+'/stats'), get('data/cbb-player-rankings-'+context.gender+'.json'),
      context.gender==='men' ? get('data/ncaam-2026-27-espn-team-crosswalk.json') : null
    ]);
    renderProfile(profile, cohort, crosswalk, context);
    renderHistory(history, cohort, crosswalk, context);
    renderRankings(cohort, context);
  }
  window.SLTCBBPlayerProfile = {load};
})();
