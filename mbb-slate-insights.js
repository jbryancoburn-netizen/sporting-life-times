/* Source-gated scoring and performance insights for the NCAA slate.
   No unsourced offensive/defensive efficiency, possession counts or runs. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.SLTBasketballInsights=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
 function seasonProfiles(events){
  const teams=new Map();
  const get=id=>{if(!teams.has(String(id)))teams.set(String(id),{pf:0,pa:0,w:0,l:0,g:0,homeW:0,homeL:0,homeG:0,results:[]});return teams.get(String(id))};
  for(const e of events||[]){
   if(!e||!String(e.home_id||'').startsWith('ncaa:')||!String(e.away_id||'').startsWith('ncaa:')||e.home_id===e.away_id)continue;
   const h=finite(e.home_score),a=finite(e.away_score);
   if(h===null||a===null||h===a)continue;
   for(const [id,scored,allowed,home] of [[e.home_id,h,a,true],[e.away_id,a,h,false]]){
     const p=get(id);p.g++;p.pf+=scored;p.pa+=allowed;const won=scored>allowed;p.w+=Number(won);p.l+=Number(!won);
     p.results.push({date:String(e.date||''),result:won?'W':'L',margin:scored-allowed});
     if(home&&e.neutral===false&&e.site_verified===true){p.homeG++;p.homeW+=Number(won);p.homeL+=Number(!won)}
   }
  }
  for(const p of teams.values())p.results.sort((a,b)=>a.date.localeCompare(b.date));
  return teams;
 }
 function matchBox(g,feed,gender){
  if(g?.kind!=='regular'||g.phase!=='final'||g.away?.score===null||g.home?.score===null)return null;
  const data=feed?.ncaa_team_boxscores?.games||{},matches=Object.values(data).filter(b=>
    String(b?.espn_id||'')===String(g.id)&&b.gender===gender&&b.day===g.day&&
    finite(b.away?.pts)===g.away.score&&finite(b.home?.pts)===g.home.score&&
    /^https:\/\/[^\s"'<>]+$/.test(b.source_url||''));
  return matches.length===1?matches[0]:null;
 }
 const poss=x=>{const f=finite(x?.fga),o=finite(x?.oreb),t=finite(x?.tov),ft=finite(x?.fta);
   return f!==null&&o!==null&&t!==null&&ft!==null&&f>0&&o<=f?f-o+t+0.475*ft:null};
 function gameNumbers(g,feed,gender){
  const box=matchBox(g,feed,gender);if(!box)return null;
  const away=box.away,home=box.home,pA=poss(away),pH=poss(home);
  const pct=(n,d)=>finite(n)!==null&&finite(d)>0?Math.round(100*Number(n)/Number(d)*10)/10:null;
  const metrics=[
    {label:'FIELD GOAL %',away:pct(away.fgm,away.fga),home:pct(home.fgm,home.fga),suffix:'%'},
    {label:'THREE POINT %',away:pct(away.tpm,away.tpa),home:pct(home.tpm,home.tpa),suffix:'%'},
    {label:'REBOUNDS',away:finite(away.reb),home:finite(home.reb)},
    {label:'TURNOVERS',away:finite(away.tov),home:finite(home.tov)},
    {label:'ASSISTS',away:finite(away.ast),home:finite(home.ast)}
  ].filter(row=>row.away!==null&&row.home!==null);
  if(pA!==null&&pH!==null&&pA>0&&pH>0){
    const possessions=(pA+pH)/2;
    metrics.push({label:'EST. POSSESSIONS',away:Math.round(possessions),home:Math.round(possessions)});
    metrics.push({label:'GAME OFFRTG',away:Math.round(100*g.away.score/possessions),
      home:Math.round(100*g.home.score/possessions)});
    metrics.push({label:'GAME DEFRTG',away:Math.round(100*g.home.score/possessions),
      home:Math.round(100*g.away.score/possessions)});
  }
  return {metrics,source:box.source,source_url:box.source_url,
    caveat:'Estimated possessions = FGA − offensive rebounds + turnovers + 0.475 × FTA. Ratings are single-game estimates, not season-adjusted efficiencies.'};
 }
 function gameLeaders(g,feed,gender){
  if(g?.phase!=='final'||g.kind!=='regular')return[];
  const rows=Object.values(feed?.ncaa_player_boxscores?.games||{}).filter(b=>
    String(b?.espn_id||'')===String(g.id)&&b.gender===gender&&b.day===g.day&&
    /^https:\/\/[^\s"'<>]+$/.test(b.source_url||'')&&
    finite(b.away?.score)===g.away.score&&finite(b.home?.score)===g.home.score);
  if(rows.length!==1)return[];
  const box=rows[0];
  return [['away',g.away],['home',g.home]].flatMap(([side,team])=>{
    const players=box[side]?.players||[];
    if(!players.length)return[];
    const best=[...players].filter(p=>finite(p.pts)!==null&&p.name)
      .sort((a,b)=>(Number(b.pts)-Number(a.pts))||(Number(b.reb)-Number(a.reb)))[0];
    if(!best)return[];
    return [{name:String(best.name),school:team.name,pts:best.pts,reb:best.reb,ast:best.ast,url:box.source_url}];
  });
 }
 function projectedScore(g,calibration,ratings){
  const params=calibration?.parameters||{},model=String(calibration?.model||'');
  if(g?.phase!=='upcoming'||g.kind!=='regular'||g.probability===null||
    !model.startsWith('ncaam-venue-neutral-historical-score')||
    !['HISTORICAL_HOLDOUT_VALIDATED','EXTRAPOLATION_UNVALIDATED'].includes(calibration.status))return null;
  const a=ratings?.get(String(g.away.canonical)),h=ratings?.get(String(g.home.canonical));
  const ae=finite(a?.elo),he=finite(h?.elo),mean=finite(params.mean_team_points),
    slope=finite(params.elo_margin_slope);
  if([ae,he,mean,slope].some(x=>x===null)||mean<=0||slope<=0)return null;
  let margin=(he-ae)*slope;
  let home=Math.round(mean+margin/2),away=Math.round(mean-margin/2);
  if(home===away){if(g.probability>=0.5)home+=1;else away+=1}
  return {away,home,model:'HISTORICAL NEUTRAL-COURT SCORE PROJECTION',
    caveat:'Illustrative uncapped neutral-court scoring means; extrapolation to extreme mismatches is not separately validated. Not a venue-specific or player-availability model.'};
 }
 function scoreDelta(prev,current){
  if(!prev||!current||current.phase!=='live'||prev.day!==current.day||String(prev.id)!==String(current.id))return null;
  const ah=finite(prev.away_score),hh=finite(prev.home_score),aa=finite(current.away.score),ha=finite(current.home.score);
  if([ah,hh,aa,ha].some(x=>x===null)||aa<ah||ha<hh)return null;
  if(aa===ah&&ha===hh)return null;
  return {away:aa-ah,home:ha-hh,clock:current.status||'Live',note:'Changes since the last source refresh, not a verified scoring run.'};
 }
 return {seasonProfiles,matchBox,gameNumbers,gameLeaders,scoreDelta,projectedScore};
});
