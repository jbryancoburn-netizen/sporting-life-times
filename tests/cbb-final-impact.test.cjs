'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../cbb-final-impact.js');
const fixture={
 id:'401919991',day:'2026-11-13',phase:'final',kind:'regular',
 away:{canonical:'1',score:85},home:{canonical:'2',score:75}
};
const snapshot=()=>{
 const rows=[
  {team_id:'1',conference:'Big Ten',wins:4,losses:0,conference_wins:1,conference_losses:0,rank:3,daily_change:12.35},
  {team_id:'2',conference:'Big Ten',wins:2,losses:2,conference_wins:0,conference_losses:1,rank:34,daily_change:-9.8}
 ];
 return {season:'2026-27',as_of:'2026-11-13',rankings:rows,events:[
  {id:'401919991',date:'2026-11-13',away_id:'1',home_id:'2',away_score:85,home_score:75}
 ]};
};
test('final: verified game and published same-day rating moves and conference standings',()=>{
 const info=summarize(fixture,snapshot());
 assert.equal(info.state,'published');
 assert.equal(info.away.dayChange,12.4);
 assert.equal(info.home.dayChange,-9.8);
 assert.equal(info.away.record,'4–0');
 assert.equal(info.home.record,'2–2');
 assert.equal(info.away.conferenceRecord,'1–0');
 assert.equal(info.home.conferenceRecord,'0–1');
 assert.equal(info.away.won,true);
 assert.equal(info.home.won,false);
});
test('final: prior-day final does not mislabel a later daily change as game impact',()=>{
 const f={...fixture,day:'2026-11-12'};
 const s=snapshot();s.as_of='2026-11-13';s.events[0].date='2026-11-12';
 const info=summarize(f,s);
 assert.equal(info.state,'published');
 assert.equal(info.away.dayChange,null);
 assert.equal(info.away.rank,3);
});
test('final: missing or conflicting published event blocks invented movement',()=>{
 const s=snapshot();s.events[0].away_score=90;
 assert.equal(summarize(fixture,s).state,'pending');
 const t=snapshot();t.as_of='2026-11-12';
 assert.equal(summarize(fixture,t).state,'pending');
 const d=snapshot();d.events.push({...d.events[0]});
 assert.equal(summarize(fixture,d).state,'pending');
});
test('final: unrelated opponents and exhibitions never receive rated impact',()=>{
 const outside={...fixture,home:{canonical:'999',score:75}};
 assert.equal(summarize(outside,snapshot()).state,'not-rated');
 assert.equal(summarize({...fixture,kind:'exhibition'},snapshot()).state,'not-rated');
});
test('live and pregame never show completed-game standings changes',()=>{
 assert.equal(summarize({...fixture,phase:'live'},snapshot()),null);
 assert.equal(summarize({...fixture,phase:'upcoming'},snapshot()),null);
});
test('final: only verified matchup identity and score can publish changes',()=>{
 const wrong={...fixture,id:'401919992'};
 assert.equal(summarize(wrong,snapshot()).state,'pending');
 const t=snapshot();t.rankings[0].daily_change='12.5';
 const info=summarize(fixture,t);
 assert.equal(info.away.dayChange,null);
 assert.equal(info.home.dayChange,-9.8);
});
