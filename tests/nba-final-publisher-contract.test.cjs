const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const read=p=>readFileSync(p,'utf8');
test('five-minute NBA publisher contains all final-dependent datasets',()=>{
 const y=read('.github/workflows/nba-elo-refresh.yml');
 assert(y.includes("cron: '*/5 * * * *'"));
 for(const item of ['collect-nba-player-leaders.py','backfill-nba-espn.py','update-nba-elo.mjs','reconcile-nba-schedule.mjs','nba-game-center.json','nba-player-leaders.json','nba-possession-inputs.json','nba-stat-coverage-audit.json'])assert(y.includes(item),item);
 const recovery=read('.github/workflows/nba-official-game-center.yml');
 assert(!/cron:/.test(recovery));
 assert(!/^  push:/m.test(recovery),'Second NBA writer must not run on code pushes');
 assert(/workflow_dispatch:/.test(recovery),'Manual recovery must remain possible');
 const pub=read('.github/workflows/publish-newspaper.yml');
 assert(pub.includes('Catch up NBA finals, RETRO and player stats inside Pages artifact'));
 const js=read('nba-newspaper.js');
 assert(js.includes('const finalEvents=primaryReady?data.current.events'));
});
