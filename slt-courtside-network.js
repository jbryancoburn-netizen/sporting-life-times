/* SLT | Hardwood Directory. Shared identity, never alters a league's data. */
(function () {
 'use strict';
 const desks=[
  ['nba','01','THE ASSOCIATION','NBA','nba.html'],
  ['men','02','COLLEGE / MEN','NCAA MEN','ncaam.html'],
  ['women','03','COLLEGE / WOMEN','NCAA WOMEN','ncaam.html?gender=women'],
  ['euroleague','04','EUROPE','EUROLEAGUE','euroleague.html'],
  ['nbl','05','AUSTRALIA','NBL','nbl.html']
 ];
 function attach(){
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  const gender=new URLSearchParams(location.search).get('gender');
  const kind=page==='nba.html'?'nba':
   ['ncaam.html','college-basketball.html','cbb-game-center.html','cbb-gamefile.html'].includes(page)?(gender==='women'?'women':'men'):
   page==='euroleague.html'?'euroleague':page==='nbl.html'?'nbl':null;
  if(!kind||document.querySelector('.slt-courtside-network'))return;
  const anchor=document.querySelector('header .edition-line')||document.querySelector('.edition-line');
  if(!anchor)return;
  const nav=document.createElement('nav');
  nav.className='slt-courtside-network';
  nav.setAttribute('aria-label','Sporting Life & Times basketball desks');
  const mast=document.createElement('div');
  mast.className='slt-network-brand';
  mast.innerHTML='<span class="slt-network-seal" aria-hidden="true"><strong>SL</strong><em>&</em><strong>T</strong></span>'+
    '<span class="slt-network-title"><small>THE SPORTING LIFE & TIMES</small>'+
    '<strong>THE HARDWOOD</strong><span>FIVE DESKS · ONE GAME</span></span>';
  nav.appendChild(mast);
  const rail=document.createElement('div');rail.className='slt-network-rail';
  const row=document.createElement('div');row.className='slt-network-links';
  for(const [key,number,title,short,href] of desks){
   const link=document.createElement('a');link.href=href;
   link.setAttribute('aria-label',short+' basketball newspaper');
   if(key===kind)link.setAttribute('aria-current','page');
   link.innerHTML='<span class="slt-network-number" aria-hidden="true">'+number+'</span>'+
    '<span class="slt-network-label">'+title+'</span>';
   row.appendChild(link);
  }
  rail.appendChild(row);nav.appendChild(rail);
  anchor.insertAdjacentElement('afterend',nav);
  // Keep the current desk visible without changing page scroll.
  const active=row.querySelector('[aria-current]');
  if(active&&row.scrollWidth>rail.clientWidth){
   requestAnimationFrame(()=>{rail.scrollLeft=Math.max(0,active.offsetLeft-rail.clientWidth/2+active.offsetWidth/2);});
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();