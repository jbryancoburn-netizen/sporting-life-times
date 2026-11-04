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
const records={},exceptions=[],finals=[];
const validScore=x=>Number.isSafeInteger(x)&&x>=0&&x<=300;
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
