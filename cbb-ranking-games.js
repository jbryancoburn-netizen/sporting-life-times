/* Schedule summaries for the newspaper's RETRO cards. */
(() => {
'use strict';
const zone = 'America/New_York';
const day = new Intl.DateTimeFormat('sv-SE', {timeZone: zone});
const label = new Intl.DateTimeFormat('en-US', {timeZone: zone, month: 'short', day: 'numeric'});
const tip = new Intl.DateTimeFormat('en-US', {timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'});
const dayOf = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : day.format(new Date(value));
const scoreValid = value => value != null && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0;
const excluded = game => game.exhibition === true || game.exhibition_canceled === true ||
 /exhibition|scrimmage|preseason|cancel|postpon/i.test([
   game.classification, game.name, game.status?.type?.name, game.status?.type?.state,
   typeof game.status === 'string' ? game.status : ''
 ].join(' '));
const read = async path => {
 try {
  const response = await fetch('data/' + path, {signal: AbortSignal.timeout(12000)});
  return response.ok ? await response.json() : null;
 } catch { return null; }
};
const pending = new Map();
function element(tag, className, text) {
 const item = document.createElement(tag);
 item.className = className;
 item.textContent = text;
 return item;
}
function gameSlips(last, next) {
 const slips = element('span', 'cbb-ranking-games', '');
 for (const [title, game, empty] of [
  ['Last game', last, 'No final available'],
  ['Next game', next, 'No upcoming game listed']
 ]) {
  const slip = element(game?.href ? 'a' : 'span', 'cbb-ranking-game', '');
  if (game?.href) slip.href = game.href;
  slip.append(element('span', 'cbb-ranking-game__label', title));
  if (game) {
   slip.classList.add('cbb-ranking-game--' + game.kind);
   slip.append(element('span', 'cbb-ranking-game__opponent', game.location + ' ' + game.opponent));
   const detail = element('span', 'cbb-ranking-game__detail', '');
   if (game.scoreline) detail.append(element('span', 'cbb-ranking-game__score', game.scoreline));
   const date = element('time', '', game.dateLabel);
   date.dateTime = game.day;
   detail.append(date);
   if (game.tipoff) detail.append(element('span', 'cbb-ranking-game__tip', game.tipoff));
   slip.append(detail);
  } else {
   slip.append(element('span', 'cbb-ranking-game__empty', empty));
  }
  slips.append(slip);
 }
 return slips;
}
function attach(root, gender, retro, directory) {
 const women = gender === 'women';
 const nodes = [...root.querySelectorAll('[data-ranking-games]')];
 if (!nodes.length) return;
 const names = new Map(retro.rankings.map(team => [String(team.team_id), team.team]));
 const games = new Map();
 const add = (id, game) => {
  if (!games.has(id)) games.set(id, []);
  games.get(id).push(game);
 };
 const addFinal = game => {
  if (excluded(game) || !scoreValid(game.home_score) || !scoreValid(game.away_score)) return;
  const home = String(game.home_id), away = String(game.away_id);
  add(home, {...game, opponent: game.away_name || names.get(away), location: 'vs.',
   score: Number(game.home_score), other: Number(game.away_score), completed: true});
  add(away, {...game, opponent: game.home_name || names.get(home), location: game.neutral ? 'vs.' : 'at',
   score: Number(game.away_score), other: Number(game.home_score), completed: true});
 };
 (retro.events || []).forEach(addFinal);
 const shared = women
  ? Promise.all([read('ncaaw-schedules-2026-27.json'), read('ncaaw-2026-27-games.json')]).then(([schedule, league]) => {
    for (const game of league?.finals || []) addFinal(game);
    return schedule?.teams;
   })
  : Promise.all([directory || read('ncaam-2026-27-espn-team-crosswalk.json'), read('mbb-non-di-verified-finals-2026-27.json')]).then(([cross, outside]) => {
    for (const game of outside?.games || []) {
     if (!game.verified || game.classification !== 'regular-season' || !scoreValid(game.team_score) || !scoreValid(game.opponent_score)) continue;
     add(String(game.division_i_ncaa_id), {...game, date: game.event_date || game.date, opponent: game.opponent_name,
      location: !game.neutral && game.division_i_espn_id === game.away_espn_id ? 'at' : 'vs.',
      score: Number(game.team_score), other: Number(game.opponent_score), completed: true});
    }
    return new Map((cross?.teams || []).map(team => [String(team.id), String(team.espn_id || '')]));
   });
 const jobs = new Map();
 async function schoolGames(id) {
  const index = await shared;
  if (women) return (index?.[id]?.games || []).map(game => {
   const away = String(game.away_id) === id;
   return {...game, location: game.site === 'away' ? 'at' : 'vs.',
    score: away ? game.away_score : game.home_score, other: away ? game.home_score : game.away_score};
  });
  const espn = index.get(id);
  if (!/^\d+$/.test(espn || '')) return [];
  if (!pending.has(espn)) {
   pending.set(espn, read('mbb-schedules-2026-27/' + espn + '.json'));
  }
  const schedule = await pending.get(espn);
  if (!schedule) pending.delete(espn);
  return (schedule?.events || []).map(game => {
   const competition = game.competitions?.[0];
   const teams = competition?.competitors || [];
   const self = teams.find(team => String(team.team?.id) === espn);
   const opponent = teams.find(team => team !== self);
   return {...game, opponent: opponent?.team?.displayName || game.name,
    location: self?.homeAway === 'away' && !game.neutralSite && !competition?.neutralSite ? 'at' : 'vs.',
    officialTime: game.official_time,
    completed: game.status?.type?.completed === true || game.status?.type?.state === 'post',
    active: game.status?.type?.state === 'in',
    score: self?.score, other: opponent?.score};
  });
 }
 async function summarize(id) {
  const calendar = await schoolGames(id);
  const today = day.format(new Date());
  const fixtures = [...(games.get(id) || []), ...calendar].filter(game =>
   game.opponent && game.date && Number.isFinite(Date.parse(game.date)) &&
   dayOf(game.date) >= '2026-11-01' && !excluded(game));
  const finals = fixtures.filter(game => game.completed && scoreValid(game.score) && scoreValid(game.other) &&
    Number(game.score) !== Number(game.other) && dayOf(game.date) <= today);
  finals.sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)) || Date.parse(b.date) - Date.parse(a.date));
  const finishedDates = new Set(finals.map(game => dayOf(game.date)));
  const upcoming = calendar.filter(game => fixtures.includes(game) && !game.completed && !game.active && dayOf(game.date) >= today &&
   !finishedDates.has(dayOf(game.date)) && (!game.date.endsWith('Z') || Date.parse(game.date) > Date.now()));
  upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const describe = game => {
   const date = dayOf(game.date);
   const id = String(game.retro_verified_final || game.id || '').replace(/^espn:/, '');
   const href = /^(?:\d{1,12}|ncaa:\d+|school-\d+-\d{4}-\d{2}-\d{2}-\d+)$/.test(id) ? 'ncaam-slate.html?' + new URLSearchParams({
    gender, date, game: id
   }) : '';
   return {href,
   location: game.location, opponent: game.opponent, day: dayOf(game.date),
   dateLabel: label.format(new Date(date + 'T12:00:00Z'))
   };
  };
  const last = finals[0], next = upcoming[0];
  const time = next?.officialTime || (next?.date.endsWith('Z') && !/T(?:00:00|05:00)Z$/.test(next.date) ? tip.format(new Date(next.date)) : '');
  const won = last && Number(last.score) > Number(last.other);
  return [
   last && {...describe(last), kind: won ? 'win' : 'loss', scoreline: (won ? 'W ' : 'L ') + last.score + '–' + last.other},
   next && {...describe(next), kind: 'next', tipoff: time && !/^T(?:BA|BD)$/i.test(time.trim()) ? time : ''}
  ];
 }
 const fill = async node => {
  const id = node.dataset.rankingGames;
  if (!jobs.has(id)) jobs.set(id, summarize(id));
  const pair = await jobs.get(id);
  if (node.isConnected) node.replaceChildren(gameSlips(...pair));
 };
 if (typeof IntersectionObserver !== 'function') {
  nodes.forEach(fill);
  return;
 }
 const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
   if (!entry.isIntersecting) continue;
   observer.unobserve(entry.target);
   fill(entry.target);
  }
 }, {rootMargin: '160px'});
 nodes.forEach(node => observer.observe(node));
}
window.SLTRankingGames = {attach, gameSlips};
})();
