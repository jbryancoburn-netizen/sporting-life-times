(()=>{'use strict';
const host=document.querySelector('.cs-conf-page'),root=document.getElementById('cs-conference-detail');if(!host||!root)return;
const key=host.dataset.conference;const config={
 'men-d3:miaa':{name:'MIAA',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-miaa-standings.json',other:'college-soccer-miaa-women.html'},
 'men-d3:miac':{name:'MIAC',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-miac-standings.json'},
 'men-d3:cciw':{name:'CCIW',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-cciw-standings.json'},
 'women-d3:miaa':{name:'MIAA',gender:'WOMEN',cohort:'women-d3',standings:'data/college-soccer-miaa-women-standings.json',other:'college-soccer-miaa-men.html'},
 'men-d1:big-ten':{name:'Big Ten',gender:'MEN',cohort:'men-d1',standings:'data/college-soccer-men-d1-big-ten-standings.json',other:'college-soccer-big-ten-women.html'},
 'women-d1:big-ten':{name:'Big Ten',gender:'WOMEN',cohort:'women-d1',standings:'data/college-soccer-women-d1-big-ten-standings.json',other:'college-soccer-big-ten-men.html'},
 'women-d3:miac':{name:'MIAC',gender:'WOMEN',cohort:'women-d3',standings:'data/college-soccer-women-d3-miac-standings.json'},
 'women-d3:cciw':{name:'CCIW',gender:'WOMEN',cohort:'women-d3',standings:'data/college-soccer-women-d3-cciw-standings.json'},
 'men-d2:gliac':{name:'GLIAC',gender:'MEN',cohort:'men-d2',standings:'data/college-soccer-men-d2-gliac-standings.json',other:'college-soccer-gliac-women.html'},
 'women-d2:gliac':{name:'GLIAC',gender:'WOMEN',cohort:'women-d2',standings:'data/college-soccer-women-d2-gliac-standings.json',other:'college-soccer-gliac-men.html'}
};
const [cohortCode,conferenceSlug]=String(key||'').split(':');
const cfg=config[key]||{name:String(conferenceSlug||'Conference').replaceAll('-',' ').toUpperCase(),gender:cohortCode?.startsWith('women-')?'WOMEN':'MEN',cohort:cohortCode,standings:null};
if(!cohortCode||!conferenceSlug||!/^(men|women)-d[123]$/.test(cohortCode)){root.textContent='This NCAA conference desk has no verified identity.';return;}
const E=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==null&&text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
const A=(label,href)=>{const a=E('a',label);a.href=href;if(/^https:/.test(href)){a.rel='noopener noreferrer';a.target='_blank'}return a};
const get=async p=>{const r=await fetch(p+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Missing '+p);return r.json()};
const pct=x=>(100*x).toFixed(1)+'%';
const modelOdds=(six)=>{
 const seeds=new Map(six.map((t,i)=>[t.id,i]));
 const win=(a,b)=>1/(1+Math.pow(10,-((a.elo-b.elo+(seeds.get(a.id)<seeds.get(b.id)?55:-55))/400)));
 const first=(x,y)=>[{team:x,p:win(x,y)},{team:y,p:1-win(x,y)}];
 const semi=(bye,choices)=>{const result=new Map();for(const x of choices){const w=win(bye,x.team);result.set(bye,(result.get(bye)||0)+x.p*w);result.set(x.team,(result.get(x.team)||0)+x.p*(1-w))}return [...result].map(([team,p])=>({team,p}))};
 const left=semi(six[0],first(six[3],six[4])),right=semi(six[1],first(six[2],six[5]));
 const out=new Map(six.map(x=>[x.id,0]));
 for(const l of left)for(const r of right){const w=win(l.team,r.team);out.set(l.team.id,out.get(l.team.id)+l.p*r.p*w);out.set(r.team.id,out.get(r.team.id)+l.p*r.p*(1-w))}
 const sum=[...out.values()].reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-8)throw Error('Invalid tournament probability total');
 return six.map(x=>({...x,p:out.get(x.id)})).sort((a,b)=>b.p-a.p);
};
const bracketOdds=(teams,reseed=false)=>{
 const field=teams.length,seeds=new Map(teams.map((t,i)=>[t.id,i]));
 const wp=(a,b)=>1/(1+Math.pow(10,-((a.elo-b.elo+(seeds.get(a.id)<seeds.get(b.id)?55:-55))/400)));
 const out=new Map(teams.map(t=>[t.id,0]));
 const play=(a,b)=>[{winner:a,p:wp(a,b)},{winner:b,p:1-wp(a,b)}];
 const addFinal=(l,r,p)=>{for(const x of play(l,r))out.set(x.winner.id,out.get(x.winner.id)+p*x.p)};
 if(field===8){
  const q=[[0,7],[3,4],[1,6],[2,5]].map(([i,j])=>play(teams[i],teams[j]));
  for(const a of q[0])for(const b of q[1])for(const c of q[2])for(const d of q[3]){
   const pq=a.p*b.p*c.p*d.p;
   for(const s1 of play(a.winner,b.winner))for(const s2 of play(c.winner,d.winner))addFinal(s1.winner,s2.winner,pq*s1.p*s2.p);
  }
 }else if(field===6){
  for(const q1 of play(teams[2],teams[5]))for(const q2 of play(teams[3],teams[4])){
   const p=q1.p*q2.p;
   if(reseed){
    const survivors=[teams[0],teams[1],q1.winner,q2.winner].sort((a,b)=>seeds.get(a.id)-seeds.get(b.id));
    for(const s1 of play(survivors[0],survivors[3]))for(const s2 of play(survivors[1],survivors[2]))addFinal(s1.winner,s2.winner,p*s1.p*s2.p);
   }else{
    for(const s1 of play(teams[0],q2.winner))for(const s2 of play(teams[1],q1.winner))addFinal(s1.winner,s2.winner,p*s1.p*s2.p);
   }
  }
 }
 const total=[...out.values()].reduce((x,y)=>x+y,0);
 if(Math.abs(total-1)>1e-7)throw Error('Title probability normalization failure');
 return teams.map(t=>({...t,p:out.get(t.id)})).sort((a,b)=>b.p-a.p);
};
let previous='';
async function render(){
 try{
 const directory=await get('data/college-soccer-conferences.json');
 const conferenceMeta=directory.conferences?.[key];
 if(!conferenceMeta?.teams?.length||!conferenceMeta.standings_feed||!conferenceMeta.page)throw Error('Conference membership, standings feed or page not certified');
 cfg.name=conferenceMeta.short||conferenceMeta.name||cfg.name;
 cfg.standings=conferenceMeta.standings_feed;
 const [table,elo,rules,branding]=await Promise.all([get(cfg.standings),get('data/college-soccer-elo.json'),get('data/college-soccer-postseason-rules.json'),get('data/college-soccer-team-branding.json').catch(()=>({teams:{}}))]);
 const signal=JSON.stringify([table.checked_at_utc||table.snapshot_checked_date,elo.as_of,elo.applied_finals_since_baseline,rules.updated]);
 if(signal===previous)return;
 const member=directory.conferences?.[key]?.teams,rule=rules.conferences?.[key],rated=elo.cohorts?.[cfg.cohort];
 if(!member||!rule||!rated||!Array.isArray(table.rows))throw Error('One or more required verified feeds unavailable');
 const standings=new Map(table.rows.map(t=>[t.team_id,t])),ratings=new Map(rated.map(t=>[t.team_id,t]));
 if(member.some(id=>!standings.has(id))||member.length!==table.rows.length)throw Error('Conference roster mismatch');
 const knownName={usc:'USC'};
 const teams=table.rows.map(record=>{const id=record.team_id;return {id,name:ratings.get(id)?.team||knownName[id]||id.replaceAll('-',' '),elo:ratings.has(id)?Number(ratings.get(id).elo):null,...record};});
 
 root.replaceChildren();
 const hero=E('header',null,'cs-conference-hero');
 const kicker=E('span',cfg.gender+' · NCAA DIVISION '+(cfg.cohort.endsWith('d1')?'I':cfg.cohort.endsWith('d2')?'II':'III')+' · 2026','cs-conference-kicker');
 hero.append(kicker,E('h1',cfg.name+' SOCCER','cs-conference-title'),E('p','The conference race, independent Elo ratings and the road to the NCAA championship.','cs-conference-deck'));root.append(hero);
 const nav=E('nav',null,'cs-conference-nav');nav.append(A('STANDINGS','#conference-table'),A('PROJECTED BRACKET','#conference-bracket'),A('TITLE FORECAST','#conference-odds'),A('OFFICIAL RULES','#conference-rules'));if(cfg.other)nav.append(A('OTHER GENDER DESK',cfg.other));root.append(nav);
 const info=E('div',null,'cs-conference-stamp');info.append(E('span','Official standings snapshot: '+(table.checked_at_utc||table.snapshot_checked_date||'date unavailable')),E('span','Independent Elo edition: '+String(elo.as_of||'unknown')));root.append(info);
 const columns=E('div',null,'cs-conference-columns'),standSection=E('section',null,'cs-conf-standings'),modelSection=E('aside',null,'cs-conf-model');standSection.id='conference-table';modelSection.id='conference-odds';columns.append(standSection,modelSection);root.append(columns);
 standSection.append(E('h2','OFFICIAL CONFERENCE STANDINGS'));
 const t=E('table',null,'cs-conference-table');const hd=E('thead'),hr=E('tr');for(const name of ['#','School','Conf. W–L–D','Overall','Pts'])hr.append(E('th',name));hd.append(hr);const tb=E('tbody');
 teams.forEach((team,i)=>{const row=E('tr');const field=Number(rule.tournament?.field)||0;if(i===field-1)row.classList.add('cutoff');row.append(E('td',field&&i<field?i+1:'—'));const school=E('td');school.append(A(team.name,'college-soccer-team.html?team='+encodeURIComponent(cfg.cohort+':'+team.id)));row.append(school,E('td',team.conference_record||'—'),E('td',team.overall_record||'—'),E('td',team.conference_points??'—'));tb.append(row)});
 t.append(hd,tb);standSection.append(t);
 const cup=window.CollegeSoccerCupUI;if(cup)cup.decorateTable(t,teams,cfg.cohort,branding);
 standSection.append(E('p','The qualification line is illustrative and displayed only where the tournament field size is verified. The published conference feed determines table order; independent Elo never breaks official standings ties. Tournament seed projections remain provisional.','cs-conf-caption'));
 modelSection.append(E('h2','USRS ELO · PREDICTED TITLE ODDS'));
 const field=Number(rule.tournament?.field)||0,entrants=teams.slice(0,field);
 if((field===6||field===8)&&entrants.length===field&&entrants.every(t=>Number.isFinite(t.elo))){
  const probs=bracketOdds(entrants,!!rule.tournament?.reseed);
  for(const x of probs){const line=E('div',null,'cs-conf-oddsline'),label=E('div',null,'cs-conf-oddslabel');label.append(E('strong',x.name),E('span',pct(x.p)));line.append(label);const rail=E('div',null,'cs-conf-rail'),bar=E('i');bar.style.width=pct(x.p);rail.append(bar);line.append(rail);modelSection.append(line)}
 }else modelSection.append(E('p','Title probabilities withheld: tournament format or a required Elo rating is unverified.','cs-conf-caption'));
 modelSection.append(E('p','Elo is used solely to forecast possible match outcomes after a hypothetical field and seed order have been supplied from standings data. These are experimental predictions, not actual brackets or NCAA selection probabilities. Home advantage is a modeling assumption, not a verified venue.','cs-conf-caption'));
 const bracket=E('section',null,'cs-conference-bracket-section');bracket.id='conference-bracket';bracket.append(E('h2','HYPOTHETICAL ROAD TO THE TITLE'));
 if(cup&&(field===6||field===8||field===15)){const visual=field===15?cup.bracketFifteen:field===8?cup.bracketEight:cup.bracket;visual(bracket,entrants,cfg.cohort,branding,{q:rule.tournament?.first_round_date||rule.tournament?.quarterfinal_date||'OPENING ROUND',s:rule.tournament?.semifinal_date||rule.tournament?.semifinals_date||'SEMIFINALS',f:rule.tournament?.final_date||'CHAMPIONSHIP'});}else {
  const note=E('div',null,'cs-conf-unverified-bracket');
  note.append(E('strong','TOURNAMENT BRACKET PENDING OFFICIAL RULES'));
  const strip=E('div',null,'cs-conf-qualifier-strip');
  teams.slice(0,Math.min(8,teams.length)).forEach((team,i)=>{
    const tile=E('div',null,'cs-conf-qualifier');
    tile.append(E('span','TABLE POSITION '+(i+1)));
    if(cup)tile.append(cup.school(team.name,team.id,cfg.cohort,branding,i+1));
    else tile.append(E('strong',team.name));
    strip.append(tile);
  });
  note.append(strip,E('p','Published conference order shown for context only. No entrants or seeds are inferred from Elo; this is NOT a confirmed playoff field.','cs-conf-caption'));
  bracket.append(note);
 }root.append(bracket);
 const rulesSection=E('section',null,'cs-conference-rules');rulesSection.id='conference-rules';rulesSection.append(E('h2','TOURNAMENT RULES & SOURCES'));
 rulesSection.append(E('p','Field: '+(rule.tournament?.field||'unverified')+' provisional entrants. '+(rule.tournament?.status||'')+' '+(rule.projection_warning||'')));
 if(rule.tournament?.automatic_qualifier)rulesSection.append(E('p',rule.tournament.automatic_qualifier));
 if(table.source_url)rulesSection.append(A('Official conference standings ↗',table.source_url));
 for(const url of rule.tournament?.sources||[])rulesSection.append(A('Official championship source ↗',url));
 rulesSection.append(E('p','Source-of-truth policy: actual scores, standings, tiebreakers, eligibility, tournament entrants, seeds and brackets must come from competition authorities. Elo is limited to forecasts and must never replace an official competition fact.','cs-conf-caption'));
 root.append(rulesSection);previous=signal;
 }catch(err){if(!previous){root.replaceChildren(E('p','Conference data could not be reconciled; the previous figures have not been replaced with estimates.','cs-conf-caption'));root.append(A('Return to NCAA Soccer','college-soccer.html'))}console.error('Conference desk',key,err)}
}
render();setInterval(()=>{if(document.visibilityState==='visible')render()},15*60*1000);
})();