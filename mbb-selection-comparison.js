/* MBB conference and selection comparison, independent of Elo publication. */
(()=>{'use strict';
if(!['conference','tournament'].includes(document.body.dataset.page))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fetchJSON=async p=>{try{const r=await fetch(p,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}};
const getId=g=>[g.home_id||g.home,g.away_id||g.away];
const name=t=>'<a href="ncaam-team.html?team='+encodeURIComponent(t.team_id)+'">'+esc(t.team)+'</a>';
const record=t=>((t.conference_wins||0)+'–'+(t.conference_losses||0));
const winner=g=>Number(g.home_score)>Number(g.away_score)?getId(g)[0]:getId(g)[1];
const completed=g=>g.home_score!==undefined&&g.home_score!==null&&g.away_score!==undefined&&g.away_score!==null;
function order(members,games){
 const scores=new Map(members.map(t=>[t.team_id,{t,w:0,l:0}]));
 for(const g of games){if(!completed(g))continue;const [h,a]=getId(g);if(!scores.has(h)||!scores.has(a))continue;const w=winner(g),loser=w===h?a:h;scores.get(w).w++;scores.get(loser).l++;}
 const any=[...scores.values()].some(x=>x.w+x.l);
 if(!any)return {rows:[...members].sort((a,b)=>b.elo-a.elo),earned:false,records:scores};
 const rows=[...members].sort((a,b)=>{const x=scores.get(a.team_id),y=scores.get(b.team_id);const px=x.w/(x.w+x.l||1),py=y.w/(y.w+y.l||1);return py-px||b.elo-a.elo;});
 return {rows,earned:true,records:scores};
}
function projectedBracket(rows){
 let stage=rows.map((t,i)=>({seed:i+1,team:t}));
 const rounds=[];let r=0;
 while(stage.length>1&&r<7){const n=2**Math.ceil(Math.log2(stage.length)),byes=n-stage.length,matchups=[];let contestants=[...stage];if(r===0){const upper=contestants.slice(0,byes);const lower=contestants.slice(byes);const pairs=[];while(lower.length>1){pairs.push([lower.shift(),lower.pop()]);}if(lower.length)pairs.push([lower.shift(),null]);matchups.push(...upper.map(x=>({teams:[x],bye:true})),...pairs.map(p=>({teams:p.filter(Boolean),bye:false})));}else{for(let i=0;i<contestants.length;i+=2)matchups.push({teams:contestants.slice(i,i+2)});}
 rounds.push(matchups);stage=matchups.map(m=>m.teams.reduce((a,b)=>a.seed<b.seed?a:b));r++;
 }
 return rounds;
}
function bigTenBracket(members,seedRows){
 const seeded=seedRows.map((t,i)=>({team:t,seed:i+1}));
 const stages=[[],[],[],[],[],[]];
 const games=new Map();
 const match=(round,id,one,two)=>{
  const slot=value=>typeof value==='number'?seeded[value-1]:null;
  const game={id,a:slot(one),b:slot(two),one,two};
  stages[round].push(game);games.set(id,game);
 };
 // Actual Big Ten 18-team bracket entry points; no winners are forecast.
 match(0,'G1',16,17);match(0,'G2',15,18);
 match(1,'G3','G1',9);match(1,'G4',12,13);
 match(1,'G5','G2',10);match(1,'G6',11,14);
 match(2,'G7','G3',8);match(2,'G8','G4',5);
 match(2,'G9','G5',7);match(2,'G10','G6',6);
 match(3,'G11','G7',1);match(3,'G12','G8',4);
 match(3,'G13','G9',2);match(3,'G14','G10',3);
 match(4,'G15','G11','G12');match(4,'G16','G13','G14');
 match(5,'G17','G15','G16');
 const labels=['Mar 9 · First','Mar 10 · Second','Mar 11 · Third','Mar 12 · Quarters','Mar 13 · Semis','Mar 14 · Final'];
 const teamLine=(p,source)=>'<div class="bten-bracket-team">'+(p?'<span class="bten-seed">'+p.seed+'</span>'+name(p.team):'<span class="bten-slot">'+esc('Winner '+source.replace(/^G/,'G'))+'</span>')+'</div>';
 return '<div class="bten-bracket-scroll"><div class="bten-bracket-grid">'+stages.map((round,index)=>
  '<div class="bten-round"><h3>'+labels[index]+'</h3><div class="bten-round-track">'+round.map((m,i)=>
    '<div class="bten-game bten-position-'+(index+1)+'-'+(i+1)+'"><div class="bten-game-id">GAME '+m.id.slice(1)+'</div>'+teamLine(m.a,m.one)+teamLine(m.b,m.two)+'</div>').join('')+'</div></div>').join('')+'</div></div>';
}
function buildConference(app,teams,games,conference){
 const members=teams.filter(t=>t.conference===conference);if(!members.length)return;
 const o=order(members,games),rounds=projectedBracket(o.rows),noFinals=!o.earned;
 if(conference==='Big Ten'){
  const section=document.createElement('section');section.className='panel bten-bracket-section';section.id='conference-tournament-watch';
  section.innerHTML='<div class="eyebrow">2027 Big Ten Men’s Basketball Tournament</div><h2>Road to the automatic bid</h2>'+
   '<p class="note">Official tournament structure: 18 teams · March 9–14, 2027 · Gainbridge Fieldhouse, Indianapolis. These are <strong>projected seed positions</strong>, not official seeds or actual game results. Future tip times and networks are not yet announced.</p>'+
   '<div class="bten-bracket-key">Seeds 1–4 enter quarterfinals · 5–8 enter third round · 9–14 enter second round · 15–18 begin in the first round</div>'+
   bigTenBracket(members,o.rows);
  const target=app.querySelector('.grid.two')||app;target.parentNode.insertBefore(section,target.nextSibling);
  return;
 }
 const section=document.createElement('section');
 section.className='panel bten-bracket-section conference-format-section';
 section.id='conference-tournament-watch';
 const formats={
  'America East':{size:null,kind:'field',note:'2027 championship qualification and matchup structure awaiting conference confirmation.'},
  'Big South':{size:null,kind:'field',note:'2027 championship eligibility and game placement pending official bracket.'},
  'Metro':{size:null,kind:'field',note:'2027 Metro championship bracket and byes pending confirmation.'},
  'NEC':{size:null,kind:'field',note:'NEC tournament field depends on verified postseason eligibility; no unconfirmed teams excluded.'},
  'Patriot':{size:null,kind:'field',note:'2027 tournament game positions awaiting official bracket.'},
  'SWAC':{size:null,kind:'field',note:'2027 championship qualification and matchups await official bracket.'},
  'Southland':{size:null,kind:'field',source:'https://www.southland.org/news/2026/8/12/southland-announces-2026-27-mens-and-womens-basketball-conference-schedules.aspx',note:'Southland championship March 7–11, 2027, Lake Charles; matchups and qualification require verification.'},
  'MVC':{size:10,kind:'mvc10',source:'https://mvc-sports.com/news/2026/8/19/general-missouri-valley-conference-announces-2026-27-championship-schedule.aspx',note:'New 2027 ten-qualifier tournament: 11th-place school excluded; seeds 1–2 enter in semifinals. Remaining pairings not certified.'},
  'CAA':{size:13,kind:'caa13',source:'https://caasports.com/news/2026/7/15/caa-announces-2026-27-mens-basketball-conference-schedule.aspx',note:'Thirteen teams qualify; 12 and 13 open March 5, seeds 5–11 join March 6, seeds 1–4 enter March 7. Precise later matchups provisional.'},
  'Atlantic 10':{size:14,kind:'field',source:'https://atlantic10.com/news/2026/6/16/atlantic-10-releases-2026-27-mens-basketball-schedule-pairings.aspx',note:'All 14 schools, March 10–14 in Brooklyn. Pairings await official bracket.'},
  'MEAC':{size:8,kind:'traditional8',source:'https://meacsports.com/sports/2025/7/2/2526championships.aspx',note:'Eight-member championship, March 10–13, 2027; eligibility still subject to conference rules.'},
  'ACC':{size:15,kind:'acc15',source:'https://goduke.com/news/2026/5/28/mens-basketball-acc-announces-conference-matchups-for-2026-27-mens-basketball-season',note:'Top 15 of 18 teams qualify for the March 9–13 tournament in Greensboro; bottom three are excluded.'},
  'SEC':{size:16,kind:'sec16',source:'https://www.secsports.com/championships/mens-basketball-championship',note:'All 16 teams; March 10–14 at Bridgestone Arena, Nashville.'},
  'Ivy League':{size:4,kind:'ivy4',source:'https://ivyleague.com/news/2026/4/6/general-ivy-madness-to-return-to-the-palestra-in-2027-as-part-of-centennial-celebration.aspx',note:'Top four qualify for Ivy Madness at The Palestra in Philadelphia.'},
  'Mountain West':{size:10,kind:'mountain',source:'https://themw.com/news/2026/7/23/mountain-west-announces-2027-credit-union-1-mens-womens-basketball-championships-brackets.aspx',note:'Official July 23, 2026 bracket. Seeds 7–10 open; top six receive first-round byes.'},
  'Big Sky':{size:11,kind:'bigsky',source:'https://bigskyconf.com/news/2026/8/18/big-sky-releases-2026-27-mens-basketball-conference-schedule.aspx',note:'Official expansion to 11 teams; 10 plays 11, winner faces 9. Later entry slots await full bracket verification.'},
  'Big East':{size:11,kind:'field',source:'https://www.bigeast.com/news/2026/9/13/big-east-announces-2026-27-mens-basketball-schedule.aspx',note:'All 11 conference teams; March 10–13 at Madison Square Garden. Matchup placement pending bracket confirmation.'},
  'Summit League':{size:8,kind:'traditional8',note:'Eight-team traditional field; split quarterfinal doubleheaders. Verify final 2027 field eligibility.'},
  'Conference USA':{size:10,kind:'field',note:'Ten-team field with split quarterfinal doubleheaders; bracket slot mapping awaits official release.'},
  'Big West':{size:8,kind:'field',note:'Eight-qualifier stepladder; only the top eight of the larger league qualify.'},
  'West Coast':{size:10,kind:'field',note:'Ten-team stepladder tournament; precise 2027 matchups pending official bracket.'},
  'Pac-12':{size:9,kind:'field',note:'Nine-team stepladder championship format; final matchups pending official bracket.'},
  'Horizon':{size:11,kind:'field',note:'Eleven eligible men’s teams; Detroit Mercy is ineligible. Reseeding must be respected.'},
  'Sun Belt':{size:14,kind:'field',note:'Fourteen-team stepladder tournament; advancing teams never projected.'},
  'Southern':{size:11,kind:'field',note:'Eleven-team traditional field; bracket pairings pending official release.'},
  'Ohio Valley':{size:8,kind:'field',note:'Eight qualifiers in a stepladder tournament.'},
  'Mid-American':{size:8,kind:'mac8',source:'https://getsomemaction.com/news/2026/8/13/mac-announces-revised-format-for-2027-mens-womens-basketball-tournaments.aspx',note:'Official 2027 eight-team bracket; 1–2 double bye to semifinals, 3–4 bye to quarterfinals, 5–8 start first round.'},
  'ASUN':{size:8,kind:'asun8',source:'https://asunsports.org/news/2026/10/20/general-atlantic-sun-conference-announces-adjusted-eight-team-mens-and-womens-basketball-tournament-brackets.aspx',note:'Official eight-team bracket. Seeds 5–8 enter first, 3–4 enter second, 1–2 enter semifinals.'},
  'Atlantic Sun':{size:8,kind:'field',note:'Eight-team stepladder field; reclassifying-team eligibility must be confirmed.'},
  'United Athletic':{size:8,kind:'field',note:'Eight-team field; final 2027 bracket structure unconfirmed.'}
 };
 const alias={'AAC':'American','MWC':'Mountain West','C-USA':'Conference USA','MAC':'Mid-American','OVC':'Ohio Valley','SoCon':'Southern','WCC':'West Coast','UAC':'United Athletic'};
 const format=formats[alias[conference]||conference]||null;
 const american=conference==='AAC'||conference==='American',big12=conference==='Big 12'&&members.length===16;
 const eligible=o.rows.filter(t=>!(conference==='Horizon'&&/detroit mercy/i.test(t.team)));
 const fieldSize=american?10:big12?16:format?.size||null;
 const seeds=eligible.slice(0,fieldSize||eligible.length);
 const slot=n=>typeof n==='number'?(seeds[n-1]?'<span class="bten-seed">'+n+'</span>'+name(seeds[n-1]):'<span class="conference-format-placeholder">Seed '+n+' pending</span>'):'<span class="conference-format-placeholder">'+esc(n)+'</span>';
 let stages=[];
 if(american)stages=[
  {name:'Opening round',games:[[7,10],[8,9]]},
  {name:'Second round',games:[[5,'Winner 8/9'],[6,'Winner 7/10']]},
  {name:'Quarterfinals',games:[[4,'Second-round winner'],[3,'Second-round winner']]},
  {name:'Semifinals',games:[[1,'Quarterfinal winner'],[2,'Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(big12)stages=[
  {name:'Opening round',games:[[9,16],[12,13],[10,15],[11,14]]},
  {name:'Second round',games:[[8,'Winner 9/16'],[5,'Winner 12/13'],[7,'Winner 10/15'],[6,'Winner 11/14']]},
  {name:'Quarterfinals',games:[[1,'Second-round winner'],[4,'Second-round winner'],[2,'Second-round winner'],[3,'Second-round winner']]},
  {name:'Semifinals',games:[['Quarterfinal winner','Quarterfinal winner'],['Quarterfinal winner','Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='mac8')stages=[
  {name:'Opening round',games:[[5,8],[6,7]]},
  {name:'Quarterfinals',games:[[3,'Opening-round winner'],[4,'Opening-round winner']]},
  {name:'Semifinals',games:[[1,'Quarterfinal winner'],[2,'Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='mvc10')stages=[
  {name:'Semifinal bye positions (confirmed)',games:[[1,'Quarterfinal winner'],[2,'Quarterfinal winner']]}
 ];
 else if(format?.kind==='caa13')stages=[{name:'Confirmed first-round matchup',games:[[12,13]]}];
 else if(format?.kind==='ivy4')stages=[
  {name:'Semifinals',games:[[1,4],[2,3]]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='asun8')stages=[
  {name:'Opening round',games:[[5,8],[6,7]]},
  {name:'Second round',games:[[3,'Opening-round winner'],[4,'Opening-round winner']]},
  {name:'Semifinals',games:[[1,'Second-round winner'],[2,'Second-round winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='sec16')stages=[
  {name:'First round',games:[[9,16],[12,13],[10,15],[11,14]]},
  {name:'Second round',games:[[8,'Winner 9/16'],[5,'Winner 12/13'],[7,'Winner 10/15'],[6,'Winner 11/14']]},
  {name:'Quarterfinals',games:[[1,'Second-round winner'],[4,'Second-round winner'],[2,'Second-round winner'],[3,'Second-round winner']]},
  {name:'Semifinals',games:[['Quarterfinal winner','Quarterfinal winner'],['Quarterfinal winner','Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='acc15')stages=[
  {name:'First round',games:[[10,15],[11,14],[12,13]]},
  {name:'Second round',games:[[8,9],[5,'Winner 12/13'],[6,'Winner 11/14'],[7,'Winner 10/15']]},
  {name:'Quarterfinals',games:[[1,'Second-round winner'],[4,'Second-round winner'],[2,'Second-round winner'],[3,'Second-round winner']]},
  {name:'Semifinals',games:[['Quarterfinal winner','Quarterfinal winner'],['Quarterfinal winner','Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='mountain')stages=[
  {name:'Opening round',games:[[7,10],[8,9]]},
  {name:'Quarterfinals',games:[[1,'Winner 7/10'],[4,5],[3,6],[2,'Winner 8/9']]},
  {name:'Semifinals',games:[['Quarterfinal winner','Quarterfinal winner'],['Quarterfinal winner','Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='traditional8')stages=[
  {name:'Quarterfinals',games:[[1,8],[4,5],[3,6],[2,7]]},
  {name:'Semifinals',games:[['Quarterfinal winner','Quarterfinal winner'],['Quarterfinal winner','Quarterfinal winner']]},
  {name:'Championship',games:[['Semifinal winner','Semifinal winner']]}
 ];
 else if(format?.kind==='bigsky')stages=[{name:'Opening round (confirmed)',games:[[10,11]]},{name:'Next round (confirmed)',games:[[9,'Winner 10/11']]}];
 const renderGame=pair=>'<div class="conference-format-game">'+pair.map(t=>'<div class="conference-format-entry">'+slot(t)+'</div>').join('')+'</div>';
 const confirmed=stages.length?stages.map(stage=>'<div class="conference-format-round"><h3>'+esc(stage.name)+'</h3>'+stage.games.map(renderGame).join('')+'</div>').join(''):'';
 const seededList='<div class="conference-format-round"><h3>'+esc(stages.length?'Projected qualifying field':'Projected seed order')+'</h3>'+seeds.map((t,i)=>'<div class="conference-format-entry">'+slot(i+1)+'</div>').join('')+'</div>';
 const roundHTML=(confirmed||'')+(!stages.length||['bigsky','mvc10','caa13'].includes(format?.kind)?seededList:'');
 const note=american?'American: confirmed top-10 stepladder with two highest seeds entering the semifinals.':
  big12?'Big 12: all 16 schools enter, with top four joining at the quarterfinals.':
  format?format.note:'The exact 2027 tournament field, exclusions and matchup structure are not verified for this league; only projected standings are shown.';
 const ref=format?.source|| (american?'https://theamerican.org/news/2026/9/30/american-conference-announces-2026-27-mens-basketball-conference-schedule.aspx':null);
 const sourceLink=ref?' <a href="'+esc(ref)+'" target="_blank" rel="noopener">Tournament format source ↗</a>':'';
 section.innerHTML='<div class="eyebrow">'+esc(conference)+' · 2027 Men’s Basketball Championship</div>'+
  '<h2>Road to the automatic bid</h2><p class="note">'+note+sourceLink+'</p>'+
  '<div class="conference-format-grid">'+roundHTML+'</div>'+
  '<p class="note">Teams are placed using provisional current-season seed order; these are not official seeds. Winner positions remain undecided.'+
  (fieldSize?' Projected field: '+seeds.length+' of '+members.length+' programs.':' Exact qualification rules still require certification.')+'</p>';
 const target=app.querySelector('.grid.two')||app;target.parentNode.insertBefore(section,target.nextSibling);
}
function committee(teams,games,polls){
 const base=MBBEngine.resume(teams,games);
 const map=new Map(base.map(t=>[t.team_id,t]));
 const pollPts=new Map();
 const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
 const byName=new Map(teams.map(t=>[norm(t.team),t]));
 for(const key of ['ap','coaches'])for(const x of polls?.polls?.[key]?.rankings||[]){const t=byName.get(norm(x.team));if(t)pollPts.set(t.team_id,(pollPts.get(t.team_id)||0)+(26-x.rank));}
 const anyGames=games.some(completed),hasPolls=pollPts.size>0;
 const adjusted=teams.map(t=>{const r=map.get(t.team_id)?.resume||{};const pts=pollPts.get(t.team_id)||0;
 // Editorial committee-style proxy: résumé first when games exist; polls provide modest independent context.
 // Do not imply committee certification or official NET.
 const adjustment=(anyGames?Math.max(-190,Math.min(190,90*(r.wab||0)+3*(r.road||0))):0)+(hasPolls?pts*2.7:0);
 return {...t,elo:t.elo+adjustment};});
 const result=MBBEngine.field(adjusted,[]);
 return {result,anyGames,hasPolls};
}
function teamList(list,limit){
 const shown=Number.isInteger(limit)?list.slice(0,limit):list;
 return '<div class="selection-compact-list">'+shown.map(t=>'<div class="selection-row">'+
  '<span class="selection-seed">'+esc(t.trueSeed||'—')+'</span>'+name(t)+
  '<small>'+esc(t.bid==='Projected AQ'?'Projected AQ':t.bid||'At-large')+'</small></div>').join('')+'</div>';
}
function buildTournament(app,teams,games,polls){
 const proxy=committee(teams,games,polls),f=proxy.result;
 const elo=MBBEngine.field(teams,games);
 const eloIds=new Set(elo.selected.map(t=>t.team_id)),commIds=new Set(f.selected.map(t=>t.team_id));
 const shared=f.selected.filter(t=>eloIds.has(t.team_id));
 const onlyProxy=f.selected.filter(t=>!eloIds.has(t.team_id));
 const onlyElo=elo.selected.filter(t=>!commIds.has(t.team_id));
 const label=proxy.anyGames?'Experimental résumé model':'Preseason poll-adjusted illustration';
 const explainer=proxy.anyGames?
  'The résumé model uses game results and opponent-based adjustments; it is not a trained or validated NCAA committee simulator.':
  'No verified 2026–27 résumé exists yet. Preseason polls can illustrate a possible field, but they cannot establish committee selection or seeding.';
 const block=document.createElement('section');block.className='panel selection-comparison';block.id='committee-vs-elo';
 block.innerHTML='<div class="eyebrow">Optional analysis / not official NCAA seeding</div>'+
  '<h2>Where our models disagree</h2><p class="selection-compare-intro">'+esc(explainer)+
  ' '+(proxy.hasPolls?'Published AP and Coaches polls inform the illustration.':'Contemporary polls were unavailable.')+
  ' Independent USRS Elo ratings are not adjusted by this comparison.</p>'+
  '<div class="selection-summary">'+
    '<div><strong>'+shared.length+'</strong><span>Common picks</span></div>'+
    '<div><strong>'+onlyProxy.length+'</strong><span>'+esc(proxy.anyGames?'Résumé-only':'Poll-only')+'</span></div>'+
    '<div><strong>'+onlyElo.length+'</strong><span>USRS-only</span></div></div>'+
  '<div class="selection-exclusive"><div><h3>'+esc(proxy.anyGames?'Résumé model only':'Poll-adjusted only')+'</h3>'+
   (onlyProxy.length?teamList(onlyProxy,4):'<p>No differences.</p>')+
   (onlyProxy.length>4?'<details><summary>See all '+onlyProxy.length+' differences</summary>'+teamList(onlyProxy)+'</details>':'')+'</div>'+
  '<div><h3>USRS-only selections</h3>'+(onlyElo.length?teamList(onlyElo,4):'<p>No differences.</p>')+
   (onlyElo.length>4?'<details><summary>See all '+onlyElo.length+' differences</summary>'+teamList(onlyElo)+'</details>':'')+'</div></div>'+
  '<details class="selection-all"><summary>Compare complete 76-team fields</summary>'+
    '<p class="selection-method-note">Model order is not official NCAA seeding. All automatic bids remain projected.</p>'+
    '<details><summary>'+esc(label)+' · 76 teams</summary>'+teamList(f.selected)+'</details>'+
    '<details><summary>Independent USRS Elo · 76 teams</summary>'+teamList(elo.selected)+'</details></details>'+
  '<details class="selection-all"><summary>Compare projected regional placements and Opening Round</summary>'+
    '<p class="selection-method-note">These are not approved NCAA assignments.</p>'+
    '<div class="bracket-grid">'+f.regions.map(r=>'<div class="region"><h3>'+esc(r)+'</h3>'+
     Array.from({length:16},(_,i)=>{const s=f.bracket[r][i+1];return '<div class="slot"><span class="seed">'+(i+1)+'</span>'+s.teams.map(name).join(' / ')+'</div>'}).join('')+
     '</div>').join('')+'</div><h3>Opening Round · 12 games</h3>'+
     f.opening.map(o=>'<p>'+o.teams.map(name).join(' vs. ')+' → '+esc(o.region)+' #'+o.seed+'</p>').join('')+'</details>';
 const method=app.querySelector('#method');
 if(method)method.parentNode.insertBefore(block,method);
 else app.appendChild(block);
}

(async()=>{
 const sources=await Promise.all(['data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-game-ledger.json','data/ncaam-2026-27-national-polls.json'].map(fetchJSON));
 const [retro,ledger,polls]=sources;
 const valid=retro?.season==='2026-27'&&retro.model==='retro-clean-slate'&&retro.starting_elo===1500&&retro.rankings?.length===365&&
  new Set(retro.rankings.map(t=>t.team_id)).size===365&&retro.rankings.every(t=>t.base_elo===1500&&Number.isFinite(t.elo));
 // The comparison must use the same team-only RETRO ratings as the main USRS desk.
 if(!valid||!window.MBBEngine?.verifiedGames)return;
 let teams=retro.rankings;
 let games=MBBEngine.verifiedGames(retro,ledger);
 const render=()=>{const app=document.getElementById('app');if(!app||app.querySelector('#conference-tournament-watch,#committee-vs-elo'))return false;
 if(document.body.dataset.page==='conference'){const c=new URLSearchParams(location.search).get('conference');if(!c||!app.querySelector('.grid.two'))return false;buildConference(app,teams,games,c);}
 else{if(!app.querySelector('#field'))return false;buildTournament(app,teams,games,polls);}
 return true;};
 window.addEventListener('mbb:ratings-updated',async()=>{
  const [fresh,latestLedger]=await Promise.all(['data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-game-ledger.json'].map(fetchJSON));
  const approved=fresh?.season==='2026-27'&&fresh.model==='retro-clean-slate'&&fresh.starting_elo===1500&&fresh.rankings?.length===365&&
    new Set(fresh.rankings.map(t=>t.team_id)).size===365&&fresh.rankings.every(t=>t.base_elo===1500&&Number.isFinite(t.elo));
  if(!approved)return;
  teams=fresh.rankings;
  games=MBBEngine.verifiedGames(fresh,latestLedger);
  render();
 });
 if(render())return;const observer=new MutationObserver(()=>{if(render())observer.disconnect()});observer.observe(document.getElementById('app'),{childList:true,subtree:false});setTimeout(()=>observer.disconnect(),20000);
})().catch(e=>console.error('MBB comparison desk:',e));
})();