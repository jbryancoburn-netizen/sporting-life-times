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
   url.includes('retro-primary')?feed:selectedSchedule}),
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