/* NCAA men's basketball score forecasts v1. Venue-neutral until verified.
  Probabilities from the selected Elo; scoring mean and slope from independently
  recorded calibration parameters. No fabricated team offense/defense inputs. */
window.NCAAMScores=(()=>{
 const defaults={status:"UNCALIBRATED",mean_team_points:72,elo_margin_slope:1/25,margin_cap:28,minimum_winner_margin:1};
 let fit=defaults;
 const configure=x=>{if(x?.status==="HISTORICAL_HOLDOUT_VALIDATED"&&
 Number.isFinite(x?.parameters?.mean_team_points)&&
 Number.isFinite(x?.parameters?.elo_margin_slope)&&
 x.parameters.mean_team_points>=45&&x.parameters.mean_team_points<=100&&
 x.parameters.elo_margin_slope>0&&x.parameters.elo_margin_slope<0.2){
 fit={...defaults,...x.parameters,status:x.status};return true}return false};
 const predict=(home,away)=>{
  if(!home||!away||!Number.isFinite(home.elo)||!Number.isFinite(away.elo))return null;
  const diff=home.elo-away.elo;
  const homeProbability=1/(1+Math.pow(10,-diff/400));
  const margin=Math.max(-fit.margin_cap,Math.min(fit.margin_cap,fit.elo_margin_slope*diff));
  let h=Math.round(fit.mean_team_points+margin/2);
  let a=Math.round(fit.mean_team_points-margin/2);
  if(h===a){if(diff>=0)h+=fit.minimum_winner_margin;else a+=fit.minimum_winner_margin}
  return {homeScore:h,awayScore:a,homeProbability,awayProbability:1-homeProbability,
          expectedTotal:2*fit.mean_team_points,expectedMargin:margin,
          scoringStatus:fit.status,venue:"neutral-unverified"};
 };
 return {configure,predict};
})();