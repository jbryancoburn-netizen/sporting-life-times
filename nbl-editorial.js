(()=>{'use strict';
if(document.body.dataset.league!=='nbl')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validURL=u=>{try{const x=new URL(u);return x.protocol==='https:'&&(/(^|\.)espn(cdn)?\.com$/.test(x.hostname)||/(^|\.)nbl\.com\.au$/.test(x.hostname))?x.href:''}catch{return''}};
const key=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const nameAliases={'southeastmelbournephoenix':'southeastmelbournephoenix','semelbournephoenix':'southeastmelbournephoenix','nzbreakers':'newzealandbreakers'};
const canonical=s=>nameAliases[key(s)]||key(s);
const short={'Adelaide 36ers':'Adelaide','Brisbane Bullets':'Brisbane','Cairns Taipans':'Cairns','Illawarra Hawks':'Illawarra','Melbourne United':'Melbourne','New Zealand Breakers':'NZ Breakers','Perth Wildcats':'Perth','South East Melbourne Phoenix':'SEM Phoenix','Sydney Kings':'Sydney','Tasmania JackJumpers':'Tasmania'};
const json=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
const stamp=s=>{const d=new Date(s);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d):'Date unverified'};
const teamLink=team=>'nbl-team.html?team='+encodeURIComponent(team);
const clubs=[
 ['Adelaide 36ers','36','Adelaide','#c8102e'],['Brisbane Bullets','BB','Brisbane','#0e5d9d'],
 ['Cairns Taipans','CT','Cairns','#ef6b22'],['Illawarra Hawks','IH','Illawarra','#dc292c'],
 ['Melbourne United','MU','Melbourne','#282c35'],['New Zealand Breakers','NZ','NZ Breakers','#0c8e9b'],
 ['Perth Wildcats','PW','Perth','#d02030'],['South East Melbourne Phoenix','SEM','SEM Phoenix','#0a7754'],
 ['Sydney Kings','SK','Sydney','#5c2693'],['Tasmania JackJumpers','TJ','Tasmania','#34714c']
];
const clubMeta=team=>clubs.find(c=>canonical(c[0])===canonical(team));
const brand=team=>{const c=clubMeta(team);return '<span class="nbl-brand-initial" style="--club-color:'+(c?c[3]:'#424242')+'">'+esc(c?c[1]:'NBL')+'</span>'};
const logo=(team,logos,size='small')=>{const u=logos.get(canonical(team));return u?'<img class="nbl-club-mark" src="'+esc(u)+'" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('+JSON.stringify("◉")+'))">':brand(team)};
async function officialLogos(){
 const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/teams?limit=100',{cache:'no-store'});
 if(!r.ok)throw Error('Team image source unavailable');
 const j=await r.json();const out=new Map();
 for(const item of j?.sports?.[0]?.leagues?.[0]?.teams||[]){
   const t=item.team||item;const src=validURL(t.logos?.[0]?.href||t.logo);
   for(const n of [t.displayName,t.name,t.shortDisplayName])if(n&&src)out.set(canonical(n),src);
 }
 return out;
}
function clubRibbon(logos){
 const root=$('nbl-club-ribbon');if(!root)return;
 root.innerHTML=clubs.map(c=>'<a class="nbl-club-tile" href="'+esc(teamLink(c[0]))+'" style="--club-color:'+c[3]+'"><span class="nbl-tile-mark">'+(logos.get(canonical(c[0]))?'<img src="'+esc(logos.get(canonical(c[0])))+'" alt="" loading="lazy" onerror="this.remove()">':esc(c[1]))+'</span><span class="nbl-tile-name">'+esc(c[0])+'<small>Club desk ↗</small></span></a>').join('');
}
function sources(s){
 const logos=new Map();
 for(const b of (s?.leagues||[])){if(b.league!=='Australian NBL')continue;
   for(const g of b.games||[])for(const t of g.teams||[]){
     const u=validURL(t.logo);
     if(u&&t.name)logos.set(canonical(t.name),u);
   }
 }
 return logos;
}
function editorialScore(g,logos){
 const h=g.home,a=g.away,hs=g.home_score,as=g.away_score;
 const winner=hs>as?'home':'away',u=validURL(g.source_url);
 const box='<article class="nbl-result-card"><p class="nbl-result-meta">Final · '+esc(stamp(g.played_at))+'</p>'+
  '<div class="nbl-result-row '+(winner==='away'?'winner':'')+'"><span class="club">'+logo(a,logos)+esc(short[a]||a)+'</span><b>'+esc(as)+'</b></div>'+
  '<div class="nbl-result-row '+(winner==='home'?'winner':'')+'"><span class="club">'+logo(h,logos)+esc(short[h]||h)+'</span><b>'+esc(hs)+'</b></div></article>';
 return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer" aria-label="Source for '+esc(a)+' at '+esc(h)+'">'+box+'</a>':box;
}
function updateScoreboard(d,logos){
 const games=Array.isArray(d?.recent_finals)?d.recent_finals:[];
 const deck=$('nbl-featured-finals');
 if(deck)deck.innerHTML=games.length?games.slice(-4).reverse().map(g=>editorialScore(g,logos)).join(''):'<p class="nbl-scoreboard-empty">Recent sourced finals are unavailable in this edition.</p>';
 const latest=games.at(-1),score=$('nbl-hero-final');
 if(score){
  if(!latest){score.textContent='Recent results unavailable';return}
  const u=validURL(latest.source_url);
  const label='<div class="nbl-latest-score"><b>'+esc(short[latest.away]||latest.away)+' '+esc(latest.away_score)+'</b><em>–</em><b>'+esc(short[latest.home]||latest.home)+' '+esc(latest.home_score)+'</b></div>';
  score.innerHTML=u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':label;
 }
}
function record(r){return r?r.wins+'–'+r.losses:'—'}
function teamCard(name,rankings,standings,logos){
 const elo=rankings.find(x=>x.team===name),regular=standings.find(x=>x.team===name);
 return '<article class="nbl-team-summary"><div class="nbl-team-summary-head">'+logo(name,logos)+
 '<div><h3><a href="'+esc(teamLink(name))+'">'+esc(name)+'</a></h3><small>'+esc(elo?'Independent Elo research edition · Rank '+elo.rank:'Research rating unavailable')+'</small></div></div>'+
 '<div class="nbl-metrics"><div><b>'+esc(record(regular))+'</b><span>Season record</span></div>'+
 '<div><b>'+esc(elo?Number(elo.elo).toFixed(1):'—')+'</b><span>Research Elo</span></div></div></article>';
}
function renderCompare(teams,rankings,standings,logos){
 const a=$('nbl-compare-a'),b=$('nbl-compare-b'),dest=$('nbl-team-comparison');
 if(!a||!b||!dest)return;
 function update(){
   const x=a.value,y=b.value;
   if(x===y){dest.innerHTML='<p class="nbl-form-guide">Select two different clubs to compare their current records and ratings.</p>';return}
   dest.innerHTML=teamCard(x,rankings,standings,logos)+teamCard(y,rankings,standings,logos);
 }
 for(const [i,select] of [a,b].entries()){
   select.innerHTML=teams.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
   select.value=teams[i===0?0:1];select.addEventListener('change',update);
 }
 const top=rankings[0],second=rankings[1];
 if(top&&second){a.value=top.team;b.value=second.team}
 update();
}
function teamFinder(){
 const search=$('nbl-team-search'),message=$('nbl-team-search-feedback');
 if(!search)return;
 search.addEventListener('input',()=>{
  const target=canonical(search.value);
  let shown=0;
  for(const tr of document.querySelectorAll('#league-standings-table tbody tr, #nbl-elo-table tbody tr')){
   const match=!target||canonical(tr.textContent).includes(target);
   tr.classList.toggle('nbl-hidden-row',!match);
   if(match)shown++;
  }
  if(message)message.textContent=target?(shown?shown+' rows match across standings and the Power Index':'No matching club found'):'Search both tables by club name';
 });
}
async function run(){
 const [standingResult,ratingsResult,scoreResult]=await Promise.allSettled([
  json('data/nbl-standings.json'),json('data/nbl-elo-research.json'),json('multi_scoreboards.json')
 ]);
 const d=standingResult.status==='fulfilled'?standingResult.value:null;
 const e=ratingsResult.status==='fulfilled'?ratingsResult.value:null;
 const logos=sources(scoreResult.status==='fulfilled'?scoreResult.value:null);
 try {for(const [name,url] of await officialLogos())logos.set(name,url)}catch{}
 clubRibbon(logos);
 const validStandings=d?.league==='Australian NBL'&&d?.status==='source_derived_not_officially_reconciled'&&d?.rows?.length===10;
 const validRatings=e?.status==='RESEARCH_ONLY_UNCERTIFIED'&&e?.production_approved===false&&e?.prediction_certified===false&&e?.ratings?.length===10;
 const regular=validStandings?d.rows:[];
 const research=validRatings?e.ratings:[];
 const top=regular[0],power=research[0];
 if($('nbl-hero-leader'))$('nbl-hero-leader').textContent=top?top.team+' · '+record(top):'Awaiting season table';
 if($('nbl-hero-elo'))$('nbl-hero-elo').textContent=power?power.team+' · '+Number(power.elo).toFixed(1):'Rating archive unavailable';
 if($('nbl-hero-games'))$('nbl-hero-games').textContent=validStandings?d.games_replayed+' finals replayed':'Results unavailable';
 if($('nbl-source-checked'))$('nbl-source-checked').textContent=validStandings?'Regular-season table checked '+stamp(d.updated_at):'No current season snapshot';
 if(validStandings)updateScoreboard(d,logos);
 else if($('nbl-featured-finals'))$('nbl-featured-finals').textContent='Recent sourced finals are temporarily unavailable.';
 if(validRatings&&validStandings){
   const known=new Set(regular.map(r=>r.team));
   if(research.every(r=>known.has(r.team))){
     renderCompare([...known].sort((a,b)=>a.localeCompare(b)),research,regular,logos);
   }
 }
 if(!validRatings&&$('nbl-team-comparison'))$('nbl-team-comparison').textContent='Comparison available when the full independent research rating snapshot has been published.';
 if(validRatings){
   const body=$('nbl-elo-table');
   if(body)for(const tr of body.querySelectorAll('tbody tr')){
    const cell=tr.querySelector('th');
    if(cell){const n=cell.textContent;cell.innerHTML='<span class="nbl-elo-club">'+logo(n,logos)+'<a href="'+esc(teamLink(n))+'">'+esc(n)+'</a></span>'}
   }
 }
 if(validStandings){
   const container=$('league-standings-table');
   if(container)for(const tr of container.querySelectorAll('tbody tr')){
    const cell=tr.querySelector('th');
    if(cell){const n=cell.textContent;cell.innerHTML='<span class="nbl-elo-club">'+logo(n,logos)+esc(n)+'</span>'}
   }
 }
 // Shared league desk populates its tables asynchronously. Observe only the
 // two target tables so club links and sourced crests remain after they render.
 const decorate=id=>{
  const root=$(id);if(!root)return;
  for(const cell of root.querySelectorAll('tbody tr th')){
   if(cell.querySelector('.nbl-elo-club'))continue;
   const club=cell.textContent.trim();
   if(!club)return;
   cell.innerHTML='<span class="nbl-elo-club">'+logo(club,logos)+
     '<a href="'+esc(teamLink(club))+'">'+esc(club)+'</a></span>';
  }
 };
 for(const id of ['league-standings-table','nbl-elo-table']){
  const root=$(id);if(!root)continue;
  decorate(id);
  const observer=new MutationObserver(()=>decorate(id));
  observer.observe(root,{childList:true,subtree:true});
 }
 teamFinder();
}
run().catch(()=>{if($('nbl-source-checked'))$('nbl-source-checked').textContent='Snapshot unavailable';});
})();
