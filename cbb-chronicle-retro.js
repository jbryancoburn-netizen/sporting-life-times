/* Source-backed Chronicle RETRO desk. No invented scores, ratings or team crests. */
(()=>{'use strict';
const root=document.getElementById('chronicle-retro-panel');
if(!root)return;
const female=new URLSearchParams(location.search).get('gender')==='women' || document.body.dataset.gender==='women';
const file=female?'data/ncaaw-2026-27-retro-primary.json':'data/ncaam-2026-27-retro-primary.json';
const full=female?'ncaaw-rankings.html?poll=retro':'ncaam-elo.html';
const fullLink=document.getElementById('chronicle-retro-full-link');
if(fullLink)fullLink.href=full;
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
const value=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const valid=row=>row&&row.team&&Number.isFinite(Number(row.elo))&&Number.isInteger(Number(row.rank))&&Number(row.rank)>0;
const teamLink=row=>{
  const id=String(row.team_id||'');
  if(female)return /^\d+$/.test(id)?'ncaaw-team.html?team='+encodeURIComponent(id):'';
  return /^ncaa:\d+$/.test(id)?'ncaam-team.html?team='+encodeURIComponent(id):'';
};
const name=row=>{const href=teamLink(row);return href?'<a href="'+esc(href)+'">'+esc(row.team)+'</a>':esc(row.team)};
// Reuse the same vetted school identifiers, real artwork and two-color ring
// renderer used throughout the men's and women's basketball newspaper.
const crest=row=>{
  const logos=typeof window!=='undefined'?window.MBBLogos:null;
  if(!logos)return '';
  const id=String(row.team_id||'');
  if(female&&/^\d+$/.test(id))return logos.byESPN(id,'small',row.team);
  if(!female&&/^ncaa:\d+$/.test(id))return logos.byNCAA(id,'small',row.team);
  return '';
};
const row=(r,number,right)=>'<div class="chronicle-retro-row"><span class="chronicle-retro-number">'+esc(number)+'</span><span class="chronicle-retro-crest">'+crest(r)+'</span><span class="chronicle-retro-team">'+name(r)+'<small>'+esc(String(r.wins??'—'))+'–'+esc(String(r.losses??'—'))+' · '+esc(r.conference||'Division I')+'</small></span><strong class="chronicle-retro-value">'+esc(right)+'</strong></div>';
const heading=(source)=>source?'Through '+esc(source):'Latest verified snapshot';
function report(data){
  if(!data||!Array.isArray(data.rankings)||!data.rankings.length||!data.as_of)throw Error('No verified ratings snapshot');
  if(female&&data.gender!=='women')throw Error('Women’s RETRO source mismatch');
  if(!female&&data.gender==='women')throw Error('Men’s RETRO source mismatch');
  const all=data.rankings.filter(valid).slice().sort((a,b)=>Number(a.rank)-Number(b.rank));
  if(all.length<(female?350:350))throw Error('Incomplete Division I ratings');
  const best=all[0];
  const date=String(data.as_of);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Unverified rating date');
  const top=all.slice(0,4);
  const movers=all.filter(r=>Number.isFinite(Number(r.daily_change))&&Number(r.games_played)>0)
    .sort((a,b)=>Number(b.daily_change)-Number(a.daily_change));
  const rising=movers.filter(r=>Number(r.daily_change)>0).slice(0,2);
  const falling=movers.filter(r=>Number(r.daily_change)<0).reverse().slice(0,2);
  const trend=[...rising,...falling];
  const item=(r,i)=>row(r,Number(r.daily_change)>=0?'▲':'▼',(Number(r.daily_change)>=0?'+':'')+value(Number(r.daily_change),1));
  const standing=top.map((r,i)=>row(r,String(r.rank),value(Number(r.elo),1))).join('');
  const moves=trend.length?trend.map(item).join(''):'<p>No verified rating movement available for this edition.</p>';
  const record=Number.isFinite(Number(best.wins))&&Number.isFinite(Number(best.losses))?' ('+value(best.wins)+'–'+value(best.losses)+')':'';
  root.innerHTML='<p class="chronicle-retro-lead"><strong>'+esc(best.team)+'</strong>'+esc(record)+' leads this edition’s independent RETRO table at <strong>'+value(Number(best.elo),1)+'</strong>. Data through '+esc(date)+'.</p>'
    +'<div class="chronicle-retro-grid"><div class="chronicle-retro-column"><h3>The National Table</h3>'+standing+'<p class="chronicle-retro-caption">RETRO rank · rating · season record</p></div>'
    +'<div class="chronicle-retro-column"><h3>Rating Movement</h3>'+moves+'<p class="chronicle-retro-caption">Largest positive and negative daily changes among teams with completed games. These are rating-point movements, not projected margins.</p></div></div>'
    +'<p class="chronicle-retro-caption">Source: '+esc(data.model||'RETRO')+' · '+heading(date)+' · '+value(all.length)+' Division I programs. Ratings use verified results; model estimates are not final scores.</p>';
}
async function refresh(){
  try{
    const request=await fetch(file+'?chronicle='+Math.floor(Date.now()/300000),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!request.ok)throw Error('Ratings feed unavailable');
    const data=await request.json();
    // Wait for the shared identity registry before constructing actual team
    // crests, rather than briefly showing placeholders or invented initials.
    if(typeof window!=='undefined'&&window.MBBLogos?.ready)await window.MBBLogos.ready;
    report(data);
  }catch(error){
    if(root.querySelector('.chronicle-retro-grid'))return; // Keep last authenticated report through an outage.
    root.innerHTML='<p class="chronicle-news-empty">The '+(female?'women’s':'men’s')+' RETRO report is temporarily unavailable. <a href="'+esc(full)+'">Open the complete rankings</a> for its published source date.</p>';
  }
}
const menu=document.querySelector('nav.chronicle-nav .chronicle-more');
if(menu){
  document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false});
  document.addEventListener('keydown',event=>{if(menu.open&&event.key==='Escape'){menu.open=false;menu.querySelector('summary')?.focus()}});
  menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false});
}
refresh();
setInterval(()=>{if(!document.hidden)refresh()},10*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();