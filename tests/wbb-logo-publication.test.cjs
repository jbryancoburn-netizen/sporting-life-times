'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('actual publisher removes generic logo decoration from women’s and men’s owned badges',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ncaa-crest-publish-'));
 try{
  fs.mkdirSync(path.join(tmp,'scripts'));
  for(const f of fs.readdirSync('.').filter(f=>f.endsWith('.html')))fs.copyFileSync(f,path.join(tmp,f));
  fs.copyFileSync('scripts/inject-team-crests.py',path.join(tmp,'scripts/inject-team-crests.py'));
  for(const f of ['shared-team-crests.css','shared-team-crests.js','site-tab-icons.js'])fs.copyFileSync(f,path.join(tmp,f));
  const generic='<link rel="stylesheet" href="shared-team-crests.css?v=old"><script src="shared-team-crests.js?v=old" defer></script>';
  for(const name of ['ncaaw-team.html','ncaam-team.html','future-women-desk.html'])fs.writeFileSync(path.join(tmp,name),'<html><head><script src="mbb-logo-system.js?v=test"></script>'+generic+'</head><body><span class="mbb-mark"><img></span></body></html>');
  fs.writeFileSync(path.join(tmp,'other-sport.html'),'<html><head></head><body>Other sports desk</body></html>');
  for(const args of [[],['--check']]){const run=spawnSync('python',[path.join(tmp,'scripts/inject-team-crests.py'),...args],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);}
  for(const name of ['ncaaw-team.html','ncaam-team.html','future-women-desk.html']){const html=fs.readFileSync(path.join(tmp,name),'utf8');assert(!html.includes('shared-team-crests'),name+' received duplicate crest decorator');assert(html.includes('mbb-logo-system.js'));}
  assert(fs.readFileSync(path.join(tmp,'other-sport.html'),'utf8').includes('shared-team-crests.js'),'Other sports keep their own decorator');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
