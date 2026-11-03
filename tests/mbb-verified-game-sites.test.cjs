/* Source-certified game sites must never be inferred from a school's home arena. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const slate=require('../ncaam-slate.js');
const sites=read('data/mbb-verified-game-sites-2026-27.json');
const live=read('data/mbb-live.json');
const cross=read('data/ncaam-2026-27-espn-team-crosswalk.json');
const forecast=read('data/ncaam-2026-27-upcoming-forecasts.json');
const entries=Object.entries(sites.games||{});
assert.equal(sites.season,'2026-27');
assert(entries.length>=12,'a verified neutral-site record disappeared');
const validSource=source=>{try{return new URL(source).protocol==='https:';}catch{return false;}};
for(const [id,proof] of entries){
 assert(Number.isSafeInteger(Number(id)),id+' invalid game ID');
 assert.equal(proof.date.length,10,id+' invalid day');
 assert(proof.away_id&&proof.home_id&&proof.away_id!==proof.home_id,id+' missing team identities');
 assert.equal(proof.neutral,true,id+' cannot be certified as neutral without proof');
 assert.equal(proof.site_verified,true,id+' must be explicitly certified');
 assert(proof.venue&&proof.city&&proof.state,id+' lacks an actual venue');
 assert(validSource(proof.source),id+' lacks official HTTPS provenance');
}
const normalized=slate.normalizeMen(live,forecast,cross,sites);
let currentlyMatched=0;
for(const [id,proof] of entries){
 const game=live.games.find(g=>String(g.id)===id);
 if(!game)continue; // Old games legitimately leave a rolling live feed.
 currentlyMatched++;
 assert.equal(String(game.teams[0]?.id),String(proof.away_id),id+' away mismatch');
 assert.equal(String(game.teams[1]?.id),String(proof.home_id),id+' home mismatch');
 const shown=normalized.find(g=>g.id===id);
 assert(shown,id+' missing after normalizer');
 assert.equal(shown.neutral,true,id+' neutral status');
 assert.equal(shown.venue,proof.venue,id+' actual court');
 assert.equal(shown.venueCity,[proof.city,proof.state].join(', '),id+' city/state');
 assert.equal(shown.siteSource,proof.source,id+' source attribution');
}
const miami=sites.games['401906769'];
assert(miami&&miami.venue==='Benchmark International Arena');
const sample={games:[{id:'401906769',date:'2026-11-02T23:00Z',state:'post',
 teams:[{id:'2390',name:'Miami Hurricanes',score:67},{id:'57',name:'Florida Gators',score:77}]}]};
const empty={games:[]};
const good=slate.normalizeMen(sample,empty,cross,sites)[0];
assert(good.neutral&&good.venue==='Benchmark International Arena');
assert.equal(good.away.score,67);assert.equal(good.home.score,77);
// A neutral match may not inherit a home-advantage forecast made without
// a sourced neutral-court correction; leave the probability unpublished.
const incoming={games:[{...sample.games[0],state:'pre',teams:sample.games[0].teams.map(t=>({...t,score:''}))}]};
const sched={games:[{id:'espn:401906769',date:'2026-11-02',
 away_id:'ncaa:609667',home_id:'ncaa:609734',home_win_probability:.83}]};
const unproven=slate.normalizeMen(incoming,sched,cross,{games:[]})[0];
assert.equal(unproven.probability,.83,'fixture forecast setup should be valid');
const neutralForecast=slate.normalizeMen(incoming,sched,cross,sites)[0];
assert.equal(neutralForecast.neutral,true);
assert.equal(neutralForecast.probability,null,'neutral-site probability requires a neutral model');
for(const changed of [{...miami,home_id:'9999'},{...miami,date:'2026-11-03'},
                       {...miami,site_verified:false},{...miami,source:'unverified'}]){
 const invalid=slate.normalizeMen(sample,empty,cross,{games:{'401906769':changed}})[0];
 assert(!invalid.venue&&!invalid.siteSource&&!invalid.neutral,
        'unverified/mismatched evidence must not replace actual game metadata');
}
const js=fs.readFileSync('ncaam-slate.js','utf8');
const court=fs.readFileSync('cbb-live-center.js','utf8');
assert(!js.includes('HOME ARENA: '),'no game page home-arena fallback permitted');
assert(js.includes('certifiedSite(g,sites)'));
assert(court.includes('certifiedGameSite(g,day)'));
console.log('PASS official venue audit: '+entries.length+' certified, '+currentlyMatched+
 ' match current scoreboard, '+(live.games.length-currentlyMatched)+' current games require verification');
