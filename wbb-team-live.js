/* Women's team-page in-place final and Elo refresh. No men’s data dependencies. */
(function(w){
'use strict';
function start(teamId,baseGames,siteDisputes,neutralProof){
  const host=document.getElementById('desk');
  if(!host||!w.WBBGameResults||!Array.isArray(baseGames))return;
  let pending=false;
  async function refreshLiveScores(){
    // Direct, date-scoped scoreboard refresh independent of the slower certified-final ledger.
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const url='https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?groups=50&limit=1000&dates='+day.replaceAll('-','');
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return;
      const feed=await response.json();
      if(!Array.isArray(feed.events))return;
      const schedule=new Map(baseGames.map(g=>[String(g.id),g]));
      for(const event of feed.events){
        const fixture=schedule.get(String(event.id)),competition=event.competitions?.[0];
        if(!fixture||!competition||!['in','post'].includes(event.status?.type?.state))continue;
        const sides=competition.competitors||[];
        if(sides.length!==2||!sides.some(t=>String(t.team?.id)===String(teamId)))continue;
        const other=sides.find(t=>String(t.team?.id)!==String(teamId));
        if(!other||String(other.team?.id)!==String(fixture.opponent_id))continue;
        const scored=sides.map(t=>({id:String(t.team.id),n:Number(t.score?.value??t.score?.displayValue??t.score)}));
        if(scored.some(x=>!Number.isSafeInteger(x.n)||x.n<0||x.n>500))continue;
        const ours=scored.find(x=>x.id===String(teamId)),theirs=scored.find(x=>x.id===String(other.team.id));
        const row=host.querySelector('tr[data-game-id="'+String(event.id)+'"]');
        const cell=row?.querySelector('.wbb-result-cell');
        if(!cell||!ours||!theirs)continue;
        const final=event.status?.type?.state==='post'&&event.status?.type?.completed===true;
        const score=cell.querySelector('strong'),note=cell.querySelector('.wbb-result-source');
        if(score)score.textContent=(final?(ours.n>theirs.n?'W ':'L '):'')+ours.n+'–'+theirs.n;
        if(note)note.textContent=final?'Reported final · certification pending':String(event.status?.type?.shortDetail||'Live');
      }
    }catch(_err){/* Preserve last published result when live source is unavailable. */}
  }
  async function refresh(){
    if(pending)return;
    pending=true;
    try{
      const load=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error(path+' HTTP '+response.status);return response.json();};
      const [finals,ratings]=await Promise.all([
        load('data/ncaaw-2026-27-verified-games.json'),
        load('data/ncaaw-2026-27-retro-primary.json')
      ]);
      const merged=w.WBBGameResults.merge(baseGames,finals,teamId);
      const good=ratings?.model==='retro-clean-slate'&&ratings?.gender==='women'&&
        ratings?.season==='2026-27'&&ratings?.starting_elo===1500&&
        Array.isArray(ratings.rankings)&&ratings.rankings.length===363;
      const byId=good?new Map(ratings.rankings.map(t=>[String(t.team_id),t])):new Map();
      const ours=byId.get(String(teamId));
      const edge=good&&Number.isFinite(Number(ratings.parameters?.home_edge))?
        Number(ratings.parameters.home_edge):0;
      for(const game of merged.games){
        if(!/^\d+$/.test(String(game.id)))continue;
        const row=host.querySelector('tr[data-game-id="'+game.id+'"]');
        if(!row)continue;
        const outcome=w.WBBGameResults.scoreFor(game,teamId);
        const cell=row.querySelector('.wbb-result-cell');
        if(cell){
          const score=cell.querySelector('strong'),note=cell.querySelector('.wbb-result-source');
          if(score)score.textContent=outcome.value;
          if(note)note.textContent=outcome.detail;
          else if(outcome.detail)cell.title=outcome.detail;
        }
        const opponent=byId.get(String(game.opponent_id||''));
        const opponentElo=row.querySelector('.wbb-opp-elo-value')||row.querySelector('.wbb-opp-elo');
        if(opponentElo)opponentElo.textContent=opponent&&Number.isFinite(Number(opponent.elo))?
          String(Math.round(Number(opponent.elo))):'—';
        const change=row.querySelector('.wbb-opp-change');
        if(change)change.textContent=opponent&&Number.isFinite(Number(opponent.daily_change))?
          (Number(opponent.daily_change)>0?'+':'')+Number(opponent.daily_change).toFixed(1):'—';
        const forecast=row.querySelector('.wbb-win-probability');
        if(forecast){
          if(game.completed||game.result_conflict)forecast.textContent=game.result_conflict?'Review':'Final';
          else if(w.WBBSiteIntegrity?.claims(game,siteDisputes,neutralProof).length)forecast.textContent='Venue review';
          else if(ours&&opponent){
            const neutral=w.WBBSiteIntegrity?.certifiedNeutral(game,neutralProof);
            const adj=neutral?0:game.site==='home'?edge:game.site==='away'?-edge:0;
            const p=100/(1+Math.pow(10,-((Number(ours.elo)-Number(opponent.elo)+adj)/400)));
            forecast.textContent=Number.isFinite(p)?p.toFixed(0)+'%':'—';
          }else forecast.textContent='—';
        }
      }
      if(ours&&Number.isFinite(Number(ours.elo))){
        const rank=host.querySelector('#wbb-team-elo'),record=host.querySelector('#wbb-team-record');
        if(rank)rank.textContent=Number(ours.elo).toFixed(0);
        if(record)record.textContent=(ours.wins||0)+'–'+(ours.losses||0);
      }
      // Notify the shared scorebugs when a newer verified women-only RETRO ledger arrives.
      if(good){w.WBBRetroSnapshot=ratings;w.dispatchEvent(new Event('wbb-retro-refreshed'));}
      const status=host.querySelector('#wbb-result-refresh');
      if(status)status.textContent=merged.matched+' published finals matched to this team schedule'+
        (merged.conflicts.length?' · '+merged.conflicts.length+' identity conflicts withheld':'')+
        (good?' · Elo '+(ratings.as_of?'through '+ratings.as_of:'preseason'):' · ratings source unavailable');
    }catch(e){
      const status=host.querySelector('#wbb-result-refresh');
      if(status)status.textContent='Results temporarily unavailable; showing the last published schedule.';
    }finally{pending=false;}
  }
  // Refresh immediately on opening a team page, not after the first interval.
  void refresh();
  void refreshLiveScores();
  if(typeof setInterval==='function')setInterval(()=>{
    if(typeof document==='undefined'||!document.hidden){void refresh();void refreshLiveScores();}
  },30000);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){void refresh();void refreshLiveScores();}
  });
}
w.WBBTeamLive={start};
})(window);
