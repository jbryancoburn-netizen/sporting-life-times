#!/usr/bin/env node
// Every completed game with a verified ESPN player box must enter NBA Elo exactly once.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../data/',import.meta.url);
const elo=JSON.parse(readFileSync(new URL('nba-2026-27-current-provisional.json',base),'utf8'));
const archive=JSON.parse(readFileSync(new URL('nba-game-center.json',base),'utf8'));
const ledger=new Map();
const archivedIds=new Set();
for(const game of elo.events||[]){
 assert(!ledger.has(game.id),'Duplicate NBA Elo game '+game.id);
 ledger.set(game.id,game);
}
let total=0;
const missing=[];
const records=new Map(elo.rankings.map(r=>[r.team,{wins:0,losses:0,elo:r.elo}]));
assert.equal(records.size,30,'NBA rankings must contain 30 unique teams');
for(const final of elo.events){
 const home=records.get(final.home),away=records.get(final.away);
 assert(home&&away&&home!==away,'Unregistered NBA final team '+final.id);
 assert(Number.isInteger(final.home_score)&&Number.isInteger(final.away_score)&&final.home_score!==final.away_score,'Invalid NBA final score '+final.id);
 const winner=final.home_score>final.away_score?home:away;
 const loser=winner===home?away:home;
 winner.wins++;loser.losses++;
}
assert.equal([...records.values()].reduce((n,r)=>n+r.wins,0),elo.games_played,'NBA standings wins do not reconcile');
assert.equal([...records.values()].reduce((n,r)=>n+r.losses,0),elo.games_played,'NBA standings losses do not reconcile');
for(const game of archive.games||[]){
 assert(game.id && !archivedIds.has(game.id),'Duplicate NBA Game Center game '+game.id);
 archivedIds.add(game.id);
 if(game.state!=='post')continue;
 assert(/^espn-nba-\d+$/.test(String(game.id))||/^002\d{7}$/.test(String(game.id)),'Unexpected NBA final identifier '+game.id);
 const h=game.teams?.find(t=>t.home_away==='home'),a=game.teams?.find(t=>t.home_away==='away');
 assert(h&&a&&h.code!==a.code,'Missing or invalid teams in completed NBA game '+game.id);
 assert(Number.isInteger(Number(h.score))&&Number.isInteger(Number(a.score)),'Missing NBA final score '+game.id);
 total++;
 const row=ledger.get(game.id);
 if(!row){missing.push(game.id+': '+a.code+' @ '+h.code);continue;}
 assert.equal(row.home,h.code,'NBA Elo home team '+game.id);
 assert.equal(row.away,a.code,'NBA Elo away team '+game.id);
 assert.equal(row.home_score,Number(h.score),'NBA Elo home score '+game.id);
 assert.equal(row.away_score,Number(a.score),'NBA Elo away score '+game.id);
}
// Official verified finals are allowed to precede player box-score ingestion.
// Every *captured* completed game must match Elo, but Elo is not required to wait for a player archive.
if(missing.length)throw Error(missing.length+' completed player boxes lack Elo and standings updates: '+missing.join(', '));
assert.equal(elo.events.length,elo.games_played);
console.log('PASS: '+total+' archived NBA finals matched once in '+elo.events.length+' verified Elo results; all 30 team records reconcile. '+(elo.events.length-total)+' Elo finals await detailed Game Center archive.');
