/* SLT College Court: ONE header owner for all four NCAA Division I core pages.
 * Does not create game data, alter ratings, or interfere with gender loaders. */
(function(){
'use strict';
const page=(location.pathname.split('/').pop()||'').toLowerCase();
const pages=new Set(['ncaam.html','college-basketball.html','ncaam-slate.html','cbb-game-center.html','cbb-gamefile.html']);
if(!pages.has(page))return;
const params=new URLSearchParams(location.search),women=params.get('gender')==='women';
const genderLink=(file,isWomen)=>file+(isWomen?'?gender=women':'');
const sections=[
 ['FRONT PAGE','ncaam.html'],['GAMES','ncaam-slate.html'],['LIVE','cbb-game-center.html'],
 ['RANKINGS','ncaam-elo.html'],['TEAMS','ncaam.html#teams'],['CONFERENCES','ncaam-conference.html']
];
const moreSections=[
 ['BRACKET WATCH','ncaam-tournament.html'],['PLAYER LEADERS','ncaam-players.html'],
 ['ARENA FILE','ncaam-arena.html'],['MATCHUP LAB','ncaam-predictor.html'],
 ['RIVALRIES','ncaam-rivalry.html'],['ELO HISTORY','ncaam-history.html'],
 ['ALL SPORTS','sports.html']];
const mk=(tag,cls,label)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(label!=null)el.textContent=label;return el};
const href=(target)=>{
 if(target==='sports.html')return target;
 const bits=target.split('#');
 return genderLink(bits[0],women)+(bits[1]?'#'+bits[1]:'');
};
const label=page.includes('gamefile')?'GAMEFILE':page.includes('center')?'COURTSIDE':page.includes('slate')?'DAILY SLATE':'NATIONAL DESK';
function boot(){
 const header=document.querySelector('header');if(!header)return;
 document.body.classList.add('cbb-product','cbb-header-v2');
 document.body.dataset.cbbEdition=page.includes('gamefile')?'gamefile':page.includes('center')?'live':page.includes('slate')?'slate':'front';
 // Remove *only* duplicate presentation controls, not any live-data components.
 header.querySelectorAll('.slt-courtside-network,.slt-broadcast-ribbon,.cbb-gender-bar,.cbb-product-ribbon,.cbb-product-switch').forEach(el=>el.remove());
 const legacyToggle=document.querySelector('.cbb-standalone>.cbb-switch');
 if(legacyToggle)legacyToggle.remove();
 const mast=header.querySelector('.slt-retro-masthead,.sl-masthead,.masthead');
 if(!mast)return;
 const oldTop=header.querySelector('.topline,.sl-meta');
 if(oldTop)oldTop.classList.add('cbb-legacy-topline');
 const legacyEdition=header.querySelector('.edition-line,.sl-masthead>span');
 if(legacyEdition)legacyEdition.classList.add('cbb-legacy-edition');
 const mastLink=mast.querySelector('a[href]');
 if(mastLink){
   mastLink.setAttribute('aria-label','Sporting Life and Times home');
   if(!mastLink.querySelector('.slt-brand-title')){
    mastLink.textContent='SPORTING LIFE AND TIMES';mastLink.classList.add('cbb-plain-masthead');
   }
 }
 const mastTitle=mast.querySelector('.slt-brand-title');
 if(mastTitle)mastTitle.textContent='SPORTING LIFE AND TIMES';
 const bar=mk('div','cbb-compact-identity');
 bar.setAttribute('aria-label','NCAA basketball edition');
 const mark=mk('strong','cbb-identity-mark','NCAA BASKETBALL');
 const subtitle=mk('span','cbb-identity-subtitle',(women?"WOMEN'S":"MEN'S")+' DIVISION I · '+label);
 const season=mk('span','cbb-identity-season','2026–27');
 bar.append(mark,subtitle,season);
 mast.insertAdjacentElement('afterend',bar);
 // A single accessible horizontal navigation; the long list lives in one compact MORE menu.
 let nav=header.querySelector('nav.nav,nav.sl-nav,nav[aria-label="College basketball navigation"]');
 if(!nav)nav=mk('nav','nav');
 nav.setAttribute('aria-label','College basketball sections');
 nav.classList.add('cbb-main-nav');
 nav.replaceChildren();
 for(const [title,target] of sections){
  const a=mk('a','cbb-main-link',title);a.href=href(target);
  if(target.split('#')[0]===page||(page==='college-basketball.html'&&target==='ncaam.html'))a.setAttribute('aria-current','page');
  nav.appendChild(a);
 }
 const more=mk('details','cbb-nav-more'),summary=mk('summary','cbb-nav-more-button','MORE');
 const dropdown=mk('div','cbb-nav-dropdown');
 more.append(summary,dropdown);
 for(const [title,target] of moreSections){
  const a=mk('a','cbb-nav-dropdown-link',title);a.href=href(target);dropdown.appendChild(a);
 }
 const navRow=mk('div','cbb-navigation');navRow.append(nav,more);
 const existing=header.querySelector('.cbb-navigation');
 if(existing)existing.replaceWith(navRow);else bar.insertAdjacentElement('afterend',navRow);
 const edition=mk('nav','cbb-compact-editions');
 edition.setAttribute('aria-label','Select basketball gender and division');
 const here=page==='cbb-gamefile.html'?'cbb-game-center.html':page==='college-basketball.html'?'ncaam.html':page;
 for(const [title,target,on] of [
  ['MEN',genderLink(here,false),!women],['WOMEN',genderLink(here,true),women],
  ['D-I',genderLink('ncaam.html',women),true],
  ['D-II',women?'d2-womens-basketball.html':'d2-mens-basketball.html',false],
  ['D-III',women?'d3-womens-basketball.html':'d3-mens-basketball.html',false]
 ]){
  const a=mk('a','cbb-edition-link',title);a.href=target;
  if(on)a.setAttribute('aria-current','page');
  edition.appendChild(a);
 }
 navRow.insertAdjacentElement('afterend',edition);
 if(page==='ncaam-slate.html'){
  const h= document.querySelector('.sl-hero h1');
  if(h)h.textContent='TODAY ON THE COURT';
 }
 // A single menu remains open; dismiss outside clicks and Escape on small screens.
 document.addEventListener('click',e=>{if(more.open&&!more.contains(e.target))more.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')more.open=false;});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
