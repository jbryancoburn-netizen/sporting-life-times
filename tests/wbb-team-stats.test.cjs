'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('wbb-team-stats.js','utf8');
function library(document){
 const w={},ctx={window:w,document,Map,Number,String,Set,Array,Date,encodeURIComponent,AbortSignal,URL,fetch:async()=>({ok:false})};
 vm.runInNewContext(code,ctx);
 return w.WBBTeamStats;
}
const ledger={season:'2026-27',as_of:'2026-11-01',games:[
 {id:'401920983',date:'2026-11-01T17:00Z',home_id:'222',away_id:'87',
  status:'final',home_score:75,away_score:99,score_evidence:'espn_final_ncaa_pending'}
]};
test('Notre Dame and Villanova get real scoring stats from their one women’s final',()=>{
 const stats=library().summarizeFinals;
 const nd=stats(ledger,'87'),nova=stats(ledger,'222');
 assert.equal(nd.games,1);assert.equal(nd.wins,1);assert.equal(nd.losses,0);
 assert.equal(nd.ppg,'99.0');assert.equal(nd.allowed,'75.0');assert.equal(nd.margin,'24.0');
 assert.equal(nova.wins,0);assert.equal(nova.losses,1);assert.equal(nova.ppg,'75.0');
 assert.equal(nova.allowed,'99.0');assert.equal(nova.margin,'-24.0');
 const html=library().teamMarkup(nd);
 assert.match(html,/99\.0/);assert.match(html,/75\.0/);assert.match(html,/verified women’s results|Verified women’s results/);
});
test('team statistics fail closed for wrong season, ties, duplicate games and disputed scores',()=>{
 const stats=library().summarizeFinals;
 assert.equal(stats({...ledger,season:'2025-26'},'87'),null);
 assert.equal(stats({...ledger,games:[ledger.games[0],ledger.games[0]]},'87').games,0);
 assert.equal(stats({...ledger,games:[{...ledger.games[0],home_score:99}]},'87').games,0);
 assert.equal(stats({...ledger,games:[{...ledger.games[0],status:'review'}]},'87').games,0);
 assert.equal(stats({...ledger,games:[{...ledger.games[0],away_id:'222'}]},'87').games,0);
 assert.equal(stats(ledger,'84').games,0);
});
test('men’s or previous-season ESPN statistics cannot appear as 2026-27 women’s player data',()=>{
 const valid=library().validatedESPN;
 const base={status:'success',requestedSeason:{year:2027},team:{id:'87'},
  teamTotals:[{stats:[{name:'gamesPlayed',value:1,displayValue:'1'},{name:'avgPoints',value:99}]}],
  results:[]};
 assert.ok(valid(base,'87'));
 assert.equal(valid({...base,requestedSeason:{year:2026}},'87'),null);
 assert.equal(valid({...base,team:{id:'222'}},'87'),null);
 assert.equal(valid({...base,status:'failure'},'87'),null);
});
test('unavailable individual-player API cannot erase authenticated women’s team stats',async()=>{
 let markup='';
 const panel={className:'',innerHTML:''};
 const host={appendChild(x){this.panel=x},set innerHTML(x){markup=x},get innerHTML(){return markup}};
 const document={getElementById:()=>host,createElement:()=>panel};
 const w={},ctx={window:w,document,Map,Number,String,Set,Array,Date,encodeURIComponent,
 AbortSignal,URL,fetch:async url=>url==='data/ncaaw-2026-27-verified-games.json'?
  {ok:true,json:async()=>ledger}:{ok:false}};
 vm.runInNewContext(code,ctx);
 await w.WBBTeamStats.render('87');
 assert.match(markup,/99\.0/);
 assert.match(panel.innerHTML,/Current-season women’s player statistics are not yet available/);
});
