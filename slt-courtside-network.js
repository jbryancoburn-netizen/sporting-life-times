/* SLT Courtside Network — brand identity only, league models remain independent. */
(function(){
 'use strict';
 const links=[
   ['nba','NBA','nba.html'],
   ['men','NCAA MEN','ncaam.html'],
   ['women','NCAA WOMEN','ncaam.html?gender=women'],
   ['euroleague','EUROLEAGUE','euroleague.html'],
   ['nbl','NBL','nbl.html']
 ];
 function attach(){
   const page=(location.pathname.split('/').pop()||'').toLowerCase();
   const params=new URLSearchParams(location.search);
   const kind=page==='nba.html'?'nba':
     page==='ncaam.html'||page==='college-basketball.html'?'gender' in Object.fromEntries(params)&&params.get('gender')==='women'?'women':'men':
     page==='cbb-game-center.html'?(params.get('gender')==='women'?'women':'men'):
     page==='euroleague.html'?'euroleague':page==='nbl.html'?'nbl':null;
   if(!kind||document.querySelector('.slt-courtside-network'))return;
   const header=document.querySelector('header .edition-line')||document.querySelector('.edition-line');
   if(!header)return;
   const nav=document.createElement('nav');
   nav.className='slt-courtside-network';
   nav.setAttribute('aria-label','The Courtside Network');
   const brand=document.createElement('div');
   brand.className='slt-network-brand';
   brand.innerHTML='<span class="slt-network-stamp" aria-hidden="true">SLT</span>'+
      '<span class="slt-network-title"><strong>THE COURTSIDE NETWORK</strong><small>ONE PAPER. FIVE BASKETBALL DESKS.</small></span>';
   nav.append(brand);
   const row=document.createElement('div');row.className='slt-network-links';
   for(const [key,label,url] of links){
     const a=document.createElement('a');
     a.href=url;a.textContent=label;
     if(key===kind)a.setAttribute('aria-current','page');
     row.append(a);
   }
   nav.append(row);
   header.insertAdjacentElement('afterend',nav);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();