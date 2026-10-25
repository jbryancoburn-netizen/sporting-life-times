(()=>{'use strict';
const node=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined&&text!==null)x.textContent=String(text);return x;};
const svgSafe=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const profile=(cohort,id)=>'college-soccer-team.html?team='+encodeURIComponent(cohort+':'+id);
function crest(name,id,cohort,branding){
 const mark=node('span','cs-cup-crest',String(name||id).replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'SC');
 const info=branding?.teams?.[cohort+':'+id]||{};
 if(/^#[0-9a-fA-F]{6}$/.test(info.primary||''))mark.style.setProperty('--club',info.primary);
 const src=info.logo_url||(svgSafe.test(String(id))?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg':null);
 if(src){const img=node('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=src;img.addEventListener('load',()=>mark.classList.add('has-image'));img.addEventListener('error',()=>img.remove());mark.append(img);}
 return mark;
}
function school(name,id,cohort,branding,seed){
 const wrap=node('span','cs-cup-school');
 if(Number.isInteger(seed))wrap.append(node('small','cs-cup-seed',seed));
 wrap.append(crest(name,id,cohort,branding));
 const link=node('a','cs-cup-teamname',name);link.href=profile(cohort,id);wrap.append(link);
 return wrap;
}
function pair(label,a,b,cohort,branding,kind='fixture'){
 const card=node('div','cs-cup-match '+kind);
 card.append(node('small','cs-cup-match-label',label));
 const add=(team)=>{if(!team){card.append(node('div','cs-cup-tbd','Awaiting earlier-round winner'));return;}
 const teamId=team.id||team.team_id, name=team.name||team.team?.team||team.team;
 const seed=team.seed;
 card.append(school(name,teamId,cohort,branding,seed));};
 add(a);add(b);return card;
}
function bracket(parent,teams,cohort,branding,labels={}){
 if(!Array.isArray(teams)||teams.length!==6)return;
 const t=teams.map((x,i)=>({id:x.id||x.team_id,name:x.name||x.team?.team||x.team,seed:i+1}));
 const root=node('div','cs-cup-bracket');root.setAttribute('aria-label','Provisional six-team conference tournament bracket');
 const round=(label,cls)=>{const c=node('section','cs-cup-round '+cls);c.append(node('h4','cs-cup-round-title',label));root.append(c);return c;};
 const q=round(labels.q||'QUARTERFINALS','quarter');
 q.append(pair('GAME 1 · #3 VS #6',t[2],t[5],cohort,branding),pair('GAME 2 · #4 VS #5',t[3],t[4],cohort,branding));
 const semi=round(labels.s||'SEMIFINALS','semis');
 semi.append(pair('TOP SEED ENTERS',t[0],null,cohort,branding,'bye'),pair('SECOND SEED ENTERS',t[1],null,cohort,branding,'bye'));
 const final=round(labels.f||'CHAMPIONSHIP','championship');
 const championship=node('div','cs-cup-final');
 championship.append(node('span','cs-cup-trophy','★'),node('strong',null,'CONFERENCE FINAL'),node('span',null,'Semifinal winners'),node('small',null,'WINNER CLAIMS THE CONFERENCE TITLE'));
 final.append(championship);
 root.append(node('p','cs-cup-caveat','Illustrative seeding from the latest published conference table; actual opponents, tiebreakers and eligibility remain subject to the conference.'));
 parent.append(root);return root;
}
function decorateTable(table,teams,cohort,branding){
 if(!table)return;
 const rows=table.querySelectorAll('tbody tr');
 for(let i=0;i<Math.min(rows.length,teams.length);i++){
  const team=teams[i],id=team.id||team.team_id,name=team.name||team.team?.team||team.team;
  const link=rows[i].querySelector('td:nth-child(2) a');
  if(!link||link.querySelector('.cs-cup-crest'))continue;
  link.classList.add('cs-cup-table-school');
  link.prepend(crest(name,id,cohort,branding));
 }
}
window.CollegeSoccerCupUI=Object.freeze({crest,school,bracket,decorateTable});
})();