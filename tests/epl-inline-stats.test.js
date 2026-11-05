const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../epl-inline-stats.js'),'utf8');
function harness(data){
 const handlers={},panel={innerHTML:'',setAttribute(){},removeAttribute(){}},points=[{},{}];let requests=0;
 const card={dataset:{eplFixture:'123'},querySelectorAll:()=>points};
 const details={open:true,dataset:{},matches:()=>true,closest:()=>card,querySelector:()=>panel};
 const rail={addEventListener:(name,handler)=>handlers[name]=handler,querySelectorAll:()=>[details]};
 let timer;
 const context={document:{getElementById:()=>rail,hidden:false},console,AbortSignal,setInterval:f=>timer=f,fetch:async()=>{requests++;return {ok:true,json:async()=>data}}};
 vm.runInNewContext(source,context);
 return {details,panel,points,open:()=>handlers.toggle({target:details}),timer:()=>timer(),requests:()=>requests};
}
const summary={header:{id:'123',competitions:[{status:{type:{state:'in',shortDetail:"65'"}},competitors:[{id:'1',homeAway:'home',score:'0',team:{displayName:'Home'}},{id:'2',homeAway:'away',score:'1',team:{displayName:'Away'}}]}]},boxscore:{teams:[{team:{id:'1'},statistics:[{name:'possessionPct',label:'Possession',displayValue:'51.6'}]},{team:{id:'2'},statistics:[{name:'possessionPct',label:'Possession',displayValue:'48.4'}]}]},keyEvents:[{clock:{displayValue:"32'"},text:'Verified goal'}],rosters:[]};
const settle=()=>new Promise(r=>setImmediate(r));
test('click opens inline sourced statistics and live cards poll only while open',async()=>{
 const h=harness(summary);assert.equal(h.requests(),0);h.open();await settle();
 assert.match(h.panel.innerHTML,/48.4.*Possession.*51.6/);assert.match(h.panel.innerHTML,/Verified goal/);
 assert.ok(h.panel.innerHTML.indexOf('Away · Away')<h.panel.innerHTML.indexOf('Home · Home'));
 assert.deepEqual(h.points.map(p=>p.textContent),['1','0']);
 h.timer();await settle();assert.equal(h.requests(),2);h.details.open=false;h.timer();await settle();assert.equal(h.requests(),2);
});
test('incorrect fixture response displays retry instead of another match stats',async()=>{
 const h=harness({...summary,header:{...summary.header,id:'999'}});h.open();await settle();assert.match(h.panel.innerHTML,/Retry match stats/);assert.ok(!h.panel.innerHTML.includes('Verified goal'));
});
