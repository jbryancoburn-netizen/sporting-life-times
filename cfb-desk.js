(()=>{'use strict';const D=window.CFB_DESK,{esc,link,crest,rating,ranked,pct}=D,$=id=>document.getElementById(id);let data,all=[],showAll=false,scoreRequest=0;
const etDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const stamp=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
const number=n=>Number.isFinite(n)?n.toFixed(1):'—';
const table=(heads,rows)=>'<table><thead><tr>'+heads.map((h,i)=>'<th scope="col" class="'+(i===1?'school':'')+'">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
function rankings(){if(!data)return;const q=$('rank-search').value.toLowerCase(),scope=$('rank-scope').value;const teams=ranked(all),positions=new Map(teams.map((t,i)=>[t.id,i+1]));const shown=teams.filter(t=>(scope==='all'||D.G6.includes(t.conference))&&(t.full.toLowerCase().includes(q)||t.name.toLowerCase().includes(q)));$('elo-list').innerHTML=shown.length?table(['#','School','W–L','RETRO','Elo','SOS','SOR'],shown.map(t=>{const r=window.CFB_RATINGS[t.id],s=data.scoring.get(t.id);return '<tr><td>'+positions.get(t.id)+'</td><td class="school">'+link(t)+'</td><td>'+(s?s.w+'–'+s.l:'—')+'</td><td class="power">'+Math.round(r.adjustedElo)+'</td><td>'+Math.round(r.elo)+'</td><td>'+Math.round(r.sos)+'</td><td>'+r.sor.toFixed(2)+'</td></tr>'})):'<p class="empty">'+(window.CFB_RATINGS?'No matching FBS schools.':'Waiting for verified RETRO ratings…')+'</p>';}
function stats(){if(!data)return;const sort=$('stats-sort').value,q=$('stats-search').value.toLowerCase();const value=t=>['sos','sor'].includes(sort)?window.CFB_RATINGS?.[t.id]?.[sort]:data.scoring.get(t.id)?.[sort];const teams=all.filter(t=>data.scoring.has(t.id)&&t.full.toLowerCase().includes(q)).sort((a,b)=>(sort==='papg'?1:-1)*((value(a)??-Infinity)-(value(b)??-Infinity))||a.name.localeCompare(b.name));$('stats-table').innerHTML=teams.length?table(['#','School','GP','PF','PA','PPG','OPPG','Margin','SOS','SOR'],teams.map((t,i)=>{const s=data.scoring.get(t.id),r=window.CFB_RATINGS?.[t.id];return '<tr><td>'+(i+1)+'</td><td class="school">'+link(t)+'</td><td>'+s.gp+'</td><td>'+s.pf+'</td><td>'+s.pa+'</td><td>'+number(s.ppg)+'</td><td>'+number(s.papg)+'</td><td>'+number(s.margin)+'</td><td>'+number(r?.sos)+'</td><td>'+(r?r.sor.toFixed(2):'—')+'</td></tr>'})):'<p class="empty">No matching teams.</p>';const qualified=all.filter(t=>(data.scoring.get(t.id)?.gp||0)>=4);$('stat-leaders').innerHTML=[['Scoring offense','ppg',false],['Scoring defense','papg',true],['Scoring margin','margin',false]].map(([name,key,asc])=>{const t=[...qualified].sort((a,b)=>(asc?1:-1)*(data.scoring.get(a.id)[key]-data.scoring.get(b.id)[key]))[0];return t?'<div class="leader-item"><small>'+name+' · minimum 4 games</small><div>'+link(t)+'<b>'+number(data.scoring.get(t.id)[key])+'</b></div></div>':''}).join('');}
function standings(){if(!data)return;const name=$('conference-select').value;const teams=all.filter(t=>t.conference===name).sort((a,b)=>pct(b.confRecord)-pct(a.confRecord)||(b.confRecord?.w||0)-(a.confRecord?.w||0)||a.name.localeCompare(b.name));const missing=teams.filter(t=>!t.confRecord).length;$('standings-note').textContent='Standings captured '+stamp(data.payload.feeds.standings.updated_at)+'. Ordered by conference winning percentage; tied records remain tied and alphabetical display does not settle championship qualification.'+(missing?' '+missing+' conference records unavailable.':'');$('conference-list').innerHTML=table(['Pos','School','Conf','Conf PCT','Overall','RETRO','PPG','OPPG'],teams.map((t,i)=>{const s=data.scoring.get(t.id),r=rating(t);const pos=teams.findIndex(a=>pct(a.confRecord)===pct(t.confRecord))+1;return '<tr><td>'+pos+'</td><td class="school">'+link(t)+'</td><td>'+esc(t.confRecord?.text||'—')+'</td><td>'+(t.confRecord?pct(t.confRecord).toFixed(3):'—')+'</td><td>'+esc(t.record?.text||'—')+'</td><td class="power">'+(Number.isFinite(r)?Math.round(r):'—')+'</td><td>'+number(s?.ppg)+'</td><td>'+number(s?.papg)+'</td></tr>'}));}
function directory(){if(!data)return;const q=$('team-search').value.toLowerCase();const matches=all.filter(t=>(t.full+' '+t.name+' '+t.conference).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));const shown=q||showAll?matches:matches.slice(0,16);$('team-count').textContent=matches.length+' FBS programs'+(shown.length<matches.length?' · showing first '+shown.length:'');$('team-list').innerHTML=shown.map(t=>'<a class="cfb-team-card" style="--school-color:#'+esc(t.color||'203b49')+'" href="cfb-team.html?team='+encodeURIComponent(t.id)+'">'+crest(t)+'<span><strong>'+esc(t.name)+'</strong><small>'+esc(t.conference)+' · '+esc(t.record?.text||'Record unavailable')+'</small></span></a>').join('')||'<p class="empty">No matching schools.</p>';$('more-teams').hidden=!!q||showAll||shown.length===matches.length;}
function drawScores(events,liveFeed){
 const phase=$('game-status').value,day=$('game-date').value;
 const games=events.filter(e=>etDate(e.date)===day&&
  (phase==='all'||e.status?.type?.state===phase)).sort((a,b)=>{
   const order=s=>s==='in'?0:s==='pre'?1:2;
   return order(a.status?.type?.state)-order(b.status?.type?.state)||
    Date.parse(a.date)-Date.parse(b.date);
  });
 $('score-note').textContent=(liveFeed?'Live scoreboard checked '+stamp(new Date()):
  'Published scoreboard captured '+stamp(data.payload.feeds.scoreboard.updated_at)+
  '; live feed unavailable.')+' · '+games.length+' games shown.';
 const positions=new Map(ranked(all).map((t,i)=>[String(t.id),i+1]));
 const html=games.map(e=>{
  const c=e.competitions?.[0],sides=c?.competitors||[];
  const away=sides.find(t=>t.homeAway==='away'),home=sides.find(t=>t.homeAway==='home');
  if(!away||!home)return '';
  const status=e.status?.type||{},final=status.completed||status.state==='post';
  const mode=final?'final':status.state==='in'?'live':'upcoming';
  const teamData=t=>{
   const school=data.teams.get(String(t.team.id))||{
    id:t.team.id,name:t.team.shortDisplayName||t.team.displayName,
    logo:t.team.logo,color:t.team.color,secondary:t.team.alternateColor
   };
   const value=rating(school),position=positions.get(String(school.id));
   const hex=String(school.color||'').replace(/^#/,'');
   return {name:school.full||school.name,score:mode==='upcoming'?null:
     t.score?.displayValue??t.score?.value??t.score,
     crest:crest(school),color:/^[0-9a-f]{6}$/i.test(hex)?'#'+hex:'#655239',
     record:school.record?.text||'Record pending',
     retro:Number.isFinite(value)?'RETRO '+Math.round(value)+
      (position?' (#'+position+')':''):'RETRO —'};
  };
  const bug=window.SLTSportsScorebug?.render({phase:mode,
   status:status.shortDetail||'LIVE',away:teamData(away),home:teamData(home)
  })||'<p class="empty">Scorebug unavailable.</p>';
  return '<article class="game-card ledger26-card">'+
   '<div class="ledger26-meta"><span>'+esc(c?.venue?.fullName||'Venue TBA')+'</span>'+
   '<span>'+esc((c?.broadcasts||[]).flatMap(b=>b.names||[]).join(', ')||stamp(e.date))+'</span></div>'+
   '<details class="ledger26-expand"><summary class="ledger26-summary">'+bug+
   '<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+
   '<div class="ledger26-expanded"><p>'+esc(stamp(e.date))+'</p>'+
   '<p>'+link(data.teams.get(String(away.team.id))||{id:away.team.id,name:away.team.displayName})+
   ' · '+link(data.teams.get(String(home.team.id))||{id:home.team.id,name:home.team.displayName})+
   '</p><p>Results and live scores use sourced team identities.</p></div></details></article>';
 }).join('');
 $('scores').innerHTML=games.length?html:'<p class="empty">No '+
  (phase==='all'?'':phase==='in'?'live ':phase==='post'?'completed ':'upcoming ')+
  'games listed for this date.</p>';
}
async function scores(){if(!data)return;const request=++scoreRequest,date=$('game-date').value;const saved=data.payload.feeds.scoreboard.data.events;drawScores(saved,false);try{const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates='+date.replaceAll('-','')+'&groups=80&limit=400',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Scoreboard HTTP '+r.status);const p=await r.json();if(!Array.isArray(p.events))throw Error('Invalid scoreboard');if(request!==scoreRequest)return;drawScores([...new Map([...saved.filter(e=>etDate(e.date)===date),...p.events].map(e=>[String(e.id),e])).values()],true);}catch(e){if(request===scoreRequest)drawScores(saved,false);}}
D.promise.then(d=>{data=d;all=[...d.teams.values()];$('data-stamp').textContent='Results: '+stamp(d.payload.audit.generated_at)+' · '+d.payload.audit.games+' finals · source: ESPN';$('metrics').innerHTML=[[all.length,'FBS programs'],[d.payload.audit.games,'Finals in rating ledger'],[D.G6.length,'Group of 6 conferences'],['1500','Common starting rating']].map(([v,k])=>'<div class="metric"><b>'+v+'</b><span>'+k+'</span></div>').join('');$('conference-select').innerHTML=[...new Set(all.map(t=>t.conference))].sort().map(n=>'<option>'+esc(n)+'</option>').join('');$('conference-select').value='SEC';$('game-date').value=etDate(new Date());rankings();stats();standings();directory();scores();setInterval(scores,60000);}).catch(e=>{for(const id of ['elo-list','scores','conference-list','stats-table'])$(id).innerHTML='<p class="error">Football data unavailable: '+esc(e.message)+'. Please reload.</p>';$('data-stamp').textContent='CFB data could not load.';});
for(const id of ['rank-search','rank-scope'])$(id).addEventListener('input',rankings);for(const id of ['stats-sort','stats-search'])$(id).addEventListener('input',stats);$('conference-select').addEventListener('change',standings);$('team-search').addEventListener('input',directory);$('more-teams').addEventListener('click',()=>{showAll=true;directory()});for(const id of ['game-date','game-status'])$(id).addEventListener('change',scores);$('today-button').addEventListener('click',()=>{$('game-date').value=etDate(new Date());scores()});document.addEventListener('cfb-ratings-ready',()=>{D.promise.then(d=>{data=d;all=[...d.teams.values()];$('data-stamp').textContent='Results: '+stamp(d.payload.audit.generated_at)+' · '+d.payload.audit.games+' finals · source: ESPN';rankings();stats();standings();directory();}).catch(console.error)});
})();
