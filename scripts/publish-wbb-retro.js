#!/usr/bin/env node
/* Dedicated women's NCAA RETRO: 1500 to start every year; no men or carryover. */
'use strict';
const fs=require('node:fs');
require('../mbb-retro.js');
const load=f=>JSON.parse(fs.readFileSync('data/'+f,'utf8'));
const registry=load('ncaaw-2026-27-teams.json');
const ledger=load('ncaaw-2026-27-verified-games.json');
if(registry.season!=='2026-27'||registry.teams.length!==363)throw Error('Women-only roster incomplete');
const teams=registry.teams;
const teamMap=new Map(teams.map(t=>[String(t.team_id),t]));
if(teamMap.size!==teams.length)throw Error('Duplicate women team IDs');
const events=[],unique=new Map();
for(const g of ledger.games||[]){
  const id=String(g.id||''),h=String(g.home_id||''),a=String(g.away_id||''),date=String(g.date||'').slice(0,10);
  const hs=Number(g.home_score),as=Number(g.away_score);
  if(!id||!teamMap.has(h)||!teamMap.has(a)||h===a||date<'2026-11-01'||date>'2027-04-30'||
      !Number.isInteger(hs)||!Number.isInteger(as)||hs<=0||as<=0||hs===as)throw Error('Unverified WBB final '+id);
  if(unique.has(id)){
    if(JSON.stringify(unique.get(id))!==JSON.stringify(g))throw Error('Conflicting WBB final '+id);
    continue;
  }
  unique.set(id,g);
  events.push({...g,date,neutral:g.neutral===true||g.site_verified!==true});
}
events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const config='data/ncaaw-retro-parameters.json';
const calibrated=fs.existsSync(config)?JSON.parse(fs.readFileSync(config,'utf8')):null;
const verified=calibrated?.status==='historical-calibration-complete'&&calibrated?.holdout?.games>1000;
const edge=verified?Number(calibrated.parameters.home_edge):0;
if(!Number.isFinite(edge)||edge<0||edge>150)throw Error('Invalid historical home edge');
const replay=g=>globalThis.MBB_RETRO.calculate(g,{baseline:1500,homeEdge:edge,passes:160});
const scores=replay(events);
if(scores.games!==events.length)throw Error('Incomplete WBB rating replay');
const date=events.at(-1)?.date||null;
const previous=date?replay(events.filter(g=>g.date<date)).ratings:{};
const records=new Map(teams.map(t=>[String(t.team_id),{
  wins:0,losses:0,conference_wins:0,conference_losses:0,games_played:0
}]));
for(const g of events){
  const h=records.get(String(g.home_id)),a=records.get(String(g.away_id));
  h.games_played++;a.games_played++;
  const winner=g.home_score>g.away_score?h:a,loser=winner===h?a:h;
  winner.wins++;loser.losses++;
  const ht=teamMap.get(String(g.home_id)),at=teamMap.get(String(g.away_id));
  if(ht.conference&&ht.conference===at.conference){
    winner.conference_wins++;loser.conference_losses++;
  }
}
const rankings=teams.map(t=>{
  const id=String(t.team_id),elo=Number((scores.ratings[id]??1500).toFixed(2));
  return {...t,base_elo:1500,elo,daily_change:Number((elo-(previous[id]??1500)).toFixed(2)),
      ...records.get(id)};
}).sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team));
let old=null;
rankings.forEach((t,i)=>{t.rank=events.length?(t.elo===old?rankings[i-1].rank:i+1):null;old=t.elo;});
const output={
  model:'retro-clean-slate',gender:'women',season:'2026-27',
  source:'Women-only Division I verified finals',starting_elo:1500,
  status:events.length?'in-season':'preseason-all-tied',games_played:events.length,as_of:date,
  parameters:{baseline:1500,home_edge:edge,passes:160,
    calibration:verified?'historical holdout':'pending historical holdout; neutral home edge'},
  note:'Every women’s team starts at 1500. Historical seasons calibrate home advantage only, never seed ratings. Provisional conference standings exclude non-D-I games.',
  rankings,events
};
if(output.rankings.length!==teams.length||output.rankings.some(t=>t.base_elo!==1500||!Number.isFinite(t.elo)))throw Error('WBB integrity failure');
const target='data/ncaaw-2026-27-retro-primary.json',body=JSON.stringify(output,null,2)+'\n';
if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==body)fs.writeFileSync(target,body);
console.log('Women RETRO published:',teams.length,'teams,',events.length,'finals; initial Elo 1500.');
