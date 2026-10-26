(()=>{'use strict';
if(document.body.dataset.league!=='nbl'||!document.getElementById('nbl-club-picker'))return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const teams=['Adelaide 36ers','Brisbane Bullets','Cairns Taipans','Illawarra Hawks','Melbourne United','New Zealand Breakers','Perth Wildcats','South East Melbourne Phoenix','Sydney Kings','Tasmania JackJumpers'];
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const valid=u=>{try{let a=new URL(u);return a.protocol==='https:'&&/(^|\.)(espn|espncdn)\.com$/.test(a.hostname)?a.href:''}catch{return''}};
const pretty=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d):'Time unavailable'};
const get=async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error('Missing '+file);return r.json()};
const fill=(id,text)=>{const node=$(id);if(node)node.textContent=text};
const clubFromQuery=()=>{const query=new URLSearchParams(location.search).get('team');return teams.find(t=>normalize(t)===normalize(query))||'Sydney Kings'};
function gameCard(g,team,logoMap){
 const h=g.home,a=g.away,hp=Number(g.home_score),ap=Number(g.away_score);
 const isFinal=Number.isFinite(hp)&&Number.isFinite(ap)&&hp!==ap;
 const u=valid(g.source_url||g.url);
 const club=n=>{const src=logoMap.get(normalize(n));return (src?'<img src="'+esc(src)+'" alt="" loading="lazy" onerror="this.hidden=true">':'')+esc(n)};
 const lines='<div class="nbl-result-row '+(isFinal&&ap>hp?'winner':'')+'"><span class="club">'+club(a)+'</span><b>'+(isFinal?esc(ap):'—')+'</b></div>'+
  '<div class="nbl-result-row '+(isFinal&&hp>ap?'winner':'')+'"><span class="club">'+club(h)+'</span><b>'+(isFinal?esc(hp):'—')+'</b></div>';
 return (u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">':'')+'<article class="nbl-result-card"><p class="nbl-result-meta">'+(isFinal?'Final':'Scheduled')+' · '+esc(pretty(g.played_at||g.date))+'</p>'+lines+'</article>'+(u?'</a>':'');
}
function scrapeLogos(scoreboard){
 const logos=new Map();
 for(const league of scoreboard?.leagues||[])if(league.league==='Australian NBL')
  for(const g of league.games||[])for(const t of g.teams||[]){
    let url=valid(t.logo);if(t.name&&url)logos.set(normalize(t.name),url);
  }
 return logos;
}
async function start(){
 const picker=$('nbl-club-picker');
 picker.innerHTML=teams.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
 let selected=clubFromQuery();
 picker.value=selected;
 picker.addEventListener('change',()=>{location.href='nbl-team.html?team='+encodeURIComponent(picker.value)});
 const [standResult,eloResult,scoresResult,ledgerResult]=await Promise.allSettled([
  get('data/nbl-standings.json'),get('data/nbl-elo-research.json'),get('multi_scoreboards.json'),get('data/nbl-research-current-ledger.json')
 ]);
 const stand=standResult.status==='fulfilled'?standResult.value:null;
 const elo=eloResult.status==='fulfilled'?eloResult.value:null;
 const scores=scoresResult.status==='fulfilled'?scoresResult.value:null;
 const ledger=ledgerResult.status==='fulfilled'?ledgerResult.value:null;
 const standingsOk=stand?.league==='Australian NBL'&&stand?.status==='source_derived_not_officially_reconciled'&&stand?.rows?.length===10;
 const eloOk=elo?.status==='RESEARCH_ONLY_UNCERTIFIED'&&elo.production_approved===false&&elo.prediction_certified===false&&elo.ratings?.length===10;
 const ledgerOk=ledger?.source_status==='uncertified_source_candidates'&&Array.isArray(ledger?.games);
 const row=standingsOk?stand.rows.find(r=>r.team===selected):null;
 const rating=eloOk?elo.ratings.find(r=>r.team===selected):null;
 const logos=scrapeLogos(scores);
 try{const manifest=await get('assets/nbl-logos/manifest.json');for(const [team,url] of Object.entries(manifest.teams||{}))logos.set(normalize(team),url)}catch{}

 const palette={'Adelaide 36ers':'#bb253f','Brisbane Bullets':'#12649c','Cairns Taipans':'#dc6922','Illawarra Hawks':'#c6323b','Melbourne United':'#34404c','New Zealand Breakers':'#126678','Perth Wildcats':'#c62636','South East Melbourne Phoenix':'#17664e','Sydney Kings':'#6543a2','Tasmania JackJumpers':'#34765e'};
 document.documentElement.style.setProperty('--club',palette[selected]||'#164e63');
 const image=logos.get(normalize(selected));
 document.title=selected+' | NBL Club Desk | The Sporting Life & Times';
 $('nbl-club-heading').innerHTML='<div class="nbl-team-summary-head">'+(image?'<img class="nbl-team-crest" src="'+esc(image)+'" alt="" loading="lazy">': '<span class="nbl-brand-initial" aria-hidden="true">'+esc(selected.split(' ').map(x=>x[0]).slice(0,2).join(''))+'</span>')+'<h1 class="nbl-edition-title">'+esc(selected)+'</h1></div>';
 fill('nbl-club-description',row?'Your courtside edition. Games, player leaders, season stories and USRS Elo. Updated '+pretty(stand.updated_at)+'.':'Club report: waiting for a complete current-season source snapshot.');
 const metrics=[
  ['Regular-season record',row?row.wins+'–'+row.losses:'Unavailable','2026–27 record'],
  ['Season standing',row?(stand.rows.indexOf(row)+1)+' of 10':'Unavailable','League table position'],
  ['USRS Elo rating',rating?Number(rating.elo).toFixed(1):'Unavailable','Independent team rating'],
  ['USRS power rank',rating?'No. '+rating.rank:'Unavailable','League-wide Elo position']
 ];
 $('nbl-club-summary').innerHTML=metrics.map(([label,value,sub])=>'<div class="nbl-edition-cell"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(sub)+'</span></div>').join('');
 const completed=ledgerOk?ledger.games.filter(g=>(g.home===selected||g.away===selected)&&g.home_score!==g.away_score).sort((a,b)=>String(b.played_at).localeCompare(String(a.played_at))):[];
 fill('nbl-club-results-count',completed.length?completed.length+' games this season':'Completed-game archive temporarily unavailable');
 $('nbl-club-completed').innerHTML=completed.length?completed.map(g=>gameCard(g,selected,logos)).join(''):'<p class="nbl-scoreboard-empty">No complete, sourced club results are available in this snapshot.</p>';
 let upcoming=[];
 if(scores)for(const group of scores.leagues||[])if(group.league==='Australian NBL')
   for(const game of group.games||[]){
     if(!(game.state==='pre'||game.state==='in'))continue;
     const ts=game.teams||[];
     if(!ts.some(t=>normalize(t.name)===normalize(selected)))continue;
     const home=ts.find(t=>t.home_away==='home')||ts[0],away=ts.find(t=>t.home_away==='away')||ts[1];
     if(home&&away)upcoming.push({home:home.name,away:away.name,date:game.date,url:game.url});
   }
 upcoming.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 $('nbl-club-upcoming').innerHTML=upcoming.length?upcoming.slice(0,8).map(g=>gameCard(g,selected,logos)).join(''):'<p class="nbl-scoreboard-empty">No upcoming fixture is supplied by the current scoreboard window. Check <a href="https://nbl.com.au/" target="_blank" rel="noopener noreferrer">the official NBL schedule</a> for the complete season calendar.</p>';
}
start().catch(err=>{
 fill('nbl-club-description','Cannot validate the latest club snapshot: '+err.message);
 fill('nbl-club-results-count','No reliable result data available');
});
})();
