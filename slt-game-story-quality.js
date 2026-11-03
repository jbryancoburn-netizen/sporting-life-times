/* Sporting Life & Times — Game Story quality gate.
 * Standalone, zero-dependency JavaScript. Does not modify data feeds or workflows.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.SLTGameStoryQuality=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const isNum=x=>typeof x==="number"&&Number.isFinite(x);
  const issue=(code,message)=>({code,message});
  const okay=v=>({ok:v.length===0,issues:v});
  function footballField(){
    return {yardMarkers:[0,10,20,30,40,50,40,30,20,10,0],
      centerLabel:"50",leftEndZone:"GOAL",rightEndZone:"GOAL",
      coordinateSystem:"absolute 0-100 from left goal line; labels mirrored after midfield"};
  }
  function footballFieldPosition(pos,side,offense){
    if(!Number.isInteger(pos)||pos<0||pos>50) return {ok:false,reason:"Yard line must be an integer 0–50"};
    if(!side||!offense)return {ok:false,reason:"Possession and field side are required"};
    if(pos===50)return {ok:true,x:50,label:"50",territory:"MIDFIELD"};
    const own=String(side).toUpperCase()===String(offense).toUpperCase();
    return {ok:true,x:own?pos:100-pos,label:String(side).toUpperCase()+" "+pos,territory:own?"OWN":"OPPONENT"};
  }
  function validateGame(game){
    const issues=[];
    if(!game||typeof game!=="object")return okay([issue("NO_GAME","Missing game object")]);
    if(!game.id)issues.push(issue("NO_ID","A stable game ID is required"));
    if(!game.sport)issues.push(issue("NO_SPORT","Sport is required"));
    if(!game.away||!game.home||game.away===game.home)issues.push(issue("TEAMS","Distinct away and home teams are required"));
    const scores=[game.awayScore,game.homeScore];
    if(scores.some(v=>v!==null&&v!==undefined&&(!Number.isInteger(v)||v<0)))issues.push(issue("SCORE_RANGE","Scores must be nonnegative integers or unavailable"));
    if(game.status==="final"&&scores.some(v=>!Number.isInteger(v)))issues.push(issue("FINAL_SCORE","Final games require both final scores"));
    if(game.status==="final"&&scores.every(Number.isInteger)&&game.sport==="basketball"&&scores[0]===scores[1])issues.push(issue("BASKETBALL_TIE","Final basketball games cannot end tied"));
    if(game.probability!==undefined&&game.probability!==null&&(!isNum(game.probability)||game.probability<0||game.probability>1))issues.push(issue("PROBABILITY","Model probability must be between 0 and 1"));
    if(game.stats)for(const [key,obj] of Object.entries(game.stats)){
      if(!obj||typeof obj!=="object")continue;
      for(const [k,v] of Object.entries(obj)){
        if(v===null||v===undefined)continue;
        if((/pct|percentage|percent/i).test(k)&&(!isNum(v)||v<0||v>100))issues.push(issue("PERCENT_RANGE",key+"."+k+" must be 0–100 (percentage points)"));
        if((/^(fg|three|ft|freeThrow|fieldGoal)(made|attempted|m|a)$/i).test(k)&&(!Number.isInteger(v)||v<0))issues.push(issue("COUNT_RANGE",key+"."+k+" must be a nonnegative integer"));
      }
      for(const [made,attempted] of [["fgMade","fgAttempted"],["threeMade","threeAttempted"],["ftMade","ftAttempted"]]){
        if(isNum(obj[made])&&isNum(obj[attempted])&&obj[made]>obj[attempted])issues.push(issue("MAKES_EXCEED_ATTEMPTS",key+" "+made+" cannot exceed "+attempted));
      }
    }
    return okay(issues);
  }
  function validateEvents(game,events){
    const issues=[];if(!Array.isArray(events))return okay([issue("EVENTS_MISSING","Event array required")]);
    let away=0,home=0,previous=-Infinity;
    events.forEach((e,i)=>{
      if(!e||!isNum(e.elapsedSeconds)||e.elapsedSeconds<0||e.elapsedSeconds<previous)issues.push(issue("CHRONOLOGY","Event "+i+" has invalid chronological elapsed time"));
      if(e&&isNum(e.elapsedSeconds))previous=e.elapsedSeconds;
      if(e&&e.type==="score"){
        if(!["away","home"].includes(e.side)||!Number.isInteger(e.points)||e.points<=0)issues.push(issue("SCORE_EVENT","Invalid scoring event "+i));
        else if(e.side==="away")away+=e.points;else home+=e.points;
      }
    });
    if(game&&game.status==="final"&&issues.length===0&&(away!==game.awayScore||home!==game.homeScore))issues.push(issue("EVENT_SCORE_MISMATCH","Event points "+away+"–"+home+" do not reconcile with final "+game.awayScore+"–"+game.homeScore));
    return okay(issues);
  }
  function scoringRuns(game,events){
    const checked=validateEvents(game,events);
    if(!checked.ok)return {ok:false,issues:checked.issues,runs:[]};
    const runs=[];let current=null;
    events.filter(e=>e.type==="score").forEach(e=>{
      if(!current||current.side!==e.side){if(current)runs.push(current);current={side:e.side,points:e.points,start:e.elapsedSeconds,end:e.elapsedSeconds};}
      else {current.points+=e.points;current.end=e.elapsedSeconds;}
    });
    if(current)runs.push(current);
    return {ok:true,runs:runs.sort((a,b)=>b.points-a.points)};
  }
  function validateMetric(metric){
    const issues=[];
    if(!metric||typeof metric!=="object")return okay([issue("METRIC_MISSING","Metric unavailable")]);
    if(!metric.label||!isNum(metric.value))issues.push(issue("METRIC_VALUE","Metric requires a label and finite value"));
    if(!["recorded","calculated","model"].includes(metric.kind))issues.push(issue("METRIC_KIND","Identify recorded, calculated, or model statistic"));
    if(!metric.source||!metric.source.name||!metric.source.retrievedAt)issues.push(issue("METRIC_SOURCE","Source name and retrieval timestamp required"));
    if(metric.kind==="calculated"&&!metric.formula)issues.push(issue("METRIC_FORMULA","Calculated statistics need a reproducible formula"));
    if(metric.kind==="model"&&!metric.modelVersion)issues.push(issue("MODEL_VERSION","Model outputs need a model version"));
    if(metric.value!==undefined&&(/probability/i).test(metric.label)&&(!isNum(metric.value)||metric.value<0||metric.value>1))issues.push(issue("MODEL_RANGE","Probabilities must be 0–1 internally"));
    return okay(issues);
  }
  function storyClaim(claim){
    if(!claim||!claim.text)return {allowed:false,reason:"Missing claim"};
    if(claim.type==="fact")return {allowed:!!claim.source,reason:claim.source?"":"Factual claims require evidence"};
    if(claim.type==="interpretation")return {allowed:!!claim.criteria&&!!claim.evidence,reason:claim.criteria&&claim.evidence?"":"Interpretation must identify criteria and evidence"};
    return {allowed:false,reason:"Unknown claim type"};
  }
  function displayMetric(metric){
    const status=validateMetric(metric);
    return status.ok?{visible:true,value:metric.value,label:metric.label,kind:metric.kind,source:metric.source.name}:{visible:false,label:metric?.label||"Unavailable",message:"Verified data unavailable",issues:status.issues};
  }
  return Object.freeze({footballField,footballFieldPosition,validateGame,validateEvents,scoringRuns,validateMetric,storyClaim,displayMetric});
});
