'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const quarantine=load('data/ncaaw-2026-27-tipoff-quarantine.json');
const source=load('data/ncaaw-2026-27-official-field-crosschecks.json');
const opponent=load('data/ncaaw-2026-27-cross-school-time-discrepancies-2026-10-30.json');
test('women-only published quarantine includes every disputed source game and university citation',()=>{
 assert.equal(quarantine.season,'2026-27');assert.equal(quarantine.gender,'women');
 assert.equal(quarantine.status,'unresolved-source-conflicts');
 const expected=new Set(source.official_tipoff_discrepancies_for_review.map(x=>String(x.game_id)));
 for(const x of opponent.games)expected.add(String(x.game_id));
 assert.equal(quarantine.disputed_unique_games,expected.size);
 assert.equal(quarantine.source_claim_count,source.official_tipoff_discrepancies_for_review.length);
 const actual=new Set(quarantine.games.map(x=>x.game_id));assert.equal(actual.size,expected.size);
 for(const game of quarantine.games){
  assert.ok(expected.has(game.game_id));
  assert.ok(/^\d+$/.test(game.game_id));
  for(const claim of game.source_claims)assert.ok(claim.source_url.startsWith('https://'));
 }
});
const html=fs.readFileSync('ncaaw-team.html','utf8');
const main=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
assert.ok(main,'women team page must have its inline renderer');
async function render(){
 let root={innerHTML:'',style:{setProperty(){}}};
 const fixture=[
  {id:'401928314',date:'2026-12-19T01:00Z',opponent_id:'999',
   opponent:'Idaho State',home_id:'204',away_id:'999',site:'home',completed:false,
   venue:'Gill Coliseum'},
  {id:'401999998',date:'2026-11-03T21:00:00Z',opponent_id:'999',
   opponent:'Example Academy',home_id:'204',away_id:'999',site:'home',completed:false},
  {id:'401999997',date:'2026-11-04T05:00:00Z',opponent_id:'999',
   opponent:'Another Academy',home_id:'204',away_id:'999',site:'home',completed:false},
 ];
 const sources={
  'data/ncaaw-2026-27-teams.json':{teams:[{team_id:'204',team:'Oregon State Beavers',color:'dd5511'}]},
  'data/ncaaw-schedules-2026-27.json':{teams:{'204':{games:fixture}}},
  'data/ncaaw-2026-27-retro-primary.json':{gender:'women',season:'2026-27',
    rankings:[],parameters:{home_edge:75}},
  'data/ncaaw-2026-27-verified-games.json':{season:'2026-27',games:[]},
  'data/ncaaw-2026-27-tipoff-quarantine.json':quarantine
 };
 const w={
  MBBLogos:{ready:Promise.resolve(true),byESPN:()=>'<i></i>'},
  WBBGameResults:{merge:games=>({games,matched:0,conflicts:[]}),scoreFor:()=>({value:'—',detail:''})}
 };
 const context={document:{getElementById:()=>root,title:''},location:{search:'?team=204'},window:w,
  URLSearchParams,URL,encodeURIComponent,Date,Intl,Map,Number,String,Set,
  fetch:async p=>({ok:true,json:async()=>sources[p]||{}})};
 vm.runInNewContext(main[1],context);
 for(let i=0;i<15;i++)await new Promise(setImmediate);
 return root.innerHTML;
}
test('disputed Oregon State tipoff is quarantined; other listed times are clearly tentative',async()=>{
 const output=await render();
 assert.doesNotMatch(output,/Women’s team desk unavailable/);
 assert.match(output,/Disputed — verify/);
 assert.match(output,/Official university and published calendar times differ/);
 assert.match(output,/School source ↗/);
 assert.match(output,/ESPN-listed start; unverified by school/);
 assert.match(output,/4:00 PM ET/);
 assert.match(output,/Another Academy[\s\S]{0,1200}TBA/);
});
