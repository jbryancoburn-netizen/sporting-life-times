(()=>{'use strict';
const root=document.getElementById('college-soccer-conference-index');if(!root)return;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const groups=[
 {key:'men-d3:miaa',label:'MIAA',sex:"Men",href:'college-soccer-miaa-men.html'},
 {key:'men-d3:miac',label:'MIAC',sex:"Men",href:'college-soccer-miac-men.html'},
 {key:'men-d3:cciw',label:'CCIW',sex:"Men",href:'college-soccer-cciw-men.html'},
 {key:'women-d3:miaa',label:'MIAA',sex:"Women",href:'college-soccer-miaa-women.html'},
];
fetch('data/college-soccer-conferences.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
 root.replaceChildren();
 const mast=node('div',null,'cs-conf-directory-heading');mast.append(node('h2','THE CONFERENCE DIRECTORY'),node('span','CONFERENCE RACES · NCAA POSTSEASON'));root.append(mast);
 const mapped=Object.keys(data.conferences||{}).length;
 const coverage=node('p',mapped+' conference desks built · '+(groups.filter(g=>g.sex==='Men').length)+' men’s DIII · '+(groups.filter(g=>g.sex==='Women').length)+' women’s DIII. Division I, Division II and most Division III leagues are not mapped yet.','cs-conf-directory-coverage');root.append(coverage);
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
 for(const conf of groups){const meta=data.conferences?.[conf.key];if(!meta)continue;
  const link=node('a',null,'cs-conf-directory-link');link.href=conf.href;
  const kicker=node('span',conf.sex.toUpperCase()+' · DIVISION III','cs-conf-directory-kicker');
  const name=node('strong',conf.label,'cs-conf-directory-name');
  const count=node('span',meta.teams.length+' programs · Tournament race','cs-conf-directory-count');
  link.append(kicker,name,count);rail.append(link);

 }
 root.append(node('p','Verified conference mapping is being expanded. Only conferences with sourced memberships and records are listed; missing conferences are not assigned or estimated.','cs-conf-directory-note'));
}).catch(error=>{root.replaceChildren(node('p','Conference directory temporarily unavailable. Conference desks remain accessible below.','cs-conf-directory-note'));console.error('NCAA conference index',error)});
})();