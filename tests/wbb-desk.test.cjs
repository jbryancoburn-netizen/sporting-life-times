'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('college-basketball-gender.js','utf8');
const read=(path)=>JSON.parse(fs.readFileSync(path,'utf8'));
const easternDay=()=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
};
const injectedId='499999999';
const injectedFinal=()=>{
  const date=easternDay()+'T17:00:00Z';
  return {id:injectedId,date,home_id:'222',away_id:'87',
    status:'final',completed:true,home_score:75,away_score:99,
    home_name:'Villanova Wildcats',away_name:'Notre Dame Fighting Irish',
    source:'Published verified final',venue:'Test University Arena'};
};
const scoreboard=(state,home,away)=>{
  const game=injectedFinal();
  return {id:game.id,date:game.date,status:{type:{state,shortDetail:'Live'}},
    competitions:[{neutralSite:false,competitors:[
      {homeAway:'home',id:game.home_id,score:String(home),
       team:{displayName:'Villanova Wildcats'}},
      {homeAway:'away',id:game.away_id,score:String(away),
       team:{displayName:'Notre Dame Fighting Irish'}}
    ]}]};
};

async function open({corrupt=false,addFinal=false,live=null}={}){
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',href:'',
      listeners:{},addEventListener(k,f){this.listeners[k]=f;},setAttribute(){},
      insertAdjacentElement(){},parentNode:{insertBefore(){}}});
    return nodes.get(id);
  }
  const document={body:{dataset:{}},title:'',
    querySelector:node,getElementById:node,createElement:()=>node('toggle')};
  const window={
    MBBLogos:{ready:Promise.resolve(true),
      byESPN:(id,size,name)=>'<i data-team="'+id+'">'+name+'</i>',
      colorForESPN:()=>({primary:'#385866',secondary:'#597582'})},
    SLTSportsScorebug:{render:({phase,away,home})=>
      '<div data-phase="'+phase+'">'+away.name+' '+(away.score??'')+
      ' @ '+home.name+' '+(home.score??'')+'</div>'}
  };
  const context={document,window,location:{search:'?gender=women',pathname:'/ncaam.html'},
    URLSearchParams,URL,AbortSignal,Date,Map,Set,Number,String,encodeURIComponent,
    setInterval(){},fetch:async url=>{
      if(live&&url.startsWith('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard'))
        return {ok:true,json:async()=>({events:[live]})};
      if(!url.startsWith('data/')&&url!=='articles.json')return {ok:false};
      let data=read(url);
      if(corrupt&&url==='data/ncaaw-2026-27-retro-primary.json')data.gender='men';
      if(addFinal&&url==='data/ncaaw-2026-27-games.json'){
        data.finals=[...(data.finals||[]),injectedFinal()];
      }
      return {ok:true,json:async()=>data};
    }};
  vm.runInNewContext(source,context);
  for(let i=0;i<25;i++)await new Promise(setImmediate);
  return {node,document};
}

test('the women-only edition publishes 363 programs and its actual distinct season fixture count',async()=>{
  const {node}=await open();
  const master=read('data/ncaaw-schedules-2026-27.json');
  const ledger=read('data/ncaaw-2026-27-games.json');
  const ids=new Set();
  for(const team of Object.values(master.teams))for(const g of team.games||[])ids.add(String(g.id));
  for(const g of [...ledger.finals||[],...ledger.upcoming||[]])ids.add(String(g.id));
  assert.equal(Object.keys(master.teams).length,363);
  const summary=node('wbb-summary').innerHTML;
  assert.match(summary,/363 <small>programs/);
  assert.ok(ids.size>5000,'Season fixture source unexpectedly incomplete');
  assert.ok(summary.includes(ids.size.toLocaleString('en-US')+' <small>season games'),
    'Published women’s game count does not match current unique fixture IDs');
  assert.equal((node('wbb-directory-list').innerHTML.match(/class="rank-row(?: wbb-unplayed-row)?"/g)||[]).length,363);
  assert.match(node('wbb-powerboard').innerHTML,/rank-row|ELO 1500/);
});

