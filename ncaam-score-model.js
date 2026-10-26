/* The Sporting Life & Times | NCAA men's basketball scoring.
   Elo governs winner and margin. Prior season verified team scoring,
   when published, can inform matchup totals. Never claim pace without possessions. */
window.NCAAMScores=(()=>{
 "use strict";
 const defaults={status:"UNCALIBRATED",mean_team_points:72,elo_margin_slope:1/25,margin_cap:null,minimum_winner_margin:1};
 let fit={...defaults},profiles=null,leagueMean=72;
 const configure=x=>{
   const p=x?.parameters;
   if(x?.status!=="HISTORICAL_HOLDOUT_VALIDATED"||!p||
      !Number.isFinite(p.mean_team_points)||!Number.isFinite(p.elo_margin_slope)||
      p.mean_team_points<45||p.mean_team_points>100||
      p.elo_margin_slope<=0||p.elo_margin_slope>=0.2)return false;
   fit={...defaults,...p,status:x.status};
   return true;
 };
 const configureProfiles=x=>{
   if(x?.status!=="VERIFIED_HISTORICAL_SCORING_PRIORS_NOT_HOLDOUT_CALIBRATED"||
      x.team_count!==365||x.teams?.length!==365||
      !Number.isFinite(x.league_mean_points_per_team))return false;
   const candidate=new Map(x.teams.map(t=>[t.team_id,t]));
   if(candidate.size!==365)return false;
   profiles=candidate;leagueMean=x.league_mean_points_per_team;
   return true;
 };
 const predict=(home,away)=>{
   if(!home||!away||!Number.isFinite(home.elo)||!Number.isFinite(away.elo))return null;
   const difference=home.elo-away.elo;
   const homeProbability=1/(1+Math.pow(10,-difference/400));
   const expectedMargin=fit.elo_margin_slope*difference;
   const ph=profiles?.get(home.team_id),pa=profiles?.get(away.team_id);
   let mean=fit.mean_team_points;
   if(ph&&pa){
     const hp=(ph.projected_offense_ppg+pa.projected_defense_allowed_ppg)/2;
     const ap=(pa.projected_offense_ppg+ph.projected_defense_allowed_ppg)/2;
     if(Number.isFinite(hp)&&Number.isFinite(ap)){
       mean=Math.max(48,Math.min(100,fit.mean_team_points+0.5*((hp+ap)/2-leagueMean)));
     }
   }
   let homeScore=Math.round(mean+expectedMargin/2);
   let awayScore=Math.round(mean-expectedMargin/2);
   if(homeScore===awayScore){
     if(difference>=0)homeScore+=fit.minimum_winner_margin;
     else awayScore+=fit.minimum_winner_margin;
   }
   // Logistic margin distribution chosen to preserve the same neutral-court
   // Elo win probability at the zero threshold. Historical validation pending.
   const marginScale=fit.elo_margin_slope*400/Math.log(10);
   const tail=threshold=>1/(1+Math.exp((threshold-expectedMargin)/marginScale));
   const winBy={10:tail(9.5),20:tail(19.5),30:tail(29.5)};
   const loseBy={10:1-tail(-9.5),20:1-tail(-19.5),30:1-tail(-29.5)};
   return {homeScore,awayScore,homeProbability,awayProbability:1-homeProbability,
      homeWinBy:winBy,awayWinBy:loseBy,
      blowoutStatus:fit.status==="HISTORICAL_HOLDOUT_VALIDATED"?"ASSUMED_DISTRIBUTION_WITH_CALIBRATED_SLOPE":"ILLUSTRATIVE_UNVALIDATED_DISTRIBUTION",
      expectedTotal:2*mean,expectedMargin,teamScoringProfilesAvailable:Boolean(ph&&pa),
      scoringStatus:fit.status,venue:"neutral-unverified"};
 };
 return {configure,configureProfiles,predict};
})();