'use strict';
const assert=require('node:assert/strict');
const {match,poisson}=require('../college-soccer-retro-knockout.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const [a,b] of [[1500,1500],[1750,1350],[1200,1800]]){
 const m=match(a,b,{neutral:true});
 close(m.advanceHome+m.advanceAway,1);
 close(m.regulation.home+m.regulation.away+m.regulation.draw,1);
 assert.ok(m.advanceHome>=0&&m.advanceHome<=1);
}
close(match(1500,1500,{neutral:true}).advanceHome,0.5);
assert.ok(match(1700,1400,{neutral:true}).advanceHome>0.5);
assert.ok(match(1400,1700,{neutral:true}).advanceHome<0.5);
close(poisson(1.4).reduce((a,b)=>a+b,0),1);
assert.throws(()=>match(NaN,1500));
console.log('Soccer RETRO knockout probability checks passed');
