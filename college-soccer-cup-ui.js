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
function bracketEight(parent,teams,cohort,branding,labels={}){
 if(!Array.isArray(teams)||teams.length!==8)return;
 const t=teams.map((x,i)=>({id:x.id||x.team_id,name:x.name||x.team?.team||x.team,seed:i+1}));
 const root=node('div','cs-cup-bracket');root.setAttribute('aria-label','Provisional eight-team conference tournament bracket');
 const round=(title,cls)=>{const r=node('section','cs-cup-round '+cls);r.append(node('h4','cs-cup-round-title',title));root.append(r);return r;};
 const first=round(labels.q||'QUARTERFINALS','quarter');
 for(const [a,b]of [[0,7],[3,4],[1,6],[2,5]])first.append(pair('SEEDS '+(a+1)+' / '+(b+1),t[a],t[b],cohort,branding));
 const semi=round(labels.s||'SEMIFINALS','semis');
 semi.append(pair('1/8 WINNER VS 4/5 WINNER',null,null,cohort,branding),pair('2/7 WINNER VS 3/6 WINNER',null,null,cohort,branding));
 const final=round(labels.f||'CHAMPIONSHIP','championship');const card=node('div','cs-cup-final');
 card.append(node('span','cs-cup-trophy','★'),node('strong',null,'CONFERENCE FINAL'),node('span',null,'Semifinal winners'));final.append(card);
 root.append(node('p','cs-cup-caveat','Provisional pairings from official standings; official seeds/tiebreakers determine the final bracket.'));
 parent.append(root);return root;
}
function bracketFifteen(parent,teams,cohort,branding,labels={}){
 if(!Array.isArray(teams)||teams.length!==15)return;
 const t=teams.map((x,i)=>({id:x.id||x.team_id,name:x.name||x.team?.team||x.team,seed:i+1}));
 const root=node('div','cs-cup-bracket cs-cup-bracket-fifteen');
 root.setAttribute('aria-label','Hypothetical fifteen-team ACC tournament bracket, with current table order used only as an illustrative seed scenario');
 const round=(title,kind)=>{const r=node('section','cs-cup-round '+kind);r.append(node('h4','cs-cup-round-title',title));root.append(r);return r};
 const opening=round(labels.q||'NOV 4 · OPENING ROUND','opening');
 opening.append(pair('#1 BYE',t[0],null,cohort,branding,'bye'));
 for(const [a,b] of [[7,8],[4,11],[3,12],[5,10],[2,13],[6,9],[1,14]]){
  opening.append(pair('SEEDS #'+(a+1)+' / #'+(b+1),t[a],t[b],cohort,branding));
 }
 const quarters=round(labels.quarter||'NOV 8 · QUARTERFINALS','quarter');
 for(const label of ['#1 vs #8/#9 winner','#4/#13 vs #5/#12','#3/#14 vs #6/#11','#2/#15 vs #7/#10']){
  quarters.append(pair(label,null,null,cohort,branding));
 }
 const semis=round(labels.s||'NOV 12 · SEMIFINALS','semis');
 semis.append(pair('UPPER BRACKET WINNERS',null,null,cohort,branding),pair('LOWER BRACKET WINNERS',null,null,cohort,branding));
 const final=round(labels.f||'NOV 15 · FINAL','championship');
 const card=node('div','cs-cup-final');
 card.append(node('span','cs-cup-trophy','★'),node('strong',null,'ACC CHAMPIONSHIP'),node('span',null,'Semifinal winners'),node('small',null,'CARY · NORTH CAROLINA'));
 final.append(card);
 root.append(node('p','cs-cup-caveat','Official fifteen-team format, but current standings positions are NOT official tournament seeds. All pairings shown are hypothetical. Actual ACC tiebreakers and the published championship bracket take precedence; Elo only forecasts outcomes.'));
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
window.CollegeSoccerCupUI=Object.freeze({crest,school,bracket,bracketEight,bracketFifteen,decorateTable});
})();