test('wrong-gender rating data cannot enter the women’s edition',async()=>{
  const {node}=await open({corrupt:true});
  assert.match(node('data-stamp').textContent,/rating registry failed validation/);
  assert.equal(node('wbb-directory-list').innerHTML,'');
  assert.equal(node('wbb-recent').innerHTML,'');
});

test('the current women’s directory searches school names and links to the correct school',async()=>{
  const {node}=await open();
  node('wbb-team-search').value='Indiana Hoosiers';
  assert.equal(typeof node('wbb-team-search').listeners.input,'function');
  node('wbb-team-search').listeners.input();
  const html=node('wbb-directory-list').innerHTML;
  assert.equal((html.match(/class="rank-row(?: wbb-unplayed-row)?"/g)||[]).length,1);
  assert.match(html,/ncaaw-team.html\?team=84/);
});

test('conference selection shows women-only standings with valid team links',async()=>{
  const {node}=await open();
  node('wbb-conference-select').value='Big Ten Conference';
  assert.equal(typeof node('wbb-conference-select').listeners.change,'function');
  node('wbb-conference-select').listeners.change();
  assert.match(node('wbb-conference-list').innerHTML,/Indiana Hoosiers/);
  assert.match(node('wbb-conference-list').innerHTML,/wbb-standings-table/);
  assert.match(node('wbb-open-conference').href,/ncaaw-conference.html\?conference=Big%20Ten%20Conference/);
});

test('the women’s front page links to the women-only Game Center and final game files',async()=>{
  const {node}=await open({addFinal:true});
  assert.match(node('header .nav').innerHTML,/cbb-game-center.html\?gender=women/);
  const html=node('wbb-recent').innerHTML;
  assert.match(html,new RegExp('cbb-gamefile.html\\?gender=women&amp;day='+easternDay()+'&amp;game='+injectedId));
  assert.match(html,/Notre Dame Fighting Irish/);
  assert.doesNotMatch(html,/cbb-gamefile.html\?gender=men/);
});

test('a stale provider live snapshot cannot downgrade a published women’s final',async()=>{
  const {node}=await open({addFinal:true,live:scoreboard('in',75,98)});
  const html=node('wbb-recent').innerHTML;
  assert.match(html,new RegExp('game='+injectedId));
  assert.match(html,/data-phase="final"/);
  assert.match(html,/Notre Dame Fighting Irish 99/);
  assert.doesNotMatch(html,/data-phase="live"/);
});

test('a provider final conflicting with verified women’s scores is withheld, not published',async()=>{
  const {node}=await open({addFinal:true,live:scoreboard('post',75,98)});
  const html=node('wbb-recent').innerHTML;
  assert.doesNotMatch(html,new RegExp('game='+injectedId),
    'Conflicting final must not appear as a certified result');
  assert.doesNotMatch(html,/Notre Dame Fighting Irish 98/,
    'Unverified provider score must not appear as an accepted result');
});

test('the RETRO Power Board excludes baseline-only teams when finals exist',async()=>{
  const {node}=await open();
  const note=node('wbb-rating-note').textContent;
  assert.match(note,/PROVISIONAL/);
  assert.match(note,/programs played/);
  const rankings=read('data/ncaaw-2026-27-retro-primary.json').rankings;
  const top=rankings.filter(t=>(Number(t.wins)||0)+(Number(t.losses)||0)>0).slice(0,25);
  const html=node('wbb-powerboard').innerHTML;
  for(const t of top)assert.ok(html.includes(t.team),
    'A verified top-25 team is missing from women’s RETRO Power Board: '+t.team);
  assert.doesNotMatch(html,/Not yet played · baseline 1500/,
    'Baseline-only programs must not be displayed as ranked active teams');
});
