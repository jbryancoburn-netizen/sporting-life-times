/* Women's DI results overlay. Immutable season calendar; only exact women finals may update it. */
(function(w){
'use strict';
const validId=x=>/^\d+$/.test(String(x??''));
const finiteScore=x=>typeof x==='number'?Number.isInteger(x)&&x>=0:
  typeof x==='string'&&/^\d+$/.test(x.trim())&&Number.isSafeInteger(Number(x));
const states=new Set(['espn_only','espn_final_ncaa_pending','espn_and_ncaa_origin',
  'ncaa_origin_final_espn_fixture']);
function merge(schedule,ledger,teamId){
  if(!Array.isArray(schedule))return {games:[],matched:0,conflicts:[],source:'invalid_schedule'};
  const result=schedule.map(x=>({...x}));
  if(!ledger||ledger.season!=='2026-27'||!Array.isArray(ledger.games)){
    return {games:result,matched:0,conflicts:[],source:'no_verified_ledger'};
  }
  const byId=new Map(),invalid=new Set(),conflicts=[];
  for(const event of ledger.games){
    if(!event||!validId(event.id))continue;
    const key=String(event.id);
    if(byId.has(key)){invalid.add(key);continue;}
    byId.set(key,event);
  }
  let matched=0;
  for(const g of result){
    const key=String(g.id??'');
    if(!byId.has(key))continue;
    const f=byId.get(key),sameSide=String(g.home_id)===String(f.home_id)&&String(g.away_id)===String(f.away_id);
    const current=String(teamId);
    const opponent=String(g.opponent_id??'');
    const rightTeam=(String(f.home_id)===current||String(f.away_id)===current)&&
      (!opponent||opponent===String(f.home_id===current?f.away_id:f.home_id));
    const when=Date.parse(g.date),finalWhen=Date.parse(f.date);
    const dateOK=Number.isFinite(when)&&Number.isFinite(finalWhen)&&Math.abs(when-finalWhen)<=48*60*60*1000;
    const scoresOK=finiteScore(f.home_score)&&finiteScore(f.away_score)&&
      Number(f.home_score)!==Number(f.away_score);
    const statusOK=f.status==='final'&&f.completed!==false;
    const seasonOK=String(f.date||'').slice(0,10)>='2026-11-01'&&
      String(f.date||'').slice(0,10)<='2027-04-30';
    if(invalid.has(key)||!sameSide||!rightTeam||!dateOK||!scoresOK||!statusOK||!seasonOK){
      conflicts.push(key);
      g.result_conflict=true;
      // A discredited ledger row must never overwrite the schedule's identities.
      continue;
    }
    g.completed=true;
    g.home_score=Number(f.home_score);
    g.away_score=Number(f.away_score);
    g.result_provenance=states.has(f.score_evidence)?f.score_evidence:'espn_only';
    matched++;
  }
  return {games:result,matched,conflicts,source:'wbb_verified_finals'};
}
function scoreFor(g,teamId){
  if(g.result_conflict)return {value:'Review',detail:'Result identity conflict — review required'};
  if(!g.completed||!finiteScore(g.home_score)||!finiteScore(g.away_score))return {value:'—',detail:''};
  const home=String(g.home_id)===String(teamId),away=String(g.away_id)===String(teamId);
  if(home===away)return {value:'Review',detail:'Result identity not verified'};
  const ours=Number(home?g.home_score:g.away_score),theirs=Number(home?g.away_score:g.home_score);
  if(ours===theirs)return {value:'Review',detail:'Final score tied; source review required'};
  const label=g.result_provenance==='espn_and_ncaa_origin'?'ESPN + NCAA-origin confirmed':
    g.result_provenance==='ncaa_origin_final_espn_fixture'?'NCAA-origin final':
    g.result_provenance==='espn_final_ncaa_pending'?'ESPN final; NCAA check pending':
    'Final on published scoreboard';
  return {value:(ours>theirs?'W ':'L ')+ours+'–'+theirs,detail:label};
}
w.WBBGameResults={merge,scoreFor};
})(window);
