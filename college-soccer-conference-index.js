(()=>{'use strict';
const root=document.getElementById('college-soccer-conference-index');if(!root)return;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const legacy={
 '#cs-miaa':'college-soccer-miaa-men.html',
 '#cs-miac':'college-soccer-miac-men.html',
 '#college-soccer-cciw':'college-soccer-cciw-men.html',
 '#college-soccer-women-miaa':'college-soccer-miaa-women.html'
};
if(legacy[location.hash]){location.replace(legacy[location.hash]);return;}
Promise.all(['data/college-soccer-conferences.json','data/college-soccer-elo.json'].map(p=>fetch(p+'?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(p+' '+r.status);return r.json()}))).then(([data,elo])=>{
 root.replaceChildren();
 const mast=node('div',null,'cs-conf-directory-heading');mast.append(node('h2','THE CONFERENCE DIRECTORY'),node('span','CONFERENCE RACES · NCAA POSTSEASON'));root.append(mast);
 const d1link=document.createElement('a');d1link.href='college-soccer-di-men.html';d1link.className='cs-conf-directory-d1-link';d1link.textContent='MEN’S DIVISION I · CHAMPIONSHIP FORECAST BRACKETS';d1link.style.cssText='display:block;padding:14px 16px;margin:12px 0;border-top:3px solid #28495c;background:#eff4f7;font:800 13px Arial,sans-serif;color:#244a63;text-decoration:underline';root.append(d1link);
 const groups=Object.entries(data.conferences||{}).filter(([key,v])=>v.page&&v.teams?.length).map(([key,v])=>{
 const [cohort,league]=key.split(':');const [sex,division]=cohort.split('-');
 return {key,label:v.short||v.name||league,sex:sex==='women'?'Women':'Men',division:division==='d1'?'I':division==='d2'?'II':'III',href:v.page};
}).sort((a,b)=>a.division.localeCompare(b.division)||a.sex.localeCompare(b.sex)||a.label.localeCompare(b.label));
 const mapped=Object.keys(data.conferences||{}).length;
 const coverage=node('p',groups.length+' verified conference desks · Division I: '+groups.filter(g=>g.division==='I').length+' · Division II: '+groups.filter(g=>g.division==='II').length+' · Division III: '+groups.filter(g=>g.division==='III').length+'. All other conferences are still being mapped.','cs-conf-directory-coverage');root.append(coverage);
 const audit=node('div',null,'cs-conf-cohort-coverage');audit.setAttribute('aria-label','Verified NCAA soccer conference coverage by division');
 for(const [cohort,rows] of Object.entries(elo.cohorts||{})){
  const assigned=rows.filter(t=>{const key=cohort+':'+t.team_id,conference=data.team_to_conference?.[key];return !!conference&&data.conferences?.[conference]?.teams.includes(t.team_id)}).length;
  const title=cohort.replace('men','Men').replace('women','Women').replace('d1','DI').replace('d2','DII').replace('d3','DIII');
  const tile=node('div',null,'cs-conf-cohort-tile');tile.append(node('strong',title),node('span',assigned+' of '+rows.length+' rated programs mapped'));
  const track=node('div',null,'cs-conf-cohort-track'),fill=node('i');fill.style.width=100*assigned/Math.max(rows.length,1)+'%';track.append(fill);tile.append(track);audit.append(tile);
 }
 root.append(audit);
 const filters=node('div',null,'cs-conf-directory-filters');
 const search=node('input',null,'cs-conf-directory-search');search.type='search';search.placeholder='Find a conference (ACC, Big Ten, MIAC…)';search.setAttribute('aria-label','Search NCAA soccer conferences');
 const division=node('select',null,'cs-conf-directory-select');division.setAttribute('aria-label','Filter by NCAA division');
 for(const [value,label] of [['','All divisions'],['I','Division I'],['II','Division II'],['III','Division III']]){const option=node('option',label);option.value=value;division.append(option)}
 const gender=node('select',null,'cs-conf-directory-select');gender.setAttribute('aria-label','Filter by men or women');
 for(const [value,label] of [['','Men and women'],['Men','Men'],['Women','Women']]){const option=node('option',label);option.value=value;gender.append(option)}
 const count=node('span',null,'cs-conf-directory-matchcount');count.setAttribute('aria-live','polite');
 filters.append(search,division,gender,count);root.append(filters);
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
 const applyFilters=()=>{const q=search.value.trim().toLowerCase();let matched=0;for(const a of rail.querySelectorAll('.cs-conf-directory-link')){const ok=(!q||a.dataset.search.includes(q))&&(!division.value||a.dataset.division===division.value)&&(!gender.value||a.dataset.gender===gender.value);a.hidden=!ok;if(ok)matched++}count.textContent=matched+' of '+groups.length+' desks';};
 for(const el of [search,division,gender])el.addEventListener('input',applyFilters);
for(const conf of groups){const meta=data.conferences[conf.key];
  const link=node('a',null,'cs-conf-directory-link');link.href=conf.href;link.dataset.search=(conf.label+' '+meta.name+' '+conf.key).toLowerCase();link.dataset.division=conf.division;link.dataset.gender=conf.sex;
  const kicker=node('span',conf.sex.toUpperCase()+' · DIVISION '+(conf.division),'cs-conf-directory-kicker');
  const name=node('strong',conf.label,'cs-conf-directory-name');
  const count=node('span',meta.teams.length+' programs · Tournament race','cs-conf-directory-count');
  link.append(kicker,name,count);rail.append(link);

 }
 applyFilters();
 root.append(node('p','Directory generated automatically from verified conference records. Every mapped league has its own page; unmapped leagues are not invented.','cs-conf-directory-note'));
}).catch(error=>{root.replaceChildren(node('p','Conference directory temporarily unavailable. Conference desks remain accessible below.','cs-conf-directory-note'));console.error('NCAA conference index',error)});
})();