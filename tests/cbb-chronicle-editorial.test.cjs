'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('ncaam.html');
const css=read('cbb-chronicle.css');
const news=read('cbb-front-news.js');
const retro=read('cbb-chronicle-retro.js');
const nav=read('cbb-shared-navigation.js');

assert(html.indexOf('class="cbb-front-edition"')>0,'Front news section must exist');
assert(html.indexOf('class="cbb-front-edition"')<html.indexOf('id="chronicle-retro"'),'Top stories must precede RETRO');
assert(html.indexOf('id="chronicle-retro"')<html.indexOf('class="slt-edition-index"'),'RETRO and reporting must precede reference directory');
assert(html.includes('cbb-chronicle.css?v=')&&html.includes('cbb-chronicle-retro.js?v='),'One coherent new stylesheet and data view');
assert(!html.includes('<style>'),'No layered page-level CSS patches');
assert(html.includes('class="nav cbb-universal-nav chronicle-nav"'),'Retain shared navigation and gender routing');
assert(html.includes('class="chronicle-more"'),'Keep supplementary links in More');
assert(nav.includes("document.body.dataset.sltFront==='cbb'")&&nav.includes("'Chronicle':'ncaam.html?gender=women'"),'Use only front-page navigation override');
for(const file of ['indiana.png','minnesota.png','purdue.png','northwestern.png']){
  assert(fs.existsSync(path.join(root,'assets/cbb-big-ten-1980s/centered',file)),'Local authentic logo exists: '+file);
  assert(html.includes('assets/cbb-big-ten-1980s/centered/'+file),'Local archive logo is linked: '+file);
}
assert(!/<img[^>]+https?:\/\//.test(html),'No remotely hosted Chronicle images');
assert(css.includes('@media(max-width:700px)')&&css.includes('repeat(5,minmax(0,1fr))'),'Five mobile navigation destinations');
assert(css.includes('"Century Schoolbook"'),'Original newspaper body typography');
assert(retro.includes('data/ncaaw-2026-27-retro-primary.json')&&retro.includes('data/ncaam-2026-27-retro-primary.json'),'RETRO must be edition-specific');
assert(!retro.includes('Math.random')&&!retro.includes('a.espncdn.com'),'No invented or externally hotlinked statistics and logos');

async function newsEdition(gender){
  const now=Date.parse('2026-11-14T16:00:00Z');
  const timestamp=new Date(now-3600000).toISOString();
  const titles=[
    "UConn men's basketball stuns Duke in ranked upset",
    "Kansas men's basketball beats Missouri in rivalry game",
    "Illinois men's basketball defeats Southern Illinois",
    "Indiana men's basketball edges Rutgers in tight finish",
    "Texas men's basketball rises in national poll",
    "Minnesota men's basketball conference race heats up",
    "Purdue men's basketball coach discusses new starters"
  ];
  const articles=titles.map((title,i)=>({
    title,gender:'men',source:'Publisher '+i,gender_evidence:'explicit_title',
    url:'https://example.org/basketball/report-'+i,link_type:'publisher',published_at:timestamp,
    editorial_score:100-i
  }));
  articles.push({title:"UConn women's basketball defeats Georgetown",gender:'women',source:'Women's Publisher',
    gender_evidence:'explicit_title',url:'https://example.org/womens-basketball/uconn',link_type:'publisher',
    published_at:timestamp,editorial_score:100});
  const data={updated_at:new Date(now).toISOString(),articles};
  let output='',label='';
  const el={get innerHTML(){return output},set innerHTML(s){output=s}};
  const stamp={get textContent(){return label},set textContent(s){label=s}};
  class Clock extends Date{static now(){return now}}
  vm.runInNewContext(news,{
    Date:Clock,URL,URLSearchParams,AbortSignal,
    location:{search:'?gender='+gender},
    document:{getElementById:id=>id==='cbb-front-news'?el:stamp,addEventListener(){}},
    fetch:async()=>({ok:true,json:async()=>data}),
    setInterval(){},
  });
  await new Promise(setImmediate);
  assert.match(output,/class="cbb-news-grid"/,'News layout must render');
  assert.match(output,/The Lead Report/,'Lead story clearly marked');
  assert.match(label,/National wire updated/,'Preserve visible source freshness');
  if(gender==='men'){
    assert.match(output,/The National Desk/);
    assert.match(output,/Campus & Conference/);
    assert.match(output,/Players & Coaches/);
    assert(output.indexOf('stuns Duke')<output.indexOf('conference race'),'Important lead precedes department reports');
  }else{
    assert.match(output,/UConn women/);
    assert.doesNotMatch(output,/UConn men/);
  }
}
async function ratingEdition(gender){
  const now=Date.parse('2026-11-14T16:00:00Z');
  const women=gender==='women';
  const rankings=Array.from({length:women?363:365},(_,i)=>({
    team_id:women?String(i+1):'ncaa:'+String(i+10000),
    team:(women?'Women':'Men')+' Team '+(i+1),rank:i+1,elo:1750-i,
    daily_change:i%3===0?6:i%3===1?-3:1,conference:'Verified Conference',wins:3,losses:0,games_played:3
  }));
  const data={gender,model:'retro-clean-slate',as_of:'2026-11-13',rankings};
  let output='',target='';
  const node={get innerHTML(){return output},set innerHTML(s){output=s},querySelector(){return null}};
  const link={set href(v){target=v}};
  class Clock extends Date{static now(){return now}}
  vm.runInNewContext(retro,{
    Date:Clock,URLSearchParams,AbortSignal,
    location:{search:'?gender='+gender},
    document:{body:{dataset:{gender}},getElementById:id=>id==='chronicle-retro-panel'?node:link,
      querySelector:()=>null,addEventListener(){},hidden:false},
    fetch:async()=>({ok:true,json:async()=>data}),setInterval(){}
  });
  await new Promise(setImmediate);
  assert.match(output,new RegExp((women?'Women':'Men')+' Team 1'),'Edition-correct RETRO leader');
  assert.match(output,/Rating Movement/);
  assert.match(output,/2026-11-13/,'Source date is visible');
  assert.equal(target,women?'ncaaw-rankings.html?poll=retro':'ncaam-elo.html');
}
(async()=>{
 await newsEdition('men');
 await newsEdition('women');
 await ratingEdition('men');
 await ratingEdition('women');
 console.log('PASS Hardwood Chronicle: news hierarchy, three departments, source-backed RETRO, local archive crests, five-link navigation, and separate women/men editions');
})().catch(e=>{console.error(e);process.exitCode=1});
