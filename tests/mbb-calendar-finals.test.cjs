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
async function render(feed){
 const host={dataset:{},innerHTML:'',hidden:true,querySelector(s){return {
  value:s==='#calendar-view'?'all':'',addEventListener(){},textContent:''};},
  querySelectorAll(){return [];}};
 const document={title:'',getElementById:id=>id==='mbb-calendar-host'?host:null,
  querySelector:()=>({parentNode:{}}),createElement:()=>({}),head:{appendChild(){}}};
 const context={window:{MBBLogos:{ready:Promise.resolve(),
  byESPN:()=>'<span class="crest">crest</span>'}},document,
  location:{search:'?team='+encodeURIComponent(team.id)},
  fetch:async url=>({ok:true,json:async()=>url.includes('crosswalk')?{teams:[team,foe]}:
   url.includes('retro-primary')?feed:schedule}),
  URLSearchParams,Intl,Date,Map,Set,Number,Boolean,String,Promise,console,encodeURIComponent,setInterval:()=>0};
 vm.runInNewContext(source,context,{filename:'mbb-team-calendar-boot.js'});
 for(let i=0;i<100&&!host.dataset.scheduleLoaded;i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(host.dataset.scheduleLoaded,team.id,'team schedule never rendered');
 return host.innerHTML;
}
(async()=>{
 const verified=await render(ratings([final]));
 assert.match(verified,/W 74–72/,'verified neutral final must supersede stale fixture');
 assert.match(verified,/data-calendar-state="final"/);
 assert.match(verified,/cbb-gamefile\.html\?day=2026-11-01&amp;game=401920982/);
 assert.match(verified,/Network TBA/,'missing broadcast must not be invented');
 const mismatched=await render(ratings([{...final,home_id:'ncaa:other'}]));
 assert.doesNotMatch(mismatched,/W 74–72/,'never attach wrong opponent final');
 const conflicted=await render(ratings([final,{...final,home_score:70,id:'espn:401920983'}]));
 assert.doesNotMatch(conflicted,/W 74–72/,'conflicting scores must fail closed');
 const unverified=await render(ratings([{...final,site_verified:false}]));
 assert.doesNotMatch(unverified,/W 74–72/,'unverified final must fail closed');
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