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
const allIndex=pages.length;
const allButton=document.createElement('button');allButton.type='button';allButton.textContent='Full Edition';labels.appendChild(allButton);
function turn(index,scroll){
 current=Math.max(0,Math.min(allIndex,index));
 const full=current===allIndex;
 document.body.classList.add('edition-paged');
 document.querySelectorAll('[data-edition-page]').forEach(el=>{el.hidden=!full&&Number(el.dataset.editionPage)!==current;});
 labels.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-current',i===current?'page':'false');});
 allButton.setAttribute('aria-current',full?'page':'false');
 nav.querySelector('.edition-page-count').textContent=full?'FULL EDITION':'PAGE '+(current+1)+' / '+pages.length;
 back.disabled=current===0;forward.disabled=current===allIndex;
 if(scroll)nav.scrollIntoView({block:'start',behavior:'smooth'});
 try{history.replaceState(null,'',full?'#all-pages':'#page-'+(current+1))}catch{}
}
pages.forEach((page,i)=>{const btn=document.createElement('button');btn.type='button';btn.textContent=page.name;btn.addEventListener('click',()=>turn(i,true));labels.appendChild(btn)});
allButton.addEventListener('click',()=>turn(allIndex,true));
back.addEventListener('click',()=>turn(current-1,true));forward.addEventListener('click',()=>turn(current+1,true));
document.addEventListener('click',event=>{const anchor=event.target.closest('a[href^="#"]');if(!anchor)return;const id=anchor.getAttribute('href').slice(1);if(pageIds.has(id)){turn(pageIds.get(id),false);}});
const deepLink=location.hash.slice(1);
const initial=deepLink==='all-pages'?allIndex:pageIds.has(deepLink)?pageIds.get(deepLink):Math.max(0,Number((deepLink.match(/^page-(\d+)$/)||[])[1]||1)-1);
turn(initial,false);
if(pageIds.has(deepLink))setTimeout(()=>document.getElementById(deepLink)?.scrollIntoView({block:'start'}),0);
})();