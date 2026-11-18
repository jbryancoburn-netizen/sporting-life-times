(() => {
  'use strict';

  const query = new URLSearchParams(location.search);
  const player = query.get('player');
  const year = query.get('season');
  const gender = query.get('gender') === 'women' ? 'women' : 'men';
  const league = gender + 's-college-basketball';
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric'
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const status = document.getElementById('player-status');
  const name = query.get('name')?.trim().slice(0, 100);
  if (name) document.getElementById('player-name').textContent = name + ' · game log';

  function gamefile(id, day) {
    return 'cbb-gamefile.html?' + new URLSearchParams({gender, day, game: id});
  }

  if (gender === 'women') {
    document.getElementById('player-chronicle').href = 'ncaam.html?gender=women';
  }
  const originDay = query.get('day');
  const originGame = query.get('game');
  const back = document.getElementById('player-return');
  back.href = 'ncaam-slate.html?gender=' + gender;
  if (/^\d{4}-\d{2}-\d{2}$/.test(originDay || '') &&
      /^((?:ncaa:)?\d+|school-\d+-\d{4}-\d{2}-\d{2}-\d+)$/.test(originGame || '')) {
    back.href = gamefile(originGame, originDay);
    back.textContent = 'Return to Gamefile';
  }

  async function load() {
    if (!/^\d+$/.test(player || '') || !/^20\d{2}$/.test(year || '')) {
      status.textContent = 'Choose a linked player from a Gamefile box score.';
      return;
    }
    const endpoint = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/' +
      league + '/athletes/' + player + '/gamelog?season=' + year;
    const response = await fetch(endpoint, {signal: AbortSignal.timeout(12000), cache: 'no-store'});
    if (!response.ok) throw new Error('Game log feed unavailable');
    const data = await response.json();
    const filters = new Map(data.filters?.map(filter => [filter.name, String(filter.value)]));
    if (filters.get('season') !== year || filters.get('league') !== league) {
      throw new Error('Feed did not return the requested season and league');
    }
    const labels = Array.isArray(data.labels) ? data.labels : [];
    const games = new Map();
    for (const type of data.seasonTypes || []) {
      for (const group of type.categories || []) {
        for (const row of group.events || []) {
          const id = String(row.eventId || '');
          const event = data.events?.[id];
          const time = Date.parse(event?.gameDate);
          if (!/^\d+$/.test(id) || !Number.isFinite(time) || !Array.isArray(row.stats) ||
              !labels.length || row.stats.length !== labels.length) continue;
          games.set(id, {id, event, time, stats: row.stats});
        }
      }
    }
    const ordered = [...games.values()].sort((a, b) => b.time - a.time);
    const checked = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
    if (!ordered.length) {
      status.textContent = 'The source returned no individual game lines for this season · checked ' + checked;
      return;
    }
    const rows = ordered.map(({id, event, time, stats}) => {
      const day = Object.fromEntries(dateKey.formatToParts(time).map(part => [part.type, part.value]));
      const href = gamefile(id, day.year + '-' + day.month + '-' + day.day);
      const opponent = [event.atVs, event.opponent?.displayName || event.opponent?.abbreviation]
        .filter(Boolean).join(' ');
      return '<tr><th scope="row"><a href="' + escape(href) + '">' + escape(dateLabel.format(time)) +
        '</a></th><td>' + escape(opponent || 'Unavailable') + '</td><td>' +
        escape([event.gameResult, event.score].filter(Boolean).join(' ') || 'Unavailable') + '</td>' +
        stats.map(value => '<td>' + escape(value ?? 'Unavailable') + '</td>').join('') + '</tr>';
    });
    document.getElementById('player-games').innerHTML =
      '<div class="cbb-scroll"><table class="cbb-box-table" style="white-space:nowrap">' +
      '<caption>' + (Number(year) - 1) + '–' + year.slice(2) + ' season game log</caption>' +
      '<thead><tr><th scope="col">Game</th><th scope="col">Opponent</th><th scope="col">Result</th>' +
      labels.map(label => '<th scope="col">' + escape(label) + '</th>').join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    status.textContent = 'Provider game log retrieved ' + checked + ' · ' + ordered.length + ' games with published stats';
  }

  load().catch(() => {
    status.textContent = 'Season game log unavailable from the statistics feed. Use the Gamefile to see any published box score.';
  });
})();
