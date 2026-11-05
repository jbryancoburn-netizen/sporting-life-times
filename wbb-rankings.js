/* Published women-only 363-team rankings; no false NET / AP / Pomeroy substitutes. */
(async()=>{'use strict';
const $=x=>document.querySelector(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  const [published,directory]=await Promise.all([req('data/ncaaw-2026-27-national-polls.json'),req('data/ncaaw-2026-27-teams.json')]);
  if(published.gender!=='women'||published.season!=='2026-27'||published.polls?.[kind]?.rankings?.length!==25)throw Error('Verified poll unavailable');
  const pollData=published.polls[kind],teams=directory.teams||[];
  const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const aliases={'UConn':'Connecticut','USC':'Southern California','Ole Miss':'Mississippi','NC State':'North Carolina State','TCU':'Texas Christian','LSU':'Louisiana State'};
  $('#wbbr-status').innerHTML=esc(pollData.title)+' · '+esc(published.type)+' · '+esc(published.as_of)+' · <a href="'+esc(pollData.source_url)+'" target="_blank" rel="noopener noreferrer">'+esc(pollData.source)+'</a>';
  $('#wbbr-list').innerHTML=pollData.rankings.map(item=>{
   const target=norm(aliases[item.team]||item.team);
   const school=teams.find(t=>norm(t.team).startsWith(target));
   const logo=school?window.MBBLogos.byESPN(String(school.team_id),'score',school.team):window.MBBLogos.byName(item.team,'score');
   const name=school?'<a href="ncaaw-team.html?team='+encodeURIComponent(school.team_id)+'">'+esc(school.team)+'</a>':esc(item.team);
   return '<article class="wbbr-entry"><strong class="wbbr-number">#'+item.rank+'</strong>'+logo+'<div class="wbbr-identity">'+name+'</div><div class="wbbr-value">TOP 25</div></article>';
  }).join('');
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
    const name=t.team||school.team||'School',record=(t.wins||0)+'–'+(t.losses||0);
    return '<article class="wbbr-entry"><strong class="wbbr-number">#'+esc(t.rank)+'</strong>'+
      window.MBBLogos.byESPN(String(t.team_id),'score',name)+
      '<div class="wbbr-identity"><a href="ncaaw-team.html?team='+encodeURIComponent(t.team_id)+'">'+esc(name)+'</a><small>'+esc(t.conference||'Conference unverified')+'</small></div>'+
      '<div class="wbbr-value">'+Math.round(Number(t.elo)).toLocaleString('en-US')+'<small>'+esc(record)+'</small></div></article>';
  }).join('');
 };
 con.addEventListener('change',render);$('#wbbr-order').addEventListener('change',render);render();
}catch(e){$('#wbbr-status').textContent='Published women’s ratings temporarily unavailable. No other dataset has been substituted.';$('#wbbr-list').textContent=e.message;}
})();