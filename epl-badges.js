/* One EPL badge owner: two explicit rings around untouched club artwork. */
(()=>{'use strict';
const clubs={359:['Arsenal','#ef0107','#063672'],362:['Aston Villa','#670e36','#95bfe5'],349:['Bournemouth','#da291c','#171717'],337:['Brentford','#d20000','#171717'],331:['Brighton','#0057b8','#f8bc1c'],363:['Chelsea','#034694','#dbb23a'],388:['Coventry','#77bbdd','#243f85'],384:['Crystal Palace','#1b458f','#c4122e'],368:['Everton','#003399','#e2ac31'],370:['Fulham','#111111','#cc0000'],306:['Hull','#f18a00','#171717'],373:['Ipswich','#0044a9','#de2c37'],357:['Leeds United','#1d428a','#ffcd00'],364:['Liverpool','#c8102e','#007f73'],382:['Manchester City','#6cabdd','#1c2c5b'],360:['Manchester United','#da291c','#171717'],361:['Newcastle United','#171717','#8bc8e8'],393:["Nott'm Forest",'#dd0000','#f7bd13'],366:['Sunderland','#eb172b','#171717'],367:['Tottenham','#132257','#a58a50']};
let queued=false;
function apply(img){
 const id=img.getAttribute('src')?.match(/\/teamlogos\/soccer\/(?:500|500-dark)\/(\d+)\.png/i)?.[1];
 if(!clubs[id])return;
 if(img.closest('.epl-badge'))return;
 const [name,primary,secondary]=clubs[id];
 img.dataset.sltMarkState='epl';img.dataset.eplBadgeImage=id;img.removeAttribute('onerror');
 // Retire a generic wrapper that may have run before this component.
 const old=img.parentElement;
 if(old?.classList.contains('slt-mark')){old.replaceWith(img);}
 const legacyFallback=img.nextElementSibling;
 if(legacyFallback?.matches('.epl-fallback'))legacyFallback.remove();
 let badge=img.parentElement?.matches('.epl-player-crest,.match-crest-badge')?img.parentElement:null;
 if(!badge){badge=document.createElement('span');img.before(badge);badge.append(img);}
 badge.classList.add('epl-badge');badge.dataset.eplClub=id;badge.style.setProperty('--epl-ring-primary',primary);badge.style.setProperty('--epl-ring-secondary',secondary);
 const letters=document.createElement('span');letters.className='epl-badge-fallback';letters.textContent=name.split(' ').map(x=>x[0]).join('').slice(0,3);letters.setAttribute('aria-hidden','true');badge.append(letters);
 img.alt=img.alt||name+' crest';
 const loaded=()=>{badge.classList.toggle('epl-badge-missing',!img.naturalWidth);};
 img.addEventListener('load',loaded);img.addEventListener('error',()=>badge.classList.add('epl-badge-missing'));
 if(img.complete)loaded();
}
function scan(){queued=false;document.querySelectorAll('img[src*="/teamlogos/soccer/"]').forEach(apply);}
const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});scan();
})();
