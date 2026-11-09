(()=>{'use strict';const root=document.getElementById('bowl-content');if(!root)return;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const catalog=window.CFB_BOWL_CATALOG||[];const editorial=window.CFB_BOWL_EDITORIAL||{};const localLogos=window.CFB_BOWL_LOCAL_LOGOS||{};for(const b of catalog){const h=editorial[b.name];if(h)Object.assign(b,{editorial:h,logo:h.logo||b.logo});if(localLogos[b.name])b.logo=localLogos[b.name]}const historicalHTML=b=>{const h=b.editorial;if(!h)return'<p>Historical results for this bowl are still being verified.</p>';return'<section class="bowl-history"><h2>The Bowl Archive</h2><div class="bowl-history-metrics">'+(h.since?'<div><b>'+h.since+'</b><small>First season in historical series</small></div>':'')+(h.games?'<div><b>'+h.games+'</b><small>Games recorded through 2025</small></div>':'')+'</div>'+(h.highlight?'<p>'+esc(h.highlight)+'</p>':'')+(h.former?'<h3>Earlier identities</h3><p>'+esc(h.former)+'</p>':'')+(h.history?'<p><a href="'+esc(h.history)+'" target="_blank" rel="noopener noreferrer">Explore the historical game archive</a></p>':'')+(h.logoSource?'<p><a href="'+esc(h.logoSource)+'" target="_blank" rel="noopener noreferrer">Official bowl logo resources</a></p>':'')+'</section>'};const normal=n=>String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'');const confKey=n=>{n=normal(n);if(n.includes('atlanticcoast')||n==='acc')return'ACC';if(n.includes('bigten'))return'Big Ten';if(n.includes('big12')||n.includes('bigtwelve'))return'Big 12';if(n.includes('bigtwelve')||n==='big12')return'Big 12';if(n.includes('fbsindependent')||n==='independents')return'Independent';if(n.includes('southeastern')||n==='sec')return'SEC';if(n.includes('pac12')||n.includes('pacific12'))return'Pac-12';if(n.includes('mountainwest'))return'Mountain West';if(n.includes('midamerican')||n==='mac')return'MAC';if(n.includes('sunbelt'))return'Sun Belt';if(n.includes('conferenceusa')||n==='cusa')return'Conference USA';if(n.includes('american'))return'American';return String(n||'Other')};const standingsUrl='https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=2026&group=80';function allGroups(node,out=[]){if(!node)return out;const entries=node.standings?.entries||node.entries;if(entries?.length)out.push({name:node.name||node.abbreviation,entries});for(const child of node.children||node.groups||[])allGroups(child,out);return out}
function readRecord(e,conference=false){
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const keys=conference?['vsconf','vsconference','conferencerecord','conference','conf','league']:['overall','overallrecord','ovr','total'];
 const s=(e.stats||[]).find(x=>keys.includes(norm(x.name))||keys.includes(norm(x.abbreviation)));
 const m=String(s?.displayValue||s?.summary||'').match(/(\d+)\s*[-–]\s*(\d+)/);
 return m?{w:+m[1],l:+m[2]}:null;
}
function teamRank(e){
 const t=e.team||{},r=readRecord(e),c=readRecord(e,true),elo=window.CFB_RATINGS?.[String(t.id)]?.adjustedElo;
 return{id:String(t.id),name:t.displayName||t.shortDisplayName||t.name||'Team '+String(t.id),logo:t.logos?.[0]?.href||t.logo||'',w:r?.w??0,l:r?.l??0,cw:c?.w??null,cl:c?.l??null,elo:Number.isFinite(elo)?elo:null,eligible:r?.w>=6,score:r?.w*100-(r?.l||0)*10};
}
let ratingsPromise;function loadRatings(){return ratingsPromise||(ratingsPromise=new Promise((resolve,reject)=>{if(window.CFB_RATINGS&&window.CFB_ELO_REPLAY?.certified){resolve(window.CFB_RATINGS);return}document.addEventListener('cfb-ratings-ready',()=>resolve(window.CFB_RATINGS),{once:true});setTimeout(()=>window.CFB_ELO_REPLAY?.certified?resolve(window.CFB_RATINGS):reject(Error('Verified RETRO ratings unavailable')),18000)}))}let standingsStatus='Live standings',poolPromise;
function readStandings(data){
 const groups=allGroups(data),map=new Map();
 for(const g of groups){
   const key=confKey(g.name),arr=map.get(key)||[];
   for(const e of g.entries||[]){const t=teamRank(e);if(t.id&&!arr.some(x=>x.id===t.id))arr.push(t)}
   map.set(key,arr);
 }
 if([...map.values()].reduce((n,a)=>n+a.length,0)<30)throw Error('Standings feed incomplete');
 for(const arr of map.values())arr.sort((a,b)=>b.score-a.score);
 return map;
}
function pool(){
 return poolPromise||(poolPromise=(async()=>{
   try{
     const r=await fetch(standingsUrl,{signal:AbortSignal.timeout(12000),cache:'no-store'});
     if(!r.ok)throw Error('Live standings HTTP '+r.status);
     const map=readStandings(await r.json());standingsStatus='Live standings';return map;
   }catch(e){
     console.warn('Bowl predictor live standings unavailable; using verified local standings',e);
     const r=await fetch('data/cfb-2026-results.json?bowl='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(18000)});
     if(!r.ok)throw Error('Local standings HTTP '+r.status);
     const p=await r.json();
     if(p.audit?.season!==2026||p.audit?.complete!==true||p.audit?.errors?.length||!p.feeds?.standings?.data)throw Error('Published standings snapshot failed verification');
     standingsStatus='Verified local standings '+(p.audit.generated_at?new Date(p.audit.generated_at).toLocaleString():'');
     return readStandings(p.feeds.standings.data);
   }
 })());
}
let scheduleCache=null, scheduleStatus='Loading actual 2026 remaining schedules';
async function loadSchedule(){
 if(scheduleCache!==null)return scheduleCache;
 // Only retrieve regular-season and conference-title weeks, not postseason-only weeks 17-18.
 const weeks=Array.from({length:9},(_,i)=>i+8),events=new Map(),failures=[];
 await Promise.all(weeks.map(async week=>{
   try{
     const u='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2026&seasontype=2&week='+week+'&groups=80&limit=400';
     const r=await fetch(u,{signal:AbortSignal.timeout(10000),cache:'no-store'});
     if(!r.ok)throw Error('HTTP '+r.status);
     const data=await r.json();
     if(!Array.isArray(data.events))throw Error('Missing events array');
     for(const event of data.events){
       const c=event.competitions?.[0];if(!c||c.competitors?.length!==2||event.status?.type?.completed)continue;
       const home=c.competitors.find(t=>t.homeAway==='home'),away=c.competitors.find(t=>t.homeAway==='away');
       if(!home?.team?.id||!away?.team?.id||!event.date)continue;
       events.set(String(event.id),{id:String(event.id),home:String(home.team.id),away:String(away.team.id),neutral:!!c.neutralSite,date:event.date});
     }
   }catch(e){failures.push(week);console.warn('CFB schedule week',week,e.message)}
 }));
 scheduleCache=[...events.values()].filter(e=>Date.parse(e.date)>Date.now()-86400000);
 const ok=weeks.length-failures.length;
 scheduleStatus=(failures.length?'Provisional: partial fixture coverage '+ok+'/'+weeks.length:'Complete fixture scan '+ok+'/'+weeks.length)+
   ' · '+scheduleCache.length+' known remaining games'+
   (failures.length?' · missing weeks '+failures.sort((a,b)=>a-b).join(', '):'')+
   (!scheduleCache.length?' · forecasts based on current results without future-opponent adjustments':'');
 return scheduleCache;
}

