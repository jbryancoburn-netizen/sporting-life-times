/* SLT Hardwood — original editorial identity and attributed league marks.
 * Display marks only; league statistics, Elo and team crests stay independent.
 */
(function(){
 'use strict';
 const desks=[
  {id:'nba',num:'01',name:'NBA',sub:'THE ASSOCIATION',href:'nba.html',
   mark:'https://cdn.nba.com/logos/leagues/L/logo-nba.svg',alt:'NBA'},
  {id:'men',num:'02',name:'NCAA MEN',sub:'DIVISION I',href:'ncaam.html',
   mark:'https://commons.wikimedia.org/wiki/Special:FilePath/NCAA_logo.svg',alt:'NCAA'},
  {id:'women',num:'03',name:'NCAA WOMEN',sub:'DIVISION I',href:'ncaam.html?gender=women',
   mark:'https://commons.wikimedia.org/wiki/Special:FilePath/NCAA_logo.svg',alt:'NCAA'},
  {id:'euroleague',num:'04',name:'EUROLEAGUE',sub:'EUROPE',href:'euroleague.html',
   mark:'https://commons.wikimedia.org/wiki/Special:FilePath/EuroLeague_logo.svg',alt:'EL'},
  {id:'nbl',num:'05',name:'NBL',sub:'AUSTRALIA',href:'nbl.html',
   mark:'https://commons.wikimedia.org/wiki/Special:FilePath/NBL_Logo.png',alt:'NBL'}
 ];
 const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function current(){
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  const gender=new URLSearchParams(location.search).get('gender');
  if(page==='nba.html')return 'nba';
  if(['ncaam.html','college-basketball.html','cbb-game-center.html','cbb-gamefile.html'].includes(page))return gender==='women'?'women':'men';
  if(page==='euroleague.html')return 'euroleague';
  if(page==='nbl.html')return 'nbl';
  return null;
 }
 function attach(){
  const active=current();
  if(!active||document.querySelector('.slt-courtside-network'))return;
  const anchor=document.querySelector('header .edition-line')||document.querySelector('.edition-line');
  if(!anchor)return;
  const nav=document.createElement('nav');
  nav.className='slt-courtside-network';
  nav.setAttribute('aria-label','The Hardwood basketball league editions');
  const brand=document.createElement('a');
  brand.className='slt-network-brand';
  brand.href='sports.html';
  brand.setAttribute('aria-label','The Sporting Life and Times basketball desks');
  brand.innerHTML='<img class="slt-network-crest" src="assets/slt-hardwood-crest.svg" width="59" height="66" alt="The Sporting Life & Times Hardwood shield">'+
   '<span class="slt-network-title"><small>THE SPORTING LIFE & TIMES</small><strong>THE HARDWOOD</strong><span>THE BASKETBALL DESKS · EST. 2026</span></span>';
  nav.appendChild(brand);
  const rail=document.createElement('div');rail.className='slt-network-rail';
  const row=document.createElement('div');row.className='slt-network-links';
  desks.forEach(d=>{
    const link=document.createElement('a');
    link.href=d.href;
    link.setAttribute('aria-label',d.name+' basketball edition');
    if(d.id===active)link.setAttribute('aria-current','page');
    link.innerHTML='<span class="slt-league-image" aria-hidden="true"><img src="'+htmlEscape(d.mark)+'" alt="" loading="lazy" decoding="async">'+
       '<span class="slt-league-fallback">'+htmlEscape(d.alt)+'</span></span>'+
       '<span class="slt-league-copy"><small>'+htmlEscape(d.num)+' / '+htmlEscape(d.sub)+'</small><b>'+htmlEscape(d.name)+'</b></span>';
    const img=link.querySelector('img');
    img.addEventListener('error',()=>{link.classList.add('slt-league-logo-missing');img.hidden=true;},{once:true});
    if(img.complete&&img.naturalWidth===0){link.classList.add('slt-league-logo-missing');img.hidden=true;}
    row.appendChild(link);
  });
  rail.appendChild(row);nav.appendChild(rail);
  anchor.insertAdjacentElement('afterend',nav);
  const chosen=row.querySelector('[aria-current]');
  if(chosen&&row.scrollWidth>rail.clientWidth&&typeof requestAnimationFrame==='function'){
    requestAnimationFrame(()=>{rail.scrollLeft=Math.max(0,chosen.offsetLeft-rail.clientWidth/2+chosen.offsetWidth/2)});
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});
 else attach();
})();