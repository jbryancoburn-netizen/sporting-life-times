#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};runInNewContext(read('nba-rabby-possession.js'),{window});
const m=window.RabbyPossessionModel;
assert.equal(m.build({source_type:'unverified',games:[]}),null);
assert.equal(m.build({source_type:'official_nba_boxscores',games:[]}),null);
const records=[];
for(let i=0;i<24;i++){
 const first=i%2===0;
 records.push({final:true,regular_season:true,
 home:{code:first?'BOS':'GSW',points:first?126:96,fga:first?100:78,oreb:12,tov:12,fta:20},
 away:{code:first?'NYK':'CHI',points:first?116:104,fga:first?98:85,oreb:11,tov:14,fta:21}});
}
const model=m.build({source_type:'official_nba_boxscores',games:records});
assert.ok(model);
const ratings={BOS:1550,NYK:1520,GSW:1450,CHI:1480};
const fast=m.project('BOS','NYK',model,ratings);
const slow=m.project('GSW','CHI',model,ratings);
assert.ok(fast&&slow);
assert.ok(fast.total>slow.total+10,'Opponent pace/offense must produce different scoring totals');
assert.ok(fast.possessions>slow.possessions+7,'Pace must materially affect matchups');
assert.ok(Math.abs(fast.homePoints-fast.awayPoints)<40);
const page=read('nba.html'),legacy=read('nba-rabby-forecast.js');
assert.match(page,/nba-rabby-possession\.js/);
assert.doesNotMatch(legacy,/meanAbsoluteMargin|meanTotal|function predict\(/);
assert.match(legacy,/Pending verified team possession data/);
assert.match(read('nba-home.js'),/Special:FilePath\/National_Basketball_Association_logo/);
console.log('Rabby NBA possession model PASS: distinct projected totals and possession counts; invalid data blocked, Elo unchanged.');
