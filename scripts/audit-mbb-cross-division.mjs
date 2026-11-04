/* Read-only audit of all published men's school schedules. Run: node scripts/audit-mbb-cross-division.mjs
   Does not infer a school's division from a missing ESPN ID and never changes RETRO. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),folder=path.join(root,'data/mbb-schedules-2026-27');
const cross=JSON.parse(fs.readFileSync(path.join(root,'data/ncaam-2026-27-espn-team-crosswalk.json'),'utf8'));
const di=new Set((cross.teams||[]).map(t=>String(t.espn_id)));
const today=new Date().toISOString().slice(0,10),items=[],dedup=new Set();
for(const filename of fs.readdirSync(folder).filter(f=>/^\d+\.json$/.test(f))){
 const owner=filename.slice(0,-5),d=JSON.parse(fs.readFileSync(path.join(folder,filename),'utf8'));
 for(const e of d.events||[]){
  const day=String(e.date||'').slice(0,10);
  if(!/^\d{4}-\d\d-\d\d$/.test(day)||day>today)continue;
  const competitors=e.competitions?.[0]?.competitors||[];
  const opponent=competitors.find(t=>String(t.team?.id||'')!==owner);
  if(!opponent)continue;
  const id=String(opponent.team?.id||''),name=opponent.team?.displayName||e.name||'Unknown';
  if(id&&di.has(id))continue;
  const key=day+'|'+owner+'|'+(id||name.trim().toLowerCase());
  if(dedup.has(key))continue;
  dedup.add(key);
  const result=e.verified_non_d1_result,ex=e.exhibition_result;
  const verified=result?.verified===true&&result?.classification==='regular-season'&&result?.counts_for_retro===false&&
   Number.isInteger(result?.team_score)&&Number.isInteger(result?.opponent_score)&&
   /^https:\/\//.test(result?.source_url||'');
  items.push({date:day,school_espn_id:owner,opponent:name,opponent_id:id||null,
   category:!id?'missing_opponent_id':'outside_di_registry',
   classification:e.exhibition===true?'exhibition':day<'2026-11-01'?'likely_exhibition':'review',
   result_status:verified?'verified_regular_season_final':ex?.verified?'verified_exhibition':'needs_source_check',
   score:verified?result.team_score+'-'+result.opponent_score:null,
   source:verified?result.source_url:e.school_source_url||e.site_source_url||null});
 }
}
items.sort((a,b)=>a.date.localeCompare(b.date)||a.school_espn_id.localeCompare(b.school_espn_id));
const summary={as_of:today,scope:'Published schedule entries through today; missing IDs are NOT proof of non-DI status',candidate_games:items.length,verified_regular_season_finals:items.filter(x=>x.result_status==='verified_regular_season_final').length,awaiting_verification:items.filter(x=>x.result_status==='needs_source_check').length};
const report={summary,items};
const output=process.argv[2];
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
