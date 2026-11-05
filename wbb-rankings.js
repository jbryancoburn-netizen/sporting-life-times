/* Published women-only 363-team rankings; no false NET / AP / Pomeroy substitutes. */
(async()=>{'use strict';
const $=x=>document.querySelector(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const record=t=>t&&Number.isFinite(Number(t.overall_wins??t.wins))&&Number.isFinite(Number(t.overall_losses??t.losses))?(t.overall_wins??t.wins)+'–'+(t.overall_losses??t.losses):'—';
const poll=new URLSearchParams(location.search).get('poll')||'retro';
const types={retro:'Women’s RETRO Rankings',net:'Women’s NCAA NET Rankings',ap:'Women’s AP Poll',coaches:'Women’s Coaches Poll',kenpom:'Women’s Pomeroy Ratings'};
const kind=types[poll]?poll:'retro';
$('#wbbr-title').textContent=types[kind];document.title=types[kind]+' | Sporting Life & Times';
for(const a of document.querySelectorAll('.wbbr-tabs a'))if(new URL(a.href).searchParams.get('poll')===kind)a.setAttribute('aria-current','page');
if(kind==='ap'||kind==='coaches'){
 $('#wbbr-controls').hidden=true;
 try{
  await window.MBBLogos.ready;
  const req=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('Source unavailable');return r.json()};
  const [published,directory,ratings]=await Promise.all([req('data/ncaaw-2026-27-national-polls.json'),req('data/ncaaw-2026-27-teams.json'),req('data/ncaaw-2026-27-retro-primary.json').catch(()=>null)]);
  if(published.gender!=='women'||published.season!=='2026-27'||published.polls?.[kind]?.rankings?.length!==25)throw Error('Verified poll unavailable');
  const pollData=published.polls[kind],teams=directory.teams||[];
  const byRecord=new Map((ratings?.rankings||[]).map(t=>[String(t.team_id),t]));
  const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  // Official women-specific directory resolves poll abbreviations before crest and record lookup.
  const aliases={'UConn':'UConn','USC':'USC','Ole Miss':'Ole Miss','NC State':'NC State','TCU':'TCU','LSU':'LSU'};
  const mascots={'Michigan':'Wolverines','Michigan State':'Spartans','Oklahoma':'Sooners','Oklahoma State':'Cowgirls','South Carolina':'Gamecocks','North Carolina':'Tar Heels','NC State':'Wolfpack','USC':'Trojans','UConn':'Huskies','Ole Miss':'Rebels','LSU':'Tigers','TCU':'Horned Frogs'};
  function resolveTeam(label){
   const stem=aliases[label]||label, prefix=norm(stem);
   const candidates=teams.filter(t=>norm(t.team).startsWith(prefix));
   const mascot=mascots[stem];
   if(mascot){const exact=candidates.find(t=>norm(t.team).endsWith(norm(mascot)));if(exact)return exact;}
   const boundary=teams.filter(t=>String(t.team).toLowerCase().startsWith(stem.toLowerCase()+' '));
   if(boundary.length===1)return boundary[0];
   return candidates.length===1?candidates[0]:null;
  }
  function womenLogo(school,label){
   if(!school)return window.MBBLogos.byName(label,'score');
   const name=school.team,id=String(school.team_id);
   const shared=window.MBBLogos.byESPN(id,'score',name);
   if(shared.includes('<img ')&&!shared.includes('mbb-mark--missing'))return shared;
   // Some women's school identities are absent from the men's crest crosswalk.
   // Use the actual women's directory logo, never an unrelated men's lookup.
   const source=String(school.logo||'');
   if(!/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/ncaa\/500\/\d+\.png$/.test(source))return shared;
   return '<span class="mbb-mark mbb-mark--score mbb-mark--art-flat wbbr-women-mark" style="--mbb-primary:#385866;--mbb-secondary:#597582" role="img" aria-label="'+esc(name)+' logo" data-ring-count="2"><span class="mbb-mark__initials" aria-hidden="true">'+esc(name.slice(0,1))+'</span><img class="mbb-mark__img" src="'+esc(source)+'" loading="lazy" decoding="async" alt=""></span>';
  }
  $('#wbbr-status').innerHTML=esc(pollData.title)+' · '+esc(published.type)+' · '+esc(pollData.published_at||published.as_of)+' · <a href="'+esc(pollData.source_url)+'" target="_blank" rel="noopener noreferrer">'+esc(pollData.source)+'</a>';
  $('#wbbr-list').innerHTML=pollData.rankings.map(item=>{
   const school=resolveTeam(item.team);
   const logo=womenLogo(school,item.team);
   const name=school?'<a href="ncaaw-team.html?team='+encodeURIComponent(school.team_id)+'">'+esc(school.team)+'</a>':'<span class="wbbr-unresolved">'+esc(item.team)+'</span>';
   const current=school?byRecord.get(String(school.team_id)):null;
   return '<article class="wbbr-entry" data-team-id="'+esc(school?.team_id||'')+'"><strong class="wbbr-number">#'+esc(item.rank)+'</strong>'+logo+'<div class="wbbr-identity">'+name+'</div><div class="wbbr-value" aria-label="Season record">'+esc(current?record(current):'—')+'</div></article>';
  }).join('');
  // The published poll positions stay fixed until the next verified poll;
  // team records independently refresh from the latest women's RETRO finals.
  async function refreshRecords(){
   try{
    const next=await req('data/ncaaw-2026-27-retro-primary.json?refresh='+Date.now());
    if(next.gender!=='women'||next.season!=='2026-27')return;
    const byId=new Map((next.rankings||[]).map(t=>[String(t.team_id),t]));
    for(const row of document.querySelectorAll('#wbbr-list .wbbr-entry[data-team-id]')){
     const team=byId.get(row.dataset.teamId),cell=row.querySelector('.wbbr-value');
     if(team&&cell)cell.textContent=record(team);
    }
   }catch(e){console.warn('Women’s poll records refresh unavailable',e)}
  }
  const refreshTimer=setInterval(refreshRecords,60000);
  window.addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true});
 }catch(e){$('#wbbr-status').textContent='Women’s poll unavailable: '+e.message;$('#wbbr-list').innerHTML='';}
 return;
}
if(kind!=='retro'){
 $('#wbbr-controls').hidden=true;
 $('#wbbr-status').textContent='No current verified 2026–27 women’s '+kind.toUpperCase()+' table is published here. RETRO is never substituted for outside rankings.';
 $('#wbbr-list').innerHTML='<p class="wbbr-note"><a href="?poll=retro">See women’s RETRO ratings →</a></p>';
 return;
}

