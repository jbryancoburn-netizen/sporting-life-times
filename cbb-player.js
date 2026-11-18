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
  if (name) document.getElementById('player-name').textContent = name;

  function ledgerGame(id, day) {
    return 'ncaam-slate.html?' + new URLSearchParams({gender, date:day, game: id});
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
    back.href = ledgerGame(originGame, originDay);
    back.textContent = 'Return to game in Daily Ledger';
  }

  const team = query.get('team');
  if (team && /^(?:ncaa:)?\d+$/.test(team)) {
    back.href = (gender === 'women' ? 'ncaaw' : 'ncaam') + '-team.html?' +
      new URLSearchParams({team, game:originGame || ''}) + '#full-season-schedule';
    back.textContent = 'Return to team schedule';
  }
  document.getElementById('player-edition').textContent =
    (gender === 'women' ? 'Women’s' : 'Men’s') + ' Division I · Player Register';

  async function load() {
    if (!/^\d+$/.test(player || '') || !/^20\d{2}$/.test(year || '')) {
      status.textContent = 'Choose a linked player from a Daily Ledger or team schedule box score.';
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
    const season = (Number(year) - 1) + '–' + year.slice(2);
    const teams = [...new Set(ordered.map(row=>row.event.team?.abbreviation).filter(Boolean))];
    document.getElementById('player-meta').textContent = [season + ' season', ...teams].join(' · ');
    const mainStats = ['MIN', 'PTS', 'REB', 'AST'].filter(label => labels.includes(label));
    const statsAt = Object.fromEntries(labels.map((label, index)=>[label,index]));
    const shown = [ ['Games', ordered.length] ];
    for (const label of mainStats) {
      const values = ordered.map(game => game.stats[statsAt[label]])
        .filter(value=>value != null && /^\d+(?:\.\d+)?$/.test(String(value))).map(Number);
      shown.push([label + '/G', values.length ? (values.reduce((sum, value)=>sum+value,0)/values.length).toFixed(1) : '—']);
    }
    document.getElementById('player-overview').innerHTML = '<div class="player-stat-grid" aria-label="Season averages">' +
      shown.map(([label,value])=>'<div><strong>'+escape(value)+'</strong><span>'+escape(label)+'</span></div>').join('')+'</div>';
    const pointsIndex = statsAt.PTS;
    const peak = pointsIndex == null ? null : ordered.reduce((best, game) => {
      const value = game.stats[pointsIndex];
      if (!/^\d+$/.test(String(value))) return best;
      return best == null || Number(value) > Number(best.stats[pointsIndex]) ? game : best;
    }, null);
    if (peak) {
      const day = Object.fromEntries(dateKey.formatToParts(peak.time).map(part => [part.type, part.value]));
      const opponent = peak.event.opponent?.displayName || peak.event.opponent?.abbreviation;
      document.getElementById('player-highlights').innerHTML = '<p class="player-notebook"><strong>Season scoring high</strong> ' +
        escape(peak.stats[pointsIndex]) + ' points' + (opponent ? ' vs. ' + escape(opponent) : '') +
        ' · <a href="' + escape(ledgerGame(peak.id, day.year + '-' + day.month + '-' + day.day)) +
        '">' + escape(dateLabel.format(peak.time)) + '</a></p>';
    }
    const extra = labels.filter(label=>!mainStats.includes(label));
    const rows = ordered.map(({id, event, time, stats}) => {
      const day = Object.fromEntries(dateKey.formatToParts(time).map(part => [part.type, part.value]));
      const href = ledgerGame(id, day.year + '-' + day.month + '-' + day.day);
      const opponent = [event.atVs, event.opponent?.displayName || event.opponent?.abbreviation].filter(Boolean).join(' ');
      const resultClass = event.gameResult === 'W' ? ' player-win' : event.gameResult === 'L' ? ' player-loss' : '';
      const fullLine = extra.length ? '<details class="player-full-line"><summary>Box line</summary><dl>' +
        extra.map(label=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(stats[statsAt[label]]??'—')+'</dd></div>').join('') +
        '</dl></details>' : '';
      return '<tr><th scope="row"><a href="' + escape(href) + '">' + escape(dateLabel.format(time)) +
        '</a></th><td class="player-opponent">' + escape(opponent || 'Opponent unavailable') +
        '</td><td class="player-result'+resultClass+'">' + escape([event.gameResult, event.score].filter(Boolean).join(' ') || 'Result unavailable') +
        '</td>' + mainStats.map(label=>'<td data-stat="'+label+'"'+(label==='PTS'?' class="player-points"':'')+'>'+
          escape(stats[statsAt[label]]??'—')+'</td>').join('')+
        (extra.length?'<td class="player-more">'+fullLine+'</td>':'')+'</tr>';
    });
    document.getElementById('player-games').innerHTML =
      '<table class="player-log-table"><caption>Game by game</caption><thead><tr><th scope="col">Date</th>' +
      '<th scope="col">Opponent</th><th scope="col">Result</th>' +
      mainStats.map(label=>'<th scope="col">'+label+'</th>').join('') +
      (extra.length?'<th scope="col">Details</th>':'')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
    status.textContent = ordered.length + ' games with published stats · feed checked ' + checked;
  }

  if (/^\d+$/.test(player || '') && /^20\d{2}$/.test(year || '')) {
    window.SLTCBBPlayerProfile?.load({player, year, gender, league});
  }

  load().catch(() => {
    status.textContent = 'Season game log unavailable from the statistics feed. See the Daily Ledger for available box scores.';
  });
})();
