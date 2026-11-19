(() => {
  'use strict';
  const {score, format, details, escape, profile} = window.SLTCBBImpact;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const teamSelect = $('team');
  const edition = $('edition'), view = $('view'), search = $('search'), sort = $('sort'), low = $('low');
  let team = params.get('team') || '', data, revision = 0, page = 0, matches = [];
  const pageSize = 18;
  let preference;
  try { preference = localStorage.getItem('slt-college-basketball-edition'); } catch {}
  edition.value = (params.get('gender') || preference) === 'women' ? 'women' : 'men';
  view.value = params.get('view') === 'games' ? 'games' : 'season';
  search.value = params.get('q') || '';

  function prepare(doc) {
    const players = new Map(), lines = [];
    let lowShot = 0, topThree = 0;
    for (const [gameId, game] of Object.entries(doc.games)) {
      for (const [side, index] of [['home', 0], ['away', 1]]) {
        const logoId = String(game.signature[index]);
        const [teamId, school, conference] = doc.teams[logoId];
        const opponent = doc.teams[game.signature[1 - index]][1];
        const ranked = game[side].map(([id, name, ...stats]) =>
          ({id, name, stats, total:score(stats), teamId, school, conference, logoId, opponent, gameId, day:game.day}))
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
    $('impact-ledger').href = 'ncaam-slate.html?gender=' + edition.value;
    $('impact-chronicle').href = 'ncaam.html?gender=' + edition.value;
    try {
      const response = await fetch('data/cbb-game-impact-' + edition.value + '.json', {cache:'no-cache'});
      if (!response.ok) throw Error('Unavailable');
      const doc = await response.json();
      await window.MBBLogos?.ready;
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
  const linkGame = row => '<a href="ncaam-slate.html?' +
    escape(new URLSearchParams({date:row.day, game:row.gameId, gender:edition.value})) + '">' +
    escape(row.day + ' · ' + row.opponent) + '</a>';
  const average = row => row.total / row.games;
  const photo = row => {
    const initials = row.name.split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0]).join('');
    const id = String(row.id);
    const league = edition.value === 'women' ? 'womens-college-basketball' : 'mens-college-basketball';
    const image = /^\d+$/.test(id) ?
      '<img class="impact-portrait" alt="" loading="lazy" src="https://a.espncdn.com/i/headshots/'+league+'/players/full/'+id+'.png">' : '';
    return '<span class="impact-photo" aria-hidden="true"><span>'+escape(initials)+'</span>'+image+'</span>';
  };
  const schoolCrest = row => '<span class="impact-school-crest" aria-hidden="true">'+
    (window.MBBLogos?.byESPN(row.logoId,'small',row.school) || '')+'</span>';
  const conferenceCrest = row => {
    const mark = window.SLTConferenceMarks?.lookup(row.conference);
    if (!mark) return '';
    const href = (edition.value === 'women' ? 'ncaaw' : 'ncaam')+'-conference.html?conference='+
      encodeURIComponent(row.conference)+'&gender='+edition.value;
    return '<a class="impact-conference-crest" href="'+escape(href)+'" aria-label="'+escape(mark.name)+'"><img src="'+
      escape(mark.url)+'" alt="" loading="lazy"></a>';
  };
  const schoolColor = row => {
    const value = window.MBBLogos?.colorForESPN(row.logoId)?.primary;
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#795239';
  };

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
    const from = page * pageSize;
    $('status').textContent = visible.length ? (from + 1) + '–' + (from + visible.length) +
      ' of ' + matches.length.toLocaleString() + ' results' : '0 results';
    const metric = (label, value) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>';
    $('results').innerHTML = visible.length ? '<ol class="impact-grid" start="' + (from + 1) + '">' +
      visible.map((row, index) => {
        const marks = games
          ? metric('FGA', row.stats[7]) + metric('Rebounds', row.stats[1] + row.stats[2]) + metric('Blocks', row.stats[5])
          : metric('Games played', row.games) + metric('Games led', row.led + ' / ' + row.games);
        return '<li class="impact-card" style="--impact-school:'+schoolColor(row)+'"><div class="impact-card-heading">'+
          photo(row)+'<div class="impact-identity"><h3>'+profile(row.id, row.name, edition.value) + '</h3><p>' +
          linkTeam(row) + ' · ' + escape(row.conference) + '</p><div class="impact-logos">'+schoolCrest(row)+conferenceCrest(row)+
          '</div></div><span class="impact-place" aria-label="Rank '+(from+index+1)+'">'+(from+index+1)+
          '</span></div><div class="impact-primary"><span>' +
          (games ? 'Game Impact' : 'Impact per game') + '</span><strong>' +
          format(games ? row.total : average(row)) + '</strong></div><dl>' + marks + '</dl><div class="impact-card-game">' +
          (games ? linkGame(row) : '<span>Best game · ' + format(row.best.total) + '</span>' + linkGame(row.best)) +
          '</div>' + (games ? '<div class="impact-calculation">' + details(row.stats).replace(/<summary>.*?<\/summary>/,
          '<summary>View calculation</summary>') + '</div>' : '') + '</li>';
      }).join('') + '</ol>' : '<p>No matching performances. Try another search or team.</p>';
    const last = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    $('pagination').hidden = last === 0;
    $('page').textContent = 'Page ' + (page + 1) + ' of ' + (last + 1);
    $('previous').disabled = page === 0;
    $('next').disabled = page === last;
  }

  $('results').addEventListener('error', event => {
    if (event.target.matches?.('.impact-portrait')) event.target.hidden = true;
  }, true);
  edition.addEventListener('change', () => { team = ''; load(); });
  teamSelect.addEventListener('change', () => { team = teamSelect.value; filter(); });
  for (const control of [view, sort, low]) control.addEventListener('change', filter);
  search.addEventListener('input', filter);
  const turnPage = delta => { page += delta; render(); $('table-title').scrollIntoView({block:'start'}); };
  $('previous').addEventListener('click', () => turnPage(-1));
  $('next').addEventListener('click', () => turnPage(1));
  load();
})();
