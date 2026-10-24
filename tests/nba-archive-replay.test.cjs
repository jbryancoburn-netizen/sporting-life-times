const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {spawnSync}=require('node:child_process');
const root=join(__dirname,'..');
const read=p=>readFileSync(join(root,p),'utf8');
test('archived final survives scoreboard outage and repeated replay applies it exactly once',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nba-replay-'));
 try{
  mkdirSync(join(dir,'scripts'));mkdirSync(join(dir,'data'));
  writeFileSync(join(dir,'scripts/update-nba-elo.mjs'),read('scripts/update-nba-elo.mjs'));
  for(const file of ['nba-2026-27-preseason-provisional.json','nba-2026-27-current-provisional.json','nba-game-center.json'])writeFileSync(join(dir,'data',file),read('data/'+file));
  const target=join(dir,'data/nba-2026-27-current-provisional.json');
  const original=JSON.parse(readFileSync(target));
  const archived=new Set(JSON.parse(read('data/nba-game-center.json')).games.filter(g=>g.state==='post'&&g.players?.length).map(g=>g.id));
  const omitted=original.events.at(-1);assert.ok(archived.has(omitted.id));
  const partial={...original,events:original.events.slice(0,-1),games_played:original.games_played-1};
  writeFileSync(target,JSON.stringify(partial));
  writeFileSync(join(dir,'offline.mjs'),"globalThis.fetch=async()=>{throw Error('simulated scoreboard outage')};\n");
  const replay=()=>{
   const r=spawnSync(process.execPath,['--import',join(dir,'offline.mjs'),join(dir,'scripts/update-nba-elo.mjs')],{encoding:'utf8',timeout:15000});
   assert.equal(r.status,0,r.stderr);return readFileSync(target,'utf8');
  };
  const first=replay(),result=JSON.parse(first);
  assert.equal(result.games_played,original.games_played);
  assert.equal(result.events.filter(g=>g.id===omitted.id).length,1);
  assert.deepEqual(result.rankings,original.rankings);
  assert.equal(replay(),first,'Repeated outage replay must not change the ledger');
  const archivePath=join(dir,'data/nba-game-center.json');
  const conflicting=JSON.parse(readFileSync(archivePath));
  const changed=conflicting.games.find(g=>g.id===omitted.id);
  changed.teams.find(t=>t.home_away==='home').score+=1;
  writeFileSync(archivePath,JSON.stringify(conflicting));
  const rejected=spawnSync(process.execPath,['--import',join(dir,'offline.mjs'),join(dir,'scripts/update-nba-elo.mjs')],{encoding:'utf8',timeout:15000});
  assert.notEqual(rejected.status,0,'Conflicting archive must be rejected');
  assert.match(rejected.stderr,/Conflicting verified NBA final/);
  assert.equal(readFileSync(target,'utf8'),first,'Rejected inputs must leave the published ledger untouched');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
