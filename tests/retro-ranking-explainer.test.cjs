'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const explainer=require('../retro-ranking-explainer.js');
const men=JSON.parse(fs.readFileSync('data/ncaam-2026-27-retro-primary.json','utf8'));
const women=JSON.parse(fs.readFileSync('data/ncaaw-2026-27-retro-primary.json','utf8'));
test('ranking explanations use verified events and 160-pass fitted model instead of claiming per-game Elo additions',()=>{
 for(const data of [men,women]){
  const team=data.rankings.find(t=>data.events.some(g=>String(g.home_id)===String(t.team_id)||String(g.away_id)===String(t.team_id)));
  assert(team);
  const details=explainer.explain(team,data);
  const count=data.events.filter(g=>String(g.home_id)===String(team.team_id)||String(g.away_id)===String(team.team_id)).length;
  assert.equal(details.games.length,count);
  assert(details.games.every(g=>g.expected>=0&&g.expected<=1&&g.movWeight>=1&&Number.isFinite(g.fitSignal)));
  assert.equal(data.parameters.passes,160);
  const rendered=explainer.render(team,data);
  assert.match(rendered,/Why #/);
  assert.match(rendered,/current fitted ratings/);
  assert.match(rendered,/not individual Elo-point additions/);
  assert(!rendered.includes('Starting RETRO'));
 }
});
test('analysis is available only on RETRO and ranking cards keep original logos and other polls',()=>{
 const page=fs.readFileSync('ncaam-rankings.html','utf8');
 assert.match(page,/full&&window.SLTRetroExplainer/);
 assert.match(page,/rank-table-wrap--retro/);
 assert.match(page,/schoolLogo\(t\)/);
 assert.match(page,/rank-explanation/);
 assert.match(page,/retro-ranking-explainer\.js\?v=20261115-why-ranking/);
});
