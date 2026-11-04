'use strict';
// Full source-calendar identity audit. Does not manufacture opponent IDs or logos.
const fs=require('fs'),path=require('path');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function audit(){
 const r=read('data/mbb-logo-registry.json').teams, c=read('data/ncaam-2026-27-espn-team-crosswalk.json').teams;
 const w=read('data/ncaaw-2026-27-teams.json').teams, ext=read('data/mbb-out-of-division-opponent-logos.json').teams;
 const womenFull=read('data/ncaaw-schedules-2026-27.json'), mid=new Set(Object.keys(r)),wid=new Set(w.map(x=>String(x.team_id)));
 const di=new Map(),outside=new Map();
 for(const t of c)for(const n of [t.name,t.espn_name,r[t.espn_id]?.school])if(n)di.set(norm(n),String(t.espn_id));
 for(const [id,t] of Object.entries(ext))for(const n of [t.school,t.feed_name,t.corrected_name,...(t.aliases||[])])if(n)outside.set(norm(n),id);
 const classify=(id,name,gender)=>{
  id=String(id||'');name=String(name||'');
  if((gender==='women'?wid:mid).has(id))return 'D1';
  if(!id&&di.has(norm(name)))return 'D1_MISSING_ID';
  const eid=ext[id]?id:!id?outside.get(norm(name)):null;
  if(eid){const t=ext[eid];return [t.school,t.feed_name,t.corrected_name,...(t.aliases||[])].some(n=>norm(n)===norm(name))?'OUTSIDE_LOGO':'EXTERNAL_ID_MISMATCH';}
  return id?'OUTSIDE_UNREGISTERED':'UNRESOLVED_NO_ID';
 };
 const start=()=>({total:0,di_logo_blank:0,classes:{},unknown:new Map(),today:[]});
 const men=start(),women=start();
 const add=(data,school,event,opp,gender)=>{
  const kind=classify(opp.id,opp.name,gender);data.total++;data.classes[kind]=(data.classes[kind]||0)+1;
  if(kind==='D1'&&!opp.logo)data.di_logo_blank++;
  if(kind!=='D1'){
   const k=norm(opp.name)+'|'+kind+'|'+opp.id;
   const old=data.unknown.get(k)||{name:opp.name,id:opp.id,kind,visits:0,example_school:school};
   old.visits++;data.unknown.set(k,old);
  }
  if(String(event.date||'').startsWith('2026-11-04')&&kind!=='D1')
   data.today.push({school,opponent:opp.name,opponent_id:opp.id,kind,source:event.school_source_url||event.source_url||''});
 };
 let menFiles=0;
 for(const file of fs.readdirSync('data/mbb-schedules-2026-27').filter(s=>/^[0-9]+\.json$/.test(s))){
  const id=file.slice(0,-5);if(!mid.has(id))continue;menFiles++;
  const d=read(path.join('data/mbb-schedules-2026-27',file));
  for(const ev of d.events||[]){
   const comps=ev.competitions?.[0]?.competitors||[];
   if(comps.length!==2)continue;
   const op=comps.find(t=>String(t.team?.id||'')!==id);if(!op)continue;
   add(men,id,ev,{id:String(op.team?.id||''),name:op.team?.displayName||ev.name||'',logo:op.team?.logo},'men');
  }
 }
 const member=womenFull.teams||{};
 for(const [school,t] of Object.entries(member))for(const ev of t.games||[]){
  const h=String(ev.home_id||''),a=String(ev.away_id||'');
  const opid=h===school?a:a===school?h:null;
  if(opid===null)continue;
  const name=ev.opponent||(h===school?(ev.away_name||ev.opponent_name||''):(ev.home_name||ev.opponent_name||''));
  add(women,school,ev,{id:opid,name,logo:true},'women');
 }
 const out=x=>({entry_count:x.total,classifications:x.classes,
   di_source_logo_field_blanks:x.di_logo_blank,unique_nonD1_or_unresolved:x.unknown.size,
   highest_priority:[...x.unknown.values()].sort((a,b)=>b.visits-a.visits).slice(0,32),today:x.today.slice(0,35)});
 const gapM=read('data/mbb-schedule-completion-audit.json'),gapW=read('data/ncaaw-2026-27-schedule-first-full-coverage-audit.json');
 const results={date:'2026-11-04',men_logo_registry:mid.size,men_logo_verified:Object.values(r).filter(t=>t.logo_url_verified).length,
   women_logo_registry:wid.size,women_not_in_men_registry:[...wid].filter(id=>!mid.has(id)),
   external_logo_registry:Object.keys(ext).length,men:{files:menFiles,...out(men)},women:{files:Object.keys(member).length,...out(women)},
   baseline_schedule_gaps:{men:{as_of:gapM.checked_at,...gapM.summary},
     women:{as_of:gapW.date,unique_games:gapW.unique_games,paired_games:gapW.paired_games,
       unmatched_rows:gapW.remaining_unmatched_master_team_rows}},
   caution:'Missing opponent ID is not necessarily outside D-I. Non-D-I opponents never enter RETRO rankings.'};
 console.log('D1_BASKETBALL_LOGO_AUDIT_JSON='+JSON.stringify(results));return results;
}
module.exports=audit;
if(require.main===module)audit();