const P4=['ACC','Big Ten','Big 12','SEC'],G6=['American','Conference USA','MAC','Mountain West','Pac-12','Sun Belt'];
function projectedTeams(map,mode){
 const teams=[...map.entries()].flatMap(([conference,arr])=>arr.map(t=>({...t,conference,elo:window.CFB_RATINGS?.[t.id]?.adjustedElo??1500})));
 const unique=[...new Map(teams.map(t=>[t.id,t])).values()],byId=new Map(unique.map(t=>[t.id,t]));
 for(const t of unique){t.remainingGames=0;t.expectedWins=t.w;t.probabilities=[];t.bowlProbability=0;t.confLeft=0;t.confExpected=t.cw??0;t.confKnown=Number.isFinite(t.cw)&&Number.isFinite(t.cl)}
 for(const g of scheduleCache||[]){
  const a=byId.get(g.home),b=byId.get(g.away);if(!a||!b)continue;
  const p=1/(1+Math.pow(10,((b.elo||1500)-(a.elo||1500)-(g.neutral?0:65))/400));
  a.remainingGames++;b.remainingGames++;a.expectedWins+=p;b.expectedWins+=1-p;a.probabilities.push(p);b.probabilities.push(1-p);
  if(a.conference===b.conference){a.confLeft++;b.confLeft++;a.confExpected+=p;b.confExpected+=1-p}
 }
 for(const t of unique){
  let dp=[1];for(const p of t.probabilities){const next=Array(dp.length+1).fill(0);for(let i=0;i<dp.length;i++){next[i]+=dp[i]*(1-p);next[i+1]+=dp[i]*p}dp=next}
  const need=Math.max(0,6-t.w);t.bowlProbability=need===0?1:dp.slice(need).reduce((a,b)=>a+b,0);t.eligible=t.bowlProbability>=.5;
  const confN=(t.cw??0)+(t.cl??0)+t.confLeft,allN=t.w+t.l+t.remainingGames;
  t.confPct=t.confKnown&&confN>0?t.confExpected/confN:allN>0?t.expectedWins/allN:0;
  t.power=mode==='standings'?t.expectedWins*30+t.elo/100:t.elo+(t.expectedWins-6)*8;
 }
 return unique;
}
function playoffField(map,mode){
 const ranked=projectedTeams(map,mode).filter(t=>t.w+t.l>0).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 // Project leaders from conference records, not the highest RETRO rating alone.
 // Actual title games and official tie-breakers are still unknown.
 const champions=P4.map(c=>ranked.filter(t=>t.conference===c).sort((a,b)=>b.confPct-a.confPct||b.confExpected-a.confExpected||b.power-a.power)[0]).filter(Boolean);
 const g6=ranked.find(t=>G6.includes(t.conference)),automatic=[...champions,...(g6?[g6]:[])];
 const bids=new Map(champions.map(t=>[t.id,'Projected '+t.conference+' champion · automatic']));
 if(g6)bids.set(g6.id,'Group of Six · automatic');
 const nd=ranked.find(t=>/notre dame/i.test(t.name));
 if(nd&&ranked.indexOf(nd)<12&&!bids.has(nd.id)){automatic.push(nd);bids.set(nd.id,'Notre Dame · automatic (projected top 12)')}
 const selected=new Set(automatic.map(t=>t.id));
 const atLarge=ranked.filter(t=>!selected.has(t.id)).slice(0,12-automatic.length);
 for(const t of atLarge)bids.set(t.id,'At-large');
 const field=[...automatic,...atLarge].sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
 return{field,automatic,ranked,bids,champions,g6,ndAuto:!!nd&&automatic.some(t=>t.id===nd.id)};
}


