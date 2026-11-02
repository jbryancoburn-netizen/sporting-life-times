(()=>{'use strict';
const gender=document.body.dataset.gender==='women'?'women':'men';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs=new URLSearchParams(location.search);const $=id=>document.getElementById(id);
const colors=t=>{const good=v=>/^#[0-9a-f]{6}$/i.test(v||'');const a=good(t.primary)?t.primary:'#274c5e',b=good(t.secondary)&&t.secondary.toLowerCase()!==a.toLowerCase()?t.secondary:'#7895a0';return [a,b];};
const logo=t=>{let[a,b]=colors(t),slug=String(t.slug||'').replace(/[^a-z0-9-]/gi,'');return '<span class="conference-logo" style="--school-primary:'+a+';--school-secondary:'+b+'">'+(slug?'<img loading="lazy" alt="" src="https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg" onerror="this.remove()">':'')+'<small>'+esc(String(t.name||'?').split(/\s+/).slice(0,2).map(s=>s[0]).join(''))+'</small></span>';};
const teamLink=t=>'d2-team.html?gender='+gender+'&team='+encodeURIComponent(t.id);
const gamelink=g=>'d2-game.html?gender='+gender+'&game='+encodeURIComponent(g.id);
const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+'%':'—';
function conferenceRecords(members,games){const ids=new Set(members.map(t=>String(t.id)));const record=new Map(members.map(t=>[String(t.id),{w:0,l:0,elo:Number(t.elo)||1500}]));for(const g of games){if(g.status!=='final'||g.verified!==true||g.elo_eligible===false||!ids.has(String(g.away))||!ids.has(String(g.home)))continue;const a=Number(g.away_score),h=Number(g.home_score);if(!Number.isFinite(a)||!Number.isFinite(h)||a===h)continue;const winner=a>h?String(g.away):String(g.home),loser=a>h?String(g.home):String(g.away);record.get(winner).w++;record.get(loser).l++;}return record;}
async function init(){
 let payload;
 try{let response=await fetch('data/d2-'+gender+'-2026-27.json',{cache:'no-store'});if(!response.ok)throw Error('Data unavailable: '+response.status);payload=await response.json();}
 catch(e){$('conference-status').textContent='The verified game ledger is currently unavailable. '+e.message;return;}
 const teams=payload.teams.filter(t=>!t.not_eligible_for_dii_elo),byid=new Map(payload.teams.map(t=>[String(t.id),t]));
 const conferences=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const select=$('conference-picker');select.innerHTML=conferences.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 const requested=qs.get('conference');if(conferences.includes(requested))select.value=requested;
 const update=()=>{
  const conference=select.value;history.replaceState(null,'','?conference='+encodeURIComponent(conference));
  const members=teams.filter(t=>t.conference===conference);
  const records=conferenceRecords(members,payload.games);
  members.sort((a,b)=>{const x=records.get(String(a.id)),y=records.get(String(b.id));const xp=x.w+x.l?x.w/(x.w+x.l):-1,yp=y.w+y.l?y.w/(y.w+y.l):-1;return yp-xp||y.w-x.w||y.elo-x.elo||String(a.name).localeCompare(String(b.name));});
  const ids=new Set(members.map(t=>String(t.id)));
  const games=payload.games.filter(g=>ids.has(String(g.away))||ids.has(String(g.home))).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
  const finals=games.filter(g=>g.status==='final'&&g.verified===true);
  $('conference-title').textContent=conference;
  $('conference-status').textContent=members.length+' eligible schools · '+finals.length+' verified final games involving member schools · Conference table counts verified games between members only; tiebreakers pending official rules';
  $('conference-count').textContent=members.length+' member schools';
  $('conference-standings').innerHTML=members.map((t,i)=>{const r=records.get(String(t.id));return '<div class="conference-standing"><b>'+(i+1)+'</b>'+logo(t)+'<a href="'+teamLink(t)+'">'+esc(t.name)+'</a><span>'+r.w+'–'+r.l+'</span><span>'+pct(r.w,r.l)+'</span><strong>'+Math.round(r.elo)+'</strong></div>';}).join('');
  const date=($('schedule-filter').value||'');const subset=games.filter(g=>!date||g.date===date).slice(0,90);
  $('conference-schedule').innerHTML=subset.length?subset.map(g=>{const a=byid.get(String(g.away))||{id:g.away,name:g.away},h=byid.get(String(g.home))||{id:g.home,name:g.home};return '<a class="conference-game" href="'+gamelink(g)+'"><span>'+esc(g.date)+' · '+esc(g.status==='final'?'FINAL':g.status==='live'?'LIVE':g.start_time||'TIPOFF TBD')+(g.neutral?' · NEUTRAL':'')+'</span><div>'+logo(a)+'<b>'+esc(a.name)+'</b><strong>'+esc(g.status==='final'?g.away_score:'')+'</strong></div><div>'+logo(h)+'<b>'+esc(h.name)+'</b><strong>'+esc(g.status==='final'?g.home_score:'')+'</strong></div></a>'}).join(''):'<p class="note">No published games for this selection. This is not proof that a school has a complete schedule.</p>';
 };
 select.addEventListener('change',update);$('schedule-filter').addEventListener('change',update);update();
}
init();
})();