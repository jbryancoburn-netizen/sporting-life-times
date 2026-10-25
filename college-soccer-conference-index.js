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
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
for(const conf of groups){const meta=data.conferences[conf.key];
  const link=node('a',null,'cs-conf-directory-link');link.href=conf.href;
  const kicker=node('span',conf.sex.toUpperCase()+' · DIVISION '+(conf.division),'cs-conf-directory-kicker');
  const name=node('strong',conf.label,'cs-conf-directory-name');
  const count=node('span',meta.teams.length+' programs · Tournament race','cs-conf-directory-count');
  link.append(kicker,name,count);rail.append(link);

 }
 root.append(node('p','Directory generated automatically from verified conference records. Every mapped league has its own page; unmapped leagues are not invented.','cs-conf-directory-note'));
}).catch(error=>{root.replaceChildren(node('p','Conference directory temporarily unavailable. Conference desks remain accessible below.','cs-conf-directory-note'));console.error('NCAA conference index',error)});
})();