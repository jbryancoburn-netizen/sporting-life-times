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
  const details = (stats, heaves = 0) => '<details><summary>' + format(score(stats) + 850 * heaves) + '</summary><ul>' +
    fields.map(([label, weight], i) => '<li>' + label + ' (' + stats[i] + '): ' +
      (stats[i] * weight > 0 ? '+' : '') + format(stats[i] * weight) + '</li>').join('') + (heaves ? '<li>Heave charge returned: +' + format(850 * heaves) + '</li>' : '') + '</ul></details>';
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
      const rows = [], madeShots = new Map();
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
        madeShots.set(String(athlete.id), Number(line.FG.split('-')[0]));
      }
      if (!rows.length || rows.reduce((sum, row) => sum + row[2], 0) !== Number(team.score)) return null;
      return {name:team.team.displayName, rows, id, madeShots};
    });
  }


  function shotBreakdown(plays, groups, gender) {
    const finalPeriod = gender === 'women' ? 4 : 2;
    const half = finalPeriod / 2;
    const players = new Map(groups.flatMap(group => group.rows.map(row => [String(row[0]), group.id])));
    const results = new Map();
    const seen = new Set();
    for (const play of plays || []) {
      const id = String(play.participants?.[0]?.athlete?.id || '');
      const value = Number(play.scoreValue);
      const type = play.type?.text || '';
      const text = play.text || '';
      if (!play.id || seen.has(String(play.id)) || play.shootingPlay !== true ||
          ![2, 3].includes(value) || /free.throw/i.test(type + ' ' + text) ||
          !players.has(id) || players.get(id) !== String(play.team?.id)) continue;
      seen.add(String(play.id));
      const result = results.get(id) || {attempts:0, makes:0, heaves:0, tracked:0, expected:0, actual:0, high:0, low:0};
      const made = play.scoringPlay === true;
      result.attempts++;
      result.makes += Number(made);
      results.set(id, result);
      const period = Number(play.period?.number);
      const clock = /^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(play.clock?.displayValue || '');
      const seconds = clock ? Number(clock[1]) * 60 + Number(clock[2]) : NaN;
      const feet = /\b(\d{1,2})\s*[- ]\s*(?:foot|feet|ft)\b/i.exec(text);
      const distance = feet ? Number(feet[1]) : null;
      if ((period === half || period >= finalPeriod) && seconds <= 3 && value === 3 &&
          ((distance !== null && distance >= 40) || /\b(?:backcourt|half[- ]court)\b/i.test(text))) {
        result.heaves++;
        continue;
      }
      // Provisional reference rates. Only classify attempts with a usable description.
      let probability = null;
      if (value === 2 && /dunk/i.test(type + ' ' + text)) probability = .85;
      else if (value === 2 && (/layup|tip.in/i.test(type + ' ' + text) || (distance !== null && distance <= 5))) probability = .60;
      else if (value === 2 && distance !== null) probability = distance <= 12 ? .44 : .38;
      else if (value === 3 && distance !== null) probability = distance >= 30 ? .22 : .34;
      if (probability === null) continue;
      result.tracked++;
      result.expected += value * probability;
      result.actual += made ? value : 0;
      result.high += Number(probability >= .55);
      result.low += Number(probability < .30);
    }
    return results;
  }

  function shotNote(shots) {
    if (!shots) return '';
    const {tracked, expected, actual, high, low, heaves, attempts} = shots;
    const quality = tracked ? '<br><small>Shot quality: ' + (expected / tracked).toFixed(2) +
      ' expected points per classified shot · Finishing: ' + (actual >= expected ? '+' : '') +
      (actual - expected).toFixed(2) + ' points vs. expected · ' + high + ' high / ' + low +
      ' low · ' + tracked + '/' + (attempts - heaves) + ' classified</small>' : '';
    return quality + (heaves ? '<br><small>Heaves exempt: ' + heaves + ' (+' + format(850 * heaves) + ')</small>' : '');
  }

  function gameMarkup(raw, game, gender) {
    const groups = fromSummary(raw, game);
    if (!groups?.every(Boolean)) return '';
    const shotData = shotBreakdown(raw.plays, groups, gender);
    return '<h4>RETRO Game Impact <small>· Experimental</small></h4>' +
      '<p><small>Shot quality uses provisional reference rates. Verified end-of-period heaves are exempt from the attempt charge.</small></p>' +
      groups.map(({name, rows, madeShots}) => {
        const ranked = rows.map(([id, name, ...stats]) => {
          const candidate = shotData.get(String(id));
          const shots = candidate?.attempts === stats[7] &&
            candidate.makes === madeShots.get(String(id)) ? candidate : null;
          return {id, name, stats, shots, total:score(stats) + (shots?.heaves || 0) * 850};
        })
          .sort((a, b) => b.total - a.total);
        return '<table><caption>' + escape(name) + '</caption><thead><tr><th scope="col">Player</th>' +
          '<th scope="col">Impact breakdown</th></tr></thead><tbody>' + ranked.map(player =>
            '<tr><th scope="row">' + profile(player.id, player.name, gender) +
            (player.total === ranked[0].total ? ' · Leader' : '') +
            '</th><td>' + details(player.stats, player.shots?.heaves || 0) + shotNote(player.shots) + '</td></tr>').join('') + '</tbody></table>';
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
