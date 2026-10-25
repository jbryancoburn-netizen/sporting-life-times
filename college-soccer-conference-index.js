(()=>{'use strict';
const root=document.getElementById('college-soccer-conference-index');if(!root)return;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const groups=[
 {key:'men-d3:miaa',label:'MIAA',sex:"Men",anchor:'cs-miaa'},
 {key:'men-d3:miac',label:'MIAC',sex:"Men",anchor:'cs-miac'},
 {key:'men-d3:cciw',label:'CCIW',sex:"Men",anchor:'college-soccer-cciw'},
 {key:'women-d3:miaa',label:'MIAA',sex:"Women",anchor:'college-soccer-women-miaa'},
];
fetch('data/college-soccer-conferences.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
 root.replaceChildren();
 const mast=node('div',null,'cs-conf-directory-heading');mast.append(node('h2','THE CONFERENCE DIRECTORY'),node('span','CONFERENCE RACES · NCAA POSTSEASON'));root.append(mast);
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
 for(const conf of groups){const meta=data.conferences?.[conf.key];if(!meta||!document.getElementById(conf.anchor))continue;
  const link=node('a',null,'cs-conf-directory-link');link.href='#'+conf.anchor;
  const kicker=node('span',conf.sex.toUpperCase()+' · DIVISION III','cs-conf-directory-kicker');
  const name=node('strong',conf.label,'cs-conf-directory-name');
  const count=node('span',meta.teams.length+' programs · Tournament race','cs-conf-directory-count');
  link.append(kicker,name,count);rail.append(link);
  link.addEventListener('click',()=>{const sec=document.getElementById(conf.anchor);if(sec){sec.classList.add('cs-conf-highlight');setTimeout(()=>sec.classList.remove('cs-conf-highlight'),1400);}});
 }
 root.append(node('p','Verified conference mapping is being expanded. Only conferences with sourced memberships and records are listed; missing conferences are not assigned or estimated.','cs-conf-directory-note'));
}).catch(error=>{root.replaceChildren(node('p','Conference directory temporarily unavailable. Conference desks remain accessible below.','cs-conf-directory-note'));console.error('NCAA conference index',error)});
})();