(()=>{'use strict';const D=window.CFB_DESK,{esc,link,ranked,rating,pct}=D,$=id=>document.getElementById(id);let field=[],picks=new Map(),snapshot;let randomSeed;
const random=()=>{randomSeed=(Math.imul(1664525,randomSeed)+1013904223)>>>0;return randomSeed/4294967296};
const probability=(a,b,home=false)=>1/(1+10**((rating(b)-rating(a)-(home?65:0))/400));
const seed=t=>field.findIndex(a=>a.id===t.id)+1;
function pair(a,b,home){if(home&&seed(a)>seed(b))[a,b]=[b,a];return [a,b]}
function drawBracket(){if(field.length!==12)return;const rounds=[[],[],[],[]];const play=(key,a,b,home)=>{[a,b]=pair(a,b,home);let chosen=picks.get(key);if(chosen!==a.id&&chosen!==b.id)chosen=probability(a,b,home)>=.5?a.id:b.id;const winner=chosen===a.id?a:b;picks.set(key,winner.id);rounds[+key[0]].push({key,a,b,home,winner});return winner};
 const f1=play('0a',field[4],field[11],true),f2=play('0b',field[5],field[10],true),f3=play('0c',field[6],field[9],true),f4=play('0d',field[7],field[8],true);
 const q1=play('1a',field[0],f4,true),q2=play('1b',field[3],f1,true),q3=play('1c',field[1],f3,true),q4=play('1d',field[2],f2,true);
 const s1=play('2a',q1,q2,false),s2=play('2b',q3,q4,false);const champion=play('3a',s1,s2,false);const champEl=$('g6-champion');if(champEl)champEl.innerHTML='<div class="g6-champion-label">YOUR PROJECTED CHAMPION</div><div class="g6-champion-team">'+link(champion)+'</div><div class="g6-champion-meta">No. '+seed(champion)+' seed · RETRO '+Math.round(rating(champion))+' · Your bracket selection</div>';
 $('g6-bracket').innerHTML=rounds.map((games,i)=>'<section class="bracket-round"><h3>'+['First round','Quarterfinals','Semifinals','Championship'][i]+'</h3>'+games.map(g=>'<article class="bracket-game"><small>'+(g.home?'Higher seed hosts · ':'Neutral site · ')+Math.round(probability(g.a,g.b,g.home)*100)+'% '+esc(g.a.name)+'</small>'+[g.a,g.b].map(t=>'<button type="button" data-game="'+g.key+'" data-pick="'+t.id+'" aria-pressed="'+(t.id===g.winner.id)+'">'<span class="g6-seed-badge">#'+seed(t)+'</span><span class="g6-bracket-team">'+link(t).replace(/<a\b[^>]*>/,'<span class="team-identity">').replace(/<\/a>/,'</span>')+'</span>'+(t.id===g.winner.id?'<span class="g6-winner-mark" aria-label="Selected winner">✓</span>':'')+'</button>').join('')+'</article>').join('')+'</section>').join('');}
function simulate(){const counts=new Map(field.map(t=>[t.id,0]));randomSeed=20261031;const play=(a,b,home)=>{[a,b]=pair(a,b,home);return random()<probability(a,b,home)?a:b};for(let i=0;i<2000;i++){const f1=play(field[4],field[11],true),f2=play(field[5],field[10],true),f3=play(field[6],field[9],true),f4=play(field[7],field[8],true);const q1=play(field[0],f4,true),q2=play(field[3],f1,true),q3=play(field[1],f3,true),q4=play(field[2],f2,true);const champion=play(play(q1,q2,false),play(q3,q4,false),false);counts.set(champion.id,counts.get(champion.id)+1)}
 $('g6-odds').innerHTML='<table><thead><tr><th class="school">Team</th><th>Title</th></tr></thead><tbody>'+[...field].sort((a,b)=>counts.get(b.id)-counts.get(a.id)).map(t=>{const p=counts.get(t.id)/20;return '<tr><td class="school">'+link(t)+'<div class="prob-bar"><i style="width:'+p+'%"></i></div></td><td>'+p.toFixed(1)+'%</td></tr>'}).join('')+'</tbody></table>';drawRoad(counts);window.CFB_G6_SIMULATION={draws:2000,counts:Object.fromEntries(counts),field:field.map(t=>t.id)};}
function drawRoad(counts){
 const list=[...field].sort((a,b)=>counts.get(b.id)-counts.get(a.id));
 const title=t=>(counts.get(t.id)/20).toFixed(1)+'%';
 const pairings=[[field[4],field[11]],[field[5],field[10]],[field[6],field[9]],[field[7],field[8]]];
 const upset=pairings.map(([favorite,underdog])=>({favorite,underdog,p:1-probability(favorite,underdog,true)})).sort((a,b)=>b.p-a.p)[0];
 const biggest=list[0],challenger=list[1],dark=list.filter(t=>seed(t)>4)[0];
 const feature=(label,t,detail)=>'<article class="g6-road-card"><small>'+label+'</small><div class="g6-road-identity">'+link(t)+'</div><strong>'+title(t)+' title chance</strong><p>'+detail+'</p></article>';
 $('g6-road-content').innerHTML='<div class="g6-road-features">'+feature('THE TITLE FAVORITE',biggest,'No. '+seed(biggest)+' seed · RETRO '+Math.round(rating(biggest))+' · strongest simulated title contender.')+feature('THE CLOSEST CHALLENGER',challenger,'No. '+seed(challenger)+' seed · a leading rival for the crown.')+(dark?feature('THE DANGEROUS OUTSIDER',dark,'No. '+seed(dark)+' seed · must survive the opening round to make a title run.'):'')+'</div><div class="g6-upset-feature"><div><small>UPSET WATCH · FIRST ROUND</small><h3>'+esc(upset.underdog.name)+' at '+esc(upset.favorite.name)+'</h3><p>The model gives the lower seed a '+(upset.p*100).toFixed(1)+'% chance to win this opening-round matchup at the higher seed’s home field.</p></div><div class="g6-upset-marks">'+link(upset.underdog)+link(upset.favorite)+'</div></div>';
 const select=$('g6-path-team');const previous=select.value;select.innerHTML=field.map(t=>'<option value="'+esc(t.id)+'">#'+seed(t)+' '+esc(t.name)+'</option>').join('');if(field.some(t=>t.id===previous))select.value=previous;
 drawPath();
}
function drawPath(){
 const chosen=field.find(t=>t.id===$('g6-path-team').value);if(!chosen)return;
 const s=seed(chosen),first={5:12,12:5,6:11,11:6,7:10,10:7,8:9,9:8};
 const quarterGroup=s===1||s===8||s===9?[1,8,9]:s===4||s===5||s===12?[4,5,12]:s===2||s===7||s===10?[2,7,10]:[3,6,11];
 const half=quarterGroup[0]===1||quarterGroup[0]===4?'upper':'lower';
 const qOpponent=quarterGroup.filter(n=>n!==s).map(n=>field[n-1]);
 const possibleSemi=(half==='upper'?[1,4,5,8,9,12]:[2,3,6,7,10,11]).filter(n=>!quarterGroup.includes(n)).map(n=>field[n-1]);
 const opposite=(half==='upper'?[2,3,6,7,10,11]:[1,4,5,8,9,12]).map(n=>field[n-1]);
 const names=arr=>arr.map(t=>esc(t.name)).join(' · ');
 $('g6-path-details').innerHTML='<div class="g6-path-team">'+link(chosen)+'<span>Seed '+s+' · RETRO '+Math.round(rating(chosen))+'</span></div><div class="g6-path-stages"><div><small>ROUND ONE</small><strong>'+(s<=4?'BYE':esc(field[first[s]-1].name))+'</strong><span>'+(s<=4?'Advance directly to the quarterfinals':'Higher seed hosts')+'</span></div><div><small>QUARTERFINAL</small><strong>'+names(qOpponent)+'</strong><span>Possible opponents in this fixed draw</span></div><div><small>SEMIFINAL</small><strong>'+names(possibleSemi)+'</strong><span>Potential neutral-site opponents</span></div><div><small>CHAMPIONSHIP</small><strong>'+names(opposite)+'</strong><span>Potential opponents from the other half</span></div></div><p class="data-note">Paths list possible opponents, not predicted winners. Picks in the interactive bracket below may produce a different route.</p>';
}
$('g6-path-team').addEventListener('change',drawPath);


/* Weekly archive is published by the isolated G6 race workflow, never by page views. */
let raceArchive=[];
const signed=n=>(n>0?'+':'')+n;
function drawRace(){
 const root=$('g6-race-content');if(!root||!field.length)return;
 const valid=raceArchive.filter(s=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&Array.isArray(s.teams)&&s.teams.length===12&&new Set(s.teams.map(t=>String(t.id))).size===12).sort((a,b)=>a.date.localeCompare(b.date));
 if(!valid.length){root.innerHTML='<p class="g6-race-empty">The weekly register has not yet published its first verified snapshot. Current projections appear above; movement will begin once two distinct weekly records exist.</p>';return}
 const current=valid[valid.length-1],previous=valid.length>1?valid[valid.length-2]:null;
 const previousById=new Map((previous?.teams||[]).map(t=>[String(t.id),t]));
 const currentIds=new Set(current.teams.map(t=>String(t.id)));
 const dropouts=previous?previous.teams.filter(t=>!currentIds.has(String(t.id))):[];
 const date=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 const label=t=>esc(t.name||String(t.id));
 const delta=t=>{const before=previousById.get(String(t.id));if(!previous)return 'BASELINE';if(!before)return 'NEW';const d=Number(before.seed)-Number(t.seed);return d>0?'▲ '+d:d<0?'▼ '+Math.abs(d):'—'};
 const prob=t=>Number(t.titlePct).toFixed(1)+'%';
 const change=t=>{const before=previousById.get(String(t.id));return before?signed((Number(t.titlePct)-Number(before.titlePct)).toFixed(1))+' pp':'NEW'};
 root.innerHTML='<div class="g6-register-intro"><strong>Edition of '+date(current.date)+'</strong><span>'+ (previous?'Compared with '+date(previous.date):'Founding edition · baseline only')+'</span></div>'+
 (previous?'<div class="g6-register-movements"><div><small>ENTERING THE FIELD</small><strong>'+ (current.teams.filter(t=>!previousById.has(String(t.id))).map(label).join(' · ')||'No changes')+'</strong></div><div><small>DEPARTING THE FIELD</small><strong>'+(dropouts.map(label).join(' · ')||'No changes')+'</strong></div></div>':'<p class="data-note">First archived edition. There is no prior snapshot for a meaningful weekly comparison.</p>')+
 '<div class="table-scroll"><table class="g6-race-table"><thead><tr><th>Seed</th><th class="school">Team</th><th>Movement</th><th>RETRO</th><th>Title odds</th><th>Weekly change</th></tr></thead><tbody>'+
 [...current.teams].sort((a,b)=>Number(a.seed)-Number(b.seed)).map(t=>'<tr><td>'+Number(t.seed)+'</td><td class="school">'+label(t)+'</td><td>'+delta(t)+'</td><td>'+Math.round(Number(t.rating))+'</td><td>'+prob(t)+'</td><td>'+ (previous?change(t):'—')+'</td></tr>').join('')+
 '</tbody></table></div><p class="data-note">Title movement is in percentage points, not percent. Weekly snapshots are fixed archival records; the live field and simulations above may be newer. Source freshness and capture date are recorded with each edition.</p>';
}
fetch('data/g6-race-history.json?v=20261109',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('archive not yet available');return r.json()}).then(d=>{raceArchive=Array.isArray(d.snapshots)?d.snapshots:[];drawRace()}).catch(()=>{raceArchive=[];drawRace()});

function build(){if(!snapshot||!window.CFB_RATINGS)return;const pool=ranked([...snapshot.teams.values()].filter(t=>D.G6.includes(t.conference)));const champs=D.G6.map(c=>pool.filter(t=>t.conference===c&&t.confRecord).sort((a,b)=>pct(b.confRecord)-pct(a.confRecord)||rating(b)-rating(a))[0]);if(champs.some(t=>!t)){$('g6-field').innerHTML='<p class="error">All six conference record sets are required. Field withheld until coverage is restored.</p>';return}const automatic=new Set(champs.map(t=>t.id));field=ranked([...champs,...pool.filter(t=>!automatic.has(t.id)).slice(0,6)]);if(field.length!==12||new Set(field.map(t=>t.id)).size!==12)throw Error('Invalid theoretical field');
 $('g6-field').innerHTML=field.map((t,i)=>'<article class="seed-card"><div class="seed">#'+(i+1)+' · '+(i<4?'FIRST-ROUND BYE':'FIRST ROUND')+'</div>'+link(t)+'<p>'+esc(t.conference)+' · '+esc(t.record?.text||'—')+'<br>RETRO '+Math.round(rating(t))+' · '+(automatic.has(t.id)?'Provisional champion':'At-large')+'</p></article>').join('');$('data-stamp').textContent='Results: '+new Date(window.CFB_RETROSPECTIVE.sourceUpdatedAt).toLocaleString('en-US',{timeZone:'America/New_York'})+' ET · Standings: '+new Date(snapshot.payload.feeds.standings.updated_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' ET';simulate();drawBracket();drawRace();const leagueEl=$('g6-leagues');if(leagueEl){leagueEl.innerHTML=D.G6.map(c=>{const t=champs.find(t=>t.conference===c);return '<article class="g6-league"><small>'+esc(c)+'</small><div class="g6-league-mark">'+(t?link(t):'—')+'</div><span>Provisional leader</span></article>'}).join('')}window.CFB_G6_FIELD=field.map(t=>({id:t.id,conference:t.conference,automatic:automatic.has(t.id),rating:rating(t)}));}
D.promise.then(d=>{snapshot=d;build()}).catch(e=>{$('g6-field').innerHTML='<p class="error">Theoretical field unavailable: '+esc(e.message)+'</p>';$('data-stamp').textContent='Data unavailable.'});document.addEventListener('cfb-ratings-ready',()=>{D.promise.then(d=>{snapshot=d;build()}).catch(console.error)});$('reset-bracket').addEventListener('click',()=>{picks.clear();drawBracket()});$('g6-bracket').addEventListener('click',e=>{const b=e.target.closest('button[data-pick]');if(!b)return;picks.set(b.dataset.game,b.dataset.pick);drawBracket();const next=$('g6-bracket').querySelector('[data-game="'+b.dataset.game+'"][data-pick="'+b.dataset.pick+'"]');next?.focus()});
})();
