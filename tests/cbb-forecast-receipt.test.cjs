'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {receipt,indexArchive,archives,indexScored}=require('../cbb-forecast-receipt.js');
const a={date:'2026-11-15',id:'espn:401999998',home_id:'ncaa:1',away_id:'ncaa:2',
 projected_home_margin:4.5,home_win_probability:0.62,captured_at_utc:'2026-11-14T21:00:00Z'};
test('postgame receipt compares signed prediction and actual home margin',()=>{
 indexArchive({season:'2026-27',predictions:[a]},'men');
 const html=receipt('men','401999998','2026-11-15','final',7,'ncaa:1','ncaa:2','Duke','Kansas');
 assert.match(html,/Duke −4\.5/);
 assert.match(html,/Duke by 7/);
 assert.match(html,/Margin error <b>2\.5 pts/);
 assert.match(html,/Winner correct/);
});
test('wrong-team identity and unavailable archive never fabricate accuracy',()=>{
 const wrong=receipt('men','401999998','2026-11-15','final',7,'ncaa:3','ncaa:2');
 assert.match(wrong,/No archived pregame forecast/);
 assert.doesNotMatch(wrong,/Margin error/);
 const unarchived=receipt('women','401999998','2026-11-15','final',7);
 assert.match(unarchived,/No archived pregame forecast/);
});
test('a live scorebug retains only the locked pregame line without final accuracy',()=>{
 const html=receipt('men','401999998','2026-11-15','live',8,'ncaa:1','ncaa:2');
 assert.match(html,/Pregame forecast locked/);
 assert.doesNotMatch(html,/Margin error/);
});
test('conflicting duplicate archived game IDs are quarantined',()=>{
 indexArchive({season:'2026-27',predictions:[a,{...a,projected_home_margin:-30}]},'women');
 assert.equal(archives.women.has('2026-11-15|401999998'),false);
});