function playoffHTML(result,mode){
 const f=result.field;
 const team=n=>{const t=f[n-1];return t?'<div class="cfp-bracket-team"><span class="cfp-bracket-seed">'+n+'</span>'+(t.logo?'<img src="'+esc(t.logo)+'" alt="" loading="lazy" onerror="this.hidden=true">':'')+'<span>'+esc(t.name)+'</span></div>':'<div class="cfp-bracket-team">Selection pending</div>'};
 const CFP_BOWL_LOGOS={"Fiesta Bowl":"https://content.sportslogos.net/logos/68/1843/full/fiesta_bowl_logo_primary_2022_sportslogosnet-9615.png","Cotton Bowl":"https://content.sportslogos.net/logos/68/1840/full/cotton_bowl_classic_logo_primary_20152101.png","Peach Bowl":"https://content.sportslogos.net/logos/68/5196/full/peach_bowl_logo_primary_2018_sportslogosnet-5033.png","Rose Bowl":"https://content.sportslogos.net/logos/68/1869/full/rose_bowl_logo_primary_2023_sportslogosnet-9975.png","Orange Bowl":"https://content.sportslogos.net/logos/68/1864/full/orange_bowl_logo_primary_20141556.png","Sugar Bowl":"https://content.sportslogos.net/logos/68/1871/full/sugar_bowl_logo_primary_2022_sportslogosnet-3001.png"};
 const bowlLogo=name=>{const src=CFP_BOWL_LOGOS[name];return src?'<img class="cfp-projected-bowl-logo" src="'+esc(src)+'" alt="'+esc(name)+' logo" loading="lazy" onerror="this.hidden=true">':'<span class="cfp-projected-bowl-mark" aria-hidden="true">✦</span>'};
 const pending=s=>'<div class="cfp-bracket-pending">'+esc(s)+'</div>';
 const campus={
 'indiana':['Memorial Stadium','Bloomington, Indiana'],'georgia':['Sanford Stadium','Athens, Georgia'],'notre dame':['Notre Dame Stadium','Notre Dame, Indiana'],'ohio state':['Ohio Stadium','Columbus, Ohio'],'oregon':['Autzen Stadium','Eugene, Oregon'],'ucla':['Rose Bowl Stadium','Pasadena, California'],'alabama':['Bryant-Denny Stadium','Tuscaloosa, Alabama'],'texas':['Darrell K Royal–Texas Memorial Stadium','Austin, Texas'],'tennessee':['Neyland Stadium','Knoxville, Tennessee'],'utah':['Rice-Eccles Stadium','Salt Lake City, Utah'],'miami':['Hard Rock Stadium','Miami Gardens, Florida'],'boise state':['Albertsons Stadium','Boise, Idaho'],'new mexico':['University Stadium','Albuquerque, New Mexico'],'houston':['TDECU Stadium','Houston, Texas'],'texas tech':['Jones AT&T Stadium','Lubbock, Texas'],'byu':['LaVell Edwards Stadium','Provo, Utah'],'wake forest':['Allegacy Federal Credit Union Stadium','Winston-Salem, North Carolina'],'iowa':['Kinnick Stadium','Iowa City, Iowa'],'usc':['Los Angeles Memorial Coliseum','Los Angeles, California'],'south carolina':['Williams-Brice Stadium','Columbia, South Carolina'],'arizona':['Arizona Stadium','Tucson, Arizona'],'smu':['Gerald J. Ford Stadium','Dallas, Texas'],'kentucky':['Kroger Field','Lexington, Kentucky'],'lsu':['Tiger Stadium','Baton Rouge, Louisiana'],'michigan':['Michigan Stadium','Ann Arbor, Michigan'],'penn state':['Beaver Stadium','University Park, Pennsylvania'],'washington':['Husky Stadium','Seattle, Washington'],'florida state':['Doak Campbell Stadium','Tallahassee, Florida'],'ole miss':['Vaught-Hemingway Stadium','Oxford, Mississippi'],'oklahoma':['Gaylord Family–Oklahoma Memorial Stadium','Norman, Oklahoma'],'clemson':['Memorial Stadium','Clemson, South Carolina'],'nebraska':['Memorial Stadium','Lincoln, Nebraska'],'kansas state':['Bill Snyder Family Stadium','Manhattan, Kansas'],'cincinnati':['Nippert Stadium','Cincinnati, Ohio'],'louisville':['L&N Stadium','Louisville, Kentucky'],'syracuse':['JMA Wireless Dome','Syracuse, New York'],'virginia tech':['Lane Stadium','Blacksburg, Virginia'],'texas a&m':['Kyle Field','College Station, Texas'],'colorado':['Folsom Field','Boulder, Colorado'],'oklahoma state':['Boone Pickens Stadium','Stillwater, Oklahoma']};
 const venueFor=t=>{let n=String(t?.name||'').toLowerCase();const key=Object.keys(campus).sort((a,b)=>b.length-a.length).find(k=>n.includes(k));return key?campus[key]:['Campus venue to be confirmed','Location to be confirmed']};
 // Editorial distance/region preference simulates ranked seed bowl choices, not actual selections.
 const region=t=>{const n=String(t?.name||'').toLowerCase(),c=t?.conference||'';if(/ucla|usc|oregon|washington|utah|boise|arizona|byu|new mexico|colorado/.test(n))return'west';if(/texas|houston|smu|oklahoma|baylor|lsu/.test(n))return'texas';if(/georgia|miami|florida|clemson|wake forest|south carolina|alabama|tennessee|ole miss/.test(n))return'southeast';if(/indiana|notre dame|ohio state|michigan|iowa|penn state|wisconsin|nebraska/.test(n))return'midwest';return c==='Big Ten'?'midwest':c==='SEC'||c==='ACC'?'southeast':'texas'};
 const preference={west:['Rose Bowl','Fiesta Bowl','Cotton Bowl','Peach Bowl'],texas:['Cotton Bowl','Fiesta Bowl','Peach Bowl','Rose Bowl'],southeast:['Peach Bowl','Cotton Bowl','Fiesta Bowl','Rose Bowl'],midwest:['Rose Bowl','Cotton Bowl','Peach Bowl','Fiesta Bowl']};
 const topSeeds=[1,2,3,4],remaining=['Fiesta Bowl','Cotton Bowl','Peach Bowl','Rose Bowl'],assigned={};
 for(const n of topSeeds){const pref=preference[region(f[n-1])]||preference.texas;const chosen=pref.find(b=>remaining.includes(b));assigned[n]=chosen;remaining.splice(remaining.indexOf(chosen),1)}
 const bowlInfo={'Fiesta Bowl':['Dec. 30, 2026','State Farm Stadium','Glendale, Arizona'],'Cotton Bowl':['Jan. 1, 2027','AT&T Stadium','Arlington, Texas'],'Peach Bowl':['Jan. 1, 2027','Mercedes-Benz Stadium','Atlanta, Georgia'],'Rose Bowl':['Jan. 1, 2027','Rose Bowl Stadium','Pasadena, California']};
 const preferredSemi=region(f[0])==='southeast'?'Orange Bowl':'Sugar Bowl';
 const semiInfo={'Orange Bowl':['Jan. 14, 2027','Hard Rock Stadium','Miami Gardens, Florida'],'Sugar Bowl':['Jan. 15, 2027','Caesars Superdome','New Orleans, Louisiana']};
 const first=(a,b)=>{const v=venueFor(f[a-1]);return '<div class="cfp-game"><small>First round · #'+a+' hosts</small><div class="cfp-game-location">'+esc(v[0])+' · '+esc(v[1])+'</div>'+team(a)+pending('vs')+team(b)+'</div>'};
 const quarter=(bye,a,b)=>{const bowl=assigned[bye],v=bowlInfo[bowl];return '<div class="cfp-game"><div class="cfp-bowl-heading">'+bowlLogo(bowl)+'<div><small>Projected '+esc(bowl)+' · '+esc(v[0])+'</small><div class="cfp-game-location">'+esc(v[1])+' · '+esc(v[2])+'</div></div></div>'+team(bye)+pending('Winner #'+a+' / #'+b)+'</div>'};
 const route=(bye,a,b)=>'<div class="cfp-route">'+first(a,b)+quarter(bye,a,b)+'</div>';
 const half=(s1,a1,b1,s2,a2,b2,semi)=>{const v=semiInfo[semi];return '<div class="cfp-half"><h4>Seeds #'+s1+' and #'+s2+' semifinal path</h4><div class="cfp-routes">'+route(s1,a1,b1)+route(s2,a2,b2)+'</div><div class="cfp-semi"><div class="cfp-bowl-heading">'+bowlLogo(semi)+'<div><small>Projected '+semi+' · '+v[0]+'</small><div class="cfp-game-location">'+v[1]+' · '+v[2]+'</div></div></div><b>Winner #'+s1+' path vs winner #'+s2+' path</b></div></div>'};
 const sites=[
 ['Fiesta Bowl','Quarterfinal','Dec. 30, 2026','State Farm Stadium','Glendale, Arizona'],
 ['Cotton Bowl','Quarterfinal','Jan. 1, 2027','AT&T Stadium','Arlington, Texas'],
 ['Peach Bowl','Quarterfinal','Jan. 1, 2027','Mercedes-Benz Stadium','Atlanta, Georgia'],
 ['Rose Bowl','Quarterfinal','Jan. 1, 2027','Rose Bowl Stadium','Pasadena, California'],
 ['Orange Bowl','Semifinal','Jan. 14, 2027','Hard Rock Stadium','Miami Gardens, Florida'],
 ['Sugar Bowl','Semifinal','Jan. 15, 2027','Caesars Superdome','New Orleans, Louisiana']
 ];
 const site=([name,round,date,venue,city])=>{const logo=CFP_BOWL_LOGOS[name];return '<article class="cfp-site-card">'+(logo?'<img src="'+esc(logo)+'" alt="'+esc(name)+' logo" loading="lazy" onerror="this.hidden=true">':'<span class="cfp-site-star" aria-hidden="true">✦</span>')+'<div><small>'+round+' · '+date+'</small><strong>'+name+'</strong><span>'+venue+' · '+city+'</span></div></article>'};
 return '<section class="bowl-feature"><h2>Projected 12-Team College Football Playoff</h2><p>Provisional RETRO playoff selections, not official assignments. The bracket paths are fixed, but the four quarterfinal sites shown are independent editorial predictions based on regional proximity and the official top-seed selection order. CFP bowls have no traditional non-CFP conference tie-ins in these games.</p>'+
 '<div class="cfp-field">'+f.map((t,i)=>'<article class="cfp-entry"><div class="cfp-entry-top"><b>#'+(i+1)+'</b><span>'+esc(result.bids.get(t.id)||'At-large')+'</span></div><div class="cfp-name">'+(t.logo?'<img src="'+esc(t.logo)+'" alt="" loading="lazy">':'')+'<b>'+esc(t.name)+'</b></div><small>'+esc(t.conference)+' · '+t.w+'–'+t.l+' · RETRO '+Math.round(t.elo)+' · projected '+t.expectedWins.toFixed(1)+' wins</small></article>').join('')+'</div>'+
 '<h3>Complete fixed bracket</h3><p class="cfp-note">Seeds appear to the LEFT of school logos and names. Seeds 1–4 receive byes. First-round host stadiums are projected from each host school; where a stadium is not verified, the venue is left unconfirmed.</p>'+
 '<div class="cfp-bracket">'+half(1,8,9,4,5,12,preferredSemi)+half(2,7,10,3,6,11,preferredSemi==='Orange Bowl'?'Sugar Bowl':'Orange Bowl')+'</div>'+
 '<div class="cfp-title"><small>National Championship · Jan. 25, 2027</small><b>Winner #1 / #4 path vs winner #2 / #3 path</b><p>Allegiant Stadium · Las Vegas, Nevada</p></div>'+
 '<h3>Official CFP bowl sites &amp; locations</h3><p class="cfp-note">These six bowl sites and dates are confirmed; the bracket above shows editorial matchup-to-bowl projections, not actual assignments.</p><div class="cfp-site-grid">'+sites.map(site).join('')+'</div>'+
 '<p class="cfp-note">Bowl allocation model: No. 1 chooses a quarterfinal and semifinal, Nos. 2 and 3 choose remaining quarterfinal sites, and No. 4 receives the final site. Choices are estimated from geographic preference; no historic conference tie-ins are assumed. First-round games: hosted by seeds 5–8 at their chosen venues. <a href="https://collegefootballplayoff.com/sports/2018/8/31/cfp-games-schedule" target="_blank" rel="noopener noreferrer">Official 2026–27 CFP schedule</a>.</p></section>';
}

