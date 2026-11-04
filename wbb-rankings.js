/* Published women-only 363-team rankings; no false NET / AP / Pomeroy substitutes. */
(async()=>{'use strict';
const $=x=>document.querySelector(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const poll=new URLSearchParams(location.search).get('poll')||'retro';
const types={retro:'Women’s RETRO Rankings',net:'Women’s NCAA NET Rankings',ap:'Women’s AP Poll',coaches:'Women’s Coaches Poll',kenpom:'Women’s Pomeroy Ratings'};
const kind=types[poll]?poll:'retro';
$('#wbbr-title').textContent=types[kind];document.title=types[kind]+' | Sporting Life & Times';
for(const a of document.querySelectorAll('.wbbr-tabs a'))if(new URL(a.href).searchParams.get('poll')===kind)a.setAttribute('aria-current','page');
if(kind!=='retro'){
 $('#wbbr-controls').hidden=true;
 $('#wbbr-status').textContent='There is no verified, rights-cleared 2026–27 women’s '+(kind==='kenpom'?'Pomeroy':kind.toUpperCase())+' ranking dataset published in this newspaper yet. These systems will not display fabricated RETRO values in place of their own rankings.';
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