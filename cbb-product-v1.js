/* SLT College Court v1 — shared UI: four pages, data untouched.
   Visual/route enhancements only; all observed values stay owned by existing feeds. */
(function(){
'use strict';
const page=(location.pathname.split('/').pop()||'').toLowerCase();
const supported=new Set(['ncaam.html','college-basketball.html','ncaam-slate.html','cbb-game-center.html','cbb-gamefile.html']);
if(!supported.has(page))return;
const source=new URLSearchParams(location.search), women=source.get('gender')==='women';
const labels={'ncaam.html':['THE NATIONAL DESK','FRONT PAGE'],
'college-basketball.html':['THE NATIONAL DESK','FRONT PAGE'],
'ncaam-slate.html':['THE DAILY SLATE','GAMES & SCHEDULE'],
'cbb-game-center.html':['THE COURTSIDE DESK','LIVE GAME CENTER'],
'cbb-gamefile.html':['THE GAMEFILE','GAME REPORT']};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dest=(file,gender)=>file+(gender?'?gender=women':'');
const menus=[
['FRONT PAGE','ncaam.html'],['DAILY SLATE','ncaam-slate.html'],
['LIVE DESK','cbb-game-center.html'],['USRS RANKINGS','ncaam-elo.html'],
['CONFERENCES','ncaam-conference.html'],['BRACKET WATCH','ncaam-tournament.html'],
['TEAMS','ncaam.html#teams'],['PLAYERS','ncaam-players.html'],['ARENA FILE','ncaam-arena.html']];
function boot(){
 const header=document.querySelector('header');if(!header)return;
 document.body.classList.add('cbb-product');document.body.dataset.cbbEdition=page.includes('gamefile')?'gamefile':page.includes('center')?'live':page.includes('slate')?'slate':'front';
 const brand=header.querySelector('.slt-brand-title');
 if(brand)brand.textContent='SPORTING LIFE AND TIMES';
 const legacy=header.querySelector('.sl-masthead>a');
 if(legacy){legacy.textContent='SPORTING LIFE AND TIMES';legacy.style.fontStyle='normal'}
 const old=header.querySelector('.edition-line,.sl-masthead>span');
 if(old)old.textContent='NCAA BASKETBALL  /  '+(women?'WOMEN':'MEN')+"'S DIVISION I";
 const nav=header.querySelector('nav');if(nav)nav.setAttribute('aria-label','College basketball newspaper navigation');
 const strip=document.createElement('div');strip.className='cbb-product-ribbon';
 strip.innerHTML='<span class="cbb-product-stamp">SLT <small>COLLEGE COURT</small></span>'+
  '<span class="cbb-product-issue"><b>NCAA BASKETBALL</b><small>'+labels[page][0]+'</small></span>'+
  '<span class="cbb-product-issue-no">2026—27 <b>•</b> '+labels[page][1]+'</span>';
 const mast=header.querySelector('.slt-retro-masthead,.sl-masthead,.masthead')||header;
 mast.insertAdjacentElement('afterend',strip);
 const editions=document.createElement('nav');editions.className='cbb-product-switch';editions.setAttribute('aria-label','College basketball divisions and gender');
 editions.innerHTML='<span class="cbb-product-switch-name">EDITION</span>'+
  '<a href="'+dest(page==='college-basketball.html'?'ncaam.html':page,false)+'"'+(!women?' aria-current="page"':'')+'>MEN</a>'+
  '<a href="'+dest(page==='college-basketball.html'?'ncaam.html':page,true)+'"'+(women?' aria-current="page"':'')+'>WOMEN</a>'+
  '<span class="cbb-product-break" aria-hidden="true"></span>'+
  '<a href="ncaam.html" aria-label="Division I basketball">D-I</a>'+
  '<a href="d2-mens-basketball.html" aria-label="Division II basketball">D-II</a>'+
  '<a href="d3-mens-basketball.html" aria-label="Division III basketball">D-III</a>';
 if(nav)nav.insertAdjacentElement('afterend',editions);else header.appendChild(editions);
 const existing=new Set([...(nav?.querySelectorAll('a[href]')||[])].map(a=>a.getAttribute('href').split('?')[0].split('#')[0]));
 if(nav){
 const extras=menus.filter(([,url])=>!existing.has(url.split('#')[0]));
 for(const [title,url] of extras){const a=document.createElement('a');a.textContent=title;a.href=url.includes('#')?url:dest(url,women);a.className='cbb-product-navlink';nav.appendChild(a);}
 for(const a of nav.querySelectorAll('a')){a.style.fontStyle='normal';const href=a.getAttribute('href')||'';if(href.split('?')[0]===page)a.setAttribute('aria-current','page')}
 }
 if(page==='ncaam-slate.html'){
  const hero=document.querySelector('.sl-hero');if(hero){
   const title=hero.querySelector('h1');if(title)title.textContent='TODAY ON THE COURT';
   const art=hero.querySelector('.sl-court-art');if(art)art.setAttribute('aria-hidden','true');
  }
 }
 if(page==='cbb-game-center.html'){
  const top=document.querySelector('.cbb-switch');if(top)top.setAttribute('aria-label','Live desk gender');
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
