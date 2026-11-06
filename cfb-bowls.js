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
let ratingsPromise;function loadRatings(){return ratingsPromise||(ratingsPromise=new Promise((resolve,reject)=>{if(window.CFB_RATINGS&&window.CFB_ELO_REPLAY?.certified){resolve(window.CFB_RATINGS);return}document.addEventListener('cfb-ratings-ready',()=>resolve(window.CFB_RATINGS),{once:true});setTimeout(()=>window.CFB_ELO_REPLAY?.certified?resolve(window.CFB_RATINGS):reject(Error('Verified RETRO ratings unavailable')),18000)}))}let poolPromise;function pool(){return poolPromise||(poolPromise=fetch(standingsUrl).then(r=>{if(!r.ok)throw Error('standings unavailable');return r.json()}).then(d=>{const groups=allGroups(d);const map=new Map();for(const g of groups){const key=confKey(g.name);const arr=(map.get(key)||[]);for(const e of g.entries){const t=teamRank(e);if(t.id&&!arr.some(x=>x.id===t.id))arr.push(t)}map.set(key,arr)}for(const arr of map.values())arr.sort((a,b)=>b.score-a.score);return map}))}let scheduleCache=null, scheduleStatus='Loading actual 2026 remaining schedules';
async function loadSchedule(){if(scheduleCache)return scheduleCache;const weeks=Array.from({length:11},(_,i)=>i+8);let ok=0;const events=new Map();await Promise.all(weeks.map(async week=>{try{const u='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2026&seasontype=2&week='+week+'&groups=80&limit=400';const r=await fetch(u,{signal:AbortSignal.timeout(11000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();ok++;for(const e of data.events||[]){const c=e.competitions?.[0];if(!c||c.competitors?.length!==2||e.status?.type?.completed)continue;const a=c.competitors.find(t=>t.homeAway==='home')||c.competitors[0],b=c.competitors.find(t=>t.homeAway==='away')||c.competitors[1];if(!a?.team?.id||!b?.team?.id)continue;events.set(String(e.id),{id:String(e.id),home:String(a.team.id),away:String(b.team.id),neutral:!!c.neutralSite,date:e.date});}}catch(e){console.warn('CFB schedule week',week,e.message)}}));if(ok<weeks.length){scheduleStatus='Incomplete schedule feeds ('+ok+'/'+weeks.length+'); forecasts withheld';throw Error(scheduleStatus)}scheduleCache=[...events.values()].filter(e=>Date.parse(e.date)>Date.now()-86400000);scheduleStatus='Opponent-by-opponent forecast · '+scheduleCache.length+' unplayed games · '+ok+' verified weekly feeds';return scheduleCache}

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
 const f=result.field,seed=n=>f[n-1],team=n=>seed(n)?'<b><span class="cfp-seed">#'+n+'</span> '+esc(seed(n).name)+'</b>':'<b>Unassigned</b>';
 const game=(a,b)=>'<div class="cfp-game"><small>First round · #'+a+' hosts</small>'+team(a)+'<i>vs</i>'+team(b)+'</div>';
 const quarter=(bye,a,b)=>'<div class="cfp-game"><small>Quarterfinal · bowl TBD</small>'+team(bye)+'<i>vs</i><b>Winner #'+a+' / #'+b+'</b></div>';
 const route=(bye,a,b)=>'<div class="cfp-route">'+game(a,b)+quarter(bye,a,b)+'</div>';
 const half=(s1,a1,b1,s2,a2,b2)=>'<div class="cfp-half"><h4>Seeds #'+s1+' and #'+s2+' semifinal path</h4><div class="cfp-routes">'+route(s1,a1,b1)+route(s2,a2,b2)+'</div><div class="cfp-semi"><small>Semifinal · Orange or Sugar Bowl (TBD)</small><b>Winner #'+s1+' path vs Winner #'+s2+' path</b></div></div>';
 return '<section class="bowl-feature"><h2>Projected 12-Team College Football Playoff</h2><p>RETRO-based ranking with projected conference leaders. Automatic bids: ACC, Big Ten, Big 12 and SEC champions, and the highest-rated Group of Six team regardless of conference title. Notre Dame qualifies if projected in the top 12. Actual conference championships and committee selections are still pending.</p>'+
 '<div class="cfp-field">'+f.map((t,i)=>'<article class="cfp-entry"><div class="cfp-entry-top"><b>#'+(i+1)+'</b><span>'+esc(result.bids.get(t.id)||'At-large')+'</span></div><div class="cfp-name">'+(t.logo?'<img src="'+esc(t.logo)+'" alt="" loading="lazy">':'')+'<b>'+esc(t.name)+'</b></div><small>'+esc(t.conference)+' · '+t.w+'–'+t.l+' · RETRO '+Math.round(t.elo)+' · projected '+t.expectedWins.toFixed(1)+' wins</small></article>').join('')+'</div>'+
 '<h3>Complete fixed bracket</h3><p class="cfp-note">Seeds 1–4 get byes, regardless of conference titles. Higher seeds host the first round. No reseeding, including for same-conference matchups.</p>'+
 '<div class="cfp-bracket">'+half(1,8,9,4,5,12)+half(2,7,10,3,6,11)+'</div>'+
 '<div class="cfp-title"><small>National Championship · Jan. 25, 2027 · Las Vegas</small><b>Winner #1 / #4 path vs Winner #2 / #3 path</b></div>'+
 '<p class="cfp-note">Quarterfinals: Fiesta, Cotton, Peach and Rose. Semifinals: Orange and Sugar. Bowl assignments require top seeds\' selections; championship games and conference tie-breakers are not simulated. <a href="https://collegefootballplayoff.com/sports/2024/5/29/12-team-format" target="_blank" rel="noopener noreferrer">Official CFP rules</a>.</p></section>';
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
 for(const bowl of selection){
  const picks=[];
  for(const slot of bowl.tieins){
   const eligible=all.filter(t=>!used.has(t.id)&&matchesSlot(t,slot,bowl)&&!picks.some(x=>x&&x.conference===t.conference));
   eligible.sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
   const chosen=eligible[0]||null;
   if(chosen)used.add(chosen.id);
   picks.push(chosen);
  }
  result.set(bowl.id,{...bowl,picks,unfilled:bowl.tieins.filter((_,i)=>!picks[i])});
 }
 return catalog.map(b=>result.get(b.id));
}
const teamHTML=t=>t?'<span class="bowl-team">'+(t.logo?'<img alt="" src="'+esc(t.logo)+'">':'')+'<strong>'+esc(t.name)+'</strong><small>'+t.w+'-'+t.l+(t.elo?' · RETRO '+Math.round(t.elo):'')+(Number.isFinite(t.expectedWins)?' · projected '+t.expectedWins.toFixed(1)+' wins':'')+'</small></span>':'<span class="bowl-team"><strong>Unassigned</strong></span>';function bowlPalette(b){const colors=['#10375c','#4a2045','#0f4c43','#6a3515','#353f73','#5b2231'];return colors[(Number(b.id.replace(/\D/g,''))||1)%colors.length]}function curatedCard(b,mode,match){return'<a class="bowl-card" href="cfb-bowls.html?bowl='+encodeURIComponent(b.id)+'&mode='+mode+'"><div class="bowl-card-head">'+(b.logo?'<img class="bowl-identity-logo" src="'+esc(b.logo)+'" alt="'+esc(b.name)+' logo" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">':'<span class="bowl-monogram" aria-hidden="true">✦</span>')+'<span class="bowl-logo-fallback" '+(b.logo?'hidden':'')+' aria-hidden="true">✦</span><h3>'+esc(b.name)+'</h3></div><div class="bowl-card-body"><span class="bowl-tag">2026–27 · '+esc(b.date)+'</span><div class="bowl-meta">'+esc(b.stadium)+' · '+esc(b.city)+'</div><div class="bowl-meta">Affiliations: '+b.tieins.map(esc).join(' / ')+'</div>'+(match?'<div class="bowl-match">'+teamHTML(match.picks[0])+'<strong>VS</strong>'+teamHTML(match.picks[1])+'</div>':'')+'</div></a>'}function curatedDetail(b,rows,mode){const match=rows.find(x=>x.id===b.id);return'<a href="cfb-bowls.html">← Bowl directory</a><section class="bowl-feature" style="background:linear-gradient(125deg,'+bowlPalette(b)+',#111c2e)"><div class="eyebrow">The '+esc(b.name)+' edition</div><h1>'+esc(b.name)+'</h1>'+(b.logo?'<img alt="Authentic bowl logo" src="'+esc(b.logo)+'">':'')+'<h2>'+esc(b.stadium)+'</h2><p>'+esc(b.city)+' · '+esc(b.date)+', 2026–27</p><div class="bowl-match">'+teamHTML(match?.picks[0])+'<strong>VS</strong>'+teamHTML(match?.picks[1])+'</div></section>'+historicalHTML(b)+'<h2>Conference affiliations</h2><p>'+b.tieins.map(esc).join(' versus ')+'</p><p>These are flexible bowl affiliations, not guaranteed selections. Bowl committees, CFP selections, eligibility, and conference agreements can change the assignments.</p><h2>Projection method</h2><p>'+ (mode==='retro'?'RETRO-based estimated end-of-season wins and bowl qualification. Remaining scheduled games are forecast opponent by opponent using RETRO and home-field advantage. Assignments are provisional, not official invitations.':'Projected finish based on actual remaining matchups; this is not an official bowl selection.')+'</p><p><a href="'+esc(b.source)+'">Official bowl season schedule</a> · <a href="'+esc(b.tieSource)+'">Affiliation reference</a></p>'}function renderCatalog(map){const params=new URLSearchParams(location.search),mode=params.get('mode')==='standings'?'standings':'retro';const playoff=playoffField(map,mode),rows=projectionRows(map,mode),chosen=catalog.find(x=>x.id===params.get('bowl'));if(chosen){root.innerHTML=curatedDetail(chosen,rows,mode);document.title=chosen.name+' | The Sporting Life & Times';return}root.innerHTML='<p class="bowl-note">'+esc(scheduleStatus)+' · projections only, not official selections · recalculated on reload</p><section id="cfp-predictor"><h2>College Football Playoff Predictor</h2>'+playoffHTML(playoff,mode)+'</section><section id="non-cfp-bowls"><h2>Projected Non-CFP Bowls</h2><p class="bowl-note">CFP teams are removed first. The remaining bowls select by 2026–27 conference agreements and projected selection preference, not game date. The Citrus and Alamo have documented first-selection rights; other ordering is an editorial estimate because committees have discretion. Pac-12 legacy eligibility is respected. Unfilled contract slots are left unassigned instead of using an unrelated school. Predictions are not official invitations.</p><p><a href="cfb-bowls.html?mode=standings">Standings projections</a> · <a href="cfb-bowls.html?mode=retro">RETRO projections</a></p><div class="bowl-grid">'+rows.map(b=>curatedCard(b,mode,b)).join('')+'</div></section>'}root.innerHTML='<h2>2026–27 Bowl Directory</h2><p class="bowl-note">Loading live standings and playoff projections. Browse individual bowls while data loads.</p><div class="bowl-grid">'+catalog.map(b=>curatedCard(b,'retro')).join('')+'</div>';Promise.all([loadRatings(),pool(),loadSchedule()]).then(([,map])=>{renderCatalog(map);document.addEventListener('cfb-ratings-ready',()=>renderCatalog(map))}).catch(e=>{root.innerHTML='<p class="bowl-note">Complete projections temporarily unavailable: '+esc(e.message)+'. Unverified or partial schedules are not used.</p><div class="bowl-grid">'+catalog.map(b=>curatedCard(b,'retro')).join('')+'</div>'})})();