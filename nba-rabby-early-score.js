// Experimental early-season NBA score model. Separate from USRS Elo ledger.
// Derives a league total and an Elo-implied margin from verified final scores.
// Not a sportsbook line; insufficient history for calibrated betting probabilities.
(function(root){'use strict';
function build(events){
 if(!Array.isArray(events))return null;
 const valid=events.filter(g=>Number.isFinite(g.home_score)&&Number.isFinite(g.away_score)&&g.home_score>=60&&g.away_score>=60&&g.home_score<=180&&g.away_score<=180);
 if(valid.length<10)return null;
 const totals=valid.map(g=>g.home_score+g.away_score);
 const margins=valid.map(g=>g.home_score-g.away_score);
 const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
 const avg=mean(totals),sd=Math.sqrt(mean(margins.map(x=>(x-mean(margins))**2)));
 if(sd<5||sd>40||avg<160||avg>300)return null;
 return {total:avg,marginSd:sd,games:valid.length,experimental:true};
}
function project(home,away,model,ratings){
 if(!model||!Number.isFinite(ratings?.[home])||!Number.isFinite(ratings?.[away]))return null;
 // Elo logistic probability translated to points using empirical margin dispersion.
 // This is a first-pass distributional approximation, NOT fitted against held-out seasons.
 const eloGap=ratings[home]+45-ratings[away];
 const homeWin=1/(1+10**(-eloGap/400));
 const margin=Math.max(-25,Math.min(25,eloGap*Math.LN10/400*model.marginSd*Math.sqrt(3)/Math.PI));
 const homePoints=(model.total+margin)/2,awayPoints=(model.total-margin)/2;
 return {homePoints,awayPoints,margin,total:model.total,homeWin,projectedWinner:margin>=0?home:away,source:'early-season Elo + captured final scores',provisional:true,sampleGames:model.games};
}
root.RabbyEarlyScore={build,project};
if(typeof module!=='undefined')module.exports={build,project};
})(typeof window!=='undefined'?window:globalThis);