try{
 await window.MBBLogos.ready;
 const req=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' unavailable');return r.json()};
 const [ratings,directory]=await Promise.all([req('data/ncaaw-2026-27-retro-primary.json'),req('data/ncaaw-2026-27-teams.json')]);
 if(ratings.gender!=='women'||ratings.season!=='2026-27'||ratings.rankings?.length!==363||directory.teams?.length!==363)throw Error('Women’s 363-team ratings source did not validate');
 const rows=ratings.rankings,byId=new Map(directory.teams.map(t=>[String(t.team_id),t]));
 const con= $('#wbbr-conf');for(const name of [...new Set(rows.map(r=>r.conference))].filter(Boolean).sort())con.add(new Option(name,name));
 $('#wbbr-status').textContent='Women-only RETRO · 363 Division I programs · Updated '+(ratings.as_of||'when verified finals are published')+'. Ratings begin at 1500 and change only after verified women’s games.';
 const render=()=>{
  const selected=con.value,order=$('#wbbr-order').value;
  let data=rows.filter(t=>!selected||t.conference===selected).slice();
  data.sort((a,b)=>order==='team'?a.team.localeCompare(b.team):order==='wins'?Number(b.wins||0)-Number(a.wins||0)||Number(a.rank||0)-Number(b.rank||0):order==='elo'?Number(b.elo||0)-Number(a.elo||0):Number(a.rank||0)-Number(b.rank||0));
  $('#wbbr-count').textContent=data.length+' schools';
  $('#wbbr-list').innerHTML=data.map(t=>{
    const school=byId.get(String(t.team_id))||t;
    const name=t.team||school.team||'School',overallRecord=record(t);
    return '<article class="wbbr-entry"><strong class="wbbr-number">#'+esc(t.rank)+'</strong>'+
      window.MBBLogos.byESPN(String(t.team_id),'score',name)+
      '<div class="wbbr-identity"><a href="ncaaw-team.html?team='+encodeURIComponent(t.team_id)+'">'+esc(name)+'</a><small>'+esc(t.conference||'Conference unverified')+'</small></div>'+
      '<div class="wbbr-value">'+esc(overallRecord)+'<small>RETRO '+Math.round(Number(t.elo)).toLocaleString('en-US')+'</small></div></article>';
  }).join('');
 };
 con.addEventListener('change',render);$('#wbbr-order').addEventListener('change',render);render();
}catch(e){$('#wbbr-status').textContent='Published women’s ratings temporarily unavailable. No other dataset has been substituted.';$('#wbbr-list').textContent=e.message;}
})();