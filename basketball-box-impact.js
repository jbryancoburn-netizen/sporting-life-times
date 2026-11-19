/* Verified NBA, EuroLeague and NCAA box-score details use the same Impact weights. */
(()=>{
'use strict';
const impact=window.SLTCBBImpact;
if(!impact)return;
const esc=impact.escape;
const integer=value=>typeof value==='number'&&Number.isInteger(value)&&value>=0?value:
 typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;
const sources={
 nba:id=>'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+id,
 euroleague:id=>'https://live.euroleague.net/api/Boxscore?gamecode='+id+'&seasoncode=E2026',
 ncaa:id=>'https://ncaa-api.henrygd.me/game/'+id+'/boxscore'
};
const settled=new Map(),pending=new Map();
function renderBox(groups){
 const markup=impact.boxMarkup(groups);
 if(!markup)return '';
 return '<section class="ledger26-gamefile" aria-label="Verified player box score"><h4>Player box score</h4>'+
  groups.map(team=>'<h5>'+esc(team.name)+'</h5><div class="basketball-impact-box-scroll"><table><thead><tr>'+
   ['Player','MIN','PTS','REB','AST','STL','BLK','TO','FGA','FTA'].map(label=>'<th scope="col">'+label+'</th>').join('')+
   '</tr></thead><tbody>'+team.rows.map(([id,player,pts,oreb,dreb,...stats])=>
    '<tr><th scope="row">'+esc(player)+'</th>'+[team.minutes.get(id),pts,oreb+dreb,...stats].map(value=>'<td>'+esc(value)+'</td>').join('')+
    '</tr>').join('')+'</tbody></table></div>').join('')+'</section>'+markup;
}
function euroGroups(raw,match){
 if(raw?.Live!==false||raw?.Stats?.length!==2)return null;
 return [match.away,match.home].map(side=>{
  const players=raw.Stats.find(team=>team.PlayersStats?.some(p=>p.Team===side.key))?.PlayersStats;
  if(!players?.length||players.some(p=>p.Team!==side.key))return null;
  const minutes=new Map();
  const rows=players.filter(p=>p.Minutes!=='DNP').map(p=>{
   const id=String(p.Player_ID||'').trim(),name=String(p.Player||'').trim();
   minutes.set(id,p.Minutes||'—');
   return [id,name,...[p.Points,p.OffensiveRebounds,p.DefensiveRebounds,p.Assistances,p.Steals,p.BlocksFavour,p.Turnovers,
    integer(p.FieldGoalsAttempted2)+integer(p.FieldGoalsAttempted3),p.FreeThrowsAttempted].map(integer)];
  });
  return {name:side.name,points:side.points,rows,minutes};
 });
}
function ncaaGroups(raw,match){
 if(String(raw?.contestId)!==match.id||Number(raw.division)!==match.division||
   raw.sportCode!==match.sport||raw.status!=='F'||raw.teams?.length!==2)return null;
 return [match.away,match.home].map((side,index)=>{
  const listed=raw.teams.find(team=>team.isHome===Boolean(index)&&team.seoname===side.key);
  const players=raw.teamBoxscore?.find(team=>listed&&String(team.teamId)===String(listed.teamId))?.playerStats;
  if(!players?.length)return null;
  const minutes=new Map();
  const rows=players.map(p=>{
   const id=String(p.id??''),name=[p.firstName,p.lastName].filter(Boolean).join(' ').trim();
   const reb=integer(p.totalRebounds),oreb=integer(p.offensiveRebounds);
   minutes.set(id,p.minutesPlayed||'—');
   return [id,name,...[p.points,oreb,reb-oreb,p.assists,p.steals,p.blockedShots,p.turnovers,p.fieldGoalsAttempted,p.freeThrowsAttempted].map(integer)];
  });
  return {name:side.name,points:side.points,rows,minutes};
 });
}
function render(raw,match){
 if(match.source==='nba'){
  const teams=raw.header?.competitions?.[0]?.competitors||[];
  const side=(which,expected)=>teams.find(team=>team.homeAway===which&&String(team.score)===String(expected.points)&&
   String(team.team?.abbreviation||'').toUpperCase().replace(/^(?:GS|NO|NY|SA|UTAH|WSH)$/,code=>({GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'}[code]))===expected.key);
  const away=side('away',match.away),home=side('home',match.home);
  return away&&home?impact.gameMarkup(raw,{id:match.id,phase:'final',away,home},'nba'):'';
 }
 const groups=match.source==='euroleague'?euroGroups(raw,match):ncaaGroups(raw,match);
 return groups?.every(Boolean)?renderBox(groups):'';
}
function slot(match){
 const fallback='<p class="ledger26-detail-note">Player box score and RETRO Game Impact are unavailable for this result.</p>';
 if(!match||!/^\d{1,12}$/.test(match.id)||!match.away.key||!match.home.key||match.away.key===match.home.key||
    ![match.away.points,match.home.points].every(value=>Number.isInteger(value)&&value>=0))return fallback;
 return '<div data-verified-impact="'+esc(JSON.stringify(match))+'" aria-live="polite">Opening verified box score…</div>';
}
function ncaaSlot(game,away,home,gender,division){
 const id=String(game?.source_url||'').match(/^https:\/\/(?:www\.)?ncaa\.com\/game\/(\d{7})(?:[/?#].*)?$/i)?.[1];
 return slot({source:'ncaa',id,division,sport:gender==='women'?'WBB':'MBB',
  away:{key:away?.slug,name:away?.name,points:game.away_score},
  home:{key:home?.slug,name:home?.name,points:game.home_score}});
}
async function fill(node){
 if(node.dataset.impactState)return;
 let match;try{match=JSON.parse(node.dataset.verifiedImpact);}catch{return;}
 const source=sources[match.source];
 if(!source||!/^\d{1,12}$/.test(match.id))return;
 node.dataset.impactState='loading';
 const url=source(match.id),key=node.dataset.verifiedImpact;
 if(settled.has(key)){node.innerHTML=settled.get(key);node.dataset.impactState='loaded';return;}
 if(!pending.has(key))pending.set(key,(async()=>{
  const res=await fetch(url,{signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error('Box score unavailable');
  const html=render(await res.json(),match);
  if(html)settled.set(key,html);
  return html;
 })().finally(()=>pending.delete(key)));
 try{
  const html=await pending.get(key);
  node.innerHTML=html||'<p class="ledger26-detail-note">The published player box score could not be reconciled with this final. Impact is unavailable.</p>';
  node.dataset.impactState=html?'loaded':'';
 }catch{
  node.textContent='Player box score and RETRO Game Impact are temporarily unavailable.';
  node.dataset.impactState='';
 }
}
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(details.open&&details.matches?.('details.ledger26-expand'))
  details.querySelectorAll('[data-verified-impact]').forEach(node=>void fill(node));
},true);
window.SLTBoxImpact={render,slot,ncaaSlot,fill};
})();
