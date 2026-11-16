#!/usr/bin/env node
'use strict';
// Read-only publication gate. Does not invent championship results or mutate data.
const fs=require('node:fs');
const path=require('node:path');
const source=process.argv[2]||path.join(__dirname,'..','data','college-soccer-ncaa-selection-forecast.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const errors=[],warnings=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg)};
const field=data.field||[],aq=data.automatic_bid_scenarios||[];
check(field.length===48,'Men D1 field must contain 48 distinct schools');
check(new Set(field.map(x=>x.team_id)).size===field.length,'Duplicate school in projected field');
check(aq.length===23,'Exactly 23 conference AQ scenarios required');
check(new Set(aq.map(x=>x.conference)).size===aq.length,'Duplicate conference AQ scenario');
check(field.filter(x=>['official_aq','projected_aq'].includes(x.bid_type)).length===23,'Field must allocate 23 AQ slots');
check(field.filter(x=>x.bid_type==='at_large').length===25,'Field must allocate 25 at-large slots');
const official=aq.filter(x=>x.official_aq===true);
for(const x of official){
 check(x.method==='verified_championship_result','Official AQ '+x.conference+' lacks verified-result method');
 check(/^https:\/\//.test(x.source_url||''),'Official AQ '+x.conference+' lacks source URL');
 check(x.championship_result&&Number.isFinite(x.championship_result.home_score)&&Number.isFinite(x.championship_result.away_score),'Official AQ '+x.conference+' lacks championship final score');
 check(field.some(t=>t.team_id===x.team_id&&t.bid_type==='official_aq'),'Confirmed AQ '+x.team+' not marked official in field');
}
for(const x of aq.filter(x=>!x.official_aq)){
 check(x.method!=='verified_championship_result','Unconfirmed AQ incorrectly has verified-result method: '+x.conference);
}
if(data.elo_reconciliation?.source_certified!==true)warnings.push('RETRO ratings are not source certified');
if((data.elo_reconciliation?.excluded_finals||0)>0)warnings.push(data.elo_reconciliation.excluded_finals+' finals excluded from ratings');
if(official.length<23)warnings.push((23-official.length)+' conference AQs remain unverified');
const summary={status:errors.length?'FAIL':'STRUCTURE_OK_PROVISIONAL',field:field.length,confirmedAqs:official.length,excludedFinals:data.elo_reconciliation?.excluded_finals??null,errors,warnings};
console.log(JSON.stringify(summary,null,2));
process.exitCode=errors.length?1:0;
