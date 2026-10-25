(()=>{'use strict';
const host=document.querySelector('.cs-conf-page'),root=document.getElementById('cs-conference-detail');if(!host||!root)return;
const key=host.dataset.conference;const config={
 'men-d3:miaa':{name:'MIAA',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-miaa-standings.json',other:'college-soccer-miaa-women.html'},
 'men-d3:miac':{name:'MIAC',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-miac-standings.json'},
 'men-d3:cciw':{name:'CCIW',gender:'MEN',cohort:'men-d3',standings:'data/college-soccer-cciw-standings.json'},
 'women-d3:miaa':{name:'MIAA',gender:'WOMEN',cohort:'women-d3',standings:'data/college-soccer-miaa-women-standings.json',other:'college-soccer-miaa-men.html'}
};
const cfg=config[key];if(!cfg){root.textContent='This conference desk is not yet available.';return;}
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
let previous='';
async function render(){
 try{
 const [directory,table,elo,rules,branding]=await Promise.all([get('data/college-soccer-conferences.json'),get(cfg.standings),get('data/college-soccer-elo.json'),get('data/college-soccer-postseason-rules.json'),get('data/college-soccer-team-branding.json').catch(()=>({teams:{}}))]);
 const signal=JSON.stringify([table.checked_at_utc||table.snapshot_checked_date,elo.as_of,elo.applied_finals_since_baseline,rules.updated]);
 if(signal===previous)return;
 const member=directory.conferences?.[key]?.teams,rule=rules.conferences?.[key],rated=elo.cohorts?.[cfg.cohort];
 if(!member||!rule||!rated||!Array.isArray(table.rows))throw Error('One or more required verified feeds unavailable');
 const standings=new Map(table.rows.map(t=>[t.team_id,t])),ratings=new Map(rated.map(t=>[t.team_id,t]));
 if(member.some(id=>!ratings.has(id)||!standings.has(id))||member.length!==table.rows.length)throw Error('Conference roster mismatch');
 const teams=member.map(id=>({id,name:ratings.get(id).team,elo:Number(ratings.get(id).elo),...standings.get(id)})).sort((a,b)=>b.conference_points-a.conference_points||b.elo-a.elo);
 root.replaceChildren();
 const hero=E('header',null,'cs-conference-hero');
 const kicker=E('span',cfg.gender+' · NCAA DIVISION III · 2026','cs-conference-kicker');
 hero.append(kicker,E('h1',cfg.name+' SOCCER','cs-conference-title'),E('p','The conference race, independent Elo ratings and the road to the NCAA championship.','cs-conference-deck'));root.append(hero);
 const nav=E('nav',null,'cs-conference-nav');nav.append(A('STANDINGS','#conference-table'),A('TOURNAMENT BRACKET','#conference-bracket'),A('TITLE FORECAST','#conference-odds'),A('OFFICIAL RULES','#conference-rules'));if(cfg.other)nav.append(A('OTHER GENDER DESK',cfg.other));root.append(nav);
 const info=E('div',null,'cs-conference-stamp');info.append(E('span','Official standings snapshot: '+(table.checked_at_utc||table.snapshot_checked_date||'date unavailable')),E('span','Independent Elo edition: '+String(elo.as_of||'unknown')));root.append(info);
 const columns=E('div',null,'cs-conference-columns'),standSection=E('section',null,'cs-conf-standings'),modelSection=E('aside',null,'cs-conf-model');standSection.id='conference-table';modelSection.id='conference-odds';columns.append(standSection,modelSection);root.append(columns);
 standSection.append(E('h2','THE CONFERENCE TABLE'));
 const t=E('table',null,'cs-conference-table');const hd=E('thead'),hr=E('tr');for(const name of ['#','School','Conference','Pts','Elo'])hr.append(E('th',name));hd.append(hr);const tb=E('tbody');
 teams.forEach((team,i)=>{const row=E('tr');if(i===5)row.classList.add('cutoff');row.append(E('td',i<6?i+1:'—'));const school=E('td');school.append(A(team.name,'college-soccer-team.html?team='+encodeURIComponent(cfg.cohort+':'+team.id)));row.append(school,E('td',team.conference_record),E('td',team.conference_points),E('td',team.elo.toFixed(1)));tb.append(row)});
 t.append(hd,tb);standSection.append(t);
 const cup=window.CollegeSoccerCupUI;if(cup)cup.decorateTable(t,teams,cfg.cohort,branding);
 standSection.append(E('p','The top six are an illustrative qualification line. Where conference points are tied, the display uses independent Elo—not official conference tiebreakers.','cs-conf-caption'));
 modelSection.append(E('h2','CONFERENCE TITLE WATCH'));
 const six=teams.slice(0,6);
 if(six.length===6&&Number(rule.tournament?.field)===6){for(const x of modelOdds(six)){const line=E('div',null,'cs-conf-oddsline'),label=E('div',null,'cs-conf-oddslabel');label.append(E('strong',x.name),E('span',pct(x.p)));line.append(label);const rail=E('div',null,'cs-conf-rail'),bar=E('i');bar.style.width=pct(x.p);rail.append(bar);line.append(rail);modelSection.append(line)}}
 else modelSection.append(E('p','Tournament forecast unavailable until field size is verified.','cs-conf-caption'));
 modelSection.append(E('p','Experimental six-team Elo model, assuming top-two byes, 55 Elo points of higher-seed home advantage and a decisive result. Not calibrated championship odds.','cs-conf-caption'));
 const bracket=E('section',null,'cs-conference-bracket-section');bracket.id='conference-bracket';bracket.append(E('h2','THE ROAD TO THE TITLE'));
 if(cup&&six.length===6)cup.bracket(bracket,six,cfg.cohort,branding,{q:rule.tournament?.first_round_date||rule.tournament?.quarterfinal_date||'OPENING ROUND',s:rule.tournament?.semifinal_date||rule.tournament?.semifinals_date||'SEMIFINALS',f:rule.tournament?.final_date||'CHAMPIONSHIP'});root.append(bracket);
 const rulesSection=E('section',null,'cs-conference-rules');rulesSection.id='conference-rules';rulesSection.append(E('h2','TOURNAMENT RULES & SOURCES'));
 rulesSection.append(E('p','Field: '+(rule.tournament?.field||'unverified')+' provisional entrants. '+(rule.tournament?.status||'')+' '+(rule.projection_warning||'')));
 if(rule.tournament?.automatic_qualifier)rulesSection.append(E('p',rule.tournament.automatic_qualifier));
 if(table.source_url)rulesSection.append(A('Official conference standings ↗',table.source_url));
 for(const url of rule.tournament?.sources||[])rulesSection.append(A('Official championship source ↗',url));
 rulesSection.append(E('p','The site does not treat a projected seed as confirmed or use current Elo as NCAA selection criteria.','cs-conf-caption'));
 root.append(rulesSection);previous=signal;
 }catch(err){if(!previous){root.replaceChildren(E('p','Conference data could not be reconciled; the previous figures have not been replaced with estimates.','cs-conf-caption'));root.append(A('Return to NCAA Soccer','college-soccer.html'))}console.error('Conference desk',key,err)}
}
render();setInterval(()=>{if(document.visibilityState==='visible')render()},15*60*1000);
})();