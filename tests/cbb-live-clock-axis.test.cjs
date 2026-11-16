'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={window:{},console,Date,Math,Number,String,Map,Set,WeakMap,URL,URLSearchParams};
vm.runInNewContext(fs.readFileSync('cbb-live-court.js','utf8'),sandbox);
const court=sandbox.window.SLTCourt;
assert(court?.gameFlow&&court?.parsePlays);
function game(gender='men'){return {gender,phase:'live',away:{team:{id:'1',schoolLabel:'Alcorn'}},home:{team:{id:'2',schoolLabel:'Maryland'}}};}
const plays=[
 {period:1,clock:'20:00',awayScore:0,homeScore:0},
 {period:1,clock:'18:45',awayScore:0,homeScore:3},
 {period:1,clock:'17:39',awayScore:0,homeScore:6}
];
const marked=court.gameFlow(plays,game());
assert.match(marked,/GAME CLOCK · HALVES/);
assert.match(marked,/H1 20:00/);
assert.match(marked,/H1 19:00/);
assert.match(marked,/H1 18:00/);
assert.match(marked,/H1 17:00/);
assert.match(marked,/Horizontal spacing uses the source game clock/);
assert.doesNotMatch(marked,/EARLIER PLAYS|LATEST PLAY →/);
const positions=[...marked.matchAll(/<circle cx="([\d.]+)" cy=/g)].map(x=>Number(x[1]));
assert.equal(positions.length,1);
assert(positions[0]>400&&positions[0]<876,'Latest play must appear at its clock position, not the right-hand edge');
const women=court.gameFlow([
 {period:1,clock:'10:00',awayScore:0,homeScore:0},
 {period:1,clock:'09:00',awayScore:2,homeScore:0},
 {period:2,clock:'09:00',awayScore:10,homeScore:8}
],game('women'));
assert.match(women,/GAME CLOCK · QUARTERS/);
assert.match(women,/Q1 10:00/);assert.match(women,/Q2 10:00/);
assert.doesNotMatch(women,/H1 20:00/);
const missing=court.gameFlow([{...plays[0],clock:''},plays[1],plays[2]],game());
assert.match(missing,/EVENT ORDER · SOURCE CLOCKS INCOMPLETE/);
assert.match(missing,/EVENT 1/);
assert.doesNotMatch(missing,/Horizontal spacing uses the source game clock/);
console.log('PASS: men and women game-clock axes, exact elapsed positions, no guessed timestamps');
