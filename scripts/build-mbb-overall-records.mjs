#!/usr/bin/env node
/* Separate verified school overall record from Division I RETRO W-L.
   RETRO remains strictly D-I vs D-I. Never feed these scores into RETRO. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), base=path.join(root,'data');
const load=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const published=load('ncaam-2026-27-retro-primary.json');
const cross=load('ncaam-2026-27-espn-team-crosswalk.json');
if(published.season!=='2026-27'||published.model!=='retro-clean-slate'||published.rankings?.length!==365)throw Error('Invalid D-I RETRO source');
const di=new Set(cross.teams.map(t=>String(t.espn_id)));
const ncaaToEspn=new Map(cross.teams.map(t=>[String(t.id),String(t.espn_id)]));
const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validScore=x=>Number.isSafeInteger(x)&&x>=0&&x<=300;
const records={},exceptions=[],finals=[];
const extraFile=path.join(base,'mbb-non-di-verified-finals-2026-27.json');
const outside=fs.existsSync(extraFile)?load('mbb-non-di-verified-finals-2026-27.json'):{season:'2026-27',games:[]};
if(outside.season!=='2026-27'||!Array.isArray(outside.games)||outside.counts_for_retro===true)
 throw Error('Invalid outside-D-I final-game ledger');
const extraBySchool=new Map(),normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
for(const g of outside.games){
 if(g.verified!==true||g.classification!=='regular-season'||g.counts_for_retro!==false||
    !validScore(g.team_score)||!validScore(g.opponent_score)||g.team_score===g.opponent_score||
    !/^https:\/\/[^\s"'<>]+$/.test(g.source_url||'')||g.date<'2026-11-01'||g.date>asOf||
    di.has(String(g.opponent_espn_id))||
    ncaaToEspn.get(String(g.division_i_ncaa_id))!==String(g.division_i_espn_id)){
    exceptions.push({event_id:g.id,reason:'outside-D-I source row failed validation'});
    continue;
 }
 const a=extraBySchool.get(String(g.division_i_ncaa_id))||[];
 a.push(g);extraBySchool.set(String(g.division_i_ncaa_id),a);
}
for(const team of published.rankings){
 const id=String(team.team_id),espn=ncaaToEspn.get(id);
 const record={team_id:id,team:team.team,retro_wins:team.wins||0,retro_losses:team.losses||0,
  verified_non_di_wins:0,verified_non_di_losses:0,overall_wins:team.wins||0,overall_losses:team.losses||0};
 records[id]=record;
 if(!espn){exceptions.push({team:id,reason:'missing ESPN crosswalk'});continue;}
 const file=path.join(base,'mbb-schedules-2026-27',espn+'.json');
 if(!fs.existsSync(file)){exceptions.push({team:id,reason:'missing school schedule'});continue;}
 const schedule=JSON.parse(fs.readFileSync(file,'utf8')),seen=new Map();
 for(const event of schedule.events||[]){
  const r=event.verified_non_d1_result;if(!r)continue;
  const date=String(event.date||'').slice(0,10);
  const comps=event.competitions?.[0]?.competitors||[];
  const other=comps.find(c=>String(c.team?.id)!==espn);
  const otherId=String(other?.team?.id||''),name=other?.team?.displayName||event.name||'Unknown';
  const key=date+'|'+(otherId||name.toLowerCase().trim());
  if(!/^202[67]-\d{2}-\d{2}$/.test(date)||date>'2027-04-30'||date>asOf||
     r.verified!==true||r.classification!=='regular-season'||r.counts_for_retro!==false||
     !validScore(r.team_score)||!validScore(r.opponent_score)||r.team_score===r.opponent_score||
     !/^https:\/\/[^\s"'<>]+$/.test(r.source_url||'')||
     event.exhibition===true||date<'2026-11-01'||di.has(otherId)){
   exceptions.push({team:id,date,opponent:name,reason:'invalid or DI-identified cross-division result'});continue;
  }
  if(seen.has(key)){
   const prior=seen.get(key);
   if(prior.team_score!==r.team_score||prior.opponent_score!==r.opponent_score)
    throw Error('Conflicting finals for '+team.team+' '+key);
   continue;
  }
  seen.set(key,r);
  const win=r.team_score>r.opponent_score;
  record['verified_non_di_'+(win?'wins':'losses')]++;
  record['overall_'+(win?'wins':'losses')]++;
  finals.push({date,team_id:id,school:team.team,opponent:name,team_score:r.team_score,
   opponent_score:r.opponent_score,source_url:r.source_url});
 }
 // Append independently verified completed games with outside-D-I opponents.
 // University-verified schedule scores win any conflicting-source dispute.
 for(const g of extraBySchool.get(id)||[]){
   const old=finals.find(f=>f.team_id===id&&f.date===g.date&&(
     normalize(f.opponent)===normalize(g.opponent_name)||
     (f.team_score===g.team_score&&f.opponent_score===g.opponent_score)));
   if(old){
     if(old.team_score!==g.team_score||old.opponent_score!==g.opponent_score)
       exceptions.push({team:id,event_id:g.id,reason:'conflict with university final'});
     continue;
   }
   const outcome=g.team_score>g.opponent_score?'wins':'losses';
   record['verified_non_di_'+outcome]++;
   record['overall_'+outcome]++;
   finals.push({date:g.date,team_id:id,school:team.team,opponent:g.opponent_name,
      opponent_espn_id:String(g.opponent_espn_id),event_id:String(g.id),
      team_score:g.team_score,opponent_score:g.opponent_score,
      source_url:g.source_url,source_tier:'independent_secondary'});
 }
}
if(Object.keys(records).length!==365)throw Error('Overall record count mismatch');
for(const v of Object.values(records)){
 if(v.overall_wins!==v.retro_wins+v.verified_non_di_wins||
    v.overall_losses!==v.retro_losses+v.verified_non_di_losses)throw Error('Double count');
}
finals.sort((a,b)=>a.date.localeCompare(b.date)||a.school.localeCompare(b.school));
const out={season:'2026-27',as_of:asOf,retro_as_of:published.as_of,record_basis:'Verified Division I RETRO finals plus independently sourced non-Division I regular-season finals; not an official completeness certification',
 notes:'Conference-only records and all RETRO calculations remain unchanged. Exhibitions excluded. Unknown/unconfirmed scores excluded.',
 summary:{division_i_teams:365,verified_non_di_regular_season_finals:finals.length,
  schools_with_non_di_finals:new Set(finals.map(f=>f.team_id)).size,
  unverified_or_conflicting_entries:exceptions.length},
 records,verified_non_di_finals:finals,exceptions};
const output=path.join(base,'mbb-overall-records-2026-27.json');
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log('Verified school records:',finals.length,'cross-division finals; 365 teams; errors:',exceptions.length);
