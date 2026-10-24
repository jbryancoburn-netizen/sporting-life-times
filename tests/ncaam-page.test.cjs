const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('ncaam-elo-page.js','utf8');

function element(value=''){
  return {value,textContent:'',innerHTML:'',children:[],handlers:{},dataset:{},hidden:false,
          append(option){this.children.push(option)},
          addEventListener(name,callback){this.handlers[name]=callback}};
}
function fixture(kind,gameCount=0){
 let ranks=Array.from({length:365},(_,n)=>{
   const common={rank:n+1,team_id:'ncaa:'+n,
      team:n===0?'Michigan':n===1?'Indiana':n===2?'Purdue':'Team '+n,
      conference:n%2?'Big Ten':'ACC',elo:1600-n*.2,season_games:gameCount};
   if(kind==='roster'||kind==='shadow')return {...common,
      offseason_adjustment:n===0?12.5:0,base_elo:common.elo-(n===0?12.5:0)};
   if(kind==='current')return {...common,games:gameCount};
   return {...common,last_season_elo:1650-n*.2};
 });
 if(kind==='quality'){
   ranks=ranks.map((r,n)=>({...r,roster_informed_elo:r.elo,
      experimental_scoring_quality_adjustment:n===1?1.5:0,
      elo:r.elo+(n===1?1.5:0),
      verified_prior_player_scoring_count:n===1?8:10}));
   ranks.sort((a,b)=>b.elo-a.elo);
   ranks.forEach((r,i)=>{r.rank=i+1});
   return {season:'2026-27',team_count:365,season_games:0,
     status:'SHADOW_ONLY_DO_NOT_PROMOTE',
     production_elo_approved:false,preseason_asof_certified:false,
     source_integrity:{matched_verified_history:2923,quality_beta:400},
     rankings:ranks};
 }
 return {season:'2026-27',status:'provisional-'+kind,team_count:365,
   games_played:gameCount,rankings:ranks,
   preseason_roster_informed:kind==='roster',
   evidence:{roster_programs:364,source_linked_player_ids:3523,
             players_with_verified_historical_minutes:2923}};
}
async function render({withCurrent=false,withRoster=true,withShadow=true,withQuality=true,
                        invalidRoster=false,invalidCurrent=false,invalidQuality=false,qualityMismatch=false}={}){
 const ids=['ratings','status','source-note','team-search','conference-filter',
   'rating-version','reference-heading','rating-heading',
   'matchup-a','matchup-b','matchup-venue','matchup-result','elo-quality-comparison','elo-model-pill'];
 const elements=Object.fromEntries(ids.map(id=>[id,element(id==='rating-version'?'auto':'')]));
 const data={'data/ncaam-2026-27-preseason-provisional.json':fixture('baseline')};
 if(withRoster){
   data['data/ncaam-2026-27-preseason-roster-informed.json']=fixture('roster');
   if(invalidRoster)data['data/ncaam-2026-27-preseason-roster-informed.json'].rankings.pop();
 }
 if(withQuality){
   const playerQuality=fixture('quality');
   if(invalidQuality)playerQuality.production_elo_approved=true;
   if(qualityMismatch)playerQuality.rankings[0].roster_informed_elo+=15;
   data['data/ncaam-2026-27-scoring-quality-shadow.json']=playerQuality;
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
 if(elements.status.textContent==='College Elo data temporarily unavailable'){
   throw new Error('Page render exception: '+elements['source-note'].textContent);
 }
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

test('new 365-team player scoring research model is selectable but never automatically the default',async()=>{
 const els=await render();
 assert.match(els.status.textContent,/roster-informed preseason/);
 assert.ok(els['rating-version'].children.some(x=>x.value==='quality'));
 assert.match(els['rating-version'].children.find(x=>x.value==='quality').textContent,/experimental.*not certified/);
 els['rating-version'].value='quality';
 els['rating-version'].handlers.change();
 assert.match(els.status.textContent,/EXPERIMENTAL RESEARCH/);
 assert.match(els['source-note'].textContent,/1,596-game test/);
 assert.match(els['source-note'].textContent,/does NOT validate/);
 assert.match(els['matchup-result'].textContent,/Experimental research only/);
 assert.equal(els['elo-model-pill'].textContent,'EXPERIMENTAL');
 assert.equal(els['elo-quality-comparison'].hidden,false);
 assert.match(els.ratings.innerHTML,/Δ|1\.50|↑1/);
 assert.match(els['reference-heading'].textContent,/Δ vs roster Elo/);
 els['rating-version'].value='roster';
 els['rating-version'].handlers.change();
 assert.equal(els['elo-quality-comparison'].hidden,true);
 assert.equal(els['elo-model-pill'].textContent,'PROVISIONAL');
});
test('any mistakenly approved experimental model is rejected rather than displayed',async()=>{
 const els=await render({invalidQuality:true});
 assert.match(els.status.textContent,/roster-informed preseason/);
 assert.ok(!els['rating-version'].children.some(x=>x.value==='quality'));
});
test('experimental adjustments must reconcile against exactly the same published roster data',async()=>{
 const els=await render({qualityMismatch:true});
 assert.match(els.status.textContent,/roster-informed preseason/);
 assert.ok(!els['rating-version'].children.some(x=>x.value==='quality'));
});
test('experimental research cannot display without its valid roster-informed comparison',async()=>{
 const els=await render({withRoster:false});
 assert.match(els.status.textContent,/carryover baseline/);
 assert.ok(!els['rating-version'].children.some(x=>x.value==='quality'));
});
test('newspaper includes contextual historical holdout evidence and the experimental disclaimer',()=>{
 const html=fs.readFileSync('ncaam-elo.html','utf8');
 assert.match(html,/id="elo-quality-comparison"/);
 assert.match(html,/id="elo-model-pill"/);
 assert.match(html,/1,596 unseen games/);
 assert.match(html,/not an official preseason ranking/);
 assert.match(html,/ncaam-2026-27-scoring-quality-shadow\.json/);
});
