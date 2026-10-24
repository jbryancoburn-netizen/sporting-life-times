import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {analyze}=require('../nba-game-comparison.js');
const game={team_comparison:{away:{'FG%':47.5,'3PT%':35,'REB':41,'TO':9},home:{'FG%':51.2,'3PT%':29,'REB':39,'TO':14}}};
const m=Object.fromEntries(analyze(game).map(x=>[x.key,x]));
assert.equal(m['FG%'].advantage,'home');
assert.equal(m['FG%'].awayWidth,47.5);
assert.equal(m['FG%'].homeWidth,51.2);
assert.equal(m['TO'].advantage,'away');
assert.equal(m['TO'].awayWidth,9/14*100);
assert.equal(m['REB'].advantage,'away');
assert.equal(analyze({team_comparison:{away:{'FG%':104,'REB':20},home:{'FG%':50,'REB':25}}}).find(x=>x.key==='FG%'),undefined);
assert.equal(analyze({team_comparison:{away:{'REB':null},home:{'REB':40}}}).length,0);
assert.equal(analyze({team_comparison:{away:{'REB':-3},home:{'REB':40}}}).length,0);
assert.deepEqual(analyze({}),[]);
const archive=JSON.parse(readFileSync(new URL('../data/nba-game-center.json',import.meta.url),'utf8'));
let tested=0;
for(const game of archive.games||[]){
 const compared=analyze(game);
 for(const metric of compared){
  assert(Number.isFinite(metric.awayWidth) && metric.awayWidth>=0 && metric.awayWidth<=100);
  assert(Number.isFinite(metric.homeWidth) && metric.homeWidth>=0 && metric.homeWidth<=100);
  assert(['away','home','even'].includes(metric.advantage));
  if(metric.key.endsWith('%'))assert.equal(metric.awayWidth,metric.away);
 }
 if(compared.length)tested++;
}
assert(tested>0,'No actual captured NBA team statistics were evaluated');
console.log('PASS NBA comparison: '+tested+' archived games, correct scales, turnover direction and invalid-data rejection');
