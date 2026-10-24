#!/usr/bin/env node
// Every completed game with a verified ESPN player box must enter NBA Elo exactly once.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../data/',import.meta.url);
const elo=JSON.parse(readFileSync(new URL('nba-2026-27-current-provisional.json',base),'utf8'));
const archive=JSON.parse(readFileSync(new URL('nba-game-center.json',base),'utf8'));
const ledger=new Map();
for(const game of elo.events||[]){
 assert(!ledger.has(game.id),'Duplicate NBA Elo game '+game.id);
 ledger.set(game.id,game);
}
let total=0;
const missing=[];
for(const game of archive.games||[]){
 if(game.state!=='post'||!String(game.id).startsWith('espn-nba-')||!game.players?.length)continue;
 const h=game.teams?.find(t=>t.home_away==='home'),a=game.teams?.find(t=>t.home_away==='away');
 if(!h||!a||!Number.isInteger(Number(h.score))||!Number.isInteger(Number(a.score)))continue;
 total++;
 const row=ledger.get(game.id);
 if(!row){missing.push(game.id+': '+a.code+' @ '+h.code);continue;}
 assert.equal(row.home,h.code,'NBA Elo home team '+game.id);
 assert.equal(row.away,a.code,'NBA Elo away team '+game.id);
 assert.equal(row.home_score,Number(h.score),'NBA Elo home score '+game.id);
 assert.equal(row.away_score,Number(a.score),'NBA Elo away score '+game.id);
}
if(missing.length)throw Error(missing.length+' completed player boxes lack Elo and standings updates: '+missing.join(', '));
assert.equal(elo.events.length,elo.games_played);
console.log('PASS: '+total+' captured ESPN finals included exactly once in '+elo.events.length+' NBA Elo results; standings can reconcile.');
