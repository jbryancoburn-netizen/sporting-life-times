(()=>{'use strict';
const root=document.getElementById('college-soccer-postseason');if(!root)return;
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
const fetchJSON=async p=>{const r=await fetch(p+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p+' '+r.status);return r.json();};
const link=(txt,url)=>{const a=el('a',txt);a.href=url;if(/^https:/.test(url)){a.target='_blank';a.rel='noopener noreferrer';}return a;};
const fmt=n=>Math.round(n*100)+'%';
let lastSignature='';
function render(conf,table,ratings,rules,miacTable,branding){
 const miaa=conf.conferences?.['men-d3:miaa'],rule=rules.conferences?.['men-d3:miaa'];
 const members=new Map((ratings.cohorts?.['men-d3']||[]).map(t=>[t.team_id,t]));
 const official=new Map((table.rows||[]).map(t=>[t.team_id,t]));
 if(!miaa||!rule||miaa.teams.some(id=>!members.has(id)||!official.has(id)))throw Error('MIAA team membership or standings incomplete');
 const seeded=[...miaa.teams].map(id=>({id,team:members.get(id),standing:official.get(id)}))
 .sort((a,b)=>b.standing.conference_points-a.standing.conference_points||b.team.elo-a.team.elo);
 // Elo is only a displayed provisional tiebreaker; the MIAA's actual rules take precedence.
 const top=seeded.slice(0,6);root.replaceChildren();
 const intro=el('div',null,'cs-post-heading');intro.append(el('h2','CONFERENCES & THE ROAD TO THE NCAA'),el('span','2026 · VERIFIED RULES / PROVISIONAL PROJECTIONS'));root.append(intro);
 const nav=el('nav',null,'cs-post-nav');nav.setAttribute('aria-label','College soccer postseason sections');nav.append(link('MIAA tournament','#cs-miaa'),link('MIAC tournament','#cs-miac'),link('CCIW tournament','#college-soccer-cciw'),link('MIAA women','#college-soccer-women-miaa'),link('NCAA championship rules','#cs-ncaa-rules'));root.append(nav);
 const split=el('div',null,'cs-post-columns');root.append(split);
 const left=el('section',null,'cs-post-main');left.id='cs-miaa';split.append(left);
 const right=el('aside',null,'cs-post-side');split.append(right);
 const heading=el('div',null,'cs-post-section-head');heading.append(el('h3','MIAA · Men’s Division III'),link('Official conference table ↗',table.source_url||rule.table_source));left.append(heading);
 left.append(el('p','Conference table from the MIAA snapshot; standings last confirmed through '+(table.last_verified_game_date||'an unconfirmed date')+'. Positions below are an illustration, not final tournament seeds.','cs-post-note'));
 const tableNode=el('table',null,'cs-post-table');const tr=el('tr');for(const h of ['Seed*','School','Conf.','Pts','USRS'])tr.append(el('th',h));const thead=el('thead');thead.append(tr);const body=el('tbody');
 for(const [i,t] of seeded.entries()){const row=el('tr');row.append(el('td',i<6?i+1:'—'));const name=el('td');name.append(link(t.team.team,'college-soccer-team.html?team=men-d3%3A'+encodeURIComponent(t.id)));row.append(name,el('td',t.standing.conference_record),el('td',t.standing.conference_points),el('td',Number(t.team.elo).toFixed(1)));if(i===5)row.className='cs-post-cutline';body.append(row);}tableNode.append(thead,body);left.append(tableNode);
 left.append(el('p','*Provisional seed order uses official conference points, then independent Elo only as an illustration where points are tied. Official tiebreakers may change that order.','cs-post-note'));
 const head2=el('div',null,'cs-post-section-head');head2.append(el('h3','Projected six-team path'),el('span','BRACKET STRUCTURE · NOT OFFICIAL PAIRINGS'));left.append(head2);
 const cupUI=window.CollegeSoccerCupUI;
 if(cupUI){cupUI.decorateTable(tableNode,seeded,'men-d3',branding);cupUI.bracket(left,top,'men-d3',branding,{q:'OCT 31 · QUARTERFINALS',s:'NOV 3 · SEMIFINALS',f:'NOV 7 · CHAMPIONSHIP'});}
 else left.append(el('p','Bracket graphics unavailable; championship forecast below.','cs-post-note'));
 const ruleBlock=el('section',null,'cs-post-rules');right.append(ruleBlock);ruleBlock.append(el('h3','Conference tournament rules'));
 for(const [title,value]of [['Field','Six teams · single elimination'],['First round','Seeds 3–6 and 4–5'],['Semifinals','Seeds 1 and 2 enter'],['Hosts','Higher-seeded programs'],['Champion','Conference tournament winner']]){const d=el('div',null,'cs-post-fact');d.append(el('span',title),el('strong',value));ruleBlock.append(d);}
 ruleBlock.append(link('MIAA 2026 championship calendar ↗',rule.tournament.sources[0]));
 ruleBlock.append(el('p',rule.projection_warning,'cs-post-note'));
 const predictions=el('section',null,'cs-post-predictions');right.append(predictions);predictions.append(el('h3','If this bracket started today'));
 // Experimental knockout probability: transparent Elo-only logistic with a modest home offset.
 // Does not simulate regulation draws or an explicit penalty-kick model.
 const win=(a,b)=>{const advantage=seeded.indexOf(a)<seeded.indexOf(b)?55:-55;return 1/(1+Math.pow(10,-((a.team.elo-b.team.elo+advantage)/400)));};
 const distribution=(a,b)=>[{team:a,p:win(a,b)},{team:b,p:1-win(a,b)}];
 const sfA=distribution(top[3],top[4]).flatMap(x=>[{team:top[0],p:x.p*win(top[0],x.team)},{team:x.team,p:x.p*(1-win(top[0],x.team))}]);
 const sfB=distribution(top[2],top[5]).flatMap(x=>[{team:top[1],p:x.p*win(top[1],x.team)},{team:x.team,p:x.p*(1-win(top[1],x.team))}]);
 const consolidate=dist=>{const m=new Map();for(const x of dist)m.set(x.team.id,(m.get(x.team.id)||0)+x.p);return [...m.entries()].map(([id,p])=>({team:seeded.find(t=>t.id===id),p}));};
 const a=consolidate(sfA),b=consolidate(sfB),out=new Map();
 for(const x of a)for(const y of b){const wp=win(x.team,y.team);out.set(x.team.id,(out.get(x.team.id)||0)+x.p*y.p*wp);out.set(y.team.id,(out.get(y.team.id)||0)+x.p*y.p*(1-wp));}
 const contenders=[...out.entries()].map(([id,p])=>({team:seeded.find(t=>t.id===id),p})).sort((a,b)=>b.p-a.p);
 for(const entry of contenders){const d=el('div',null,'cs-post-odds');const line=el('div',null,'cs-post-odds-head');line.append(el('strong',entry.team.team.team),el('span',fmt(entry.p)));d.append(line);const track=el('div',null,'cs-post-odds-track'),bar=el('i');bar.style.width=(100*entry.p)+'%';track.append(bar);d.append(track);predictions.append(d);}
 predictions.append(el('p','Experimental Elo-only knockout scenario: 55 Elo points of home advantage to the higher projected seed, logistic result probabilities, and a decisive result. No draw/penalty model, official tiebreaker, remaining-game simulation, or NCAA selection committee adjustment. NOT calibrated tournament odds.','cs-post-note'));
 const miacConf=conf.conferences?.['men-d3:miac'];
 const miacRule=rules.conferences?.['men-d3:miac'];
 if(miacConf&&miacRule){
  const miacSection=el('section',null,'cs-miac-section');miacSection.id='cs-miac';root.append(miacSection);
  const miacTitle=el('div',null,'cs-post-section-head');miacTitle.append(el('h3','MIAC · Men’s Division III'),link('Official MIAC standings ↗',miacTable?.source_url||miacRule.table_source));miacSection.append(miacTitle);
  const miacRatings=new Map((ratings.cohorts?.['men-d3']||[]).map(t=>[t.team_id,t]));
  const miacRows=new Map((miacTable?.rows||[]).map(t=>[t.team_id,t]));
  const complete=miacConf.teams.every(id=>miacRatings.has(id)&&miacRows.has(id));
  if(complete){
   const seedList=miacConf.teams.map(id=>({id,team:miacRatings.get(id),standing:miacRows.get(id)}))
    .sort((a,b)=>b.standing.conference_points-a.standing.conference_points||b.team.elo-a.team.elo);
   const layout=el('div',null,'cs-miac-columns');miacSection.append(layout);
   const standingsWrap=el('div');layout.append(standingsWrap);
   standingsWrap.append(el('p','Official MIAC league points · 2026 snapshot checked '+(miacTable.snapshot_checked_date||'date unavailable')+'. Tie order uses Elo solely as a provisional display aid; it is not the league’s tiebreaker.','cs-post-note'));
   const tableNode=el('table',null,'cs-post-table');
   const head=el('tr');for(const label of ['Seed*','School','Conf.','Pts','USRS'])head.append(el('th',label));
   const thead=el('thead');thead.append(head);const tbody=el('tbody');
   seedList.forEach((item,i)=>{
    const row=el('tr');row.append(el('td',i<6?i+1:'—'));
    const school=el('td');school.append(link(item.team.team,'college-soccer-team.html?team=men-d3%3A'+encodeURIComponent(item.id)));
    row.append(school,el('td',item.standing.conference_record),el('td',item.standing.conference_points),el('td',Number(item.team.elo).toFixed(1)));
    if(i===5)row.className='cs-post-cutline';
    tbody.append(row);
   });tableNode.append(thead,tbody);standingsWrap.append(tableNode);
   if(cupUI)cupUI.decorateTable(tableNode,seedList,'men-d3',branding);
   const sidebar=el('aside',null,'cs-miac-path');layout.append(sidebar);
   sidebar.append(el('h4','Six-team MIAC playoff watch'));
   const entrants=seedList.slice(0,6);
   if(cupUI)cupUI.bracket(miacSection,entrants,'men-d3',branding,{q:'ROUND ONE · DATE PENDING',s:'SEMIFINALS · DATE PENDING',f:'MIAC FINAL · DATE PENDING'});
   entrants.forEach((entry,i)=>{const row=el('div',null,'cs-post-entrant');row.append(el('strong','#'+(i+1)+' '+entry.team.team),el('span',Number(entry.team.elo).toFixed(1)+' Elo'));sidebar.append(row);});
   sidebar.append(el('p','League preview confirms six qualifiers and an NCAA Division III automatic bid for the playoff champion. Current bracket, tiebreakers and 2026 dates have not been confirmed.','cs-post-note'));
   sidebar.append(link('MIAC 2026 championship format ↗',miacRule.tournament.sources[0]));
   const strength=el('div',null,'cs-miac-contender-strength');strength.append(el('h4','Contender matchup strength'));
   const midpoint=(entrants[0].team.elo+entrants[5].team.elo)/2;
   for(const entry of entrants){
    const probability=1/(1+Math.pow(10,-((entry.team.elo-midpoint)/400)));
    const box=el('div',null,'cs-post-contender-row'),line=el('div',null,'cs-post-odds-head');
    line.append(el('strong',entry.team.team),el('span',fmt(prob)));box.append(line);
    const track=el('div',null,'cs-post-odds-track'),bar=el('i');bar.style.width=probability*100+'%';track.append(bar);box.append(track);strength.append(box);
   }
   strength.append(el('p','Experimental neutral-field head-to-head probability against the median strength of these six provisional entrants. NOT odds of qualifying for or winning the MIAC playoff.','cs-post-note'));
   sidebar.append(strength);
  }else miacSection.append(el('p','Conference ratings and official standings are not fully reconciled. Tournament projections withheld.','cs-post-note'));
 }
  const national=el('section',null,'cs-national-rules');national.id='cs-ncaa-rules';root.append(national);
 const nh=el('div',null,'cs-post-section-head');nh.append(el('h3','NCAA Championship Watch'),el('span','OFFICIAL FIELD RULES · INDEPENDENT MODEL'));national.append(nh);
 const items=el('div',null,'cs-national-grid');
 for(const [key,label] of [['men-d1','Men’s Division I'],['women-d1','Women’s Division I'],['men-d2','Men’s Division II'],['women-d2','Women’s Division II'],['men-d3','Men’s Division III'],['women-d3','Women’s Division III']]){
  const r=rules.ncaa?.[key]||{},card=el('article',null,'cs-national-item');card.append(el('h4',label));
  if(r.status==='verified'){card.append(el('strong',r.field+' teams · '+r.automatic_bids+' automatic · '+r.at_large+' at-large'));if(r.seeded_teams)card.append(el('p',r.seeded_teams+' seeded teams; '+r.first_round_byes+' first-round byes.','cs-post-note'));card.append(el('p','Selection: '+r.selection_date,'cs-post-note'));}
  else card.append(el('p','Championship selection rules not fully certified yet; no invented field or bid odds.','cs-post-note'));
  card.append(link('Official NCAA requirements ↗',r.sources?.[0]||r.official_source||'https://www.ncaa.org/championships/general-championship-resources/'));items.append(card);
 }
 national.append(items);
 const contenderHead=el('div',null,'cs-post-section-head');
 contenderHead.append(el('h3','Early Division I contender forecast'),el('span','NEUTRAL-FIELD ELO MODEL · NOT SELECTION ODDS'));national.append(contenderHead);
 const contenderGrid=el('div',null,'cs-national-grid cs-contender-grid');
 for(const [cohort,label] of [['men-d1','Men’s DI'],['women-d1','Women’s DI']]){
  const pool=(ratings.cohorts?.[cohort]||[]).filter(t=>Number.isFinite(t.elo)).slice().sort((a,b)=>b.elo-a.elo);
  if(pool.length<16)continue;
  const benchmark=(pool[7].elo+pool[8].elo)/2;
  const column=el('div',null,'cs-post-contender');
  column.append(el('h4',label),el('p','Chance of beating the midpoint of the current Elo top 16 in a neutral, decisive matchup.','cs-post-note'));
  for(const team of pool.slice(0,10)){
   const prob=1/(1+Math.pow(10,-((team.elo-benchmark)/400)));
   const item=el('div',null,'cs-post-contender-row');
   const line=el('div',null,'cs-post-odds-head');line.append(link(team.team,'college-soccer-team.html?team='+encodeURIComponent(cohort+':'+team.team_id)),el('span',fmt(prob)));
   item.append(line);
   const track=el('div',null,'cs-post-odds-track'),bar=el('i');
   bar.style.width=prob*100+'%';track.append(bar);item.append(track);
   column.append(item);
  }
  contenderGrid.append(column);
 }
 national.append(contenderGrid);
 national.append(el('p','These matchup probabilities are Elo-only experimental head-to-head forecasts. They are not odds of being selected, reaching the College Cup or winning an NCAA tournament. At-large NCAA selections require official committee criteria and conference automatic qualifiers.','cs-post-note'));
 national.append(el('p','Nationwide conference-by-conference brackets and NCAA at-large probability projections require complete 2026 soccer conference membership, conference tournament rules, official qualification status and NCAA selection metrics. Until verified, no unsupported at-large odds are published.','cs-post-note'));
}
async function refresh(){
 try{const [c,t,e,r,m,branding]=await Promise.all([fetchJSON('data/college-soccer-conferences.json'),fetchJSON('data/college-soccer-miaa-standings.json'),fetchJSON('data/college-soccer-elo.json'),fetchJSON('data/college-soccer-postseason-rules.json'),fetchJSON('data/college-soccer-miac-standings.json').catch(error=>{console.warn('MIAC standings temporarily unavailable; MIAA stays active',error);return null;}),fetchJSON('data/college-soccer-team-branding.json').catch(()=>({teams:{}}))]);
 const signature=JSON.stringify([t.checked_at_utc,m?.checked_at_utc||m?.snapshot_checked_date||'miac-unavailable',e.as_of,e.applied_finals_since_baseline,r.updated]);
 if(signature!==lastSignature){render(c,t,e,r,m,branding);lastSignature=signature;}
 }catch(error){if(!lastSignature){root.replaceChildren(el('p','Conference and postseason data unavailable: official standings or model feeds could not be verified.','cs-post-note'));}console.error('NCAA conference forecast',error);}
}
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh();},15*60*1000);
})();