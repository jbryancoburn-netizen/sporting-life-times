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
fetch('data/college-soccer-conferences.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
 root.replaceChildren();
 const mast=node('div',null,'cs-conf-directory-heading');mast.append(node('h2','THE CONFERENCE DIRECTORY'),node('span','CONFERENCE RACES · NCAA POSTSEASON'));root.append(mast);
 const mapped=Object.keys(data.conferences||{}).length;
 const coverage=node('p',groups.length+' verified conference desks · Division I: '+groups.filter(g=>g.division==='I').length+' · Division II: '+groups.filter(g=>g.division==='II').length+' · Division III: '+groups.filter(g=>g.division==='III').length+'. All other conferences are still being mapped.','cs-conf-directory-coverage');root.append(coverage);
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
 const groups=Object.entries(data.conferences||{}).filter(([key,v])=>v.page&&v.teams?.length).map(([key,v])=>{
 const [cohort,league]=key.split(':');const [sex,division]=cohort.split('-');
 return {key,label:v.short||v.name||league,sex:sex==='women'?'Women':'Men',division:division==='d1'?'I':division==='d2'?'II':'III',href:v.page};
}).sort((a,b)=>a.division.localeCompare(b.division)||a.sex.localeCompare(b.sex)||a.label.localeCompare(b.label));
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