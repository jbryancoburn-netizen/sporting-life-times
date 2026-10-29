/* Runtime smoke tests for the three-league basketball newspaper.
 * Prevent data-renderer errors from silently replacing standings and scores
 * with an empty/\"unavailable\" screen.  No browser or network dependency. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'pb-professional-edition.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'nba.html'),'utf8');
const nba=fs.readFileSync(path.join(root,'nba-newspaper.js'),'utf8');
const toggle=fs.readFileSync(path.join(root,'pb-league-switch.js'),'utf8');
const css=fs.readFileSync(path.join(root,'pb-league-switch.css'),'utf8');
const makeNode=()=>({innerHTML:'',textContent:'',dataset:{},setAttribute(k,v){this[k]=v;}});
async function render(league,view='home'){
 const nodes=new Map();
 const selectors=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);};
 const query=s=>{if(!selectors.has(s))selectors.set(s,makeNode());return selectors.get(s);};
 const document={body:{dataset:{}},getElementById:get,querySelector:query};
 const files=[];
 const fetch=async(p)=>{
  const f=p.split('?')[0];files.push(f);
  const pathname=path.resolve(root,f);
  assert.ok(pathname.startsWith(root+path.sep),'source path stays inside site');
  const value=JSON.parse(fs.readFileSync(pathname,'utf8'));
  return {ok:true,json:async()=>value};
 };
 const ctx={location:{pathname:'/sporting-life-times/nba.html',search:'?league='+league+'&view='+view,href:'https://example.test/sporting-life-times/nba.html?league='+league},URL,URLSearchParams,AbortSignal,fetch,document,console,setTimeout,clearTimeout};
 vm.runInNewContext(script,ctx,{filename:'pb-professional-edition.js',timeout:1500});
 for(let i=0;i<12;i++){await new Promise(resolve=>setImmediate(resolve));if(get('app').innerHTML.includes('pb-shared-hero')||get('app').innerHTML.includes('Unable to load source-backed data'))break;}
 return {html:get('app').innerHTML,requested:files,document};
}
test('league switcher has each league and preserves the independent data source choice',()=>{
 assert.match(hub,/pb-league-switch\.js/);
 assert.match(hub,/pb-professional-edition\.js/);
 assert.match(toggle,/nba\.html\?league=/);
 assert.match(toggle,/aria-label="Switch to /);
 assert.match(css,/object-fit:contain/);
 assert.doesNotMatch(script,/clubMap=new Map/);
 assert.match(script,/teamMap=new Map/);
});
for(const league of ['euroleague','nbl']){
 for(const view of ['home','standings','rankings','games','players','matchups','playoffs','teams']){
  test(league+' '+view+' loads its own data and renders usable content',async()=>{
   const {html,requested,document}=await render(league,view);
   assert.ok(html.includes('pb-shared-hero'),league+' '+view+' failed to show its league hero: '+html.slice(0,350));
   assert.ok(!html.includes('Unable to load source-backed data'),league+' '+view+' displayed fallback');
   assert.match(html,/USRS|Elo|Game|club|Standings|title|Data|Source|results|performances|information|source/i);
   assert.equal(document.body.dataset.proLeague,league);
   assert.ok(requested.includes(league==='euroleague'?'data/euroleague-model.json':'data/nbl-standings.json'));
   assert.ok(!requested.includes(league==='euroleague'?'data/nbl-elo-research.json':'data/euroleague-model.json'));
   if(view==='home'||view==='standings'||view==='rankings'||view==='teams'){
    assert.ok(html.includes('pb-club-crest'),league+' '+view+' no teams rendered');
   }
   if(view==='home'){
    assert.ok(html.includes('pb-score-card'),league+' home has no scores');
    assert.ok(html.includes('rank-row'),league+' home has no Elo ranking rows');
   }
  });
 }
}
