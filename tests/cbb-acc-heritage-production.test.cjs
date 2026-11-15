'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const manifest=json('data/cbb-acc-1980s-source-manifest.json'),cross=json('data/ncaam-2026-27-espn-team-crosswalk.json'),women=json('data/ncaaw-2026-27-teams.json');
test('all 18 original-era ACC crests publish locally for both genders with exact IDs',async()=>{
 const data={
 'data/mbb-logo-registry.json':json('data/mbb-logo-registry.json'),
 'data/ncaam-2026-27-espn-team-crosswalk.json':cross,
 'data/dual-ring-team-palette.json':json('data/dual-ring-team-palette.json'),
 'data/mbb-out-of-division-opponent-logos.json':json('data/mbb-out-of-division-opponent-logos.json')
 };
 const w={location:{pathname:'/ncaam-team.html',search:''}};
 const ctx={window:w,document:{readyState:'loading',documentElement:null,addEventListener(){}},
 fetch:async p=>({ok:true,json:async()=>data[String(p).split('?')[0]]}),
 URL,URLSearchParams,console,HTMLImageElement:class{},MutationObserver:class{observe(){}}};
 vm.runInNewContext(read('mbb-logo-system.js'),ctx,{filename:'mbb-logo-system.js'});
 assert.equal(await w.MBBLogos.ready,true);
 assert.equal(manifest.schools.length,18);
 assert.deepEqual(Array.from(w.MBBLogos.heritageACCTeamIds()).sort(),manifest.schools.map(s=>String(s.espn_id)).sort());
 for(const s of manifest.schools){
  const id=String(s.espn_id),row=cross.teams.find(t=>String(t.espn_id)===id),
   lady=women.teams.find(t=>String(t.team_id)===id),url='assets/cbb-embossed-crests/'+id+'.png?v=20261115-retro1';
  assert(row&&lady,'Both division-I gender IDs: '+s.name);
  assert(s.archive_url.startsWith('https://')&&s.local_sha256);
  const bytes=fs.readFileSync(path.join(root,s.local_path));
  assert(bytes.length>3000&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);
  assert(s.geometry.gap_to_238px_ring>=20,'Clear both rings '+s.slug);
  for(const html of [w.MBBLogos.byESPN(id,'score',lady.team),w.MBBLogos.byNCAA(row.id,'hero',row.name)]){
   assert(html.includes('src="'+url+'"'));assert(html.includes('mbb-mark--heritage'));
   assert(html.includes('mbb-mark--precomposed'),'The site must use the locally baked rings');
   assert(html.includes('data-ring-count="2"'));assert(html.includes('data-espn-id="'+id+'"'));
   assert(!html.includes('data-logo-alternate="https://'),'No third-party fallback');
  }
  assert.equal(w.MBBLogos.logoURL(row.id),url);
 }
});
test('all 14 CBB readers use new renderer without per-team CSS patches',()=>{
 const pages=['college-basketball.html','ncaam.html','ncaam-slate.html','ncaam-team.html','ncaaw-team.html',
 'ncaam-rankings.html','ncaaw-rankings.html','ncaam-conference.html','ncaaw-conference.html',
 'ncaam-elo.html','ncaam-tournament.html','live-game.html','cbb-gamefile.html','cbb-game-center.html'];
 for(const p of pages){
  const html=read(p);
  if(p==='ncaaw-rankings.html'){
    assert(html.includes("location.replace(")&&html.includes("ncaam-rankings.html"),'The women ranking redirect must resolve to the shared reader');
  }else{
    assert(html.includes('mbb-logo-system.js?v=cbb-retro-20261115-v1'),p);
    assert(html.includes('mbb-logo-system.css?v=cbb-retro-20261115-v1'),p);
  }
 }
 assert(read('wbb-rankings.js').includes('assets/cbb-embossed-crests/'));
 assert(read('ncaam-rankings.html').includes('assets/cbb-embossed-crests/'));
 assert(read('mbb-logo-system.css').includes('mbb-mark--precomposed::before'));
 assert(!read('mbb-logo-system.css').includes('mbb-mark--heritage[data-espn-id='));
});
