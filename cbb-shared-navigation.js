/* One source of truth for college basketball navigation, across men's and women's editions. */
(()=>{'use strict';
const navs=[...document.querySelectorAll('nav.cbb-universal-nav')];
if(!navs.length)return;
const women=new URLSearchParams(location.search).get('gender')==='women'||document.body.dataset.gender==='women'||location.pathname.includes('ncaaw');
const front=women?'ncaam.html?gender=women':'ncaam.html';
const ranks=[['RETRO','retro'],['NET','net'],['AP','ap'],['Coaches','coaches'],['Pomeroy','kenpom']];
for(const nav of navs){
 const links=[...nav.querySelectorAll('a')];
 links.filter(a=>/Live Game Center/i.test(a.textContent)).forEach(a=>a.remove());
 const rating=links.find(a=>/USRS Rankings|Power Index|^Rankings$/i.test(a.textContent.trim()));
 if(rating){
   const d=document.createElement('div');d.className='cbb-rank-menu';
   const sum=document.createElement('button');sum.type='button';sum.className='cbb-rank-trigger';sum.textContent='Rankings';sum.setAttribute('aria-label','Rankings: choose RETRO, NET, AP, Coaches or Pomeroy');sum.setAttribute('aria-expanded','false');sum.setAttribute('aria-haspopup','true');
   const list=document.createElement('div');list.className='cbb-rank-links';list.id='cbb-rank-dropdown-'+Math.random().toString(36).slice(2);list.hidden=true;sum.setAttribute('aria-controls',list.id);
   for(const [label,key] of ranks){const a=document.createElement('a');a.href=women?'ncaam.html?gender=women#wbb-rankings':front+'?poll='+key+'#rankings';a.textContent=label;list.append(a);}
   d.append(sum);rating.replaceWith(d);document.body.append(list);
   const close=()=>{list.hidden=true;sum.setAttribute('aria-expanded','false');};
   const place=()=>{if(list.hidden)return;const box=sum.getBoundingClientRect();const w=list.offsetWidth||180;list.style.left=Math.max(8,Math.min(box.left,innerWidth-w-8))+'px';list.style.top=Math.min(box.bottom+6,innerHeight-list.offsetHeight-8)+'px';};
   sum.addEventListener('click',()=>{const opening=list.hidden;for(const other of document.querySelectorAll('.cbb-rank-links'))other.hidden=true;list.hidden=!opening;sum.setAttribute('aria-expanded',String(opening));if(opening)place();});
   document.addEventListener('pointerdown',e=>{if(!d.contains(e.target)&&!list.contains(e.target))close();});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();sum.focus();}});
   window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
   list.addEventListener('click',close);
 }
 const finder=[...nav.querySelectorAll('a')].find(a=>/Find Your Team|Team Directory/i.test(a.textContent));
 if(finder){const btn=document.createElement('button');btn.type='button';btn.className='cbb-find-btn';btn.textContent='Find Your Team';finder.replaceWith(btn);btn.addEventListener('click',openFinder);}
}
let index=null;
async function openFinder(){
 let dialog=document.getElementById('cbb-team-finder');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='cbb-team-finder';dialog.innerHTML='<div class="cbb-find-head"><strong>Find Your Team</strong><button type="button" data-close aria-label="Close search">×</button></div><label for="cbb-team-query">Search Division I schools</label><input id="cbb-team-query" type="search" placeholder="University, mascot or nickname" autocomplete="off"><div class="cbb-find-results" aria-live="polite"></div>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.querySelector('input').addEventListener('input',render);}
 dialog.showModal();dialog.querySelector('input').focus();
 if(!index){try{const r=await fetch('data/ncaam-2026-27-espn-team-crosswalk.json');if(!r.ok)throw Error('Team index unavailable');index=(await r.json()).teams||[];}catch{dialog.querySelector('.cbb-find-results').textContent='Team directory unavailable. Please try again.';return;}}
 render();
}
function render(){const dialog=document.getElementById('cbb-team-finder');if(!dialog||!index)return;const q=dialog.querySelector('input').value.trim().toLowerCase();const names=index.filter(t=>(t.name+' '+(t.espn_name||'')).toLowerCase().includes(q)).slice(0,30);const res=dialog.querySelector('.cbb-find-results');res.replaceChildren();for(const t of names){const a=document.createElement('a');a.href=women?'ncaaw-team.html?team='+encodeURIComponent(t.id):'ncaam-team.html?team='+encodeURIComponent(t.id);a.textContent=t.name+(t.espn_name&&t.espn_name!==t.name?' · '+t.espn_name:'');res.append(a);}if(!names.length)res.textContent='No matching Division I schools.';}
const selected=new URLSearchParams(location.search).get('poll');
if(!women&&selected&&ranks.some(x=>x[1]===selected)){
 let tries=0;const timer=setInterval(()=>{const btn=document.querySelector('[data-poll="'+selected+'"]');if(btn){btn.click();clearInterval(timer);const table=document.getElementById('rankings')||btn.closest('section');table?.scrollIntoView({block:'start'});}else if(++tries>45)clearInterval(timer);},200);
}
})();