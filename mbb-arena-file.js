/* Sporting Life & Times — Arena File.
 * Source-gated editorial venue profiles for 365 D-I men's programs.
 * The official arena registry does not establish today's game location. */
(function(root,make){
 const api=make();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof document!=='undefined')api.boot();
})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const allowedURL=x=>/^https:\/\/[^\s"'<>]+$/.test(String(x||''))?String(x):'';
 function compose(team,registry,features){
  const venue=registry?.teams?.[String(team?.espn_id)]||{};
  const editorial=features?.features?.[String(team?.espn_id)]||{};
  const arena=String(editorial.arena_name||venue.home_arena||'').trim();
  const official=allowedURL(venue.home_arena_source);
  const profileSources=Array.isArray(editorial.sources)?editorial.sources.filter(s=>allowedURL(s.url)):[];
  const photo=editorial.photo&&allowedURL(editorial.photo.url)&&allowedURL(editorial.photo.source_url)&&
    allowedURL(editorial.photo.license_url)?editorial.photo:null;
  return {team,arena:arena||'Home arena not yet verified',verified:!!arena,
    city:editorial.city||null,state:editorial.state||null,address:editorial.address||null,
    capacity:Number.isInteger(editorial.capacity)&&editorial.capacity>0?editorial.capacity:null,
    opened:Number.isInteger(editorial.opened_year)?editorial.opened_year:null,
    rededicated:editorial.rededicated||null,history:editorial.history||null,
    opening:editorial.opened_context||null,distinctive:editorial.distinctive||null,
    photo,sources:profileSources,
    official,hasDeepProfile:!!editorial.history,
    note:'The verified home arena may not be the site of an upcoming or neutral-site game.'};
 }
 const box=(label,value)=>'<div class="af-fact"><small>'+esc(label)+'</small><strong>'+
   (value!==null&&value!==undefined?esc(value):'Not verified')+'</strong></div>';
 const visual=p=>p.photo?'<figure class="af-photo"><img loading="lazy" decoding="async" src="'+esc(p.photo.url)+
     '" alt="'+esc(p.photo.title)+'"><figcaption>'+esc(p.photo.display_note)+'<br><a href="'+esc(p.photo.source_url)+
     '" target="_blank" rel="noopener noreferrer">'+esc(p.photo.credit)+'</a> · <a href="'+esc(p.photo.license_url)+
     '" target="_blank" rel="noopener noreferrer">'+esc(p.photo.copyright)+'</a></figcaption></figure>':
    '<div class="af-illustrated" role="img" aria-label="Editorial illustration of arena seating, not an actual photograph">'+
    '<span class="af-roof"></span><span class="af-bleachers"></span><span class="af-court"></span>'+
    '<span class="af-illustrated-label">ILLUSTRATED ARENA STUDY<br>PHOTOGRAPH PENDING RIGHTS REVIEW</span></div>';
 function page(p){
  const title=p.arena,team=p.team;
  const city=p.city?[p.city,p.state].filter(Boolean).join(', '):null;
  const intro=p.hasDeepProfile?'THE ARENA FILE / VERIFIED HISTORY':'THE ARENA FILE / VERIFIED HOME COURT';
  return '<div class="af-banner"><span>'+esc(intro)+'</span><a href="ncaam-team.html?team='+
    encodeURIComponent(team.espn_id)+'">← '+esc(team.name)+' team desk</a></div>'+
   '<header class="af-heading"><div><p class="af-pretitle">THE SPORTING LIFE & TIMES / WHERE BASKETBALL LIVES</p>'+
   '<h1>'+esc(title)+'</h1><p class="af-subheading">'+esc(team.name)+' <span>•</span> '+esc(city||'Location research pending')+
   '</p></div><div class="af-identity"><span>'+esc(team.name)+'</span><strong>THE HOME COURT</strong></div></header>'+
   '<section class="af-layout"><div class="af-picture-column">'+visual(p)+
   '<div class="af-sources"><h2>Evidence file</h2><p>Only verifiable venue facts appear above. '+
   'Additional history, seating details, and photography are published when documented.</p>'+
   (p.official?'<a href="'+esc(p.official)+'" target="_blank" rel="noopener noreferrer">Original university arena source ↗</a>':'')+
   p.sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>').join('')+
   '</div></div><div class="af-information">'+
   '<div class="af-stats">'+box('CAPACITY',p.capacity===null?null:p.capacity.toLocaleString('en-US'))+
   box('OPENED',p.opened)+box('LOCATION',city)+box('2016 REDEDICATION',p.rededicated)+'</div>'+
   '<div class="af-story"><span class="af-overline">BENEATH THE RAFTERS</span><h2>'+
   (p.hasDeepProfile?'A living basketball landmark':'A home court with a story still being sourced')+'</h2>'+
   '<p>'+esc(p.history||'We have confirmed the team’s listed home arena, but a source-verified history has not yet been published in the Arena File. No capacity, attendance, or architectural features are assumed.')+'</p>'+
   (p.opening?'<p>'+esc(p.opening)+'</p>':'')+
   (p.address?'<p class="af-address"><strong>Find it:</strong> '+esc(p.address)+'</p>':'')+
   '<aside class="af-verification"><strong>Editorial distinction</strong><p>'+esc(p.note)+'</p></aside>'+
   '</div>'+
   '<div class="af-links"><a href="ncaam-team.html?team='+encodeURIComponent(team.espn_id)+'">Team schedule & ratings ↗</a>'+
   '<a href="ncaam-slate.html">Today’s basketball slate ↗</a></div>'+
   '</div></section>';
 }
 async function load(){
  const paths=['data/ncaam-2026-27-espn-team-crosswalk.json','data/mbb-arena-registry.json','data/mbb-arena-features.json'];
  return Promise.all(paths.map(async p=>{const r=await fetch(p,{cache:'default'});if(!r.ok)throw Error('Arena source '+p+': '+r.status);return r.json()}));
 }
 function teamFromParam(cross,params){const id=String(params.get('team')||'84');
  return (cross?.teams||[]).find(t=>String(t.espn_id)===id||t.id===id)||null}
 function optionList(cross,search){
  const q=String(search||'').trim().toLowerCase();
  return (cross.teams||[]).filter(t=>!q||String(t.name+' '+t.espn_name).toLowerCase().includes(q))
   .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,50)
   .map(t=>'<a href="ncaam-arena.html?team='+encodeURIComponent(t.espn_id)+'">'+esc(t.name)+
    '<span>'+esc(t.espn_name||'')+'</span></a>').join('');
 }
 async function boot(){
   const app=document.getElementById('af-root'),inline=document.getElementById('af-inline');
   if(!app&&!inline)return;
   try{
    const [cross,registry,features]=await load();
    if(app){
      const query=new URLSearchParams(location.search),team=teamFromParam(cross,query);
      if(!team)throw Error('That school is not in the Division I registry.');
      const profile=compose(team,registry,features);
      document.title=profile.arena+' | Arena File | The Sporting Life & Times';
      app.innerHTML='<div class="af-find"><label for="af-search">FIND A SCHOOL</label>'+
       '<input id="af-search" type="search" autocomplete="off" placeholder="Find any of 365 men’s Division I arenas…">'+
       '<div id="af-options" class="af-options" hidden></div></div>'+page(profile);
      const input=document.getElementById('af-search'),options=document.getElementById('af-options');
      input.addEventListener('input',()=>{options.innerHTML=optionList(cross,input.value);options.hidden=!input.value.trim()});
      const palette=await fetch('data/dual-ring-team-palette.json').then(x=>x.json()).catch(()=>null);
      const tone=palette?.mbb?.[String(team.espn_id)];
      if(tone?.primary?.match(/^#[0-9a-f]{6}$/i)){app.style.setProperty('--af-primary',tone.primary)}
      if(tone?.secondary?.match(/^#[0-9a-f]{6}$/i)){app.style.setProperty('--af-secondary',tone.secondary)}
    }
    if(inline){
      const query=new URLSearchParams(location.search),team=teamFromParam(cross,query);
      if(!team)return;
      const p=compose(team,registry,features);
      inline.innerHTML='<div class="af-inline-card"><span class="af-overline">THE ARENA FILE</span>'+
       '<div class="af-inline-title"><div><h2>'+esc(p.arena)+'</h2><p>'+esc(p.city?[p.city,p.state].join(', '):
       'Home court verified; city profile pending')+
       ' · '+esc(p.capacity===null?'Capacity research pending':p.capacity.toLocaleString('en-US')+' seats')+
       '</p></div><a href="ncaam-arena.html?team='+encodeURIComponent(team.espn_id)+
       '">Explore the arena →</a></div></div>';
    }
   }catch(e){
    if(app)app.innerHTML='<div class="af-error"><strong>Arena sources unavailable</strong><p>'+esc(e.message)+
      '</p><a href="ncaam.html">Return to college basketball ↗</a></div>';
    if(inline)inline.textContent='';
   }
 }
 return {compose,optionList,teamFromParam,boot};
});
