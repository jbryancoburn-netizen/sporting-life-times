(()=>{'use strict';
const id=new URLSearchParams(location.search).get('team')||'84',$=name=>document.getElementById(name);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg=v=>'<p class="team-subtle">'+esc(v)+'</p>',base='https://site.api.espn.com/apis/site/v2/sports/football/college-football/';
const get=async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
const source=path=>get(base+path),color=(x,f)=>/^[0-9a-f]{6}$/i.test(x||'')&&!/^(ffffff|fefefe|fffefa)$/i.test(x)?'#'+x:f;
const dt=x=>new Date(x).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
const tm=x=>new Date(x).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
const fullDate=x=>new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const done=e=>e?.status?.type?.completed===true||e?.status?.type?.state==='post';
const logo=t=>t?.logos?.[0]?.href||t?.logo||(t?.id?'https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(t.id)+'.png':'');
if(!/^\d+$/.test(id)){$('team-heading').textContent='Select a school from the college football directory.';return}
let snapshot=null,events=[],roster=[],brands=new Map(),schools=new Map(),team=null,scoreRecord=null,statsData=null,rosterAvailable=false;
function indexTeams(p){brands=new Map((p?.feeds?.teams?.data?.sports?.[0]?.leagues?.[0]?.teams||[]).map(e=>[String(e.team.id),e.team]));
 schools=new Map();function walk(node,parent){if(!node)return;const conference=node.name||parent||'Independent';
 for(const e of node.standings?.entries||node.entries||[]){if(e.team?.id)schools.set(String(e.team.id),{...e.team,conference})}
 for(const child of node.children||[])walk(child,conference)}walk(p?.feeds?.standings?.data,'FBS');
}
function published(teamId){const a=schools.get(String(teamId))||{},b=brands.get(String(teamId))||{};
 const t={...b,...a,id:String(teamId),displayName:a.displayName||b.displayName,shortDisplayName:a.shortDisplayName||b.shortDisplayName,color:b.color||a.color,alternateColor:b.alternateColor||a.alternateColor,logos:a.logos||b.logos,conference:a.conference};
 return t.displayName?t:null;
}
function mark(t){const b=published(t?.id)||{},a={...b,...t};
 const {primary,secondary}=window.CFB_DESK.ringColors(a);
 return '<span class="cfb-team-mark" style="--primary:'+primary+';--secondary:'+secondary+'"><img loading="lazy" src="'+esc(logo(a))+'" alt=""></span>';
}
function normalizeSchedules(saved,fixture,finals){const map=new Map();
 for(const e of fixture||[])if(e?.id)map.set(String(e.id),e);
 for(const e of saved||[])if(e?.id&&e.competitions?.[0]?.competitors?.some(c=>String(c.team?.id)===id))map.set(String(e.id),e);
 for(const g of finals||[]){if(!g.teams?.some(t=>String(t.id)===id))continue;
 const old=map.get(String(g.id));if(old&&done(old))continue;
 const sides=g.teams.map(t=>({team:{id:String(t.id),displayName:t.name,logo:logo(published(t.id)||{id:t.id})},score:String(t.score),homeAway:t.homeAway}));
 map.set(String(g.id),{...old,id:String(g.id),date:g.date,status:{type:{completed:true,state:'post',shortDetail:'Final'}},competitions:[{...(old?.competitions?.[0]||{}),competitors:sides,neutralSite:g.neutral}]});
 }
 return [...map.values()].filter(e=>e.competitions?.[0]?.competitors?.some(t=>String(t.team?.id)===id)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}
function tally(list){let w=0,l=0,t=0,pf=0,pa=0;const finished=[];
 for(const e of list){if(!done(e))continue;const sides=e.competitions?.[0]?.competitors||[],a=sides.find(x=>String(x.team?.id)===id),b=sides.find(x=>String(x.team?.id)!==id);if(!a||!b)continue;
 const aa=Number(a.score),bb=Number(b.score);if(!Number.isFinite(aa)||!Number.isFinite(bb))continue;finished.push(e);pf+=aa;pa+=bb;if(aa>bb)w++;else if(aa<bb)l++;else t++;
 }return{w,l,t,pf,pa,gp:finished.length,finished};
}
function drawSchedule(){const filter=$('schedule-filter').value;
 const chosen=events.filter(e=>{const us=e.competitions?.[0]?.competitors?.find(s=>String(s.team?.id)===id);return filter==='all'||filter==='final'&&done(e)||filter==='upcoming'&&!done(e)||filter==='home'&&us?.homeAway==='home'||filter==='away'&&us?.homeAway==='away'});
 $('team-games').innerHTML=chosen.length?chosen.map(e=>{const comp=e.competitions?.[0]||{},sides=comp.competitors||[],us=sides.find(x=>String(x.team?.id)===id),op=sides.find(x=>String(x.team?.id)!==id),opp={...published(op?.team?.id),...op?.team},final=done(e),live=e.status?.type?.state==='in';
 const win=final&&Number(us?.score)>Number(op?.score),loss=final&&Number(us?.score)<Number(op?.score);
 const result=final?(win?'W ':loss?'L ':'T ')+esc(us?.score)+'–'+esc(op?.score):live?'LIVE '+esc(us?.score)+'–'+esc(op?.score):'Scheduled';
 const venue=comp.venue?.fullName||'Venue TBA',tv=(comp.broadcasts||[]).flatMap(b=>b.names||[]).join(', ')||'Network TBD';
 const where=comp.neutralSite?'Neutral':us?.homeAway==='home'?'Home':'Away',time=(!final&&!live&&/TBD/i.test(e.status?.type?.shortDetail||''))?'TBD':tm(e.date);
 return '<div class="team-game'+(final?' is-final':'')+'"><time>'+esc(dt(e.date))+'<br>'+esc(time)+'</time><div class="team-game-opponent">'+mark(opp)+'<div><strong>'+esc(opp.displayName||'Opponent')+'</strong><small>'+esc(where+' · '+tv+' · '+venue)+'</small></div></div><div class="team-game-score '+(win?'team-win':loss?'team-loss':'')+'">'+result+'</div></div>';
 }).join(''):msg('No games match this filter.')}
function drawRoster(){const q=$('roster-search').value.toLowerCase().trim(),pos=$('roster-position').value;
 const players=roster.filter(p=>{const position=p.position?.abbreviation||p.position?.name||'—';return(pos==='all'||pos===position)&&(String(p.displayName||p.fullName||'').toLowerCase().includes(q)||String(p.jersey||'').includes(q))});
 $('team-roster').innerHTML='<p class="team-subtle"><strong>'+players.length+'</strong> of '+roster.length+' listed players · searchable by name, jersey and position.</p>'+(players.length?'<div class="team-table-scroll"><table class="team-roster-table"><thead><tr><th>#</th><th>Player</th><th>POS</th><th>Class</th><th>Height</th><th>Hometown</th></tr></thead><tbody>'+players.map(p=>'<tr><td>'+esc(p.jersey||'—')+'</td><td><a href="'+esc(p.links?.[0]?.href||'#roster')+'" '+(p.links?.[0]?.href?'target="_blank" rel="noopener"':'')+'>'+esc(p.displayName||p.fullName||'Unknown')+'</a></td><td>'+esc(p.position?.abbreviation||p.position?.name||'—')+'</td><td>'+esc(p.experience?.abbreviation||p.experience?.displayValue||'—')+'</td><td>'+esc(p.displayHeight||'—')+'</td><td>'+esc(p.birthPlace?.city||p.hometown||'—')+'</td></tr>').join('')+'</tbody></table></div>':msg(rosterAvailable?'No players match this filter.':'Roster is not available from the provider.'))}
function providerStats(data){const categories=data?.results?.stats||data?.statistics||data?.results||[],groups=Array.isArray(categories)?categories:categories?.categories||[],cards=[];
 for(const g of groups){const rows=Array.isArray(g.stats)?g.stats:Array.isArray(g.categories)?g.categories:[],usable=rows.filter(s=>s.displayValue!==undefined||s.value!==undefined).slice(0,9);
 if(usable.length)cards.push('<div class="team-stat-card"><h3>'+esc(g.displayName||g.name||'Statistics')+'</h3>'+usable.map(v=>'<div class="team-stat-row"><span>'+esc(v.displayName||v.name||'Statistic')+'</span><strong>'+esc(v.displayValue??v.value)+'</strong></div>').join('')+'</div>')}
 return cards.length?'<p class="team-subtle">Official 2026 provider statistics; not model estimates.</p><div class="team-stats-grid">'+cards.join('')+'</div>':'';
}
function renderStats(){let html=statsData?providerStats(statsData):'';const r=scoreRecord;
 if(r?.gp){const avg=n=>(n/r.gp).toFixed(1);html+='<div class="team-stat-card"><h3>Verified 2026 results ledger</h3><div class="team-stat-row"><span>Finals / record</span><strong>'+r.gp+' · '+r.w+'–'+r.l+(r.t?'–'+r.t:'')+'</strong></div>'+[['Points for',r.pf],['Points against',r.pa],['Points per game',avg(r.pf)],['Opponent points per game',avg(r.pa)],['Scoring margin per game',avg(r.pf-r.pa)]].map(([k,v])=>'<div class="team-stat-row"><span>'+k+'</span><strong>'+v+'</strong></div>').join('')+'</div>';
 }
 $('team-leaders').innerHTML=html||msg('Team statistics unavailable. No values have been invented.');
}
function renderRating(){const r=window.CFB_RATINGS?.[id],rate=Number.isFinite(r?.adjustedElo)?Math.round(r.adjustedElo):null,rec=scoreRecord;if(!rec)return;
 $('team-kpis').innerHTML=[[(rec.w+'–'+rec.l+(rec.t?'–'+rec.t:'')),'Completed record'],[rate??'—','RETRO rating'],[events.length,'Scheduled games'],[rec.gp,'Final results']].map(([v,l])=>'<div class="team-kpi"><b>'+esc(v)+'</b><small>'+esc(l)+'</small></div>').join('');
 $('team-record').innerHTML='<div class="team-info-row"><span>Completed games</span><strong>'+rec.w+'–'+rec.l+(rec.t?'–'+rec.t:'')+'</strong></div><div class="team-info-row"><span>Remaining games</span><strong>'+Math.max(0,events.length-rec.gp)+'</strong></div><div class="team-info-row"><span>RETRO starting point</span><strong>1500</strong></div><div class="team-info-row"><span>Current RETRO</span><strong>'+(rate??'Calculating…')+'</strong></div><p class="team-subtle">Completed results are verified against the 2026 FBS master ledger. RETRO uses the same independent model as the CFB power table.</p>';
 const forms=rec.finished.slice(-6).map(e=>{const a=e.competitions?.[0]?.competitors||[],us=a.find(t=>String(t.team?.id)===id),op=a.find(t=>String(t.team?.id)!==id);return Number(us?.score)>Number(op?.score)?'W':Number(us?.score)<Number(op?.score)?'L':'T'}),pct=Math.round(100*rec.w/Math.max(1,rec.gp));
 let box='<p class="team-subtle">Last six completed results</p><div class="team-form-row">'+(forms.length?forms.map(v=>'<span class="team-form-pill '+(v==='L'?'loss':'')+'">'+v+'</span>').join(''):'No finals yet')+'</div><div class="team-meter"><span style="width:'+pct+'%"></span></div><p class="team-subtle">'+pct+'% win rate through completed games.</p>';
 const upcoming=events.find(e=>!done(e)&&e.status?.type?.state!=='in'&&Date.parse(e.date)>=Date.now()-86400000);
 if(upcoming){const a=upcoming.competitions?.[0]?.competitors||[],us=a.find(x=>String(x.team?.id)===id),op=a.find(x=>String(x.team?.id)!==id),opp={...published(op?.team?.id),...op?.team},oppRate=window.CFB_RATINGS?.[String(op?.team?.id)]?.adjustedElo;
 const edge=upcoming.competitions?.[0]?.neutralSite?0:us?.homeAway==='home'?65:-65;
 const probability=Number.isFinite(r?.adjustedElo)&&Number.isFinite(oppRate)?100/(1+Math.pow(10,(oppRate-r.adjustedElo-edge)/400)):null;
 const time=/TBD/i.test(upcoming.status?.type?.shortDetail||'')?dt(upcoming.date)+' · Time TBD':fullDate(upcoming.date);
 box+='<article class="team-next-game"><span class="team-eyebrow">NEXT MATCHUP</span><div class="team-next-content">'+mark(opp)+'<div><h3>'+esc(opp.displayName||'Next opponent')+'</h3><p>'+esc(time)+' · '+esc(us?.homeAway==='home'?'HOME':us?.homeAway==='away'?'AWAY':'NEUTRAL')+'</p><p>'+esc(upcoming.competitions?.[0]?.broadcasts?.flatMap(b=>b.names||[]).join(', ')||'Broadcast TBD')+'</p></div></div><p class="team-subtle">'+(probability===null?'Pregame probability pending a verified rating for both teams.':'RETRO win probability: <strong>'+probability.toFixed(1)+'%</strong> · independent model estimate.')+'</p></article>';
 }
 $('team-form').innerHTML=box;
}
function conferenceView(tree){const groups=[];
 function walk(n){if(!n||typeof n!=='object')return;const list=n.standings?.entries||n.entries||[];if(list.some(e=>String(e.team?.id)===id))groups.push({name:n.name||n.abbreviation||'Conference',entries:list});for(const c of n.children||n.groups||[])walk(c)}
 walk(tree);const best=groups.sort((a,b)=>b.entries.length-a.entries.length)[0];
 $('team-conference').innerHTML=best?'<h3>'+esc(team?.conference||best.name)+'</h3>'+best.entries.map(e=>'<div class="team-info-row"><span>'+esc(e.team?.shortDisplayName||e.team?.displayName)+'</span><strong>'+esc((e.stats||[]).find(x=>x.name==='overall'||x.name==='overallRecord')?.displayValue||'—')+'</strong></div>').join(''):msg('Conference table unavailable.');}
async function start(){
 const requests=await Promise.allSettled([source('teams/'+id),source('teams/'+id+'/schedule?season=2026'),source('teams/'+id+'/roster?season=2026'),source('teams/'+id+'/statistics?season=2026'),get('data/cfb-2026-results.json?ts='+Date.now()),get('https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=2026&group=80')]);
 const [info,fixture,personnel,stats,results,standings]=requests;
 if(results.status==='fulfilled'){snapshot=results.value;if(snapshot.audit?.complete&&snapshot.audit?.games===snapshot.games?.length&&snapshot.audit?.errors?.length===0)indexTeams(snapshot);else snapshot=null;}
 const saved=published(id),live=info.status==='fulfilled'?(info.value.team||info.value):null;
 team=live||saved;
 if(team){team={...saved,...live,id,conference:saved?.conference||live?.groups?.parent?.name||live?.groups?.name||'FBS'};
 const {primary,secondary}=window.CFB_DESK.ringColors(team);
 document.documentElement.style.setProperty('--school',primary);document.documentElement.style.setProperty('--school2',secondary);
 document.title=team.displayName+' | The Sporting Life & Times';
 $('team-heading').innerHTML='<div class="team-hero">'+mark(team)+'<div><span class="team-eyebrow">2026 · '+esc(team.conference)+'</span><h1>'+esc(team.displayName)+'</h1><p>'+esc([team.location,team.nickname].filter(Boolean).join(' · ')||team.shortDisplayName||team.displayName)+'</p></div></div>';
 $('team-info').innerHTML=[['University',team.displayName],['Nickname',team.nickname],['Location',team.location],['Abbreviation',team.abbreviation],['Conference',team.conference]].map(([k,v])=>'<div class="team-info-row"><span>'+esc(k)+'</span><strong>'+esc(v||'Not published')+'</strong></div>').join('');
 }else {$('team-heading').innerHTML='<h1>Team unavailable in published FBS data</h1>';$('team-info').innerHTML=msg('Choose an FBS team from the College Football front page.')}
 events=normalizeSchedules(snapshot?.feeds?.scoreboard?.data?.events,fixture.status==='fulfilled'?fixture.value.events:[],snapshot?.games);
 scoreRecord=tally(events);$('schedule-filter').addEventListener('change',drawSchedule);drawSchedule();
 statsData=stats.status==='fulfilled'?stats.value:null;renderStats();
 if(personnel.status==='fulfilled'){const people=personnel.value.athletes||[];
 roster=people.flatMap(g=>g.items||[g]).filter(p=>p.id);rosterAvailable=true;
 const positions=[...new Set(roster.map(p=>p.position?.abbreviation||p.position?.name).filter(Boolean))].sort();$('roster-position').innerHTML='<option value="all">All Positions</option>'+positions.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join('');
 }$('roster-search').addEventListener('input',drawRoster);$('roster-position').addEventListener('change',drawRoster);drawRoster();
 if(roster.length){const count=new Map();for(const p of roster){const k=p.position?.abbreviation||'Other';count.set(k,(count.get(k)||0)+1)}
 $('team-roster').insertAdjacentHTML('beforebegin','<div class="team-position-chips">'+[...count].sort((a,b)=>b[1]-a[1]).map(([k,n])=>'<button type="button" data-pos="'+esc(k)+'">'+esc(k)+' <b>'+n+'</b></button>').join('')+'</div>');
 document.querySelectorAll('.team-position-chips button').forEach(btn=>btn.addEventListener('click',()=>{$('roster-position').value=btn.dataset.pos;drawRoster()}))}
 conferenceView(standings.status==='fulfilled'?standings.value:snapshot?.feeds?.standings?.data);
 renderRating();
 const sources=requests.filter(x=>x.status==='fulfilled').length;
 $('team-stamp').textContent='Updated '+new Date().toLocaleString('en-US',{timeZone:'America/New_York'})+' ET · '+(snapshot?'Verified season ledger: '+snapshot.audit.games+' finals · ':'Master ledger unavailable · ')+sources+'/6 feeds available · game results override stale team schedules';
}
document.addEventListener('cfb-ratings-ready',renderRating);
start().catch(e=>{$('team-stamp').textContent='Team desk could not finish loading: '+e.message;console.error(e)});
})();