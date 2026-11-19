(() => {
  'use strict';
  const {score, format, escape, profile} = window.SLTCBBImpact;
  const params = new URLSearchParams(location.search);
  const playerPage = document.getElementById('player-game-log');
  const gender = /ncaaw-team\.html$/.test(location.pathname) || (playerPage && params.get('gender') === 'women') ? 'women' : 'men';
  const team = params.get('team');
  const player = params.get('player');
  const playerName = params.get('name')?.trim();
  const season = params.get('season');
  if (playerPage ? (season && season !== '2027' && season !== '2026-27') || (!player && !playerName) : !team) return;

  const link = (path, query, label) => '<a href="' + path + '?' +
    escape(new URLSearchParams(query)) + '">' + escape(label) + '</a>';
  const desk = () => link('cbb-impact.html', {
    gender, ...(playerPage ? {q: playerName || ''} : {team})
  }, 'Open RETRO Game Impact');
  const read = async () => {
    const response = await fetch('data/cbb-game-impact-' + gender + '.json', {cache:'no-cache'});
    if (!response.ok) throw Error('Impact feed unavailable');
    const doc = await response.json();
    if (doc.gender !== gender || doc.season !== '2026-27' || doc.version !== 1) throw Error('Impact feed mismatch');
    return doc;
  };

  function performances(doc) {
    let playerId = /^\d+$/.test(player || '') ? player : '';
    if (playerPage && !playerId && team && playerName) {
      const candidates = new Set();
      for (const game of Object.values(doc.games)) {
        for (const [index, side] of [[0, 'home'], [1, 'away']]) {
          if (doc.teams[game.signature[index]][0] !== team) continue;
          for (const [id, name] of game[side]) {
            if (name.toLowerCase() === playerName.toLowerCase()) candidates.add(id);
          }
        }
      }
      if (candidates.size === 1) playerId = [...candidates][0];
    }
    if (playerPage && !playerId) return [];
    const rows = [];
    for (const [id, game] of Object.entries(doc.games)) {
      for (const [index, side] of [[0, 'home'], [1, 'away']]) {
        const [teamId, name] = doc.teams[game.signature[index]];
        if (!playerPage && teamId !== team) continue;
        const players = game[side].map(([id, name, ...stats]) => ({id, name, impact:score(stats)}));
        const person = players.find(row => row.id === playerId);
        if (playerPage && !person) continue;
        const opponent = doc.teams[game.signature[1 - index]][1];
        const teamTotal = players.reduce((sum, row) => sum + row.impact, 0);
        const best = Math.max(...players.map(row => row.impact));
        const leaders = players.filter(row => row.impact === best);
        rows.push({id, day:game.day, opponent, name, leaders, impact:playerPage ? person.impact : teamTotal});
      }
    }
    return rows.sort((a,b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  }

  function markup(rows) {
    if (!rows.length) return '<p>No verified Impact entries for this schedule yet.</p>';
    const average = rows.reduce((sum,row) => sum + row.impact, 0) / rows.length;
    const high = Math.max(...rows.map(row => row.impact));
    return '<p class="impact-schedule-season"><strong>' + format(average) + '</strong> Impact per game <span>· ' +
      rows.length + ' covered ' + (rows.length === 1 ? 'game' : 'games') + ' · Best ' + format(high) + '</span></p>' +
      '<p class="impact-schedule-note">' + (playerPage ? 'Season figures use verified box-score appearances.' :
      'Team Impact is the sum of its players’ scores in verified box scores.') +
      ' The figures cover Division I matchups with complete box scores.</p>' +
      '<div class="impact-schedule-scroll"><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th>' +
      (playerPage ? '' : '<th scope="col">Impact leader</th>') +
      '<th scope="col">Impact</th></tr></thead><tbody>' + rows.map(row =>
        '<tr><td>' + escape(row.day.slice(5).replace('-', '/')) + '</td><td>' +
        link('ncaam-slate.html',{gender,date:row.day,game:row.id},row.opponent) + '</td>' +
        (playerPage ? '' : '<td>' + row.leaders.map(leader => profile(leader.id,leader.name,gender) +
          ' ' + format(leader.impact)).join(', ') + '</td>') +
        '<td>' + format(row.impact) + '</td></tr>').join('') + '</tbody></table></div>';
  }

  let loaded;
  function mount() {
    const schedule = playerPage || document.getElementById('full-season-schedule');
    if (!schedule || schedule.querySelector('.impact-schedule')) return;
    const section = document.createElement('section');
    section.className = 'impact-schedule';
    section.innerHTML = '<header><h3>RETRO Game Impact</h3>' + desk() +
      '</header><div aria-live="polite">Loading Impact…</div>';
    schedule.append(section);
    loaded ||= read().then(performances).catch(() => null);
    loaded.then(rows => {
      if (section.isConnected) section.lastElementChild.innerHTML = rows ? markup(rows) :
        '<p>Impact figures are temporarily unavailable.</p>';
    });
  }
  const target = playerPage || document.getElementById(gender === 'women' ? 'desk' : 'app');
  if (!target) return;
  if (!playerPage) new MutationObserver(mount).observe(target, {childList:true,subtree:true});
  mount();
})();
