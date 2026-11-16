/* Sporting Life & Times — national men's soccer tournament projection.
   One verified 48-team field; 47 hypothetical games. No official matchups invented. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SoccerNationalBracket=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ORDER=[1,16,9,8,5,12,13,4,3,14,11,6,7,10,15,2];
 const ROMAN=['I','II','III','IV'];
 let currentRegion=0;
 const html=(tag,cls,value)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(value!==undefined&&value!==null)e.textContent=String(value);
  return e;
 };
 const sameConference=(a,b)=>Boolean(a&&b&&a.conference&&a.conference===b.conference);
 function makeBracket(field,predictor,options={}){
  const ncaa=options.mode==='ncaa';
  if(!Array.isArray(field)||field.length!==48)throw Error('The national bracket requires exactly 48 participants');
  const participants=field.map((t,i)=>({...t,forecast_rank:i+1}));
  const ids=new Set(participants.map(t=>t.team_id));
  if(ids.size!==48||participants.some(t=>!t.team_id||!t.team))throw Error('Duplicate or incomplete national-field teams');
  const at=n=>participants[n-1];
  // NCAA 2026 format: 24 protected entrants. The leading 16 have byes,
  // and the remaining eight enter round one. Distribution of two per
  // quadrant is an editorial projection choice, NOT an NCAA placement rule.
  // Both projections retain independent strength orders, never official NCAA seeds.
  const protectedForBye=new Map(Array.from({length:8},(_,i)=>[16-i,17+i]));
  const slots=ORDER.map(seed=>({seed,x:protectedForBye.get(seed)||null,y:null}));
  const unprotected=Array.from({length:24},(_,i)=>25+i);
  const groupSizes=new Map();
  for(const n of unprotected){
   const key=at(n).conference;
   groupSizes.set(key,(groupSizes.get(key)||0)+1);
  }
  let searched=0;
  function place(remaining){
   if(!remaining.length)return true;
   if(++searched>500000)return false;
   let chosen=-1,options=null;
   for(let i=0;i<slots.length;i++){
    const pod=slots[i];
    if(pod.x&&pod.y)continue;
    const fixed=[pod.seed,pod.x,pod.y].filter(Boolean).map(at);
    const available=remaining.filter(n=>fixed.every(x=>!sameConference(x,at(n))));
    if(!available.length)return false;
    if(options===null||available.length<options.length){chosen=i;options=available;}
   }
   if(chosen<0)return false;
   options.sort((a,b)=>(groupSizes.get(at(a).conference)||0)-(groupSizes.get(at(b).conference)||0)||a-b);
   const pod=slots[chosen],side=pod.x?'y':'x';
   for(const n of options){
    pod[side]=n;
    if(place(remaining.filter(x=>x!==n)))return true;
    pod[side]=null;
   }
   return false;
  }
  if(!place(unprotected))throw Error('Cannot place all teams without an early conference rematch. No matchups will be fabricated');
  if(slots.some(p=>!p.x||!p.y||sameConference(at(p.seed),at(p.x))||sameConference(at(p.seed),at(p.y))||sameConference(at(p.x),at(p.y)))){
   throw Error('Early-round conference separation failed');
  }
  // The national 1–24 ordering is an internal forecast-strength input.
  // Bracket badges reset to seeds 1–6 IN EACH quadrant (four byes plus
  // two first-round protected entrants). Do not rewrite forecast_rank,
  // which remains the source for simulation and conference placement.
  const quadrantSeeds=[];
  for(let quadrant=0;quadrant<4;quadrant++){
   const pods=slots.slice(quadrant*4,quadrant*4+4);
   const seeded=pods.flatMap(p=>[p.seed,p.x,p.y].filter(n=>n&&n<=24))
    .filter((n,i,all)=>all.indexOf(n)===i)
    .sort((a,b)=>a-b);
   if(seeded.length!==6)throw Error('Every quadrant must contain six unique seeded entrants');
   seeded.forEach((rank,i)=>{
    at(rank).quadrant_seed=i+1;
    at(rank).quadrant_number=quadrant+1;
   });
   quadrantSeeds.push(seeded);
  }
  function match(a,b,id,stage,homePending,awayPending){
   let p=null,winner=null,expected=null;
   if(a&&b&&ncaa){
    if(!Number.isInteger(a.rpi_rank)||!Number.isInteger(b.rpi_rank)||a.rpi_rank===b.rpi_rank)
     throw Error('Missing or tied source RPI rank in NCAA projection '+id);
    // This explicitly is an RPI-rank advancement PICK, not a win probability.
    // No RETRO model, Elo, score, or simulated percentage is read here.
    winner=a.rpi_rank<b.rpi_rank?a:b;
   }else if(a&&b&&predictor&&Number.isFinite(Number(a.elo))&&Number.isFinite(Number(b.elo))){
    const outcome=predictor(Number(a.elo),Number(b.elo),{neutral:true});
    p=outcome?.advanceHome;
    if(!Number.isFinite(p)||p<0||p>1||Math.abs(p+(outcome?.advanceAway??NaN)-1)>0.00001){
     throw Error('Invalid RETRO knockout probability for '+id);
    }
    winner=p>=0.5?a:b;
    expected=outcome.expectedGoals||null;
   }
   return {id,stage,home:a||null,away:b||null,homePending:homePending||'Previous-round winner',
    awayPending:awayPending||'Previous-round winner',probabilityHome:p,winner,expectedGoals:expected};
  }
  const regions=[];
  for(let region=0;region<4;region++){
   const four=slots.slice(region*4,region*4+4);
   const first=four.map((s,i)=>match(at(s.x),at(s.y),'R1-'+(region*4+i+1),'FIRST ROUND'));
   const second=four.map((s,i)=>match(at(s.seed),first[i].winner,'R2-'+(region*4+i+1),'SECOND ROUND',null,'Winner of '+first[i].id));
   const third=[0,2].map((i,k)=>match(second[i].winner,second[i+1].winner,'R3-'+(region*2+k+1),'THIRD ROUND','Winner of '+second[i].id,'Winner of '+second[i+1].id));
   const quarter=match(third[0].winner,third[1].winner,'QF-'+(region+1),'QUARTERFINAL','Winner of '+third[0].id,'Winner of '+third[1].id);
   regions.push({number:region+1,name:'QUADRANT '+ROMAN[region],anchor:at(quadrantSeeds[region][0]),seeded:quadrantSeeds[region].map(at),byes:four.map(s=>at(s.seed)),
    first,second,third,quarter});
  }
  const semifinals=[
   match(regions[0].quarter.winner,regions[1].quarter.winner,'SF-1','COLLEGE CUP SEMIFINAL',
    'Quadrant I winner','Quadrant II winner'),
   match(regions[2].quarter.winner,regions[3].quarter.winner,'SF-2','COLLEGE CUP SEMIFINAL',
    'Quadrant III winner','Quadrant IV winner')
  ];
  const championship=match(semifinals[0].winner,semifinals[1].winner,'F-1','NATIONAL FINAL',
   'Semifinal 1 winner','Semifinal 2 winner');
  const openingRanks=slots.flatMap(s=>[s.x,s.y]);
  const earlyProtected=openingRanks.filter(n=>n>=17&&n<=24);
  if(new Set(openingRanks).size!==32||earlyProtected.length!==8||
     regions.some(r=>r.first.flatMap(m=>[m.home,m.away]).filter(t=>t.forecast_rank>=17&&t.forecast_rank<=24).length!==2)){
   throw Error('Protected-team distribution or opening field is invalid');
  }
  return {field:participants,slots,regions,semifinals,championship,
   matchCount:4*(4+4+2+1)+3,earlyRoundConferenceSafe:true,
   provisional:true,sourceType:ncaa?'NCAA RPI-led résumé projection':'RETRO strength-order projection'};
 }
 const winnerText=(t)=>t?.team||'No predicted winner';
 function schoolLine(team,pick,percentage,branding,pending,options={}){
  const line=html('div','snb-team'+(pick?' snb-picked':''));
  if(!team){line.append(html('span','snb-pending',pending));return line;}
  const forecastSeed=Number.isInteger(team.quadrant_seed);
  const badge=html('span',forecastSeed?'snb-seed-badge':'snb-seed-spacer',
    forecastSeed?String(team.quadrant_seed):'');
  if(forecastSeed){
    badge.setAttribute('title',(options.mode==='ncaa'?'RPI-led projected seed #':'RETRO projected seed #')+team.quadrant_seed+' in quadrant '+ROMAN[team.quadrant_number-1]+' — not an official NCAA committee seed');
    badge.setAttribute('aria-label',(options.mode==='ncaa'?'RPI-led projected seed ':'RETRO projected seed ')+team.quadrant_seed+' in quadrant '+ROMAN[team.quadrant_number-1]);
  }else badge.setAttribute('aria-hidden','true');
  line.append(badge);
  const crest=window.CollegeSoccerCupUI.crest(team.team,team.team_id,'men-d1',branding);
  crest.classList.add('snb-crest');
  line.append(crest);
  const copy=html('span','snb-school-name');
  const link=html('a','snb-school-link',team.team);
  link.href='college-soccer-team.html?team='+encodeURIComponent('men-d1:'+team.team_id);
  copy.append(link);
  if(forecastSeed)copy.append(html('small','snb-seed',options.mode==='ncaa'?'RPI SEED PROJECTION':'RETRO SEED'));
  if(options.mode==='ncaa'&&Number.isInteger(team.rpi_rank))copy.append(html('small','snb-rpi-rank','NCAA RPI #'+team.rpi_rank));
  line.append(copy);
  if(percentage!==null)line.append(html('span','snb-percentage',Math.round(percentage*100)+'%'));
  return line;
 }
 function card(game,branding,options={}){
  const article=html('article','snb-match');
  article.dataset.matchId=game.id;
  const header=html('div','snb-match-header');
  header.append(html('span',null,game.id),html('span',null,game.stage));
  article.append(header);
  const p=game.probabilityHome;
  article.append(schoolLine(game.home,game.winner===game.home&&!!game.winner,p,branding,game.homePending,options));
  article.append(schoolLine(game.away,game.winner===game.away&&!!game.winner,p===null?null:1-p,branding,game.awayPending,options));
  const foot=html('div','snb-match-foot');
  if(game.winner){
   foot.append(html('span','snb-pick-label',options.mode==='ncaa'?'RPI-BASED PICK':'RETRO PICK'));
   foot.append(html('strong',null,winnerText(game.winner)));
   if(game.expectedGoals&&Number.isFinite(game.expectedGoals.home)&&Number.isFinite(game.expectedGoals.away)){
    foot.append(html('small',null,'xG '+game.expectedGoals.home.toFixed(2)+'–'+game.expectedGoals.away.toFixed(2)));
   }
  }else foot.append(html('span',null,'Winner determined by prior rounds · prediction not available'));
  article.append(foot);
  return article;
 }
 function section(title,sub,games,branding,cls,options={}){
  const round=html('section','snb-round '+cls);
  const head=html('header','snb-round-head');
  const order=html('span','snb-round-count',sub);
  head.append(html('h4',null,title),order);round.append(head);
  const stack=html('div','snb-round-stack');
  for(const m of games)stack.append(card(m,branding,options));
  round.append(stack);return round;
 }
 function render(container,field,branding,predictor,options={}){
  const bracket=html('section','snb-edition');
  bracket.id='snb-national-bracket';
  bracket.setAttribute('aria-label','Projected NCAA Division I mens soccer 48-team knockout bracket');
  container.append(bracket);
  let projection;
  try{projection=makeBracket(field,predictor,options);}
  catch(error){
   bracket.append(html('p','snb-error','NATIONAL BRACKET WITHHELD: '+error.message));
   return null;
  }
  const hero=html('header','snb-hero');
  const ncaa=options.mode==='ncaa';
  bracket.classList.add(ncaa?'snb-ncaa-model':'snb-retro-model');
  const kicker=html('span','snb-kicker',ncaa?'FINAL PRE-SELECTION NCAA RÉSUMÉ PREDICTION · 2026':'INDEPENDENT RETRO PROJECTION · 2026');
  hero.append(kicker,html('h2',null,'THE ROAD TO THE COLLEGE CUP'));
  hero.append(html('p',null,'48 teams · 16 first-round fixtures · 16 opening byes · 4 regional champions · 1 national title'));
  const summary=html('div','snb-edition-stamp');
  summary.append(html('span',null,(ncaa?'NCAA RPI SOURCE: ':'RETRO CUTOFF: ')+(options.cutoff||'not confirmed')));
  summary.append(html('span',null,String(options.confirmed||0)+' CONFERENCE CHAMPIONS VERIFIED'));
  summary.append(html('span',null,ncaa?'NCAA CRITERIA PROXY · NOT COMMITTEE SELECTION':'RETRO FORECAST · NOT COMMITTEE SELECTION'));
  if(ncaa)summary.append(html('span',null,'NO RETRO RATINGS OR WIN PROBABILITIES'));
  hero.append(summary);bracket.append(hero);
  const legend=html('div','snb-seed-legend');
  const example=html('span','snb-seed-badge','1');example.setAttribute('aria-hidden','true');
  legend.append(example,html('span',null,(ncaa?'Numbered badge = RPI-led projected seed':'Numbered badge = RETRO projected seed')+' (1–6 within each quadrant), NOT an official NCAA seed. Each quadrant has four bye teams and two seeded first-round entrants.'));
  bracket.append(legend);
  const explanation=html('p','snb-methodology',ncaa?
   'NCAA-based independent pre-selection forecast. Uses all 23 source-certified conference champions; the published November 14 NCAA RPI rankings and Division I .500 record screen for 25 at-large candidates. The 24 projected seeded entrants are numbered 1–6 inside each of the four quadrants; they are NOT announced NCAA committee seeds. Head-to-head, common-opponent, late-season résumé adjustments, and official hosting are incomplete. An RPI favorite advances each hypothetical matchup; no RETRO inputs are used.':
   'Independent RETRO scenario (NOT NCAA selections). 23 AQs plus 25 provisional at-large picks; six RETRO-ranked projected seeds in each quadrant and 16 byes. First-game conference rematches avoided. Hosting and geography unverified; win probabilities assume neutral sites.');
  bracket.append(explanation);
  // Make the far end of the national bracket visible immediately, without
  // scrolling down to the separate College Cup cards.
  const finalRail=html('section','snb-final-rail');
  finalRail.setAttribute('aria-label','Projected College Cup semifinals and final');
  finalRail.append(html('strong',null,'COLLEGE CUP · AT A GLANCE'));
  for(const game of projection.semifinals)finalRail.append(html('span',null,
   winnerText(game.home)+' vs '+winnerText(game.away)));
  finalRail.append(html('strong',null,'FINAL'));
  finalRail.append(html('span',null,winnerText(projection.championship.home)+' vs '+winnerText(projection.championship.away)));
  finalRail.append(html('b',null,(ncaa?'RPI PICK: ':'RETRO PICK: ')+winnerText(projection.championship.winner)));
  bracket.append(finalRail);
  const regions=html('section','snb-regions');
  const regionHead=html('div','snb-region-heading');
  regionHead.append(html('h3',null,'FOUR COMPLETE BRACKET QUADRANTS'),html('p',null,'All four rounds visible together on desktop. Mobile: choose the round, no sideways scrolling.'));
  regions.append(regionHead);
  const tabs=html('div','snb-region-tabs');
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Choose projected bracket region');
  const stage=html('div','snb-region-stage');stage.id='snb-region-stage';
  const buttons=[];
  function switchRegion(index){
   currentRegion=index;
   const r=projection.regions[index];
   buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
   stage.replaceChildren();
   stage.append(html('p','snb-region-deck','Quadrant '+ROMAN[index]+' · '+(ncaa?'RPI projected #':'RETRO #')+r.anchor.quadrant_seed+' '+r.anchor.team+' · 4 first-round · 4 second-round · 2 third-round · 1 quarterfinal.'));
   const switchers=html('nav','snb-mobile-round-tabs');
   switchers.setAttribute('aria-label','Choose a bracket round on small screens');
   const rounds=[['Round 1','first'],['Round 2','second'],['Round 3','third'],['Quarterfinal','quarter']];
   const roundButtons=[];
   function changeRound(value){
    stage.dataset.mobileRound=value;
    roundButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(rounds[i][1]===value)));
   }
   for(const [title,key] of rounds){
    const b=html('button',null,title);b.type='button';
    b.addEventListener('click',()=>changeRound(key));
    roundButtons.push(b);switchers.append(b);
   }
   stage.append(switchers);
   const scroller=html('div','snb-region-scroll');
   scroller.setAttribute('aria-label','All four knockout rounds for '+r.name+' without horizontal scrolling');
   const grid=html('div','snb-round-grid');
   grid.append(section('FIRST ROUND','4 MATCHES',r.first,branding,'snb-first',options));
   grid.append(section('SECOND ROUND','4 MATCHES · BYES ENTER',r.second,branding,'snb-second',options));
   grid.append(section('THIRD ROUND','2 MATCHES',r.third,branding,'snb-third',options));
   grid.append(section('QUARTERFINAL','REGIONAL WINNER', [r.quarter],branding,'snb-quarter',options));
   scroller.append(grid);stage.append(scroller);
   changeRound('first');
   const footer=html('div','snb-region-winner');
   footer.append(html('span',null,'QUADRANT '+ROMAN[index]+' · '+(ncaa?'RPI FAVORED':'RETRO ADVANCES')));
   footer.append(html('strong',null,winnerText(r.quarter.winner)));
   stage.append(footer);
  }
  for(let i=0;i<4;i++){
   const r=projection.regions[i],button=html('button','snb-region-tab');
   button.type='button';button.setAttribute('role','tab');
   button.setAttribute('aria-controls','snb-region-stage');
   button.append(html('span',null,'QUADRANT '+ROMAN[i]),html('strong',null,(ncaa?'RPI ':'RETRO ')+'#'+r.anchor.quadrant_seed+' '+r.anchor.team));
   button.addEventListener('click',()=>switchRegion(i));
   button.addEventListener('keydown',event=>{
    const direction=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
    if(direction){event.preventDefault();switchRegion((i+4+direction)%4);buttons[currentRegion].focus();}
   });
   buttons.push(button);tabs.append(button);
  }
  regions.append(tabs,stage);bracket.append(regions);
  switchRegion(Math.max(0,Math.min(3,currentRegion)));
  const cup=html('section','snb-college-cup');
  cup.append(html('span','snb-kicker','THE FINAL FOUR'),html('h3',null,'THE COLLEGE CUP'));
  cup.append(html('p',null,'Predicted quadrant winners advance to the College Cup. The NCAA committee has not announced these pairings.'));
  const cupGrid=html('div','snb-cup-grid');
  cupGrid.append(section('SEMIFINALS','2 MATCHES',projection.semifinals,branding,'snb-semifinal',options));
  cupGrid.append(section('NATIONAL CHAMPIONSHIP','1 MATCH', [projection.championship],branding,'snb-final',options));
  cup.append(cupGrid);
  const winner=html('div','snb-champion');
  winner.append(html('span',null,ncaa?'RPI-LED NATIONAL TITLE PICK':'RETRO NATIONAL TITLE PICK'),html('strong',null,winnerText(projection.championship.winner)));
  cup.append(winner);bracket.append(cup);
  bracket.append(html('p','snb-disclaimer',ncaa?'Nov. 14 RPI ranking and certified conference champions through Nov. 15; not the committee announcement. NCAA uses additional unmeasured résumé factors and host/geographic placement. All 47 predicted matchups and winners are illustrative, with NO RETRO ratings used.':'RETRO knockout percentages are provisional neutral-site Poisson estimates. This is not official NCAA selection, seeding or bracket placement.'));
  return projection;
 }
 return Object.freeze({makeBracket,render});
});