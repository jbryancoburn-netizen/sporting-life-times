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
const groups=[{"key":"men-d1:big-ten","label":"Big Ten","sex":"Men","href":"college-soccer-big-ten-men.html"},{"key":"women-d1:big-ten","label":"Big Ten","sex":"Women","href":"college-soccer-big-ten-women.html"},{"key":"men-d3:miaa","label":"MIAA","sex":"Men","href":"college-soccer-miaa-men.html"},{"key":"women-d3:miaa","label":"MIAA","sex":"Women","href":"college-soccer-miaa-women.html"},{"key":"men-d3:miac","label":"MIAC","sex":"Men","href":"college-soccer-miac-men.html"},{"key":"women-d3:miac","label":"MIAC","sex":"Women","href":"college-soccer-miac-women.html"},{"key":"men-d3:cciw","label":"CCIW","sex":"Men","href":"college-soccer-cciw-men.html"},{"key":"women-d3:cciw","label":"CCIW","sex":"Women","href":"college-soccer-cciw-women.html"},{"key":"men-d2:gliac","label":"GLIAC","sex":"Men","href":"college-soccer-gliac-men.html"},{"key":"women-d2:gliac","label":"GLIAC","sex":"Women","href":"college-soccer-gliac-women.html"}];
fetch('data/college-soccer-conferences.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
 root.replaceChildren();
 const mast=node('div',null,'cs-conf-directory-heading');mast.append(node('h2','THE CONFERENCE DIRECTORY'),node('span','CONFERENCE RACES · NCAA POSTSEASON'));root.append(mast);
 const mapped=Object.keys(data.conferences||{}).length;
 const coverage=node('p',mapped+' verified conference desks spanning NCAA Divisions I and III. Additional conferences are still being mapped.','cs-conf-directory-coverage');root.append(coverage);
 const rail=node('nav',null,'cs-conf-directory-rail');rail.setAttribute('aria-label','NCAA soccer conference directory');root.append(rail);
 for(const conf of groups){const meta=data.conferences?.[conf.key];if(!meta)continue;
  const link=node('a',null,'cs-conf-directory-link');link.href=conf.href;
  const kicker=node('span',conf.sex.toUpperCase()+' · DIVISION '+(conf.key.includes('-d1:')?'I':'III'),'cs-conf-directory-kicker');
  const name=node('strong',conf.label,'cs-conf-directory-name');
  const count=node('span',meta.teams.length+' programs · Tournament race','cs-conf-directory-count');
  link.append(kicker,name,count);rail.append(link);

 }
 root.append(node('p','Conference directory now includes independently sourced Divisions I, II, and III. Only conferences with sourced memberships and records are listed; missing conferences are not assigned or estimated.','cs-conf-directory-note'));
}).catch(error=>{root.replaceChildren(node('p','Conference directory temporarily unavailable. Conference desks remain accessible below.','cs-conf-directory-note'));console.error('NCAA conference index',error)});
})();