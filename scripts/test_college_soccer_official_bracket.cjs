#!/usr/bin/env node
'use strict';
// Execute the actual bracket-row code against confirmed Big Ten and A-10 fixtures.
// This catches [team,index] / [index,team] inversion that made known clubs display
// as 'To be determined' with incorrect generic crests and away scores on both rows.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const js=fs.readFileSync('college-soccer-conference-page.js','utf8');
const loopStart='for(const [index,team] of names.entries()){';
const end='label.append(cell)}card.append(label);';
const from=js.indexOf(loopStart),to=js.indexOf(end,from);
assert(from>=0&&to>from,'Official bracket team-row renderer changed or index/team values reversed');
assert(!js.includes('for(const [team,index] of names.entries())'),'Broken team/index ordering reintroduced');
const code=js.slice(from,to+'label.append(cell)}'.length);
const E=(tag,value,cls)=>({
  tag,text:value===undefined||value===null?'':String(value),css:cls||'',
  children:[],classList:{values:new Set(),add(x){this.values.add(x);}},
  append(...nodes){this.children.push(...nodes);}
});
const A=(name,url)=>({kind:'link',name,url});
const logoCalls=[];
const cup={school(name,id,cohort){
  assert.equal(typeof name,'string','School name missing (generic U crest regression)');
  assert.equal(typeof id,'string','School ID missing (generic U crest regression)');
  logoCalls.push(id);return {kind:'school',name,id,cohort};
}};
let matchCount=0;
for(const feed of [
 'data/college-soccer-men-d1-big-ten-standings.json',
 'data/college-soccer-men-d1-atlantic-10-standings.json',
 'data/college-soccer-men-d1-patriot-standings.json',
 'data/college-soccer-men-d1-mountain-west-standings.json',
 'data/college-soccer-men-d1-big-south-standings.json',
 'data/college-soccer-men-d1-big-west-standings.json',
 'data/college-soccer-men-d1-sun-belt-standings.json',
 'data/college-soccer-men-d1-acc-standings.json',
 'data/college-soccer-men-d1-big-east-standings.json',
 'data/college-soccer-men-d1-america-east-standings.json',
 'data/college-soccer-men-d1-american-standings.json',
 'data/college-soccer-men-d1-ivy-standings.json',
 'data/college-soccer-men-d1-wcc-standings.json',
 'data/college-soccer-men-d1-ovc-standings.json',
 'data/college-soccer-men-d1-mvc-standings.json',
 'data/college-soccer-men-d1-asun-standings.json',
 'data/college-soccer-men-d1-horizon-standings.json',
 'data/college-soccer-men-d1-caa-standings.json',
 'data/college-soccer-men-d1-nec-standings.json',
 'data/college-soccer-men-d1-socon-standings.json',
 'data/college-soccer-men-d1-summit-standings.json',
 'data/college-soccer-men-d1-maac-standings.json',
 'data/college-soccer-men-d1-pac-12-standings.json'
]){
 const data=JSON.parse(fs.readFileSync(feed,'utf8'));
 assert.equal(data.tournament_bracket.status,'official');
 const seeds=data.tournament_seeds;
 assert(Array.isArray(seeds)&&seeds.length>=4,'Missing official tournament seeds: '+feed);
 assert.equal(new Set(seeds).size,seeds.length,'Duplicate seeds: '+feed);
 const tournamentSeedByTeam=new Map(seeds.map((id,i)=>[id,i+1]));
 const schools=new Map(data.rows.map(t=>[t.team_id,{id:t.team_id,name:t.team_id.replaceAll('-',' ')}]));
 const officialRegionalSeedLabels=data.tournament_seed_labels||{};
 for(const match of data.tournament_bracket.matches){
  if(!match.home_id||!match.away_id){
   assert.equal(match.status,'scheduled','A TBD final must not be scored');
   continue;
  }
  const names=[schools.get(match.home_id),schools.get(match.away_id)];
  assert(names.every(Boolean),'Fixture references an unknown school: '+feed);
  const label={children:[],append(node){this.children.push(node);}};
  vm.runInNewContext(code,{names,match,cfg:{cohort:'men-d1'},branding:{},E,A,cup,label,tournamentSeedByTeam,tournamentSeedsVerified:true,officialRegionalSeedLabels});
  assert.equal(label.children.length,2,'Each match must render two clubs');
  for(const [i,id] of [match.home_id,match.away_id].entries()){
   const row=label.children[i];
   assert.equal(row.css,'cs-official-team');
   assert(tournamentSeedByTeam.has(id),'Official match team lacks a seed: '+id+' / '+feed);
   assert(row.children[0].css.split(' ').includes('cs-tournament-seed'),'Tournament seed not beside team');
   assert.equal(row.children[0].text,officialRegionalSeedLabels[id]||'#'+tournamentSeedByTeam.get(id),'Wrong permanent official conference seed');
   assert.equal(row.children[1].kind,'school','Known club cannot render as TBD');
   assert.equal(row.children[1].id,id,'Wrong crest/team mapped to matchup row');
   assert.equal(row.children[1].name,schools.get(id).name,'Wrong name attached to team');
   const scores=row.children.filter(x=>x.css==='cs-official-score');
   if(match.status==='final'){
    assert.equal(scores.length,1,'Played game must have goals on both rows');
    assert.equal(scores[0].text,String(i===0?match.home_score:match.away_score),
      'Home/away scoreboard swapped');
   }else assert.equal(scores.length,0,'Unplayed match must have no invented score');
   assert.equal(row.classList.values.has('cs-official-winner'),
     match.status==='final'&&id===match.winner_id,
     'Only verified winner may receive advancement highlight');
  }
  matchCount++;
 }
}
assert(matchCount>=85,'Expected certified tournament fixtures across all 23 conferences');
assert.equal(logoCalls.length,matchCount*2,'Every participating club must get its correct crest');
console.log('PASS: '+matchCount+' fixtures across all 23 official tournaments, '+(2*matchCount)+' correct permanent conference seeds, logos, score sides and winner markers');
