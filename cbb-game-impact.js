(() => {
  'use strict';
  const fields = [
    ['Points', 1000], ['Offensive rebounds', 1050], ['Defensive rebounds', 350],
    ['Assists', 1250], ['Steals', 1650], ['Blocks', 900], ['Turnovers', -1650],
    ['Field-goal attempts', -850], ['Free-throw attempts', -374]
  ];
  const escape = text => String(text ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);
  const score = stats => stats.reduce((sum, value, i) => sum + value * fields[i][1], 0);
  const format = value => (value / 1000).toFixed(2);
  const details = stats => '<details><summary>' + format(score(stats)) + '</summary><ul>' +
    fields.map(([label, weight], i) => '<li>' + label + ' (' + stats[i] + '): ' +
      (stats[i] * weight > 0 ? '+' : '') + format(stats[i] * weight) + '</li>').join('') + '</ul></details>';
  const profile = (id, name, gender) => '<a href="cbb-player.html?' +
    escape(new URLSearchParams({player:id, name, gender, season:'2027'})) + '">' + escape(name) + '</a>';

  function fromSummary(raw, game) {
    const contest = raw?.header?.competitions?.[0];
    if (game.phase !== 'final' || !contest?.status?.type?.completed ||
        String(raw.header.id) !== String(game.espnId || game.id)) return null;
    const groups = raw.boxscore?.players || [];
    if (groups.length !== 2) return null;
    return ['away', 'home'].map(side => {
      const team = game[side], id = String(team?.team?.id);
      const competitor = contest.competitors?.find(item => item.homeAway === side);
      if (String(competitor?.team?.id) !== id || String(competitor.score) !== String(team.score)) return null;
      const section = groups.find(group => String(group.team?.id) === id)?.statistics
        ?.find(section => section.labels?.includes('PTS'));
      if (!section?.athletes?.length) return null;
      const rows = [];
      for (const player of section.athletes) {
        if (player.didNotPlay) continue;
        const line = Object.fromEntries(section.labels.map((label, i) => [label, player.stats?.[i]]));
        if (line.MIN === '--') continue;
        const number = key => /^\d+$/.test(line[key]) ? Number(line[key]) : NaN;
        const attempts = key => /^\d+-\d+$/.test(line[key]) ? Number(line[key].split('-')[1]) : NaN;
        const stats = ['PTS','OREB','DREB','AST','STL','BLK','TO'].map(number)
          .concat(attempts('FG'), attempts('FT'));
        const athlete = player.athlete;
        if (!stats.every(Number.isFinite) || stats[1] + stats[2] !== number('REB') ||
            !/^\d+$/.test(athlete?.id) || !athlete?.displayName) return null;
        if (line.MIN === '0' && !stats.some(Boolean)) continue;
        rows.push([athlete.id, athlete.displayName, ...stats]);
      }
      if (!rows.length || rows.reduce((sum, row) => sum + row[2], 0) !== Number(team.score)) return null;
      return {name:team.team.displayName, rows};
    });
  }

  function gameMarkup(raw, game, gender) {
    const groups = fromSummary(raw, game);
    if (!groups?.every(Boolean)) return '';
    return '<h4>RETRO Game Impact <small>· Experimental</small></h4>' +
      groups.map(({name, rows}) => {
        const ranked = rows.map(([id, name, ...stats]) => ({id, name, stats, total:score(stats)}))
          .sort((a, b) => b.total - a.total);
        return '<table><caption>' + escape(name) + '</caption><thead><tr><th scope="col">Player</th>' +
          '<th scope="col">Impact breakdown</th></tr></thead><tbody>' + ranked.map(player =>
            '<tr><th scope="row">' + profile(player.id, player.name, gender) +
            (player.total === ranked[0].total ? ' · Leader' : '') +
            '</th><td>' + details(player.stats) + '</td></tr>').join('') + '</tbody></table>';
      }).join('');
  }

  const desk = document.querySelector('[data-impact-team-link]');
  const team = new URLSearchParams(location.search).get('team');
  if (desk && /^(?:ncaa:)?\d+$/.test(team || '')) {
    const target = new URL(desk.href);
    target.searchParams.set('team', team);
    desk.href = target.href;
  }
  window.SLTCBBImpact = {fields, score, format, details, profile, escape, gameMarkup};
})();
