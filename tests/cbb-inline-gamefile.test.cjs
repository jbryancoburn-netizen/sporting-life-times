/* Native Gamefile data and rendering contracts: no embeds, no invented statistics. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const inline=require('../cbb-inline-gamefile.js');
const game={
  id:'401999999',day:'2026-11-03',phase:'final',kind:'regular',status:'Final',
  away:{id:'120',name:'Example State',score:75},
  home:{id:'150',name:'Example College',score:70},
  venue:'Example Arena',broadcast:''
};
function summary(){
  return {header:{competitions:[{competitors:[
    {homeAway:'away',team:{id:'120'},score:{value:75},linescores:[{value:35},{value:40}]},
    {homeAway:'home',team:{id:'150'},score:{value:70},linescores:[{value:30},{value:40}]}
  ]}]},
  boxscore:{teams:[
    {team:{id:'120'},statistics:[{name:'rebounds',label:'Rebounds',displayValue:'40'}]},
    {team:{id:'150'},statistics:[{name:'rebounds',label:'Rebounds',displayValue:'34'}]}
  ],players:[
    {team:{id:'120'},statistics:[{name:'statistical',labels:['MIN','PTS'],athletes:[
      {athlete:{displayName:'Player Example'},stats:['33','27']}
    ]}]},
    {team:{id:'150'},statistics:[{name:'statistical',labels:['MIN','PTS'],athletes:[
      {athlete:{displayName:'Other Example'},stats:['30','18']}
    ]}]}
  ]}
  };
}
test('provider summary must match both schools and verified final scores',()=>{
  const ok=summary();
  assert.equal(inline.checkedSummary(ok,game),ok);
  const other=summary();other.header.competitions[0].competitors[1].team.id='151';
  assert.equal(inline.checkedSummary(other,game),null);
  const wrongScore=summary();wrongScore.header.competitions[0].competitors[1].score.value=73;
  assert.equal(inline.checkedSummary(wrongScore,game),null);
});
test('only exact game, day, gender, final and total can certify NCAA boxes',()=>{
  const box={espn_id:game.id,gender:'men',day:game.day,
    away:{pts:75,reb:40},home:{pts:70,reb:34},source_url:'https://www.ncaa.com/game'};
  const feed={ncaa_team_boxscores:{games:{one:box}}};
  assert.equal(inline.checkedBox(game,feed,false,'ncaa_team_boxscores'),box);
  assert.equal(inline.checkedBox(game,feed,true,'ncaa_team_boxscores'),null);
  assert.equal(inline.checkedBox({...game,id:'different'},feed,false,'ncaa_team_boxscores'),null);
  assert.equal(inline.checkedBox({...game,home:{...game.home,score:71}},feed,false,'ncaa_team_boxscores'),null);
});
test('expanded Gamefile renders period halves, source-marked statistics and player rows',()=>{
  const html=inline.renderHTML(game,summary(),{},false,'m-2026-11-03-401999999');
  assert.match(html,/H1/);assert.match(html,/H2/);assert.match(html,/75/);
  assert.match(html,/Rebounds/);assert.match(html,/Player Example/);
  assert.match(html,/data-inline-panel="plays"/);
  assert.doesNotMatch(html,/<iframe|<object|<embed/i);
});
test('women have quarters and overtime, not men’s halves',()=>{
  const women={...game};
  const raw=summary();
  raw.header.competitions[0].competitors.forEach(c=>{c.linescores=[{value:15},{value:17},{value:18},{value:20},{value:5}];});
  const html=inline.renderHTML(women,raw,{},true,'w-2026-11-03-401999999');
  for(const p of ['Q1','Q2','Q3','Q4','OT 1'])assert.match(html,new RegExp(p));
});
test('complete play log uses all source reported events, not just recent twelve',()=>{
  const prior=global.SLTCourt;
  try{
    global.SLTCourt={parsePlays:()=>Array.from({length:17},(_,i)=>({
      id:String(i),period:1,clock:'12:00',text:'Sourced event '+i,awayScore:i,homeScore:i
    })),gameFlow:()=>'<svg aria-label="Sourced game flow"></svg>'};
    const html=inline.renderHTML(game,summary(),{},false,'m-2026-11-03-401999999');
    assert.match(html,/17 source-reported events/);
    assert.match(html,/Sourced event 16/);assert.match(html,/Sourced event 0/);
    assert.match(html,/Sourced game flow/);
  }finally{global.SLTCourt=prior;}
});
test('Daily Ledger integration contains no iframe and loads one native owner',()=>{
  const js=fs.readFileSync(path.join(root,'ncaam-slate.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'ncaam-slate.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'cbb-ledger-scorecard.css'),'utf8');
  assert.doesNotMatch(js,/createElement\(['"]iframe['"]\)/);
  assert.doesNotMatch(js,/data-gamefile=/);
  assert.doesNotMatch(css,/sl-inline-frame/);
  assert.match(js,/SLTInlineGamefile\.mount/);
  assert.match(html,/cbb-inline-gamefile.js/);
  assert.match(html,/cbb-live-court.js/);
});
