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
 root.setAttribute('aria-label','ACC fifteen-team bracket if the tournament began with the latest published standings');
 root.append(node('p','cs-cup-caveat','IF THE TOURNAMENT STARTED TODAY · Seeds reflect the published standings order, subject to official ACC tiebreakers. This is not an announced bracket. Elo never determines the seeds.'));
 const round=(title,kind)=>{const r=node('section','cs-cup-round '+kind);r.append(node('h4','cs-cup-round-title',title));root.append(r);return r;};
 const first=round(labels.q||'FIRST ROUND','opening');
 const opening=[[8,9],[4,13],[5,12],[3,14],[6,11],[7,10],[2,15]];
 const match=(a,b)=>pair('POSITION '+a+' vs '+b,t[a-1],t[b-1],cohort,branding);
 first.append(pair('#1 · FIRST-ROUND BYE',t[0],null,cohort,branding,'bye'));
 for(const [a,b] of opening)first.append(match(a,b));
 const quarters=round(labels.quarter||'QUARTERFINALS','quarter');
 const qPaths=[
  ['#1 vs winner #8/#9',t[0],'Winner 8/9'],
  ['Winner #4/#13 vs #5/#12',null,'Winner 4/13 vs winner 5/12'],
  ['Winner #3/#14 vs #6/#11',null,'Winner 3/14 vs winner 6/11'],
  ['Winner #7/#10 vs #2/#15',null,'Winner 7/10 vs winner 2/15']
 ];
 for(const [label,team,opponent] of qPaths){
  const card=pair(label,team,null,cohort,branding);
  const placeholder=card.querySelector('.cs-cup-tbd');if(placeholder)placeholder.textContent=opponent;
  if(team){const second=node('div','cs-cup-path',opponent);card.append(second);}
  quarters.append(card);
 }
 const semis=round(labels.s||'SEMIFINALS','semis');
 for(const [title,left,right] of [['SEMIFINAL 1','Quarterfinal 1 winner','Quarterfinal 2 winner'],['SEMIFINAL 2','Quarterfinal 3 winner','Quarterfinal 4 winner']]){
  const card=pair(title,null,null,cohort,branding);const placeholders=card.querySelectorAll('.cs-cup-tbd');placeholders[0].textContent=left;placeholders[1].textContent=right;semis.append(card);
 }
 const final=round(labels.f||'CHAMPIONSHIP','championship');
 const title=pair('ACC FINAL',null,null,cohort,branding);
 const places=title.querySelectorAll('.cs-cup-tbd');places[0].textContent='Semifinal 1 winner';places[1].textContent='Semifinal 2 winner';final.append(title);
 root.append(node('p','cs-cup-caveat','Bracket paths follow the ACC championship format, not projected game winners. Actual scores advance only when reported as official results. Whenever standings change, the provisional first-round field is rebuilt.'));
 parent.append(root);return root;
}

function predictiveBracket(parent,teams,cohort,branding,labels={}){
 if(![4,6,8,15].includes(teams.length)||teams.some(t=>!Number.isFinite(Number(t.elo))))return null;
 const t=teams.map((x,i)=>({...x,id:x.id||x.team_id,name:x.name||x.team?.team||x.team,seed:i+1}));
 const odds=(a,b)=>1/(1+Math.pow(10,-((a.elo-b.elo)/400)));
 const decide=(a,b)=>({winner:odds(a,b)>=.5?a:b,prob:Math.max(odds(a,b),1-odds(a,b))});
 const root=node('div','cs-cup-bracket cs-cup-prediction-bracket');
 root.setAttribute('aria-label','USRS predicted conference tournament bracket, hypothetical games');
 root.append(node('p','cs-cup-caveat','IF PLAYED WITH THE CURRENT CONFERENCE TABLE · Forecast winners and advancement are based on USRS Elo. Team positions follow published standings, never Elo. This is NOT the official bracket.'));
 const round=(title)=>{const r=node('section','cs-cup-round');r.append(node('h4','cs-cup-round-title',title));root.append(r);return r;};
 const game=(group,label,a,b)=>{const d=decide(a,b);const card=pair(label,a,b,cohort,branding);card.classList.add('cs-cup-predicted-match');card.append(node('small','cs-cup-prediction-label','USRS PICK: '+d.winner.name+' · '+Math.round(100*d.prob)+'%'));group.append(card);return d.winner;};
 let finalists=[];
 if(t.length===4){
  const semi=round(labels.s||'SEMIFINALS');
  finalists=[game(semi,'#1 vs #4',t[0],t[3]),game(semi,'#2 vs #3',t[1],t[2])];
 }else if(t.length===6){
  const q=round(labels.q||'OPENING ROUND');
  const w36=game(q,'#3 vs #6',t[2],t[5]),w45=game(q,'#4 vs #5',t[3],t[4]);
  const s=round(labels.s||'SEMIFINALS');
  finalists=[game(s,'#1 bracket path',t[0],w45),game(s,'#2 bracket path',t[1],w36)];
 }else if(t.length===8){
  const q=round(labels.q||'QUARTERFINALS');
  const w=[[0,7],[3,4],[1,6],[2,5]].map(([a,b])=>game(q,'#'+(a+1)+' vs #'+(b+1),t[a],t[b]));
  const s=round(labels.s||'SEMIFINALS');
  finalists=[game(s,'Semifinal 1',w[0],w[1]),game(s,'Semifinal 2',w[2],w[3])];
 }else{
  const q=round(labels.q||'FIRST ROUND');
  q.append(pair('#1 · BYE',t[0],null,cohort,branding,'bye'));
  const games=[[8,9],[4,13],[5,12],[3,14],[6,11],[7,10],[2,15]];
  const w=games.map(([a,b])=>game(q,'#'+a+' vs #'+b,t[a-1],t[b-1]));
  const quarter=round(labels.quarter||'QUARTERFINALS');
  const v=[game(quarter,'Quarterfinal 1',t[0],w[0]),game(quarter,'Quarterfinal 2',w[1],w[2]),game(quarter,'Quarterfinal 3',w[3],w[4]),game(quarter,'Quarterfinal 4',w[5],w[6])];
  const s=round(labels.s||'SEMIFINALS');
  finalists=[game(s,'Semifinal 1',v[0],v[1]),game(s,'Semifinal 2',v[2],v[3])];
 }
 const f=round(labels.f||'CHAMPIONSHIP');
 const champion=game(f,'PROJECTED CONFERENCE FINAL',finalists[0],finalists[1]);
 f.append(node('strong','cs-cup-projected-champion','USRS PROJECTED CHAMPION: '+champion.name));
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
window.CollegeSoccerCupUI=Object.freeze({crest,school,bracket,bracketEight,bracketFifteen,predictiveBracket,decorateTable});
})();