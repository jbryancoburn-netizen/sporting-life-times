/* Shared CFB snapshot, FBS membership, scoring statistics, and crest identity. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const conf=n=>/sun belt/i.test(n)?'Sun Belt':/mid-american/i.test(n)?'MAC':/american/i.test(n)?'American':/atlantic coast/i.test(n)?'ACC':/southeastern/i.test(n)?'SEC':/big ten/i.test(n)?'Big Ten':/big 12/i.test(n)?'Big 12':/mountain west/i.test(n)?'Mountain West':/pac-12/i.test(n)?'Pac-12':/conference usa/i.test(n)?'Conference USA':/independent/i.test(n)?'Independent':n;
const G6=['American','Conference USA','MAC','Mountain West','Pac-12','Sun Belt'];
const stat=(e,name)=>e.stats?.find(s=>s.name===name)?.displayValue??null;
const record=s=>{const m=String(s||'').match(/^(\d+)-(\d+)(?:-(\d+))?$/);return m?{w:+m[1],l:+m[2],t:+(m[3]||0),text:m[0]}:null};
const pct=r=>r&&(r.w+r.l+r.t)>0?(r.w+r.t/2)/(r.w+r.l+r.t):0;
function groups(node,parent=null,out=[]){
 const name=conf(node.name||parent||'');const entries=node.standings?.entries||node.entries;
 if(entries?.length){let g=out.find(g=>g.name===name);if(!g)out.push(g={name,entries:[]});g.entries.push(...entries)}
 for(const child of node.children||[])groups(child,name,out);return out;
}
const load=()=>fetch('data/cfb-2026-results.json?ts='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async r=>{
 if(!r.ok)throw Error('Results HTTP '+r.status);const p=await r.json();
 if(p.audit?.season!==2026||!p.audit?.complete||p.audit.games!==p.games?.length||p.audit.errors?.length)throw Error('Results snapshot failed verification');
 if(!p.feeds?.standings?.data)throw Error('Standings snapshot unavailable');
 const gs=groups(p.feeds.standings.data),brands=new Map((p.feeds.teams?.data?.sports?.[0]?.leagues?.[0]?.teams||[]).map(x=>[String(x.team.id),x.team]));
 const teams=new Map();for(const g of gs)for(const e of g.entries){const id=String(e.team.id),b=brands.get(id)||{},t=e.team;teams.set(id,{id,name:t.shortDisplayName||t.displayName,full:t.displayName,conference:g.name,color:b.color,secondary:b.alternateColor,logo:t.logos?.[0]?.href||b.logos?.[0]?.href||'',record:record(stat(e,'overall')),confRecord:record(stat(e,'vs. Conf.')),entry:e})}
 const scoring=new Map();for(const g of p.games)for(const t of g.teams){const opp=g.teams.find(x=>String(x.id)!==String(t.id));const id=String(t.id);const s=scoring.get(id)||{gp:0,pf:0,pa:0,w:0,l:0};s.gp++;s.pf+=Number(t.score);s.pa+=Number(opp.score);s.w+=t.score>opp.score?1:0;s.l+=t.score<opp.score?1:0;scoring.set(id,s)}
 for(const [id,s] of scoring){s.ppg=s.pf/s.gp;s.papg=s.pa/s.gp;s.margin=(s.pf-s.pa)/s.gp}
 return {payload:p,groups:gs,teams,scoring};
});
/* School-color rings: preserve verified alternates; never invent generic gold. */
const color=v=>{const s=String(v||'').replace(/^#/,'').toLowerCase();return /^[a-f\d]{6}$/.test(s)?'#'+s:null};
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const nearWhite=hex=>hex&&channels(hex).every(n=>n>=218);
const distance=(a,b)=>Math.sqrt(channels(a).reduce((sum,n,i)=>sum+(n-channels(b)[i])**2,0));
const shade=hex=>{const rgb=channels(hex),bright=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000;
  const factor=bright<115?.32:-.30;
  const next=rgb.map(v=>Math.min(255,Math.max(0,Math.round(factor>0?v*(1-factor)+255*factor:v*(1+factor)))));
  return '#'+next.map(v=>v.toString(16).padStart(2,'0')).join('');
};
function ringColors(t){const primary=color(t?.color)||color(t?.primary)||'#203b49';
  const supplied=color(t?.secondary)||color(t?.alternateColor);
  const secondary=!supplied||nearWhite(supplied)||distance(primary,supplied)<36?shade(primary):supplied;
  return {primary,secondary};
}
/* The only ring painter for the entire CFB edition: two SVG bands, no CSS border layers. */
function ringArtwork(primary,secondary){return '<svg class="cfb-ring-art" viewBox="0 0 100 100" focusable="false" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="'+primary+'"/><circle cx="50" cy="50" r="44" fill="'+secondary+'"/><circle cx="50" cy="50" r="38" fill="#fff"/></svg>'}
function logoInitials(t){const abbr=String(t?.abbreviation||t?.abbr||'').trim();if(abbr)return abbr.slice(0,4).toUpperCase();const name=String(t?.name||t?.shortDisplayName||t?.full||t?.displayName||'TEAM').trim().replace(/\([^)]*\)/g,'');return (name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('')||'T').toUpperCase()}
function imageMarkup(url,t){return '<span class="cfb-logo-fallback" aria-hidden="true">'+esc(logoInitials(t))+'</span><img data-cfb-logo="1" loading="eager" decoding="async" alt="" src="'+esc(url)+'">'}
document.addEventListener('load',e=>{const img=e.target;if(img?.getAttribute?.('data-cfb-logo')==='1')img.previousElementSibling?.classList?.add('is-hidden')},true);
document.addEventListener('error',e=>{const img=e.target;if(img?.getAttribute?.('data-cfb-logo')==='1'){img.style.display='none';img.previousElementSibling?.classList?.remove('is-hidden')}},true);
function crest(t){const {primary,secondary}=ringColors(t);return '<span class="cfb-crest" style="--primary:'+primary+';--secondary:'+secondary+'">'+ringArtwork(primary,secondary)+imageMarkup(t?.logo||'https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(t?.id||'')+'.png',t)+'</span>'}
const link=t=>'<a class="team-identity" href="cfb-team.html?team='+encodeURIComponent(t.id)+'">'+crest(t)+'<span>'+esc(t.name)+'</span></a>';
const rating=t=>window.CFB_RATINGS?.[t.id]?.adjustedElo;
const ranked=a=>[...a].filter(t=>Number.isFinite(rating(t))).sort((a,b)=>rating(b)-rating(a)||a.id.localeCompare(b.id));
let lastLoad=Date.now(),promise=load();
window.CFB_DESK={get promise(){if(Date.now()-lastLoad>240000){lastLoad=Date.now();promise=load()}return promise},esc,conf,G6,record,pct,ringColors,ringArtwork,imageMarkup,crest,link,rating,ranked};
})();
