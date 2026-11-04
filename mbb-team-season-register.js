/* Historical register and tournament resume: evidence-backed, independently refreshed. */
(function(){
'use strict';
if(document.body.dataset.page!=='team')return;
const teamId=new URLSearchParams(location.search).get('team');
if(!teamId)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fetchJSON=async path=>{try{const res=await fetch(path,{cache:'no-store'});return res.ok?await res.json():null}catch{return null}};
const stat=(label,value)=>'<div class="march-resume-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
const asNumber=n=>Number.isFinite(Number(n))?Number(n):null;
const selected=()=>document.querySelector('#season-switcher [aria-pressed="true"]')?.dataset.season||'current';
const venue=g=>g.neutral===true?'neutral':g.site_verified===true?'home/away verified':'site unverified';
function quad(rank,site){
 if(!Number.isInteger(rank)||rank<1)return 0;
 if(site==='home')return rank<=30?1:rank<=75?2:rank<=160?3:4;
 if(site==='away')return rank<=75?1:rank<=135?2:rank<=240?3:4;
 if(site==='neutral')return rank<=50?1:rank<=100?2:rank<=200?3:4;
 return 0;
}
async function update(){
 const [retro,net]=await Promise.all([
 fetchJSON('data/ncaam-2026-27-retro-primary.json'),
 fetchJSON('data/mbb-official-net-2026-27.json')]);
 const root=document.getElementById('season-register-desk');if(!root)return;
 if(!retro||retro.season!=='2026-27'||retro.model!=='retro-clean-slate'||!Array.isArray(retro.events))return;
 const ranking=retro.rankings.find(x=>x.team_id===teamId);
 if(!ranking)return;
 const games=retro.events.filter(g=>g.home_id===teamId||g.away_id===teamId);
 const home=games.filter(g=>g.home_id===teamId&&!g.neutral).length;
 const road=games.filter(g=>g.away_id===teamId&&!g.neutral).length;
 const roadWins=games.filter(g=>g.away_id===teamId&&!g.neutral&&Number(g.away_score)>Number(g.home_score)).length;
 const netValid=net?.season==='2026-27'&&net?.verified===true&&Array.isArray(net?.rankings)&&net.source_url&&net.as_of;
 const netRanks=new Map(netValid?net.rankings.filter(x=>Number.isInteger(x.rank)&&x.rank>0).map(x=>[x.team_id,x.rank]):[]);
 const ownNET=netRanks.get(teamId);
 const qs=Array.from({length:4},()=>({w:0,l:0}));let qualified=0;
 if(netValid)for(const g of games){
  const isHome=g.home_id===teamId,other=isHome?g.away_id:g.home_id,oppRank=netRanks.get(other);
  const site=g.neutral===true?'neutral':g.site_verified===true?(isHome?'home':'away'):'';
  const q=quad(oppRank,site);if(!q)continue;qualified++;
  if(Number(isHome?g.home_score:g.away_score)>Number(isHome?g.away_score:g.home_score))qs[q-1].w++;else qs[q-1].l++;
 }
 const projected=document.querySelector('.team-hero')?.nextElementSibling?.querySelectorAll('.metric');
 let seed='—';
 for(const el of document.querySelectorAll('#app .metric')){
  if(el.textContent.includes('Projected NCAA placement'))seed=el.querySelector('b')?.textContent?.trim()||'—';
 }
 const latest=esc(retro.as_of||'unavailable');
 const current='<p class="march-resume-status">2026–27 · Verified RETRO results through '+latest+'</p>'+
 '<div class="march-resume-stats">'+stat('Overall',ranking.wins+'–'+ranking.losses)+stat('Road victories',roadWins+' / '+road)+stat('RETRO rank','#'+ranking.rank)+stat('RETRO Elo',Math.round(ranking.elo))+stat('Projected NCAA position',seed)+'</div>'+
 '<h3>Official NET &amp; quadrant ledger</h3>'+
 '<div class="march-resume-stats">'+stat('Official NET',ownNET?'#'+ownNET:'Not published')+
 (netValid?qs.map((q,i)=>stat('Quad '+(i+1),q.w+'–'+q.l)).join(''):stat('Quad 1–4','Awaiting verified NET'))+'</div>'+
 '<p class="note">'+(netValid?'Quadrants calculated from verified NET rankings and verified game locations; '+qualified+' matchups eligible.':'Official NET and quadrant records require independently verified NCAA NET rankings. RETRO is never substituted for NET.')+'</p>'+
 '<p class="note">Projected placement is a RETRO forecast, not a committee designation. <a href="ncaam-tournament.html">Bracket watch →</a></p>';
 root.querySelector('#season-current').innerHTML=current;
 root.querySelector('#season-last').innerHTML='<p class="march-resume-status">2025–26 · Historical archive</p><p class="note">The previous season remains separate from the clean-slate 2026–27 RETRO model. The original historical register below contains available archived Elo and roster-continuity information.</p>';
 const previous=root.closest('.column')?.querySelector('#historical-archive-panel');
 if(previous)previous.hidden=selected()!=='last';
 root.querySelector('#season-current').hidden=selected()!=='current';
 root.querySelector('#season-last').hidden=selected()!=='last';
 root.querySelector('.march-refresh').textContent='Updated '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function mount(){
 const headings=[...document.querySelectorAll('#app .panel .panel-head')];
 const march=headings.find(x=>x.textContent.includes('The March File'))?.closest('.panel');
 const historical=headings.find(x=>x.textContent.includes('Last Season at a Glance'))?.closest('.panel');
 if(!march||!historical||document.querySelector('#season-register-desk'))return false;
 historical.id='historical-archive-panel';historical.hidden=true;
 march.id='season-register-desk';
 march.innerHTML='<div class="panel-head"><div class="eyebrow">The selection ledger</div><h2>Season Register &amp; The March File</h2></div>'+
 '<div id="season-switcher" role="group" aria-label="Select season"><button type="button" data-season="current" aria-pressed="true">2026–27 · This season</button><button type="button" data-season="last" aria-pressed="false">2025–26 · Last season</button></div>'+
 '<div id="season-current"><p class="note">Loading verified résumé…</p></div><div id="season-last" hidden></div><p class="march-refresh note"></p>';
 march.querySelectorAll('#season-switcher button').forEach(b=>b.addEventListener('click',()=>{
  march.querySelectorAll('#season-switcher button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  historical.hidden=b.dataset.season!=='last';
  march.querySelector('#season-current').hidden=b.dataset.season!=='current';
  march.querySelector('#season-last').hidden=b.dataset.season!=='last';
 }));
 update();setInterval(update,300000);
 return true;
}
if(!mount()){const obs=new MutationObserver(()=>{if(mount())obs.disconnect()});obs.observe(document.getElementById('app'),{childList:true,subtree:true});}
})();
