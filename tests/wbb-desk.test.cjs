'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('college-basketball-gender.js','utf8');
async function open(corrupt=false,liveFixture=null){
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',listeners:{},addEventListener(k,f){this.listeners[k]=f;},setAttribute(){},insertAdjacentElement(){},parentNode:{insertBefore(){}}});return nodes.get(id);}
 const body={dataset:{}};
 const document={body,title:'',querySelector:s=>node(s),getElementById:node,createElement:()=>node('toggle')};
 const context={document,location:{search:'?gender=women',pathname:'/ncaam.html'},URLSearchParams,URL,AbortSignal,Date,Map,Set,Number,String,encodeURIComponent,setInterval(){},window:{MBBLogos:{ready:Promise.resolve(true),byESPN:(id,size,name)=>'<i data-team="'+id+'">'+name+'</i>'}},fetch:async url=>{
  if(liveFixture&&url.startsWith('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard'))return {ok:true,json:async()=>({events:[liveFixture]})};
  if(!url.startsWith('data/')&&url!=='articles.json')return {ok:false};
  const data=JSON.parse(fs.readFileSync(url,'utf8'));
  if(corrupt&&url.includes('retro-primary'))data.gender='men';
  return {ok:true,json:async()=>data};
 }};
 vm.runInNewContext(code,context);for(let i=0;i<20;i++)await new Promise(setImmediate);
 return {nodes,node,document};
}
test('women’s desk exposes all programs, complete season calendar and isolated ratings',async()=>{
 const {node}=await open();assert.match(node('wbb-summary').innerHTML,/5,782/);assert.equal((node('wbb-directory-list').innerHTML.match(/class="rank-row"/g)||[]).length,363);assert.match(node('wbb-powerboard').innerHTML,/ELO 1500|class="rank-row"/);
 node('wbb-team-search').value='Indiana Hoosiers';node('wbb-team-search').listeners.input();assert.equal((node('wbb-directory-list').innerHTML.match(/class="rank-row"/g)||[]).length,1);assert.match(node('wbb-directory-list').innerHTML,/ncaaw-team.html\?team=84/);
 node('wbb-date').listeners.change({target:{value:'2026-11-02'}});node('wbb-game-conf').value='Big Ten Conference';node('wbb-game-conf').listeners.change();const html=node('wbb-score-rail').innerHTML;assert.match(html,/Maryland Terrapins/);assert.match(html,/South Carolina Gamecocks/);assert.ok(html.indexOf('Maryland Terrapins')<html.indexOf('South Carolina Gamecocks'));assert.match(html,/61%/);assert.doesNotMatch(html,/Villanova Wildcats/);
 node('wbb-game-search').value='no such school';node('wbb-game-search').listeners.input();assert.match(node('wbb-score-rail').innerHTML,/No games match/);
});
test('a men’s or invalid registry cannot populate the women’s newspaper',async()=>{
 const {node}=await open(true);assert.match(node('wbb-score-stamp').textContent,/failed validation/);assert.equal(node('wbb-directory-list').innerHTML,'');assert.equal(node('wbb-score-rail').innerHTML,'');
});

test('verified university ESPN+ assignments display on women’s opening-day game cards',async()=>{
 const {node}=await open();
 node('wbb-game-conf').value='';
 node('wbb-game-conf').listeners.change();
 node('wbb-date').listeners.change({target:{value:'2026-11-02'}});
 const html=node('wbb-score-rail').innerHTML;
 assert.match(html,/MIT Engineers[\s\S]{0,1300}Bryant Bulldogs[\s\S]{0,1300}ESPN\+/);
 assert.match(html,/Dominican \(NY\) Chargers[\s\S]{0,1300}Iona Gaels[\s\S]{0,1300}ESPN\+/);
});

test('women’s front page links real fixtures to the women-only live Game Center',async()=>{
 const {node}=await open();
 assert.match(node('header .nav').innerHTML,/cbb-game-center.html\?gender=women/);
 node('wbb-date').listeners.change({target:{value:'2026-11-01'}});
 const html=node('wbb-score-rail').innerHTML;
 assert.match(html,/Gamecast &amp; box score/);
 assert.match(html,/cbb-gamefile.html\?gender=women&amp;day=2026-11-01&amp;game=401920983/);
 assert.doesNotMatch(html,/cbb-gamefile.html\?gender=men/);
});

const liveRome=(phase,homeScore,awayScore)=>({
 id:'401920983',date:'2026-11-01T17:00Z',
 status:{type:{state:phase,shortDetail:'Live'}},
 competitions:[{neutralSite:true,competitors:[
  {homeAway:'home',id:'222',score:String(homeScore),team:{displayName:'Villanova Wildcats'}},
  {homeAway:'away',id:'87',score:String(awayScore),team:{displayName:'Notre Dame Fighting Irish'}}
 ]}]
});
test('a stale ESPN live snapshot does not downgrade the published Notre Dame final',async()=>{
 const {node}=await open(false,liveRome('in',75,99));
 node('wbb-date').listeners.change({target:{value:'2026-11-01'}});
 const html=node('wbb-score-rail').innerHTML;
 assert.match(html,/Final · Nov 1/);
 assert.match(html,/Notre Dame Fighting Irish/);
 assert.doesNotMatch(html,/>Live ·/);
});
test('a new provider final that conflicts with published WBB final is withheld for review',async()=>{
 const {node}=await open(false,liveRome('post',75,98));
 node('wbb-date').listeners.change({target:{value:'2026-11-01'}});
 const html=node('wbb-score-rail').innerHTML;
 assert.match(html,/Source conflict · score withheld/);
 assert.match(html,/Published final \/ live scoreboard score conflict/);
});
