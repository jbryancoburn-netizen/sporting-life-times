(() => {
  'use strict';
  const labels = {
    avgPoints: 'PTS/G', avgRebounds: 'REB/G', avgAssists: 'AST/G', avgSteals: 'STL/G',
    avgBlocks: 'BLK/G', avgMinutes: 'MIN/G', avgThreePointFieldGoalsMade: '3PM/G',
    avgTurnovers: 'TO/G', fieldGoalPct: 'FG%', threePointFieldGoalPct: '3P%',
    freeThrowPct: 'FT%', trueShootingPct: 'TS%', scored: 'PTS/G', allowed: 'Opp PTS/G',
    margin: 'Margin/G', winPct: 'Win%', elo: 'RETRO', wins: 'Wins', losses: 'Losses'
  };
  const teamMetrics = ['elo', 'winPct', 'wins', 'losses', 'scored', 'allowed', 'margin'];
  const shootingMinimum = {
    fieldGoalPct: [0, 3], threePointFieldGoalPct: [1, 1.5],
    freeThrowPct: [2, 1.5], trueShootingPct: [0, 3]
  };
  const lowerIsBetter = new Set(['allowed', 'losses']);
  const $ = id => document.getElementById(id);
  const edition = $('edition'), mode = $('mode'), search = $('search'), conference = $('conference');
  const metric = $('metric'), minimum = $('minimum');
  const query = new URLSearchParams(location.search);
  const selected = new Set();
  const pageSize = 40;
  let rows = [], metrics = [], snapshot = '', page = 0, lastPage = 0, revision = 0;
  let currentRows = new Map();
  const option = (value, name) => new Option(name ?? value, value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
  const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{Mark}/gu, '')
    .toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '');
  const rounded = (value, precision) => Number(value.toFixed(precision));
  const precision = key => ['wins', 'losses'].includes(key) ? 0 : key === 'elo' ? 2 : 1;
  const format = (key, value) => Number.isFinite(value)
    ? value.toFixed(precision(key)) + (labels[key].endsWith('%') ? '%' : '') : '—';
  let preference;
  try { preference = localStorage.getItem('slt-college-basketball-edition'); } catch {}
  edition.value = (query.get('gender') || preference) === 'women' ? 'women' : 'men';
  mode.value = query.get('view') === 'teams' ? 'teams' : 'players';
  search.value = query.get('q') || '';
  if ([...minimum.options].some(entry => entry.value === query.get('min'))) minimum.value = query.get('min');

  async function read(path) {
    const response = await fetch(path, {cache: 'no-cache'});
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  }

  function teamRows(data) {
    const teams = new Map(data.rankings.map(team => [String(team.team_id), {
      id: String(team.team_id), name: team.team, conference: team.conference || '', games: 0,
      scored: 0, allowed: 0, wins: 0, elo: team.elo, rank: team.rank
    }]));
    const seen = new Set();
    for (const game of data.events) {
      const home = teams.get(String(game.home_id)), away = teams.get(String(game.away_id));
      const h = game.home_score, a = game.away_score;
      if (!game.id || seen.has(game.id) || !home || !away || home === away ||
          !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h === a) continue;
      seen.add(game.id);
      for (const [team, scored, allowed] of [[home, h, a], [away, a, h]]) {
        team.games++;
        team.scored += scored;
        team.allowed += allowed;
        team.wins += Number(scored > allowed);
      }
    }
    return [...teams.values()].map(team => {
      const {games, scored, allowed, wins, elo} = team;
      return {...team, teamId: team.id, stats: {
        elo, wins, losses: games - wins, scored: scored / games, allowed: allowed / games,
        margin: (scored - allowed) / games, winPct: 100 * wins / games
      }};
    });
  }

  function playerRows(data) {
    return Object.entries(data.players).map(([id, row]) => {
      const [team, name, games, ...values] = row;
      const [teamId, school, league] = data.teams[team];
      return {id, name, games, teamId, school, conference: league || '',
        stats: Object.fromEntries(data.metrics.map((key, index) => [key, values[index]])),
        attempts: values.slice(data.metrics.length)};
    });
  }

  async function load() {
    const token = ++revision;
    const gender = edition.value, players = mode.value === 'players';
    const prefix = gender === 'women' ? 'ncaaw' : 'ncaam';
    $('impact-link').href = 'cbb-impact.html?gender=' + gender;
    $('chronicle').href = 'ncaam.html?gender=' + gender;
    $('games-label').hidden = !players;
    $('count').textContent = 'Loading season statistics…';
    $('leaderboard').replaceChildren();
    $('comparison').hidden = true;
    $('pagination').hidden = true;
    $('method').textContent = '';
    conference.disabled = metric.disabled = true;
    rows = [];
    selected.clear();
    page = 0;
    try {
      const data = await read(players ? 'data/cbb-stats-players-' + gender + '.json'
        : 'data/' + prefix + '-2026-27-retro-primary.json');
      if (token !== revision) return;
      if (players ? data.gender !== gender || data.season !== 2027 : data.season !== '2026-27') {
        throw new Error('Unexpected data');
      }
      rows = players ? playerRows(data) : teamRows(data);
      metrics = players ? data.metrics.filter(key => Object.hasOwn(labels, key)) : teamMetrics;
      snapshot = players ? new Date(data.asOf).toLocaleString('en-US', {
        timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric',
        minute: '2-digit', timeZoneName: 'short'
      }) : data.as_of;
      const conferences = [...new Set(rows.map(row => row.conference).filter(Boolean))].sort();
      conference.replaceChildren(option('', 'All conferences'), ...conferences.map(value => option(value)));
      conference.value = conferences.includes(query.get('conference')) ? query.get('conference') : '';
      metric.replaceChildren(...metrics.map(key => option(key, labels[key])));
      metric.value = metrics.includes(query.get('stat')) ? query.get('stat') : metrics[0];
      conference.disabled = metric.disabled = false;
      render();
    } catch {
      if (token === revision) $('count').textContent = 'Season statistics are unavailable. Refresh to retry.';
    }
  }

  function teamLink(id, name) {
    const path = edition.value === 'women' ? 'ncaaw-team.html' : 'ncaam-team.html';
    return '<a href="' + path + '?' + escape(new URLSearchParams({team: id, gender: edition.value}))
      + '">' + escape(name) + '</a>';
  }

  function entityLink(row) {
    if (mode.value === 'teams') return teamLink(row.teamId, row.name);
    const params = {player: row.id, name: row.name, team: row.teamId, season: '2027', gender: edition.value};
    return '<a href="cbb-player.html?' + escape(new URLSearchParams(params)) + '">' + escape(row.name) + '</a>';
  }

  const rankText = rank => rank ? (rank.tied ? 'T-' : '') + rank.position : '—';

  function rankings(key, players) {
    const ranked = rows.filter(row => {
      if (!Number.isFinite(row.stats[key])) return false;
      if (!players) return key === 'elo' ? Number.isInteger(row.rank) : row.games > 0;
      if (row.games < Number(minimum.value)) return false;
      const threshold = shootingMinimum[key];
      return !threshold || row.attempts[threshold[0]] / row.games >= threshold[1];
    }).map(row => ({row, value: rounded(row.stats[key], precision(key))}));
    if (key === 'elo') {
      return new Map(ranked.map(({row}) => [row.id, {position: row.rank, total: ranked.length}]));
    }
    const sign = lowerIsBetter.has(key) ? 1 : -1;
    ranked.sort((a, b) => sign * (a.value - b.value));
    const ranks = new Map();
    let position = 1;
    ranked.forEach(({row, value}, index) => {
      if (index && value !== ranked[index - 1].value) position = index + 1;
      ranks.set(row.id, {position, total: ranked.length,
        tied: ranked[index - 1]?.value === value || ranked[index + 1]?.value === value});
    });
    return ranks;
  }

  function renderComparison(maps) {
    const picks = [...selected].map(id => currentRows.get(id)).filter(Boolean);
    $('comparison').hidden = !picks.length;
    if (!picks.length) return;
    const lines = [['Games', row => row.games], ...metrics.map(key => [labels[key], row => {
      const rank = maps.get(key).get(row.id);
      return format(key, row.stats[key]) + (rank ? ' <small>(' + rankText(rank) + ' / ' + rank.total + ')</small>' : '');
    }])];
    $('compare-table').innerHTML = '<table><thead><tr><th scope="col">Stat (national rank)</th>' +
      picks.map(row => '<th scope="col">' + entityLink(row) +
        '<br><button type="button" data-pick="' + escape(row.id) + '" aria-label="Remove ' + escape(row.name) +
        '">Remove</button></th>').join('') + '</tr></thead><tbody>' +
      lines.map(([label, value]) => '<tr><th scope="row">' + label + '</th>' +
        picks.map(row => '<td>' + value(row) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  function render(focusSelector) {
    if (!rows.length) return;
    const players = mode.value === 'players', key = metric.value;
    const maps = new Map(metrics.map(stat => [stat, rankings(stat, players)]));
    const national = maps.get(key);
    const terms = search.value.trim().split(/\s+/).map(normalize).filter(Boolean);
    currentRows = new Map(rows.map(row => [row.id, row]));
    const matches = rows.filter(row => {
      const haystack = normalize([row.name, row.school, row.conference].join(' '));
      return (!conference.value || conference.value === row.conference) && terms.every(term => haystack.includes(term));
    }).sort((a, b) => (national.get(a.id)?.position ?? Infinity) - (national.get(b.id)?.position ?? Infinity)
      || a.name.localeCompare(b.name));
    lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    page = Math.min(page, lastPage);
    const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
    $('count').textContent = matches.length.toLocaleString() + ' matches · ' + national.size.toLocaleString()
      + ' ranked in ' + labels[key] + ' · ' + selected.size + ' of 4 selected';
    $('method').textContent = (players
      ? 'Season player statistics · ' + snapshot + '. The table includes players below the selected ranking thresholds.'
      : 'Team rates and records use completed Division I vs. Division I games in the published RETRO dataset · through ' + snapshot + '.');
    $('leaderboard').innerHTML = visible.length ? '<table><thead><tr><th scope="col">D-I rank</th><th scope="col">'
      + (players ? 'Player / school' : 'Team') + '</th><th scope="col">GP</th>'
      + metrics.map(stat => '<th scope="col"' + (stat === key ? ' aria-sort="' +
        (lowerIsBetter.has(key) ? 'ascending' : 'descending') + '"' : '') +
        '><button type="button" data-stat="' + stat + '">' + labels[stat] + '</button></th>').join('')
      + '<th scope="col">Compare</th></tr></thead><tbody>'
      + visible.map(row => {
        const active = selected.has(row.id);
        return '<tr><td>' + rankText(national.get(row.id)) + '</td><th scope="row">' + entityLink(row)
          + '<br><small>' + (players ? teamLink(row.teamId, row.school) + ' · ' : '') + escape(row.conference)
          + '</small></th><td>' + row.games + '</td>'
          + metrics.map(stat => '<td>' + format(stat, row.stats[stat]) + '</td>').join('')
          + '<td><button class="pick" type="button" data-pick="' + escape(row.id)
          + '" aria-pressed="' + active + '" aria-label="Compare ' + escape(row.name) + '"'
          + (!active && selected.size === 4 ? ' disabled' : '') + '>' + (active ? '✓' : '+') + '</button></td></tr>';
      }).join('') + '</tbody></table>' : '<p>No matches. Try a different name or conference.</p>';
    $('pagination').hidden = lastPage === 0;
    $('page').textContent = 'Page ' + (page + 1) + ' of ' + (lastPage + 1);
    $('previous').disabled = page === 0;
    $('next').disabled = page === lastPage;
    renderComparison(maps);
    if (focusSelector) document.querySelector(focusSelector)?.focus();
    const state = new URLSearchParams({gender: edition.value, view: mode.value, stat: key});
    if (search.value) state.set('q', search.value);
    if (conference.value) state.set('conference', conference.value);
    if (players) state.set('min', minimum.value);
    history.replaceState(null, '', '?' + state);
  }

  function filter() { page = 0; render(); }
  search.addEventListener('input', filter);
  for (const control of [conference, metric, minimum]) control.addEventListener('change', filter);
  edition.addEventListener('change', () => {
    try { localStorage.setItem('slt-college-basketball-edition', edition.value); } catch {}
    load();
  });
  mode.addEventListener('change', load);
  $('previous').addEventListener('click', () => { page--; render(); });
  $('next').addEventListener('click', () => { page++; render(); });
  $('clear').addEventListener('click', () => { selected.clear(); render(); search.focus(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-pick], button[data-stat]');
    if (!button) return;
    const {pick, stat} = button.dataset;
    if (stat) {
      metric.value = stat;
      page = 0;
      render('button[data-stat="' + stat + '"]');
      return;
    }
    if (selected.has(pick)) selected.delete(pick);
    else if (selected.size < 4) selected.add(pick);
    render('#leaderboard button[data-pick="' + CSS.escape(pick) + '"]');
    if (document.activeElement === document.body) search.focus();
  });
  load();
})();
