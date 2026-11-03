/* Optional NCAA.com play log experiment. Never replaces live scoreboard data.
   One manual request per verified NCAA game / minute / visitor. Fail closed. */
(function(global){
'use strict';
const BASE='https://ncaa-api.henrygd.me/game/';
const cache=new Map(),pending=new Set();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\x27':'&#39;'}[c]));
const goodId=v=>/^\d{5,9}$/.test(String(v??''));
const pick=(o,keys)=>{for(const k of keys)if(typeof o?.[k]==='string'&&o[k].trim())return o[k].trim();return '';};
function parse(data){
 if(!Array.isArray(data?.periods))return [];
 let rows=[];
 for(const [i,period] of data.periods.entries()){
   const events=period?.playbyplayStats||period?.plays||[];
   if(!Array.isArray(events))continue;
   for(const block of events){
     // The NCAA GraphQL feed may group individual plays within a stat object.
     const plays=Array.isArray(block?.plays)?block.plays:[block];
     for(const e of plays){
       const text=pick(e,['description','playDescription','playText','play_by_play_text','text','summary','action','eventDescription','eventDesc']);
       if(!text||text.length>350)continue;
       const clock=pick(e,['clock','gameClock','time','timeRemaining','gameTime','clockDisplayValue']);
       const periodNumber=Number(period?.periodNumber||period?.number||i+1);
       rows.push({text,clock,period:periodNumber});
     }
   }
 }
 const seen=new Set();
 rows=rows.filter(x=>{const k=x.period+'|'+x.clock+'|'+x.text;if(seen.has(k))return false;seen.add(k);return true;});
 return rows.slice(-16).reverse();
}
function render(root,game,raw){
 if(!root||!goodId(game?.ncaaId)||game?.disputed||game?.phase==='upcoming')return;
 const id=String(game.ncaaId),cached=cache.get(id);
 const entries=cached?.items||[];
 const playable=raw?.plays?.items||raw?.plays||[];
 const espnHasPlays=Array.isArray(playable)&&playable.some(x=>typeof x?.text==='string');
 // The ESPN live play feed is preferred. NCAA detail is a limited, explicitly requested supplement.
 root.innerHTML='<section class="cbb-ncaa-pilot"><div><b>NCAA EVENT CROSS-CHECK</b><small>'+
   (espnHasPlays?'An optional second source for additional context':'Check for missing play-by-play coverage')+
   '</small></div><button type="button" data-ncaa-fetch '+(pending.has(id)?'disabled':'')+
   '>'+(pending.has(id)?'CHECKING…':'CHECK NCAA PLAY LOG')+'</button>'+
   (cached?'<p class="cbb-ncaa-status">'+esc(cached.message)+'</p>':'')+
   (entries.length?'<ol>'+entries.map(x=>'<li><time>'+esc((Number.isFinite(x.period)?'P'+x.period+' ':'')+x.clock)+'</time><span>'+esc(x.text)+'</span></li>').join('')+'</ol>':'')+
   '<small class="cbb-ncaa-credit">Experimental community API · NCAA.com sourced · may be unavailable. ESPN game score remains authoritative for live display.</small></section>';
 root.querySelector('[data-ncaa-fetch]')?.addEventListener('click',async()=>{
   if(pending.has(id))return;
   const previous=cache.get(id);
   if(previous&&Date.now()-previous.at<60000){render(root,game,raw);return;}
   pending.add(id);render(root,game,raw);
   try{
     const r=await fetch(BASE+encodeURIComponent(id)+'/play-by-play',
       {cache:'no-store',signal:AbortSignal.timeout(8500),credentials:'omit'});
     if(!r.ok)throw new Error('NCAA service HTTP '+r.status);
     const items=parse(await r.json());
     cache.set(id,{at:Date.now(),items,message:items.length?
       'NCAA game '+id+' · '+items.length+' recent attributed events; not independently timed live':
       'No usable play-by-play returned by the NCAA service.'});
   }catch(e){cache.set(id,{at:Date.now(),items:[],message:'NCAA detail temporarily unavailable. ESPN CourtCast stays active.'});}
   finally{pending.delete(id);if(root.isConnected)render(root,game,raw);}
 });
}
global.SLTNCAAPilot={mount:render,parse};
})(window);
