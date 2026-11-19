(() => {
  'use strict';
  const {score, format, details, escape, profile} = window.SLTCBBImpact;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const teamSelect = $('team');
  const edition = $('edition'), view = $('view'), search = $('search'), sort = $('sort'), low = $('low');
  let team = params.get('team') || '', data, revision = 0, page = 0, matches = [];
  const pageSize = 35;
  edition.value = params.get('gender') === 'women' ? 'women' : 'men';
  view.value = params.get('view') === 'games' ? 'games' : 'season';
  search.value = params.get('q') || '';

  function prepare(doc) {
    const players = new Map(), lines = [];
    let lowShot = 0, topThree = 0;
    for (const [gameId, game] of Object.entries(doc.games)) {
      for (const [side, index] of [['home', 0], ['away', 1]]) {
        const [teamId, school, conference] = doc.teams[game.signature[index]];
        const opponent = doc.teams[game.signature[1 - index]][1];
        const ranked = game[side].map(([id, name, ...stats]) =>
          ({id, name, stats, total:score(stats), teamId, school, conference, opponent, gameId, day:game.day}))
          .sort((a, b) => b.total - a.total);
        for (const row of ranked) {
          const key = row.id + ':' + teamId;
          const player = players.get(key) || {...row, total:0, games:0, led:0, best:row};
          player.total += row.total;
          player.games++;
          if (row.total === ranked[0].total) player.led++;
          if (row.total > player.best.total) player.best = row;
          players.set(key, player);
          if (row.stats[7] <= 5 && score([0, ...row.stats.slice(1, 6), 0, 0, 0]) >= 5000) {
            lowShot++;
            if (row.total >= ranked[Math.min(2, ranked.length - 1)].total) topThree++;
          }
          lines.push(row);
        }
      }
    }
    return {players:[...players.values()], lines, lowShot, topThree};
  }

  async function load() {
    const token = ++revision;
    data = null;
    $('status').textContent = 'Loading box scores…';
    $('results').replaceChildren();
    $('pagination').hidden = true;
    $('coverage').textContent = $('audit').textContent = '';
    $('register').href = 'cbb-stats.html?gender=' + edition.value;
    try {
      const response = await fetch('data/cbb-game-impact-' + edition.value + '.json', {cache:'no-cache'});
      if (!response.ok) throw Error('Unavailable');
      const doc = await response.json();
      if (token !== revision) return;
      if (doc.gender !== edition.value || doc.version !== 1 || !Object.keys(doc.games).length) throw Error('Unavailable');
      data = prepare(doc);
      const schools = Object.values(doc.teams).sort((a, b) => a[1].localeCompare(b[1]));
      teamSelect.replaceChildren(new Option('All teams', ''), ...schools.map(([id, name]) => new Option(name, id)));
      teamSelect.value = schools.some(([id]) => id === team) ? team : '';
      team = teamSelect.value;
      $('coverage').textContent = Object.keys(doc.games).length.toLocaleString() + ' of ' +
        doc.expected.toLocaleString() + ' linked Division I finals have matching complete box scores.';
      $('audit').textContent = 'Low-shot contributors finished in their team’s top three in ' +
        data.topThree.toLocaleString() + ' of ' + data.lowShot.toLocaleString() + ' qualifying appearances.';
      filter();
    } catch {
      if (token === revision) $('status').textContent = 'Impact statistics are unavailable for this edition.';
    }
  }

  const linkTeam = row => '<a href="' + (edition.value === 'women' ? 'ncaaw' : 'ncaam') +
    '-team.html?' + escape(new URLSearchParams({team:row.teamId, gender:edition.value})) + '">' + escape(row.school) + '</a>';
  const linkGame = row => '<a href="cbb-game-center.html?' +
    escape(new URLSearchParams({day:row.day, game:row.gameId, gender:edition.value})) + '">' +
    escape(row.day + ' · ' + row.opponent) + '</a>';
  const average = row => row.total / row.games;

  function filter() {
    page = 0;
    if (!data) return;
    const games = view.value === 'games';
    $('table-title').textContent = games ? 'Single-game performances' : 'Season leaders';
    $('low-label').hidden = !games;
    $('sort-label').hidden = games;
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const value = games ? row => row.total : sort.value === 'led' ? row => row.led : average;
    matches = (games ? data.lines : data.players).filter(row =>
      (!team || row.teamId === team) && (!games || !low.checked || row.stats[7] <= 5) &&
      terms.every(term => [row.name, row.school, row.conference, games ? row.opponent : '']
        .join(' ').toLowerCase().includes(term))
    ).sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
    render();
  }

  function render() {
    const games = view.value === 'games';
    const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
    const headers = games ? ['Player and school', 'Game', 'Impact breakdown', 'FGA', 'REB', 'BLK'] :
      ['Player and school', 'GP', 'Impact/G', 'Games led', 'Best game'];
    $('status').textContent = matches.length.toLocaleString() + ' results';
    $('results').innerHTML = visible.length ? '<table><thead><tr>' +
      headers.map(label => '<th scope="col">' + label + '</th>').join('') + '</tr></thead><tbody>' +
      visible.map(row => '<tr><td>' + profile(row.id, row.name, edition.value) + '<br><small>' + linkTeam(row) +
        ' · ' + escape(row.conference) + '</small></td>' + (games ?
          '<td>' + linkGame(row) + '</td><td>' + details(row.stats) + '</td><td>' + row.stats[7] +
          '</td><td>' + (row.stats[1] + row.stats[2]) + '</td><td>' + row.stats[5] + '</td>' :
          '<td>' + row.games + '</td><td>' + format(average(row)) + '</td><td>' + row.led +
          ' / ' + row.games + '</td><td>' + format(row.best.total) + ' · ' + linkGame(row.best) + '</td>') +
        '</tr>').join('') + '</tbody></table>' : '<p>No matching performances.</p>';
    const last = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    $('pagination').hidden = last === 0;
    $('page').textContent = 'Page ' + (page + 1) + ' of ' + (last + 1);
    $('previous').disabled = page === 0;
    $('next').disabled = page === last;
  }

  edition.addEventListener('change', () => { team = ''; load(); });
  teamSelect.addEventListener('change', () => { team = teamSelect.value; filter(); });
  for (const control of [view, sort, low]) control.addEventListener('change', filter);
  search.addEventListener('input', filter);
  $('previous').addEventListener('click', () => { page--; render(); });
  $('next').addEventListener('click', () => { page++; render(); });
  load();
})();
