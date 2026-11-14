'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const {normalizeMen,calculate,opponentLabel}=require('../cbb-team-form.js');

test('all 12 published certified 2026–27 neutral finals reconcile to the Form Book',()=>{
 const retro=read('data/ncaam-2026-27-retro-primary.json');
 const crosswalk=read('data/ncaam-2026-27-espn-team-crosswalk.json');
 const sites=read('data/mbb-verified-game-sites-2026-27.json');
 const certified=Object.entries(sites.games).filter(([,row])=>row.neutral===true&&row.site_verified===true);
 assert(certified.length>=12,'certified game site inventory dropped unexpectedly');
 const register=normalizeMen(retro,null,crosswalk,sites);
 const byId=new Map(register.games.map(g=>[g.id,g]));
 for(const [id,proof] of certified){
   const event=byId.get(id);
   assert(event,'certified game must be in published final results '+id);
   assert.equal(event.date,proof.date,'certified event date match '+id);
   assert.equal(event.neutral,true,'neutral court propagated '+id);
   assert.equal(event.siteVerified,true,'independent university certification propagated '+id);
 }
 const florida=crosswalk.teams.find(t=>String(t.espn_id)==='57');
 const floridaForm=calculate(String(florida.id),register);
 const miami=floridaForm.recent.find(g=>g.id==='401906769');
 assert(miami,'Florida vs Miami verified November 2 final should be in the Form Book');
 assert.match(opponentLabel(miami),/^vs\. .*\(N\)$/,'Florida-Miami should read vs. Miami (N)');
});
