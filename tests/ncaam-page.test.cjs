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
   const common={rank:n+1,team_id:'ncaa:'+n,team:n===0?'Michigan':'Team '+n,
      conference:n%2?'Big Ten':'ACC',elo:1600-n*.2,season_games:gameCount};
   if(kind==='roster')return {...common,offseason_adjustment:n===0?12.5:0,
      base_elo:common.elo-12.5};
   if(kind==='current')return {...common,games:gameCount};
   return {...common,last_season_elo:1650-n*.2};
 });
 return {season:'2026-27',status:'provisional-'+kind,team_count:365,
   games_played:gameCount,rankings:ranks,carryover:.65,
   evidence:{roster_programs:364}};
}
async function render({withCurrent=false,withRoster=true,approved=false}={}){
 const ids=['ratings','status','source-note','team-search','conference-filter',
   'rating-version','reference-heading','rating-heading'];
 const elements=Object.fromEntries(ids.map(id=>[id,element(id==='rating-version'?'auto':'')]));
 const data={
   'data/ncaam-2026-27-preseason-provisional.json':fixture('baseline',0)};
 if(withRoster)data['data/ncaam-2026-27-offseason-shadow.json']={...fixture('roster',0),audit:{release_approved:approved}};
 if(withCurrent)data['data/ncaam-2026-27-current-provisional.json']=fixture('current',3);
 const context={
   document:{getElementById:id=>elements[id],createElement:()=>element()},
   fetch:async url=>({ok:!!data[url],json:async()=>data[url]}),
   console};
 await vm.runInNewContext('(async()=>{\n'+code+'\n})()',context);
 return elements;
}
test('uses approved roster-adjusted preseason only after audit gate',async()=>{
 const els=await render({approved:true});
 assert.match(els.status.textContent,/roster-adjusted/);
 assert.match(els['source-note'].textContent,/364\/365/);
 assert.match(els.ratings.innerHTML,/12\.50/);
 assert.doesNotMatch(els.ratings.innerHTML,/NaN|undefined/);
});
test('live current-season game replay outranks preseason roster model',async()=>{
 const els=await render({withCurrent:true});
 assert.match(els.status.textContent,/current-season Elo/);
 assert.match(els.status.textContent,/3 completed games/);
});
test('unadjusted preseason remains available via model selector',async()=>{
 const els=await render();
 els['rating-version'].value='baseline';
 els['rating-version'].handlers.change();
 assert.match(els.status.textContent,/carryover baseline/);
 assert.match(els.ratings.innerHTML,/1650\.00/);
});
test('missing shadow data cleanly falls back to historical carryover',async()=>{
 const els=await render({withRoster:false});
 assert.match(els.status.textContent,/carryover baseline/);
 assert.doesNotMatch(els.ratings.innerHTML,/NaN/);
});

test('unapproved shadow is never exposed as a selectable primary rating',async()=>{
 const els=await render({withRoster:true,approved:false});
 assert.match(els.status.textContent,/carryover baseline/);
 assert.ok(!els['rating-version'].children.some(x=>x.value==='roster'));
});
