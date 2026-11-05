/* Men's Daily Ledger: keep the sourced TV label and press entry on every upcoming card.
   Narrow integration: leave game status, results, RETRO, and regular refreshes untouched. */
(function(){
'use strict';
const host=document.getElementById('sl-games');
if(!host)return;
const verified=new Map([["401909726","ESPN2"],["401917177","BTN"],["401916287","Peacock"],["401919804","truTV"],["401925754","Peacock"],["401909491","ESPN+"],["401913526","FS1"],["401909501","truTV"],["401909739","truTV"],["401925031","ESPN+"],["401909563","ACC Network"],["401906770","SEC Network+"],["401906864","SEC Network+"],["401909717","ACCNX"],["401921747","ESPN+"],["401921094","ESPN+"]]);
const pending=v=>!String(v||'').trim()||/^(?:TV\s*)?(?:TBA|TBD|unknown|not announced|network unverified)$/i.test(String(v).trim());
function school(el){
 if(!el)return '';
 const copy=el.cloneNode(true);
 copy.querySelectorAll('.ledger26-poll').forEach(x=>x.remove());
 return (copy.textContent||'').trim();
}
function apply(){
 for(const card of host.querySelectorAll('.ledger26-card')){
  const details=card.querySelector('details[data-game-id]');
  if(!details)continue;
  const scorebug=card.querySelector('.ledger26-scorebug');
  if(!scorebug||!scorebug.querySelector('[data-phase="upcoming"]'))continue;
  const id=String(details.dataset.gameId||'').replace(/^espn:/,'');
  let meta=card.querySelector('.ledger26-meta');
  if(!meta){meta=document.createElement('div');meta.className='ledger26-meta';card.insertBefore(meta,details);}
  let right=meta.querySelector('.ledger26-network');
  if(!right){right=document.createElement('span');right.className='ledger26-network';meta.appendChild(right);}
  const network=verified.get(id);
  let networkLabel=right.querySelector('.slt-ledger-network-text');
  if(!networkLabel){
   networkLabel=document.createElement('span');
   networkLabel.className='slt-ledger-network-text';
   networkLabel.textContent=(right.childNodes.length?right.firstChild?.textContent:'')||'Network unverified';
   right.textContent='';
   right.appendChild(networkLabel);
  }
  if(network&&pending(networkLabel.textContent))networkLabel.textContent=network;
  else if(!network&&pending(networkLabel.textContent))networkLabel.textContent='Network unverified';
  let button=card.querySelector('[data-slt-preview-open]');
  if(!button){
   button=document.createElement('button');button.type='button';
   button.setAttribute('data-slt-preview-open','');
   button.textContent='PREGAME PRESS ›';
   const names=scorebug.querySelectorAll('.ledger26-name');
   button.dataset.sltPressAway=school(names[0]);
   button.dataset.sltPressHome=school(names[1]);
   button.dataset.sltPressGender='men';
  }
  // A button inside <summary> can be swallowed by the native disclosure control.
  // Relocate it alongside the verified network, outside the disclosure.
  if(button.parentElement!==right){
   button.classList.remove('ledger26-preview-link');
   button.classList.add('slt-press-inline');
   right.appendChild(button);
  }
 }
}
let queued=false;
function queue(){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;apply()});
}
const observer=new MutationObserver(queue);
observer.observe(host,{subtree:true,childList:true});
queue();
async function sync(){
 try{
  const response=await fetch('data/cbb-verified-broadcasts-2026-27.json',{cache:'no-store'});
  if(response.ok){
   const body=await response.json();
   for(const e of body.entries||[])if(e?.id&&e?.network)verified.set(String(e.id),String(e.network));
  }
 }catch(e){/* The embedded source-backed snapshot protects known listings. */}
 queue();
}
sync();
setInterval(()=>{if(!document.hidden)sync()},300000);
})();