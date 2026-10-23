const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('ncaam-elo-page.js','utf8');

function element(value=''){
  return {value,textContent:'',innerHTML:'',children:[],handlers:{},
          append(option){this.children.push(option)},
          addEventListener(name,callback){this.handlers[name]=callback}};
}
function fixture(kind,gameCount=0){
 const ranks=Array.from({length:365},(_,n)=>{
   const common={rank:n+1,team_id:'ncaa:'+n,
      team:n===0?'Michigan':n===1?'Indiana':n===2?'Purdue':'Team '+n,
      conference:n%2?'Big Ten':'ACC',elo:1600-n*.2,season_games:gameCount};
   if(kind==='roster'||kind==='shadow')return {...common,
      offseason_adjustment:n===0?12.5:0,base_elo:common.elo-(n===0?12.5:0)};
   if(kind==='current')return {...common,games:gameCount};
   return {...common,last_season_elo:1650-n*.2};
 });
 return {season:'2026-27',status:'provisional-'+kind,team_count:365,
   games_played:gameCount,rankings:ranks,
   preseason_roster_informed:kind==='roster',
   evidence:{roster_programs:364,source_linked_player_ids:3523,
             players_with_verified_historical_minutes:2923}};
}
async function render({withCurrent=false,withRoster=true,withShadow=true,
                        invalidRoster=false,invalidCurrent=false}={}){
 const ids=['ratings','status','source-note','team-search','conference-filter',
   'rating-version','reference-heading','rating-heading',
   'matchup-a','matchup-b','matchup-venue','matchup-result'];
 const elements=Object.fromEntries(ids.map(id=>[id,element(id==='rating-version'?'auto':'')]));
 const data={'data/ncaam-2026-27-preseason-provisional.json':fixture('baseline')};
 if(withRoster){
   data['data/ncaam-2026-27-preseason-roster-informed.json']=fixture('roster');
   if(invalidRoster)data['data/ncaam-2026-27-preseason-roster-informed.json'].rankings.pop();
 }
 if(withShadow)data['data/ncaam-2026-27-offseason-shadow.json']=fixture('shadow');
 if(withCurrent){
   data['data/ncaam-2026-27-current-provisional.json']=fixture('current',3);
   if(invalidCurrent)data['data/ncaam-2026-27-current-provisional.json'].rankings[0].rank=50;
 }
 const context={
   document:{getElementById:id=>elements[id],createElement:()=>element()},
   fetch:async url=>({ok:!!data[url],json:async()=>data[url]}),
   console};
 await vm.runInNewContext('(async()=>{\n'+code+'\n})()',context);
 return elements;
}
test('identity-linked roster-informed Elo is the provisional preseason default',async()=>{
 const els=await render();
 assert.match(els.status.textContent,/roster-informed preseason/);
 assert.match(els['source-note'].textContent,/3523 linked/);
 assert.match(els['source-note'].textContent,/2923 players/);
 assert.match(els['source-note'].textContent,/364\/365/);
 assert.match(els.ratings.innerHTML,/12\.50/);
 assert.doesNotMatch(els.ratings.innerHTML,/NaN|undefined/);
});
test('independent current-season final replay outranks preseason',async()=>{
 const els=await render({withCurrent:true});
 assert.match(els.status.textContent,/current-season Elo/);
 assert.match(els.status.textContent,/3 completed games/);
});
test('original unadjusted preseason Elo remains selectable',async()=>{
 const els=await render();
 els['rating-version'].value='baseline';
 els['rating-version'].handlers.change();
 assert.match(els.status.textContent,/carryover baseline/);
 assert.match(els.ratings.innerHTML,/1650\.00/);
});
test('missing new preseason falls back to game-only without defaulting to old shadow',async()=>{
 const els=await render({withRoster:false,withShadow:true});
 assert.match(els.status.textContent,/carryover baseline/);
 assert.ok(els['rating-version'].children.some(x=>x.value==='shadow'));
});
test('the earlier experimental exact-name model remains comparison-only',async()=>{
 const els=await render();
 els['rating-version'].value='shadow';
 els['rating-version'].handlers.change();
 assert.match(els.status.textContent,/RESEARCH/);
 assert.doesNotMatch(els.status.textContent,/current-season/);
});
test('incomplete roster file cannot become default',async()=>{
 const els=await render({invalidRoster:true});
 assert.match(els.status.textContent,/carryover baseline/);
});
test('corrupted live rankings do not supplant valid preseason',async()=>{
 const els=await render({withCurrent:true,invalidCurrent:true});
 assert.match(els.status.textContent,/roster-informed preseason/);
});
