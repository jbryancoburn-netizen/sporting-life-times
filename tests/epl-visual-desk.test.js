const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
async function render(ratings,forecast){
 const nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id)},querySelector(selector){return this.getElementById(selector.slice(1))}};
 const errors=[];
 const context={document,window:{},console:{error(...args){errors.push(args)}},fetch:async url=>({ok:true,json:async()=>url.includes('epl-ratings')?ratings:forecast})};
 vm.createContext(context);
 for(const file of ['cbb-ledger-scorebug.js','epl-visual-desk.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,errors};
}
test('forecast-only exports render verified finals, all clubs and reconciled identities',async()=>{
 const r=read('data/epl-ratings.json'),f=read('data/epl-match-center.json');
 delete f.recent_results;
 const {nodes,errors}=await render(r,f);
 assert.equal(errors.length,0);
 assert.equal(nodes.get('epl-pulse-finals').textContent,String(r.completed_matches));
 assert.equal((nodes.get('epl-power-board').innerHTML.match(/class="epl-register-row epl-power-row"/g)||[]).length,20);
 assert.equal((nodes.get('epl-club-directory').innerHTML.match(/class="slt-club-link"/g)||[]).length,20);
 assert.equal((nodes.get('epl-table-board').innerHTML.match(/class="epl-register-row"/g)||[]).length,20);
 const rail=nodes.get('epl-score-rail').innerHTML;
 assert.equal((rail.match(/data-phase="final"/g)||[]).length,6);
 const last=[...r.season_results].sort((a,b)=>Date.parse(b.kickoff_utc)-Date.parse(a.kickoff_utc))[0];
 assert.ok(rail.includes(last.fixture_id));
 const finalCard=rail.slice(rail.indexOf('data-epl-fixture="'+last.fixture_id+'"'));
 assert.ok(finalCard.indexOf(last.away)<finalCard.indexOf(last.home));
 assert.ok(!rail.includes('Record unavailable'));
});
test('legacy result snapshots remain supported',async()=>{
 const r=read('data/epl-ratings.json'),f=read('data/epl-match-center.json');
 f.recent_results=r.season_results.slice(-18).reverse();delete r.season_results;
 const {errors}=await render(r,f);assert.equal(errors.length,0);
});
test('missing verified results fail closed',async()=>{
 const r=read('data/epl-ratings.json'),f=read('data/epl-match-center.json');
 delete r.season_results;delete f.recent_results;
 const {nodes,errors}=await render(r,f);assert.equal(errors.length,1);
 assert.match(nodes.get('epl-visual-desk').innerHTML,/unavailable/);
});
