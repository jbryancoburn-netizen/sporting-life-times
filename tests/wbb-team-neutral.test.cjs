'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('ncaaw-team.html','utf8');
const match=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
assert.ok(match,'women team desk inline script found');

async function desk(teamId,disputed=false){
  const root={innerHTML:'',style:{setProperty(){}}};
  const game={id:'401906067',date:'2026-11-21T01:00:00Z',site:'neutral',
    home_id:'2',away_id:'1',home_score:70,away_score:74,completed:true,
    venue:'Neutral Court',opponent_id:teamId==='1'?'2':'1',opponent:teamId==='1'?'Home U':'Away U'};
  const lookups={
    'data/ncaaw-2026-27-teams.json':{teams:[{team_id:'1',team:'Away U',color:'aa1133'},{team_id:'2',team:'Home U',color:'3322aa'}]},
    'data/ncaaw-schedules-2026-27.json':{teams:{'1':{games:[game]},'2':{games:[game]}}},
    'data/ncaaw-2026-27-retro-primary.json':{season:'2026-27',gender:'women',parameters:{home_edge:75},
      rankings:[{team_id:'1',elo:1500,wins:1,losses:0},{team_id:'2',elo:1500,wins:0,losses:1}]},
    'data/ncaaw-2026-27-cross-school-time-discrepancies-2026-10-30.json':
      {season:'2026-27',games:disputed?[{game_id:'401906067'}]:[]},
  };
  const context={
    document:{getElementById:()=>root,title:''},
    location:{search:'?team='+teamId},
    window:{MBBLogos:{ready:Promise.resolve(true),byESPN:(id)=>'<i data-espn-id="'+id+'"></i>'}},
    URLSearchParams,encodeURIComponent,
    fetch:async path=>({ok:true,json:async()=>lookups[path]||{}}),
  };
  // The page now uses one shared result identity module.
  vm.runInNewContext(fs.readFileSync('wbb-game-results.js','utf8'),
    {window:context.window,Date,Map,Set,Number,String,Array});
  vm.runInNewContext(match[1],context);
  for(let i=0;i<25;i++)await new Promise(setImmediate);
  return root.innerHTML;
}

test('neutral-site final follows actual ESPN home/away identity for each school',async()=>{
  const away=await desk('1');
  assert.match(away,/<strong>W 74–70<\/strong>/);
  const home=await desk('2');
  assert.match(home,/<strong>L 70–74<\/strong>/);
});

test('completed neutral final is not kept in a pregame tipoff dispute state',async()=>{
  const result=await desk('1',true);
  assert.match(result,/<strong>W 74–70<\/strong>/);
  assert.doesNotMatch(result,/Disputed — verify/);
});
