'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { seasonProfiles, forecastScorePair } = require('../mbb-slate-insights.js');

const data = path.join(__dirname, '../data');
const read = name => JSON.parse(fs.readFileSync(path.join(data, name), 'utf8'));
const output = path.join(data, 'ncaam-retro-prospective-audit-2026-27.json');
const id = value => String(value).replace(/^espn:/, '');
const key = (date, value) => date + '|' + id(value);
const half = value => Math.round(value * 2) / 2;
const slateDay = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'});
const timestamp = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;

function widerMargin(margin) {
  const size = Math.abs(margin);
  return half(Math.sign(margin) * (1.2 * Math.min(size, 10) + 1.4 * Math.max(0, size - 10)));
}

function capture(existing, forecasts, feed, finals, teams, leagueMean, now) {
  const cutoff = Date.parse(now);
  const snapshots = new Map(existing.map(game => [key(game.date, game.id), game]));
  const schedule = new Map(feed.games.map(game => [id(game.id), game]));
  const priorFinals = new Map(finals.map(game => [key(game.date, game.id), game]));
  const canonical = new Map(teams.map(team => [String(team.espn_id), team.id]));
  const profiles = seasonProfiles(finals);
  for (const forecast of forecasts) {
    const gameKey = key(forecast.date, forecast.id);
    const fixture = schedule.get(id(forecast.id));
    const tip = timestamp(fixture?.date);
    if (snapshots.has(gameKey) || priorFinals.has(gameKey) || fixture?.state !== 'pre' ||
        !(tip > cutoff) || slateDay.format(new Date(tip)) !== forecast.date ||
        forecast.forecast_model !== 'retro-central-elo-uncapped-v2' ||
        !Number.isFinite(forecast.projected_home_margin) ||
        !Number.isFinite(forecast.home_win_probability) || fixture.teams?.length !== 2 ||
        !forecast.away_id || !forecast.home_id ||
        canonical.get(String(fixture.teams[0].id)) !== forecast.away_id ||
        canonical.get(String(fixture.teams[1].id)) !== forecast.home_id) continue;
    const margin = half(forecast.projected_home_margin);
    const challenger = widerMargin(margin);
    const away = profiles.get(String(forecast.away_id));
    const home = profiles.get(String(forecast.home_id));
    const currentScore = forecastScorePair(forecast.projected_home_margin, away, home, leagueMean);
    const shadowScore = forecastScorePair(challenger, away, home, leagueMean);
    if (!currentScore || !shadowScore) continue;
    snapshots.set(gameKey, {
      id: forecast.id, date: forecast.date, home_id: forecast.home_id, away_id: forecast.away_id,
      captured_at_utc: now, tipoff_at_utc: fixture.date, forecast_model: forecast.forecast_model,
      baseline: {margin, home: currentScore.home, away: currentScore.away},
      wider_margin: {margin: challenger, home: shadowScore.home, away: shadowScore.away}
    });
  }
  return [...snapshots.values()].sort((a, b) => key(a.date, a.id).localeCompare(key(b.date, b.id)));
}

function grade(snapshots, finals) {
  const results = new Map(finals.map(game => [key(game.date, game.id), game]));
  const scored = [];
  let pending = 0;
  let excluded = 0;
  for (const forecast of snapshots) {
    const final = results.get(key(forecast.date, forecast.id));
    if (!final) {
      pending++;
      continue;
    }
    if (forecast.home_id !== final.home_id || forecast.away_id !== final.away_id ||
        !Number.isFinite(final.home_score) || !Number.isFinite(final.away_score) ||
        !(timestamp(forecast.captured_at_utc) < timestamp(forecast.tipoff_at_utc))) {
      excluded++;
      continue;
    }
    scored.push({...forecast, actual_home: final.home_score, actual_away: final.away_score});
  }
  return {scored, pending, excluded};
}

function metrics(games, model) {
  const average = fn => games.length ? Number((games.reduce((sum, game) => sum + fn(game, game[model]), 0) / games.length).toFixed(4)) : null;
  const home = (g, p) => Math.abs(p.home - g.actual_home);
  const away = (g, p) => Math.abs(p.away - g.actual_away);
  return {
    spread_mae: average((g, p) => Math.abs(p.margin - (g.actual_home - g.actual_away))),
    home_score_mae: average(home),
    away_score_mae: average(away),
    team_score_mae: average((g, p) => (home(g, p) + away(g, p)) / 2),
    total_mae: average((g, p) => Math.abs(p.home + p.away - g.actual_home - g.actual_away))
  };
}

function main() {
  const forecasts = read('ncaam-2026-27-upcoming-forecasts.json');
  const finals = read('ncaam-2026-27-retro-primary.json');
  const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')).forecasts : [];
  if (forecasts.season !== '2026-27' || finals.season !== '2026-27') throw Error('Unexpected season');
  const feed = read('mbb-live.json');
  const teams = read('ncaam-2026-27-espn-team-crosswalk.json').teams;
  const mean = read('ncaam-score-calibration.json').parameters.mean_team_points;
  const now = new Date().toISOString();
  const snapshots = capture(existing, forecasts.games, feed, finals.events, teams, mean, now);
  const {scored, pending, excluded} = grade(snapshots, finals.events);
  const summary = games => ({games: games.length, baseline: metrics(games, 'baseline'), wider_margin: metrics(games, 'wider_margin')});
  const days = new Map();
  for (const game of scored) {
    if (!days.has(game.date)) days.set(game.date, []);
    days.get(game.date).push(game);
  }
  const report = {
    season: '2026-27', sport: 'NCAA men’s Division I basketball',
    model: 'retro-wider-margin-120-140-v1', status: 'SHADOW_ONLY',
    summary: summary(scored), pending, excluded,
    by_date: Object.fromEntries([...days].map(([date, games]) => [date, summary(games)])),
    forecasts: snapshots, graded_games: scored
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({captured: snapshots.length, pending, excluded, ...report.summary}));
}

if (require.main === module) main();
module.exports = {capture, grade, metrics, widerMargin};