const PAC12_LEGACY=new Set(['arizona','arizonastate','california','cal','colorado','oregon','oregonstate','stanford','ucla','usc','southerncalifornia','utah','washington','washingtonstate']);
const PAC12_NEW=new Set(['boisestate','coloradostate','fresnostate','sandiegostate','texasstate','utahstate']);
function legacyKey(name){return String(name||'').toLowerCase().replace(/wildcats|sundevils|buffaloes|ducks|beavers|cardinal|bruins|trojans|utes|huskies|cougars|goldenbears|broncos|rams|bulldogs|aztecs|bobcats|aggies|football|university/g,'').replace(/[^a-z0-9]/g,'')}
function matchesSlot(t,slot,bowl){
 if(!t||!t.eligible)return false;
 if(slot==='Pac-12 legacy')return PAC12_LEGACY.has(legacyKey(t.name))&&(bowl.name!=='Poinsettia Bowl'||t.conference!=='Pac-12');
 if(slot==='Pac-12 current')return t.conference==='Pac-12';
 if(slot==='Pac-12 newcomer')return t.conference==='Pac-12'&&PAC12_NEW.has(legacyKey(t.name));
 return t.conference===slot;
}
function projectionRows(map,mode){
 const playoff=playoffField(map,mode),used=new Set(playoff.field.map(t=>t.id)),all=projectedTeams(map,mode);
 const selection=[...catalog].sort((a,b)=>(a.pickPriority??99)-(b.pickPriority??99)||a.name.localeCompare(b.name));
 const result=new Map();
 // FIRST PASS: exhaust legitimate conference/legacy commitments in bowl selection order.
 // Do not allow at-large teams to consume a conference's still-available primary selection.
 for(const bowl of selection){
  const picks=[];
  for(const slot of bowl.tieins){
   const eligible=all.filter(t=>!used.has(t.id)&&matchesSlot(t,slot,bowl)&&!picks.some(x=>x&&x.conference===t.conference));
   eligible.sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
   const chosen=eligible[0]||null;
   if(chosen)used.add(chosen.id);
   picks.push(chosen);
  }
  result.set(bowl.id,{...bowl,picks,replacements:picks.map(()=>false)});
 }
 // SECOND PASS: if an affiliated conference could not supply a team, fill
 // the open place with a remaining projected bowl-eligible at-large school.
 // Label it accurately; it is never represented as satisfying the original tie-in.
 for(const bowl of selection){
  const row=result.get(bowl.id);
  for(let index=0;index<row.picks.length;index++){
   if(row.picks[index])continue;
   const opponents=row.picks.filter(Boolean);
   const possible=all.filter(t=>t.eligible&&!used.has(t.id)&&!opponents.some(o=>o.conference===t.conference));
   possible.sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
   const replacement=possible[0]||null;
   if(replacement){row.picks[index]=replacement;row.replacements[index]=true;used.add(replacement.id)}
  }
  row.unfilled=bowl.tieins.filter((_,i)=>!row.picks[i]);
 }
 // Preserve the calendar's displayed ordering, not selection priority order.
 return catalog.map(b=>result.get(b.id));
}
const teamHTML=t=>t?'<span class="bowl-team">'+(t.logo?'<img alt="" src="'+esc(t.logo)+'">':'')+'<strong>'+esc(t.name)+'</strong><small>'+t.w+'-'+t.l+(Number.isFinite(t.expectedWins)?' · projected '+t.expectedWins.toFixed(1)+' wins':'')+'</small></span>':'<span class="bowl-team"><strong>Selection pending</strong><small>No eligible projected team remaining</small></span>';function bowlPalette(b){const colors=['#10375c','#4a2045','#0f4c43','#6a3515','#353f73','#5b2231'];return colors[(Number(b.id.replace(/\D/g,''))||1)%colors.length]}function curatedCard(b,mode,match){return'<a class="bowl-card" href="cfb-bowls.html?bowl='+encodeURIComponent(b.id)+'&mode='+mode+'"><div class="bowl-card-head">'+(b.logo?'<img class="bowl-identity-logo" src="'+esc(b.logo)+'" alt="'+esc(b.name)+' logo" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">':'<span class="bowl-monogram" aria-hidden="true">✦</span>')+'<span class="bowl-logo-fallback" '+(b.logo?'hidden':'')+' aria-hidden="true">✦</span><h3>'+esc(b.name)+'</h3></div><div class="bowl-card-body"><span class="bowl-tag">2026–27 · '+esc(b.date)+'</span><div class="bowl-meta">'+esc(b.stadium)+' · '+esc(b.city)+'</div><div class="bowl-meta">Affiliations: '+b.tieins.map(esc).join(' / ')+'</div>'+(match?'<div class="bowl-match">'+teamHTML(match.picks[0])+'<strong>VS</strong>'+teamHTML(match.picks[1])+'</div>'+match.replacements.map((isReplacement,i)=>isReplacement?'<p class="bowl-at-large">At-large replacement for '+esc(b.tieins[i])+' affiliation · provisional</p>':'').join(''):'')+'</div></a>'}function curatedDetail(b,rows,mode){const match=rows.find(x=>x.id===b.id);return'<a href="cfb-bowls.html">← Bowl directory</a><section class="bowl-feature" style="background:linear-gradient(125deg,'+bowlPalette(b)+',#111c2e)"><div class="eyebrow">The '+esc(b.name)+' edition</div><h1>'+esc(b.name)+'</h1>'+(b.logo?'<img alt="Authentic bowl logo" src="'+esc(b.logo)+'">':'')+'<h2>'+esc(b.stadium)+'</h2><p>'+esc(b.city)+' · '+esc(b.date)+', 2026–27</p><div class="bowl-match">'+teamHTML(match?.picks[0])+'<strong>VS</strong>'+teamHTML(match?.picks[1])+'</div>'+(match?.replacements?.some(Boolean)?'<p class="bowl-at-large">'+match.replacements.map((yes,i)=>yes?'At-large replacement for '+esc(b.tieins[i])+' affiliation':'').filter(Boolean).join(' · ')+' · provisional forecast</p>':'')+'</section>'+historicalHTML(b)+'<h2>Conference affiliations</h2><p>'+b.tieins.map(esc).join(' versus ')+'</p><p>These are flexible bowl affiliations, not guaranteed selections. Bowl committees, CFP selections, eligibility, and conference agreements can change the assignments.</p><h2>Projection method</h2><p>'+ (mode==='retro'?'RETRO-based estimated end-of-season wins and bowl qualification. Remaining scheduled games are forecast opponent by opponent using RETRO and home-field advantage. Assignments are provisional, not official invitations.':'Projected finish based on actual remaining matchups; this is not an official bowl selection.')+'</p><p><a href="'+esc(b.source)+'">Official bowl season schedule</a> · <a href="'+esc(b.tieSource)+'">Affiliation reference</a></p>'}function renderCatalog(map){const params=new URLSearchParams(location.search),mode=params.get('mode')==='standings'?'standings':'retro';const playoff=playoffField(map,mode),rows=projectionRows(map,mode),chosen=catalog.find(x=>x.id===params.get('bowl'));if(chosen){root.innerHTML=curatedDetail(chosen,rows,mode);document.title=chosen.name+' | The Sporting Life & Times';return}root.innerHTML='<p class="bowl-note">'+esc(scheduleStatus)+' · '+esc(standingsStatus)+' · updated 2026 bowl selection order · projections only, not official selections · recalculated on reload</p><section id="cfp-predictor"><h2>College Football Playoff Predictor</h2>'+playoffHTML(playoff,mode)+'</section><section id="non-cfp-bowls"><h2>Projected Non-CFP Bowls</h2><p class="bowl-note">CFP teams are removed first. The remaining bowls select by 2026–27 conference agreements and projected selection preference, not game date. The Citrus and Alamo have documented first-selection rights; other ordering is an editorial estimate because committees have discretion. Pac-12 legacy eligibility is respected. When a conference cannot supply an eligible team, any remaining bowl-eligible school may be shown as a clearly marked at-large replacement after primary agreements are satisfied. If no projected eligible teams remain, a place is marked Selection pending. Predictions are not official invitations.</p><p><a href="cfb-bowls.html?mode=standings">Standings projections</a> · <a href="cfb-bowls.html?mode=retro">RETRO projections</a></p><div class="bowl-grid">'+rows.map(b=>curatedCard(b,mode,b)).join('')+'</div></section>'}root.innerHTML='<h2>2026–27 Bowl Directory</h2><p class="bowl-note">Loading live standings and playoff projections. Browse individual bowls while data loads.</p><div class="bowl-grid">'+catalog.map(b=>curatedCard(b,'retro')).join('')+'</div>';Promise.all([loadRatings(),pool(),loadSchedule()]).then(([,map])=>{renderCatalog(map);document.addEventListener('cfb-ratings-ready',()=>renderCatalog(map))}).catch(e=>{root.innerHTML='<p class="bowl-note">Complete projections temporarily unavailable: '+esc(e.message)+'. Unverified or partial schedules are not used.</p><div class="bowl-grid">'+catalog.map(b=>curatedCard(b,'retro')).join('')+'</div>'})})();