const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('mbb-team-calendar-boot.js','utf8');
const team={id:'ncaa:609801',espn_id:'87',name:'Notre Dame',espn_name:'Notre Dame Fighting Irish'};
const foe={id:'ncaa:609509',espn_id:'222',name:'Villanova',espn_name:'Villanova Wildcats'};
const schedule={season:'2026-27',verified_from_school:true,
 source_url:'https://fightingirish.com/sports/mbball/schedule/',
 events:[{id:'school-87-2026-11-01-0',date:'2026-11-01T12:00:00-05:00',
 official_school_time:'9:30 AM ET',neutralSite:true,site_verified:true,
 competitions:[{competitors:[
 {homeAway:'away',team:{id:'87',displayName:'Notre Dame Fighting Irish'}},
 {homeAway:'home',team:{id:'222',displayName:'Villanova Wildcats'}}
 ],venue:{fullName:'Rome, Italy'},broadcasts:[]}]}]};
const final={id:'espn:401920982',date:'2026-11-01',home_id:foe.id,away_id:team.id,
 home_score:72,away_score:74,neutral:true,site_verified:true};
function ratings(events){
 return {season:'2026-27',model:'retro-clean-slate',starting_elo:1500,
  games_played:events.length,rankings:Array.from({length:365},(_,i)=>({team_id:'school-'+i,elo:1500})),events};
}
async function render(feed, fixture={}){
 const selectedTeam=fixture.team||team,selectedFoe=fixture.foe||foe;
 const selectedSchedule=fixture.schedule||schedule;
 const host={dataset:{},innerHTML:'',hidden:true,querySelector(s){return {
  value:s==='#calendar-view'?'all':'',addEventListener(){},textContent:''};},
  querySelectorAll(){return [];}};
 const document={title:'',getElementById:id=>id==='mbb-calendar-host'?host:null,
  querySelector:()=>({parentNode:{}}),createElement:()=>({}),head:{appendChild(){}}};
 const context={window:{MBBLogos:{ready:Promise.resolve(),
  byESPN:(id)=>'<span class="crest" data-logo-id="'+id+'">crest</span>'}},document,
  location:{search:'?team='+encodeURIComponent(selectedTeam.id)},
  fetch:async url=>({ok:true,json:async()=>url.includes('crosswalk')?{teams:[selectedTeam,selectedFoe]}:
   url.includes('retro-primary')?feed:
   url.includes('exhibition-finals')?(fixture.exhibitions||{season:'2026-27',retro_included:false,games:[]}):
   selectedSchedule}),
  URLSearchParams,Intl,Date,Map,Set,Number,Boolean,String,Promise,console,encodeURIComponent,setInterval:()=>0};
 vm.runInNewContext(source,context,{filename:'mbb-team-calendar-boot.js'});
 for(let i=0;i<100&&!host.dataset.scheduleLoaded;i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(host.dataset.scheduleLoaded,selectedTeam.id,'team schedule never rendered');
 return host.innerHTML;
}
(async()=>{
 const verified=await render(ratings([final]));
 assert.match(verified,/W 74–72/,'verified neutral final must supersede stale fixture');
 assert.match(verified,/data-calendar-state="final"/);
 assert.match(verified,/cbb-gamefile\.html\?day=2026-11-01&amp;game=401920982/);
 assert.match(verified,/Not announced/,'missing broadcast must not be invented');
 const mismatched=await render(ratings([{...final,home_id:'ncaa:other'}]));
 assert.doesNotMatch(mismatched,/W 74–72/,'never attach wrong opponent final');
 const conflicted=await render(ratings([final,{...final,home_score:70,id:'espn:401920983'}]));
 assert.doesNotMatch(conflicted,/W 74–72/,'conflicting scores must fail closed');
 const unverified=await render(ratings([{...final,site_verified:false}]));
 assert.match(unverified,/W 74–72/,'venue uncertainty must not erase an otherwise verified final score');
 // High Point played Liberty at 12:00 AM on Nov 2, though the source
 // ledger records an earlier day. Require a unique exact-ID midnight match.
 const highPoint={id:'ncaa:609608',espn_id:'2272',name:'High Point',espn_name:'High Point Panthers'};
 const liberty={id:'ncaa:609589',espn_id:'2335',name:'Liberty',espn_name:'Liberty Flames'};
 const midnightSchedule={season:'2026-27',verified_from_school:true,events:[{
  id:'school-2272-2026-11-02-15',date:'2026-11-02T12:00:00-05:00',
  name:'Liberty',official_school_time:'12:00 AM',site_verified:true,neutralSite:true,
  competitions:[{competitors:[
   {homeAway:'neutral',team:{id:'2272',displayName:'High Point Panthers'}},
   {homeAway:'neutral',team:{id:'2335',displayName:'Liberty Flames'}}
  ],venue:{fullName:'Rock Hill Sports & Events Center',arenaName:'Rock Hill Sports & Events Center'},
  broadcasts:[]}]}]};
 const hpFinal={id:'espn:401920409',date:'2026-11-01',home_id:highPoint.id,away_id:liberty.id,
  home_score:72,away_score:57,neutral:true,site_verified:false};
 const midnight=await render(ratings([hpFinal]),{team:highPoint,foe:liberty,schedule:midnightSchedule});
 assert.match(midnight,/Nov 2, 2026/);
 assert.match(midnight,/data-calendar-state="final"/);
 assert.match(midnight,/W 72–57/,'unique midnight game final must reconcile to school date');
 assert.match(midnight,/Opponent RETRO|sched-elo-cell/,'rating cell must be labeled');
 assert.match(midnight,/Stream|Not announced/,'no invented broadcast');
 const noMidnight={...midnightSchedule,events:midnightSchedule.events.map(e=>({
   ...e,official_school_time:'7:00 PM'
 }))};
 const notReconciled=await render(ratings([hpFinal]),{team:highPoint,foe:liberty,schedule:noMidnight});
 assert.doesNotMatch(notReconciled,/W 72–57/,'non-midnight games may not borrow adjacent-day finals');


 // Exhibition results belong to a separate source-ledger, never to the Elo
 // rating archive, and must display for both participating university pages.
 const dayton={id:'ncaa:609713',espn_id:'2168',name:'Dayton',espn_name:'Dayton Flyers'};
 const exhibitionGame={id:'school-dayton-2026-10-17',date:'2026-10-17T12:00:00-05:00',
  name:'Notre Dame (Exh.)',site_verified:true,competitions:[{competitors:[
    {homeAway:'home',team:{id:'2168',displayName:'Dayton Flyers'}},
    {homeAway:'away',team:{id:'87',displayName:'Notre Dame Fighting Irish'}}
  ],venue:{fullName:'UD Arena'},broadcasts:[]}]};
 const exhibitionEntry={date:'2026-10-17',away_espn_id:'87',home_espn_id:'2168',
  away_score:65,home_score:75,source_url:'https://daytonflyers.com/news/2026/10/17/recap',
  verified:true,classification:'exhibition',counts_for_retro:false};
 const exLedger={season:'2026-27',retro_included:false,games:[exhibitionEntry]};
 const daytonCalendar={...schedule,events:[exhibitionGame]};
 const daytonHTML=await render(ratings([]),{team:dayton,foe:team,schedule:daytonCalendar,exhibitions:exLedger});
 assert.match(daytonHTML,/EXHIBITION FINAL/);
 assert.match(daytonHTML,/W 75–65/);
 assert.match(daytonHTML,/University result ↗/,'official score has university citation');
 assert.match(daytonHTML,/data-exhibition="true"/);
 assert.match(daytonHTML,/Not applicable/,'exhibitions have no opponent RETRO');
 assert.doesNotMatch(daytonHTML,/cbb-gamefile\.html\?day=2026-10-17/,'non-counting exhibitions do not masquerade as RETRO Gamefiles');
 const notreDameCal={...schedule,events:[exhibitionGame]};
 const ndHTML=await render(ratings([]),{team,foe:dayton,schedule:notreDameCal,exhibitions:exLedger});
 assert.match(ndHTML,/L 65–75/,'away team receives its exact reciprocal exhibition result');
 const unverifiedLedger={...exLedger,games:[{...exhibitionEntry,verified:false}]};
 const notVerified=await render(ratings([]),{team:dayton,foe:team,schedule:daytonCalendar,exhibitions:unverifiedLedger});
 assert.doesNotMatch(notVerified,/W 75–65/,'unverified exhibition score never published');
 const conflictLedger={...exLedger,games:[exhibitionEntry,{...exhibitionEntry,home_score:74}]};
 const conflictedExhibition=await render(ratings([]),{team:dayton,foe:team,schedule:daytonCalendar,exhibitions:conflictLedger});
 assert.doesNotMatch(conflictedExhibition,/W 75–65/,'conflicting exhibition scores must be quarantined');
 const notOctober={...exLedger,games:[{...exhibitionEntry,date:'2026-11-03'}]};
 assert.doesNotMatch(await render(ratings([]),{team:dayton,foe:team,schedule:daytonCalendar,exhibitions:notOctober}),/W 75–65/);
 const notElo=await render(ratings([final]),{team:dayton,foe:team,schedule:daytonCalendar,exhibitions:exLedger});
 assert.match(notElo,/W 75–65/,'exhibition final is separate from RETRO game list');
 assert.match(notElo,/Exhibitions<\/option>/,'exhibition filter available without hiding regular results');


 // College exhibition ties can occur when OT is not played. They do not
 // become retro regular-season finals; both schools display T 70–70.
 const alabamaAM={id:'ncaa:609615',espn_id:'2010',name:'Alabama A&M',espn_name:'Alabama A&M Bulldogs'};
 const detroit={id:'ncaa:609716',espn_id:'2174',name:'Detroit Mercy',espn_name:'Detroit Mercy Titans'};
 const tieFixture={...exhibitionGame,id:'official-tied-2026-10-24',
   date:'2026-10-24T12:00:00-05:00',name:'Detroit Mercy (Exh.)',
   competitions:[{competitors:[
     {homeAway:'neutral',team:{id:'2010',displayName:'Alabama A&M Bulldogs'}},
     {homeAway:'neutral',team:{id:'2174',displayName:'Detroit Mercy Titans'}}
   ],venue:{fullName:'Wayne State Fieldhouse'},broadcasts:[]}]};
 const tieLedger={season:'2026-27',retro_included:false,games:[{
   date:'2026-10-24',away_espn_id:'2010',home_espn_id:'2174',away_score:70,home_score:70,
   classification:'exhibition',counts_for_retro:false,verified:true,source_tier:'official',
   source_url:'https://detroittitans.com/sports/mens-basketball/schedule'
 }]};
 const tie=await render(ratings([]),{team:alabamaAM,foe:detroit,
   schedule:{...schedule,events:[tieFixture]},exhibitions:tieLedger});
 assert.match(tie,/T 70–70/,'exhibition tie reported exactly when no OT played');
 assert.match(tie,/Not applicable/,'exhibition tie changes no RETRO rating');
 const canceledFixture={...exhibitionGame,id:'canceled-fsu',name:'Mississippi State',
   date:'2026-10-10T12:00:00-05:00',exhibition:true,exhibition_canceled:true,
   status:{type:{state:'canceled',completed:false}},competitions:[{competitors:[
     {homeAway:'neutral',team:{id:'52',displayName:'Florida State Seminoles'}},
     {homeAway:'neutral',team:{id:'344',displayName:'Mississippi State Bulldogs'}}
   ],venue:{fullName:'Pensacola Bay Center'}}]};
 const fsu={id:'ncaa:609733',espn_id:'52',name:'Florida St.',espn_name:'Florida State Seminoles'};
 const missSt={id:'ncaa:609806',espn_id:'344',name:'Mississippi St.',espn_name:'Mississippi State Bulldogs'};
 const canceled=await render(ratings([]),{team:fsu,foe:missSt,
   schedule:{...schedule,events:[canceledFixture]}});
 assert.match(canceled,/CANCELED/);
 assert.match(canceled,/Event canceled/);
 assert.doesNotMatch(canceled,/EXHIBITION FINAL/);
 // College of Idaho is not Division I Idaho: never invent the Vandals identity.
 const wyoming={id:'ncaa:609872',espn_id:'2751',name:'Wyoming',espn_name:'Wyoming Cowboys'};
 const collegeOfIdaho={...exhibitionGame,id:'school-wyoming-10-24',
   date:'2026-10-24T12:00:00-05:00',name:'College of Idaho (Exhibition)',
   exhibition:true,exhibition_result:{verified:true,counts_for_retro:false,
     team_score:76,opponent_score:61,source_url:'https://gowyo.com/news/2026/10/24/college-of-idaho',
     source_tier:'official'},
   competitions:[{competitors:[
     {homeAway:'home',team:{id:'2751',displayName:'Wyoming Cowboys'}},
     {homeAway:'away',team:{id:'',displayName:'College of Idaho Yotes'}}
   ],venue:{fullName:'Arena-Auditorium'}}]};
 const wyomingHTML=await render(ratings([]),{team:wyoming,foe:foe,
   schedule:{...schedule,events:[collegeOfIdaho]}});
 assert.match(wyomingHTML,/W 76–61/);
 assert.match(wyomingHTML,/College of Idaho Yotes/);
 assert.match(wyomingHTML,/University result ↗/);
 assert.doesNotMatch(wyomingHTML,/ncaam-team\.html\?team=ncaa%3A609/);
 const unknown={...collegeOfIdaho,exhibition_result:{...collegeOfIdaho.exhibition_result,
   verified:false}};
 assert.doesNotMatch(await render(ratings([]),{team:wyoming,foe,
   schedule:{...schedule,events:[unknown]}}),/W 76–61/,'unverified source score must fail closed');
 const cross=JSON.parse(fs.readFileSync('data/ncaam-2026-27-espn-team-crosswalk.json','utf8'));
 const actualPairs=JSON.parse(fs.readFileSync('data/mbb-exhibition-finals-2026-27.json','utf8'));
 assert.equal(actualPairs.retro_included,false);
 const pairKey=x=>[x.date,...[x.away_espn_id,x.home_espn_id].map(String).sort()].join('|');
 assert.equal(new Set(actualPairs.games.map(pairKey)).size,actualPairs.games.length,
   'no duplicate exhibition game evidence');
 assert(actualPairs.games.every(x=>x.counts_for_retro===false&&x.classification==='exhibition'&&
   x.verified===true),'all exhibition results stay outside RETRO');
 const newMexico=JSON.parse(fs.readFileSync('data/mbb-schedules-2026-27/167.json','utf8'));
 for(const [date,id,badId] of [['2026-10-18','265','45'],['2026-10-25','9','12']]){
   const fixture=newMexico.events.find(e=>e.date.startsWith(date));
   const ids=fixture.competitions[0].competitors.map(x=>String(x.team.id));
   assert(ids.includes(id)&&!ids.includes(badId),
     'New Mexico exhibitions must use exact opponent identity on '+date);
 }

 const css=fs.readFileSync('mbb-newspaper.css','utf8');
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/,'mobile cards use columns, not stacked arbitrary TD order');
 assert.match(css,/td\.sched-elo-cell\{grid-column:1/,'opponent rating must be positioned in footer');
 assert.match(css,/td\.sched-result-cell\{grid-column:2/,'result must be positioned in footer');
 assert.match(css,/tr\[hidden\]\{display:none!important\}/,'filtered game cards must stay hidden');

 const newspaper=fs.readFileSync('mbb-newspaper.js','utf8');
 assert.match(newspaper,/card\.dataset\.eloUpdated/,'ratings refresh needs visible team metric update');
 assert.match(newspaper,/Live game file/);
 const dayBody=newspaper.split('const easternGameDay=value=>{')[1]?.split('};')[0];
 assert(dayBody,'Eastern Time date helper not present');
 const day=new Function('const easternGameDay=value=>{'+dayBody+'};return easternGameDay;')();
 assert.equal(day('2026-11-02T04:59:00Z'),'2026-11-01','11:59 PM ET is the prior UTC calendar day');
 assert.equal(day('2026-11-02'),'2026-11-02','date-only games retain their official calendar date');
 console.log('PASS: completed finals, Game Center link, opponent matching, conflict quarantine and no synthetic TV');
})().catch(e=>{console.error(e);process.exitCode=1});