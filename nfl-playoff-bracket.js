(()=>{"use strict";
const root=document.getElementById("nfl-app");
if(!root||document.body.dataset.page!=="playoffs")return;
let edition=null,selected=null,lastSignature="";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const record=t=>[t.w||0,t.l||0,t.t||0].join("–");
const pct=t=>Number(t.pct)||0;
const order=(a,b)=>pct(b)-pct(a)||(b.w||0)-(a.w||0)||(Number(b.elo)||0)-(Number(a.elo)||0);
function seeded(conf){const all=edition.teams.filter(t=>t.conference===conf),divisions=["East","North","South","West"];
const leaders=divisions.map(d=>all.filter(t=>t.division===conf+" "+d).sort(order)[0]).filter(Boolean).sort(order);
const wild=all.filter(t=>!leaders.some(q=>q.id===t.id)).sort(order).slice(0,3);
return [...leaders,...wild].map((t,i)=>({...t,seed:i+1,wildcard:i>=4}));}
function badge(t){return t&&t.logo?'<img src="'+esc(t.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="brk-unknown">◆</span>';}
function entry(t,label){return '<div class="brk-team '+(t?'':'brk-tbd')+'">'+(t?'<span class="brk-seed">'+t.seed+'</span>'+badge(t)+'<span class="brk-team-name">'+esc(t.name)+'</span><span class="brk-record">'+record(t)+'</span>':'<span class="brk-placeholder">'+esc(label||"To be determined")+'</span>')+'</div>';}
function matchup(id,a,b,stage,label){const selectedClass=selected===id?' is-selected':'';
return '<button type="button" class="brk-match'+selectedClass+'" data-brk="'+esc(id)+'" aria-label="'+esc(label)+': '+esc(a?.name||"TBD")+' versus '+esc(b?.name||"TBD")+'" aria-pressed="'+(selected===id?'true':'false')+'"><span class="brk-match-cap">'+esc(label)+'</span>'+entry(a,stage==="wild"?"": "Winner to advance")+entry(b,stage==="wild"?"":"Winner to advance")+'</button>';}
function conference(conf){const s=seeded(conf),get=n=>s[n-1],name=conf.toLowerCase();
return '<section class="brk-conference" aria-label="'+conf+' projected bracket"><h3><span>'+conf+'</span> <small>PROJECTED CONFERENCE FIELD</small></h3><div class="brk-columns">'+
'<div class="brk-round"><h4>Wild Card</h4>'+matchup(name+"-wc-1",get(2),get(7),"wild","No. 2 v No. 7")+matchup(name+"-wc-2",get(3),get(6),"wild","No. 3 v No. 6")+matchup(name+"-wc-3",get(4),get(5),"wild","No. 4 v No. 5")+'</div>'+
'<div class="brk-round"><h4>Divisional</h4><div class="brk-bye">'+entry(get(1))+'<p>FIRST-ROUND BYE</p></div>'+matchup(name+"-div-1",null,null,"future","Highest seed v lowest surviving seed")+matchup(name+"-div-2",null,null,"future","Remaining advancing teams")+'</div>'+
'<div class="brk-round"><h4>'+conf+' Championship</h4>'+matchup(name+"-champ",null,null,"future","Conference final")+'</div></div></section>';}
function superBowl(){return '<section class="brk-super"><img class="brk-super-logo" src="https://assets.onlocationexp.com/prod/images/Super%20Bowl%20LXI%20Logo.png" alt="Official Super Bowl LXI logo" loading="lazy"><p>THE ROAD TO THE LOMBARDI TROPHY</p><h3>SUPER BOWL LXI</h3>'+matchup("super",null,null,"future","AFC Champion v NFC Champion")+'<small>Conference champions appear when determined. No simulated result is presented as official.</small></section>';}
function make(){const heading='<div class="brk-heading"><div><p class="brk-eyebrow">THE POSTSEASON · 2026 SEASON</p><h2>THE ROAD TO THE SUPER BOWL</h2><p>Interactive projected field · 14 clubs · seven per conference · No. 1 seeds receive a bye</p></div><span class="brk-seal">SL<span>&</span>T<br>PLAYOFF DESK</span></div>';
return '<section id="nfl-bracket" class="brk-paper" aria-label="Interactive projected NFL playoff bracket">'+heading+
'<div class="brk-disclaimer"><strong>PROJECTED BRACKET — NOT OFFICIAL SEEDING.</strong> Seeds follow current conference standings with division leaders first and three wild cards; Elo is a simplified tie-break proxy. This is a snapshot, not the NFL’s complete tiebreaking procedure. The bracket updates when the published season ledger updates.</div>'+
'<div class="brk-layout">'+conference("AFC")+superBowl()+conference("NFC")+'</div>'+
'<div class="brk-details" id="brk-details" aria-live="polite">Select any Wild Card matchup to see its clubs, records and links to team pages. Future rounds are reseeded after the Wild Card round and cannot yet be assigned.</div>'+
'<p class="brk-footnote">Playoff probabilities and Super Bowl forecasts are available in the simulation tables below. Click a club name in the matchup details to open its team page.</p></section>';}
function detail(id){if(!edition)return;const match=/^(afc|nfc)-wc-([123])$/.exec(id);const target=document.getElementById("brk-details");if(!target)return;
if(!match){target.innerHTML='<strong>Round not yet decided.</strong> The NFL reseeds after Wild Card weekend: the No. 1 seed hosts the lowest remaining seed. Winning teams and confirmed fixtures populate later rounds only after results are available.';return;}
const s=seeded(match[1].toUpperCase()),pair=[[2,7],[3,6],[4,5]][Number(match[2])-1],a=s[pair[0]-1],b=s[pair[1]-1];
target.innerHTML='<strong>'+esc(match[1].toUpperCase())+' Wild Card · '+a.seed+' v '+b.seed+'</strong><div class="brk-detail-clubs">'+[a,b].map(t=>'<a href="nfl-team.html?team='+encodeURIComponent(t.id)+'">'+badge(t)+'<span>'+esc(t.name)+'<small>Seed '+t.seed+' · '+record(t)+' · RETRO '+Math.round(Number(t.elo)||1500)+'</small></span><span aria-hidden="true">↗</span></a>').join('')+'</div><p>Provisional pairing based on current standings. Home advantage goes to the higher seed; the actual postseason matchup is subject to NFL tiebreakers.</p>';}
function mount(){if(!edition||!root.querySelector(".nfl-sim"))return;
const newSig=JSON.stringify(edition.teams.map(t=>[t.id,t.w,t.l,t.t,t.pct,t.elo]));
const old=root.querySelector("#nfl-bracket");if(old&&lastSignature===newSig)return;
if(old)old.remove();lastSignature=newSig;
const target=root.querySelector(".nfl-sim");target.insertAdjacentHTML("beforebegin",make());
root.querySelectorAll("[data-brk]").forEach(el=>el.addEventListener("click",()=>{selected=el.dataset.brk;root.querySelectorAll("[data-brk]").forEach(b=>{b.classList.toggle("is-selected",b.dataset.brk===selected);b.setAttribute("aria-pressed",String(b.dataset.brk===selected));});detail(selected);}));
if(selected)detail(selected);
}
const observer=new MutationObserver(()=>{if(!root.querySelector("#nfl-bracket")||!root.querySelector(".nfl-sim")){observer.disconnect();mount();observer.observe(root,{childList:true});}});
observer.observe(root,{childList:true});
async function reload(){try{const r=await fetch("data/nfl-2026-edition.json?bracket="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("ledger unavailable");const d=await r.json();if(!Array.isArray(d.teams)||d.teams.length!==32)return;edition=d;mount();}catch(e){/* Keep the original simulation tables usable. */}}
reload();setInterval(()=>{if(!document.hidden)reload()},60000);
})();