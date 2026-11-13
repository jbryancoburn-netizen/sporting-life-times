/* Shared, evidence-only 2026-27 Form Book for both Division I team desks.
   Presentation never mutates schedules, the finals ledger, or RETRO. */
(function (global) {
  'use strict';
  const SEASON_START = '2026-11-01';
  const SEASON_END = '2027-04-30';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const score = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 && n <= 300 ? n : null;
  };
  const day = value => String(value || '').slice(0, 10);
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(day(value)) &&
    day(value) >= SEASON_START && day(value) <= SEASON_END;
  const validScores = g => score(g.home_score) !== null &&
    score(g.away_score) !== null && score(g.home_score) !== score(g.away_score);
  const safeId = value => /^[0-9]+$/.test(String(value || ''));
  const normal = (g, id) => ({
    id: String(id), date: day(g.date),
    home: String(g.home_id), away: String(g.away_id),
    homeScore: score(g.home_score), awayScore: score(g.away_score),
    // Only published and explicitly verified neutral venues qualify for the (N) marker.
    // Unverified men's RETRO events may carry neutral=true as a placeholder.
    neutral: g.neutral === true && g.site_verified === true,
    siteVerified: g.site_verified === true,
    otherName: g.otherName || '', outside: g.outside === true
  });
  const unique = games => {
    // Duplicated event IDs are quarantined, not counted twice or arbitrarily chosen.
    const map = new Map(), conflicts = new Set();
    for (const g of games) {
      if (map.has(g.id)) conflicts.add(g.id);
      else map.set(g.id, g);
    }
    for (const id of conflicts) map.delete(id);
    return [...map.values()];
  };
  function normalizeMen(retro, outside, crosswalk) {
    if (retro?.season !== '2026-27' || retro.model !== 'retro-clean-slate' ||
        retro.starting_elo !== 1500 || !Array.isArray(retro.events) ||
        retro.rankings?.length !== 365 || retro.events.length !== retro.games_played ||
        crosswalk?.season !== '2026-27' || !Array.isArray(crosswalk.teams)) {
      throw Error('Verified men\'s final-game register is unavailable.');
    }
    const names = new Map(crosswalk.teams.map(t => [String(t.id), t.name]));
    const ncaaByEspn = new Map(crosswalk.teams.map(t => [String(t.espn_id), String(t.id)]));
    const games = [];
    for (const g of retro.events) {
      const id = String(g.id || '').replace(/^espn:/, '');
      if (!safeId(id) || !validDay(g.date) || !validScores(g) ||
          !names.has(String(g.home_id)) || !names.has(String(g.away_id)) ||
          String(g.home_id) === String(g.away_id)) continue;
      games.push(normal(g, id));
    }
    let outsideLoaded = outside?.season === '2026-27' &&
      outside.counts_for_retro === false && Array.isArray(outside.games);
    if (outsideLoaded) for (const g of outside.games) {
      const own = ncaaByEspn.get(String(g.division_i_espn_id || ''));
      const ownOnFixture = String(g.home_espn_id) === String(g.division_i_espn_id) ||
        String(g.away_espn_id) === String(g.division_i_espn_id);
      if (!own || String(g.division_i_ncaa_id) !== own ||
          !ownOnFixture || !safeId(g.id) || !validDay(g.date) ||
          g.verified !== true || g.classification !== 'regular-season' ||
          g.counts_for_retro !== false || !/^https:\/\//.test(String(g.source_url || '')) ||
          score(g.team_score) === null || score(g.opponent_score) === null ||
          score(g.team_score) === score(g.opponent_score)) continue;
      const home = String(g.home_espn_id) === String(g.division_i_espn_id);
      const fixture = {
        id: String(g.id), date: g.date,
        home_id: home ? own : 'non-di:' + String(g.id),
        away_id: home ? 'non-di:' + String(g.id) : own,
        home_score: home ? g.team_score : g.opponent_score,
        away_score: home ? g.opponent_score : g.team_score,
        neutral: g.neutral, site_verified: g.site_verified,
        outside: true, otherName: String(g.opponent_name || 'Non-Division I opponent')
      };
      games.push(normal(fixture, g.id));
    }
    return {games: unique(games), names, source: 'Published RETRO and independently verified non-D-I finals',
      note: outsideLoaded ? '' : 'Non-Division I results unavailable; totals may be incomplete.'};
  }
  function normalizeWomen(finals, roster) {
    if (finals?.season !== '2026-27' || !Array.isArray(finals.games) ||
        roster?.season !== '2026-27' || !Array.isArray(roster.teams)) {
      throw Error('Verified women\'s final-game register is unavailable.');
    }
    const names = new Map(roster.teams.map(t => [String(t.team_id), String(t.team)]));
    const games = [];
    for (const g of finals.games) {
      if (!safeId(g.id) || g.status !== 'final' || g.completed === false ||
          !validDay(g.date) || !validScores(g) || !names.has(String(g.home_id)) ||
          !names.has(String(g.away_id)) || String(g.home_id) === String(g.away_id)) continue;
      games.push(normal(g, g.id));
    }
    return {games: unique(games), names, source: 'Women\'s published final-score register', note: ''};
  }
  function calculate(teamId, register) {
    const id = String(teamId);
    const played = register.games.filter(g => g.home === id || g.away === id).map(g => {
      const home = g.home === id;
      const ours = home ? g.homeScore : g.awayScore;
      const theirs = home ? g.awayScore : g.homeScore;
      const other = home ? g.away : g.home;
      return {...g, ours, theirs, won: ours > theirs,
        opponent: g.outside ? g.otherName : (register.names.get(other) || 'Opponent unavailable'),
        location: g.neutral ? 'neutral' : !g.siteVerified ? 'unverified' : home ? 'home' : 'away'};
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const wins = played.filter(g => g.won).length, losses = played.length - wins;
    let streak = 0;
    if (played.length) for (const g of played) {
      if (g.won !== played[0].won) break;
      streak++;
    }
    const pointsFor = played.reduce((sum, g) => sum + g.ours, 0);
    const pointsAgainst = played.reduce((sum, g) => sum + g.theirs, 0);
    return {played: played.length, wins, losses,
      ppg: played.length ? (pointsFor / played.length).toFixed(1) : '—',
      allowed: played.length ? (pointsAgainst / played.length).toFixed(1) : '—',
      streak: played.length ? (played[0].won ? 'W' : 'L') + streak : '—',
      lastFive: played.slice(0, 5).reverse().map(g => g.won ? 'W' : 'L'),
      recent: played.slice(0, 5), latest: played[0]?.date || null};
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {normalizeMen, normalizeWomen, calculate};
  }
  if (typeof document === 'undefined' || typeof location === 'undefined') return;
  const women = document.body?.dataset.page === 'women-team';
  const men = document.body?.dataset.page === 'team';
  if (!women && !men) return;
  const selected = new URLSearchParams(location.search).get('team') ||
    new URLSearchParams(location.search).get('id');
  if (!selected) return;
  const anchor = () => women
    ? document.querySelector('#desk .wbb-kpis')
    : document.querySelector('#app > .metrics');
  function mount() {
    const target = anchor();
    if (!target) return null;
    let node = document.getElementById('cbb-team-form');
    if (!node || node.previousElementSibling !== target) {
      if (node) node.remove();
      node = document.createElement('section');
      node.id = 'cbb-team-form';
      node.className = 'cbb-team-form';
      node.setAttribute('aria-label', 'The Form Book, verified season results');
      node.innerHTML = '<h2>The Form Book</h2><p class="cbb-form-status" role="status">Checking published final scores…</p>';
      target.insertAdjacentElement('afterend', node);
    }
    return node;
  }
  const stamp = () => Math.floor(Date.now() / 60000);
  async function load(path) {
    const divider = path.includes('?') ? '&' : '?';
    const response = await fetch(path + divider + 'form=' + stamp(), {cache: 'no-store'});
    if (!response.ok) throw Error('Published source HTTP ' + response.status);
    return response.json();
  }
  const dateText = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US',
    {month: 'short', day: 'numeric', timeZone: 'UTC'});
  const mark = g => g.won ? 'W' : 'L';
  function draw(form, source) {
    const node = mount();
    if (!node) return false;
    const cell = (title, value) => '<div class="cbb-form-stat"><small>' + esc(title) +
      '</small><strong>' + esc(value) + '</strong></div>';
    const formMarks = form.lastFive.length
      ? form.lastFive.map(s => '<span class="cbb-form-mark ' + (s === 'W' ? 'is-win' : 'is-loss') + '">' + s + '</span>').join('')
      : '<span class="cbb-form-unknown">No final games yet</span>';
    const recent = form.recent.length
      ? form.recent.map(g => {
        const place = g.location === 'away' ? 'at ' :
          g.location === 'neutral' ? 'vs ' : g.location === 'home' ? 'vs ' : 'against ';
        return '<li><time datetime="' + esc(g.date) + '">' + dateText(g.date) + '</time>' +
          '<span>' + esc(place + g.opponent) + (g.location === 'neutral' ? ' (N)' : '') + '</span>' +
          '<strong class="' + (g.won ? 'is-win' : 'is-loss') + '">' +
          mark(g) + ' ' + esc(g.ours) + '–' + esc(g.theirs) + '</strong></li>';
      }).join('')
      : '<li class="cbb-form-empty">No published finals yet.</li>';
    node.innerHTML =
      '<div class="cbb-form-heading"><div><span class="cbb-form-kicker">The statistical notebook · 2026–27</span>' +
      '<h2>The Form Book</h2></div><span class="cbb-form-asof">' +
      (form.latest ? 'Finals through ' + dateText(form.latest) : 'Awaiting finals') +
      '</span></div><div class="cbb-form-stats">' +
      cell('Verified record', form.wins + '–' + form.losses) +
      cell('Points scored / game', form.ppg) +
      cell('Points allowed / game', form.allowed) +
      cell('Current streak', form.streak) +
      '</div><div class="cbb-form-lower"><div class="cbb-form-last">' +
      '<h3>Last five</h3><div class="cbb-form-marks">' + formMarks + '</div>' +
      '</div><div class="cbb-form-recent"><h3>Recent verified results</h3><ol>' + recent +
      '</ol></div></div><p class="cbb-form-status">' + esc(source.source) +
      '. Exhibition games excluded. ' + esc(source.note) + '</p>';
    node.dataset.rendered = 'true';
    return true;
  }
  let pending = false, lastDisplay = '';
  async function refresh() {
    if (pending || (document.hidden && lastDisplay)) return;
    pending = true;
    try {
      let register, teamId;
      if (women) {
        const [finals, roster] = await Promise.all([
          load('data/ncaaw-2026-27-verified-games.json'),
          load('data/ncaaw-2026-27-teams.json')
        ]);
        register = normalizeWomen(finals, roster);
        teamId = selected;
        if (!register.names.has(teamId)) throw Error('Women\'s team ID not in the 2026–27 roster.');
      } else {
        const [retro, crosswalk, outside] = await Promise.all([
          load('data/ncaam-2026-27-retro-primary.json'),
          load('data/ncaam-2026-27-espn-team-crosswalk.json'),
          load('data/mbb-non-di-verified-finals-2026-27.json').catch(() => null)
        ]);
        register = normalizeMen(retro, outside, crosswalk);
        const school = crosswalk.teams.find(t =>
          String(t.id) === String(selected) || String(t.espn_id) === String(selected));
        if (!school) throw Error('Men\'s team ID not in the 2026–27 crosswalk.');
        teamId = String(school.id);
      }
      const form = calculate(teamId, register);
      const signature = JSON.stringify({form, note: register.note});
      if (signature !== lastDisplay || document.getElementById('cbb-team-form')?.dataset.rendered !== 'true') {
        if (draw(form, register)) lastDisplay = signature;
      }
    } catch (error) {
      const panel = mount();
      const status = panel?.querySelector('.cbb-form-status');
      if (status) status.textContent = lastDisplay
        ? 'Latest refresh failed; showing the last verified snapshot.'
        : 'The verified Form Book is temporarily unavailable. No result has been estimated.';
      console.warn('Form Book refresh', error);
    } finally { pending = false; }
  }
  mount();
  const root = document.getElementById(women ? 'desk' : 'app');
  if (root && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('cbb-team-form')) {
        mount();
        void refresh();
      }
    });
    observer.observe(root, {childList: true, subtree: false});
  }
  void refresh();
  setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
})(typeof window === 'undefined' ? {} : window);
