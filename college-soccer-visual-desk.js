(()=>{'use strict';
const host=document.getElementById('college-soccer-visual-desk');if(!host)return;
const E=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==null&&txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
const URL_TEAM=(c,id)=>'college-soccer-team.html?team='+encodeURIComponent(c+':'+id);
const date=d=>{const x=new Date(d),now=new Date();if(isNaN(x))return String(d);const eventDay=String(d).match(/^\d{4}-\d{2}-\d{2}/)?.[0];const localDay=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');if(eventDay===localDay)return '';return x.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:/^\d{4}-\d{2}-\d{2}$/.test(String(d))?'UTC':undefined});};
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const rank=(s)=>({1:'I',2:'II',3:'III'})[s.slice(-1)];
let gender='men',division=1,model=null,forecast=null,brand={teams:{}},audit=null,index=null;
const section=(parent,title,subtitle)=>{const wrap=E('section',null,'cs-visual-section');const hd=E('div',null,'cs-section-title');hd.append(E('h3',title),E('span',subtitle));wrap.append(hd);parent.append(wrap);return wrap;};
const link=(name,cohort,id)=>{const a=E('a',name);a.href=URL_TEAM(cohort,id);return a;};
const pct=n=>Math.round(100*Number(n))+'%';
const logoFor=(cohort,id)=>{
 const identity=brand.teams?.[cohort+':'+id];
 if(identity?.logo_url)return identity.logo_url;
 // NCAA.com itself publishes member-school marks using its canonical school slug.
 // Only exact safe school identifiers are candidates; failed loads keep the text badge.
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id||'')))return null;
 return 'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg';
};
const club=(name,cohort,id,small=false)=>{
 const wrap=E('span',null,'cs-team');const mark=E('span',null,'cs-mark');const identity=brand.teams?.[cohort+':'+id];
 mark.textContent=String(name).slice(0,2).toUpperCase();
 const src=logoFor(cohort,id);
 if(src){
  const pic=E('img');pic.src=src;pic.alt='';pic.loading='lazy';pic.decoding='async';
  pic.addEventListener('load',()=>mark.classList.add('cs-has-logo'));
  pic.addEventListener('error',()=>pic.remove());
  mark.append(pic);
 }
 if(identity?.primary)mark.style.setProperty('--cs-color',identity.primary);
 wrap.append(mark,link(name,cohort,id));return wrap;
};
const row=(container,title,value,linkUrl)=>{const r=E('div',null,'cs-leader-row');const a=E('a',title);a.href=linkUrl;r.append(a,E('strong',value));container.append(r);};
const load=async path=>{const r=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path+' '+r.status);return r.json();};
function render(){
 const cohort=gender+'-d'+division,teams=model.cohorts[cohort];if(!Array.isArray(teams)||!teams.length)return;
 host.replaceChildren();
 const header=E('div',null,'cs-main-heading');header.append(E('strong','THE COLLEGE SOCCER MATCHDAY FILE'),E('span','INDEPENDENT USRS · '+date(model.as_of)));host.append(header);
 const fresh=E('div',null,'cs-data-freshness');
 const listed=model.applied_finals_since_baseline;
 const ledgerCount=audit?.ledger_finals;
 const indexCount=index?.verified_final_count;
 const asOf=String(model.as_of||'unknown');
 const reconciled=Number.isInteger(listed)&&Number.isInteger(ledgerCount)&&Number.isInteger(indexCount)&&listed===ledgerCount&&listed===indexCount;
 const heartbeat=typeof audit?.checked_through==='string'?audit.checked_through:null;
 const caption=reconciled?'DATA COUNTS RECONCILED · '+listed+' FINALS':'DATA RECONCILIATION PENDING';
 fresh.append(E('strong',caption));
 fresh.append(E('span','Ratings as of '+asOf+' · last scoreboard check '+(heartbeat||'unavailable')));
 const explanation=E('small',reconciled?'Ledger, ratings and team match index agree on final count. This does not certify GitHub Pages deployment or that all NCAA matches have been captured.':'At least one required final-count feed is missing or disagrees. Do not infer fresh results from this page.');
 fresh.append(explanation);fresh.classList.add(reconciled?'cs-fresh-ok':'cs-fresh-warn');
 host.append(fresh);
 const controls=E('div',null,'cs-controls');
 for(const [label,g,d] of [["Men's",'men',null],["Women's",'women',null],['DI',null,1],['DII',null,2],['DIII',null,3]]){
 const b=E('button',label,'cs-choice'+((g?gender===g:division===d)?' active':''));b.type='button';b.setAttribute('aria-pressed',String(g?gender===g:division===d));
 b.addEventListener('click',()=>{if(g)gender=g;else division=d;render();});controls.append(b);}
 controls.append(E('span',teams.length+' programs · '+(gender==='men'?"Men's":"Women's")+' Division '+rank(cohort),'cs-controls-desc'));host.append(controls);
 const byName=new Map(teams.map(t=>[t.team,t]));
 const finals=(model.latest_finals||[]).filter(m=>m.cohort===cohort).slice(0,8);
 const rail=section(host,'Latest verified finals','OPEN A MATCH FOR STATS & ELO CONTEXT');
 if(!finals.length)rail.append(E('p','No verified finals in this published edition.','cs-note'));
 else{const grid=E('div',null,'cs-score-rail');
 for(const m of finals){
  const scores=String(m.score||'').match(/^(\d+)\s*[-–]\s*(\d+)$/);if(!scores)continue;
  const tile=E('a',null,'cs-score-tile');tile.href='college-soccer-match.html?game='+encodeURIComponent(m.match_id);tile.setAttribute('aria-label','Open NCAA match details: '+m.home+' vs '+m.away);
  tile.append(E('small','FINAL'+(date(m.date)?' · '+date(m.date):'')));
  for(const [n,score] of [[m.home,scores[1]],[m.away,scores[2]]]){
   const line=E('div',null,'cs-score-side');const entry=byName.get(n);
   if(entry?.team_id)line.append(club(n,cohort,entry.team_id));else line.append(E('span',n));
   line.append(E('strong',score));
   const identity=entry?.team_id?brand.teams?.[cohort+':'+entry.team_id]:null;
   if(/^#[0-9a-fA-F]{6}$/.test(identity?.primary||''))line.style.setProperty('--team-stripe',identity.primary);
   const otherScore=n===m.home?Number(scores[2]):Number(scores[1]);
   if(Number(score)>otherScore)line.classList.add('cs-score-winner');
   else if(Number(score)<otherScore)line.classList.add('cs-score-loser');
   tile.append(line);
  }grid.append(tile);
 }rail.append(grid);}
 const cols=E('div',null,'cs-columns');host.append(cols);
 const left=E('div'),right=E('div');cols.append(left,right);
 const standings=section(left,'Division standings','COMPLETE RATINGS · FULL SEASON W–L–D');
 const table=E('table',null,'cs-table'),thead=E('thead'),head=E('tr');
 for(const x of ['#','Program','GP','W–L–D','GF','GA','GD','USRS'])head.append(E('th',x));thead.append(head);
 const tbody=E('tbody');for(const t of teams){
 const tr=E('tr');tr.append(E('td',t.rank));const name=E('td');name.append(club(t.team,cohort,t.team_id));tr.append(name);
 for(const v of [t.gp,t.record,t.gf,t.ga,(t.gd>0?'+':'')+t.gd,fmt(t.elo)])tr.append(E('td',v));
 tbody.append(tr);}table.append(thead,tbody);
 const scroll=E('div',null,'cs-table-scroll');scroll.append(table);standings.append(scroll);
 standings.append(E('p','Records and Elo are taken from the published model edition. This is not an official NCAA conference table.','cs-note'));
 const top=teams.slice().sort((a,b)=>Number(b.elo)-Number(a.elo)).slice(0,20);
 const power=section(right,'Power 20','HIGHEST ELO · NO SYNTHETIC MOVEMENT');
 const low=Math.min(...top.map(t=>t.elo)),high=Math.max(...top.map(t=>t.elo));
 for(const t of top){const item=E('div',null,'cs-power-row');item.append(E('span',t.rank,'cs-number'),club(t.team,cohort,t.team_id));
 const track=E('span',null,'cs-power-track'),fill=E('i');fill.style.width=(7+93*(t.elo-low)/(high-low||1))+'%';const color=brand.teams?.[cohort+':'+t.team_id]?.primary;if(color)fill.style.background=color;track.append(fill);item.append(track,E('strong',fmt(t.elo)));power.append(item);}
 const movement=(model.latest_finals||[]).filter(g=>g.cohort===cohort&&Number.isFinite(Number(g.home_elo_change))).slice(0,5);
 if(movement.length){
  const changes=section(right,'Elo at the final whistle','VERIFIED GAME MOVEMENT · HOME TEAM');
  for(const g of movement){
   const delta=Number(g.home_elo_change);
   const line=E('div',null,'cs-movement-row');
   const a=E('a',g.home+' vs '+g.away);
   a.href=g.source_game||'#college-soccer-elo';if(g.source_game){a.target='_blank';a.rel='noopener noreferrer';}
   line.append(a,E('strong',(delta>0?'+':'')+delta.toFixed(1),'cs-delta '+(delta>0?'up':delta<0?'down':'flat')));
   changes.append(line);
  }
  changes.append(E('p','Actual published Elo change for the home team in each listed final—not a daily change or an invented movement for every school.','cs-note'));
 }
  const upcoming=section(right,'Forecast watch','LOCKED PREMATCH MODEL · NOT LIVE SCORES');
 const finalIds=new Set((model.latest_finals||[]).map(f=>f.match_id));
 const now=Date.now();
 const games=(forecast.forecasts||[]).filter(m=>m.cohort===cohort&&!finalIds.has(m.match_id)&&Date.parse(m.kickoff_utc)>now&&Number.isFinite(Number(m.p_home))&&Number.isFinite(Number(m.p_draw))&&Number.isFinite(Number(m.p_away))).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc)).slice(0,5);
 if(!games.length)upcoming.append(E('p','No verified future fixture forecasts remain in the published feed.','cs-note'));
 for(const g of games){
 const item=E('div',null,'cs-fixture');item.append(E('small',(date(g.kickoff_utc)?date(g.kickoff_utc)+' · ':'')+'LOCKED PROJECTION'));const detail=E('a','View match analysis ↗','cs-game-link');detail.href='college-soccer-match.html?game='+encodeURIComponent(g.match_id);
 const teamsLine=E('div',null,'cs-fixture-teams');teamsLine.append(club(g.home_name||g.home_team,cohort,g.home_team),E('span','vs'),club(g.away_name||g.away_team,cohort,g.away_team));item.append(teamsLine);
 const prob=E('div',null,'cs-prob');for(const [val,kind] of [[g.p_home,'home'],[g.p_draw,'draw'],[g.p_away,'away']]){const bar=E('i',null,'cs-prob-'+kind);bar.style.width=(Math.max(0,100*Number(val)))+'%';prob.append(bar);}item.append(prob);
 const labels=E('div',null,'cs-prob-labels');labels.append(E('span',pct(g.p_home)+' '+(g.home_name||g.home_team)),E('span',pct(g.p_draw)+' draw'),E('span',pct(g.p_away)+' '+(g.away_name||g.away_team)));item.append(labels);
 item.append(detail);if(g.source_game){const a=E('a','Official NCAA match listing ↗','cs-game-link');a.href=g.source_game;a.target='_blank';a.rel='noopener noreferrer';item.append(a);}upcoming.append(item);
 }
 const stats=E('div',null,'cs-stat-columns');host.append(stats);
 const attacks=section(stats,'Attack leaders','GOALS FOR · RATE PER MATCH');
 const defenses=section(stats,'Defense leaders','LOWEST GOALS CONCEDED PER MATCH');
 const valid=teams.filter(t=>Number(t.gp)>0);
 const atk=valid.slice().sort((a,b)=>b.gf/b.gp-a.gf/a.gp).slice(0,8);
 const def=valid.slice().sort((a,b)=>a.ga/a.gp-b.ga/b.gp).slice(0,8);
 for(const t of atk)row(attacks,t.team,(t.gf/t.gp).toFixed(2)+' GF/GP',URL_TEAM(cohort,t.team_id));
 for(const t of def)row(defenses,t.team,(t.ga/t.gp).toFixed(2)+' GA/GP',URL_TEAM(cohort,t.team_id));
 const foot=E('p','Source cutoffs: USRS '+String(model.as_of||'unknown')+' · forecasts '+String(forecast.published_at||'unknown')+'. Elo movement needs prior certified rating snapshots; it is deliberately not inferred from ranks or scores.','cs-note');host.append(foot);
}
(async()=>{try{const [a,b,c,d,e]=await Promise.allSettled([load('data/college-soccer-elo.json'),load('data/college-soccer-prospective-v2.json'),load('data/college-soccer-team-branding.json'),load('data/college-soccer-elo-live-audit.json'),load('data/college-soccer-team-game-index.json')]);if(a.status!=='fulfilled'||b.status!=='fulfilled')throw Error('Required ratings or forecast feed missing');model=a.value;forecast=b.value;if(c.status==='fulfilled')brand=c.value;if(d.status==='fulfilled')audit=d.value;if(e.status==='fulfilled')index=e.value;if(!model?.cohorts||!Array.isArray(forecast?.forecasts))throw Error('Invalid schema');render();}catch(e){host.replaceChildren(E('p','NCAA visual dashboard unavailable: required published ratings or forecasts could not be loaded.','cs-note'));console.error('College soccer visual desk',e);}})();
})();