(()=>{'use strict';
const pages=[
 {name:'Front Page',ids:['nba-rabby-today','nba-news']},
 {name:'Scores',ids:['nba-nba-scoreboard','nba-yesterday','nba-boxscores']},
 {name:'Standings & Elo',ids:['nba-official-standings','nba-current-elo','nba-results-desk']},
 {name:'Players',ids:['nba-individual-player-leaders','nba-player-stat-notebook','nba-data-links']},
 {name:'Forecasts',ids:['nba-upcoming','nba-three-models','nba-frozen-2025-26']}
];
const nav=document.getElementById('nba-page-turner');
if(!nav)return;
const labels=nav.querySelector('.edition-page-links'),back=nav.querySelector('[data-turn="prev"]'),forward=nav.querySelector('[data-turn="next"]');
const pageIds=new Map();
pages.forEach((page,index)=>page.ids.forEach(id=>{const e=document.getElementById(id);if(e){e.dataset.editionPage=index;pageIds.set(id,index)}}));
let current=0;
function turn(index,scroll){
 current=Math.max(0,Math.min(pages.length-1,index));
 document.body.classList.add('edition-paged');
 document.querySelectorAll('[data-edition-page]').forEach(el=>{el.hidden=Number(el.dataset.editionPage)!==current;});
 labels.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-current',i===current?'page':'false');});
 nav.querySelector('.edition-page-count').textContent='PAGE '+(current+1)+' / '+pages.length;
 back.disabled=current===0;forward.disabled=current===pages.length-1;
 if(scroll)nav.scrollIntoView({block:'start',behavior:'smooth'});
 try{history.replaceState(null,'','#page-'+(current+1))}catch{}
}
pages.forEach((page,i)=>{const btn=document.createElement('button');btn.type='button';btn.textContent=page.name;btn.addEventListener('click',()=>turn(i,true));labels.appendChild(btn)});
back.addEventListener('click',()=>turn(current-1,true));forward.addEventListener('click',()=>turn(current+1,true));
document.addEventListener('click',event=>{const anchor=event.target.closest('a[href^="#"]');if(!anchor)return;const id=anchor.getAttribute('href').slice(1);if(pageIds.has(id)){turn(pageIds.get(id),false);}});
const initial=Number((location.hash.match(/^#page-(\d+)$/)||[])[1]||1)-1;
turn(initial,false);
})();