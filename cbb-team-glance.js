/* Shared, verified at-a-glance register for men's and women's Division I team pages.
   Source ledgers are gender-isolated; no forecasts, exhibitions or disputed results. */
(function(){
'use strict';
const women=document.body?.dataset.page==='women-team'||/ncaaw-team\.html$/.test(location.pathname);
const teamId=new URLSearchParams(location.search).get('team')||
 (women?new URLSearchParams(location.search).get('id'):null);
if(!teamId)return;
const season='2026-27';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const score=x=>(typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=300)||
 (typeof x==='string'&&/^\d{1,3}$/.test(x)&&Number(x)<=300)?Number(x):null;
const inSeason=x=>String(x||'').slice(0,10)>='2026-11-01'&&String(x||'').slice(0,10)<='2027-04-30';
const get=async path=>{const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw Error('Published source '+res.status);return res.json();};
function unique(rows,key){
 const counts=new Map();
 for(const g of rows){const id=String(key(g)||'');if(id)counts.set(id,(counts.get(id)||0)+1);}
 return rows.filter(g=>{const id=String(key(g)||'');return !!id&&counts.get(id)===1;});
}
function result(g,homeId,awayId,homeScore,awayScore,id,date){
 if(!inSeason(date)||String(homeId)===String(awayId))return null;
 const home=String(homeId)===String(teamId),away=String(awayId)===String(teamId);
 if(home===away)return null;
 const h=score(homeScore),a=score(awayScore);
 if(h===null||a===null||h===a)return null;
 const ours=home?h:a,theirs=home?a:h;
 return {id:String(id),day:String(date).slice(0,10),for:ours,against:theirs,win:ours>theirs};
}
function menResults(retro,outside){
 if(retro?.season!==season||retro?.model!=='retro-clean-slate'||retro.starting_elo!==1500||
   !Array.isArray(retro.rankings)||retro.rankings.length!==365||!Array.isArray(retro.events)||
   retro.events.length!==retro.games_played)throw Error('Men’s verified RETRO ledger unavailable');
 const di=unique(retro.events,g=>g.id).map(g=>{
  if(!/^espn:\d+$/.test(String(g.id||'')))return null;
  return result(g,g.home_id,g.away_id,g.home_score,g.away_score,g.id,g.date);
 }).filter(Boolean);
 let other=[];
 if(outside?.season===season&&outside.counts_for_retro===false&&Array.isArray(outside.games)){
  other=unique(outside.games,g=>g.id).filter(g=>
   String(g.division_i_ncaa_id)===String(teamId)&&
   g.verified===true&&g.classification==='regular-season'&&g.counts_for_retro===false&&
   /^https:\/\/[^\s"'<>]+$/.test(g.source_url||'')&&
   score(g.team_score)!==null&&score(g.opponent_score)!==null&&
   score(g.team_score)!==score(g.opponent_score)).map(g=>({
    id:'espn:'+g.id,day:String(g.date||'').slice(0,10),
    for:Number(g.team_score),against:Number(g.opponent_score),win:Number(g.team_score)>Number(g.opponent_score)
   })).filter(g=>inSeason(g.day));
 }
 const ids=new Set(di.map(g=>g.id));
 const rows=di.filter(g=>String(retro.events.find(e=>e.id===g.id)?.home_id)===String(teamId)||
                         String(retro.events.find(e=>e.id===g.id)?.away_id)===String(teamId));
 return {games:rows.concat(other.filter(g=>!ids.has(g.id))),ranking:retro.rankings.find(r=>String(r.team_id)===String(teamId))||null};
}
function womenResults(master,ledger,ratings){
 if(ledger?.season!==season||!Array.isArray(ledger.games)||!master?.teams?.[teamId]||
   !window.WBBGameResults?.merge)throw Error('Women’s verified schedule/final ledger unavailable');
 // Reuse the newspaper’s exact match and conflict quarantine, never a score-only join.
 const merged=window.WBBGameResults.merge(master.teams[teamId].games||[],ledger,teamId);
 const occur=new Map();
 for(const g of ledger.games||[]){const id=String(g.id||'');occur.set(id,(occur.get(id)||0)+1);}
 const games=merged.games.filter(g=>g.completed===true&&!g.result_conflict&&g.result_provenance&&
  occur.get(String(g.id))===1).map(g=>result(g,g.home_id,g.away_id,g.home_score,g.away_score,g.id,g.date)).filter(Boolean);
 const rating=ratings?.season===season&&ratings?.gender==='women'&&
  ratings.model==='retro-clean-slate'&&ratings.rankings?.length===363?
  ratings.rankings.find(r=>String(r.team_id)===String(teamId)):null;
 return {games,ranking:rating||null};
}
function summary(data){
 const rows=data.games.slice().sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
 const wins=rows.filter(g=>g.win).length,losses=rows.length-wins;
 const pf=rows.reduce((v,g)=>v+g.for,0),pa=rows.reduce((v,g)=>v+g.against,0);
 let count=0;const last=rows[rows.length-1]?.win;
 for(let i=rows.length-1;i>=0&&rows[i].win===last;i--)count++;
 return {rows,wins,losses,ppg:rows.length?pf/rows.length:null,papg:rows.length?pa/rows.length:null,
  margin:rows.length?(pf-pa)/rows.length:null,streak:rows.length?(last?'W':'L')+count:'—',
  conference:data.ranking?
   String(data.ranking.conference_wins??0)+'–'+String(data.ranking.conference_losses??0):'—'};
}
const fmt=x=>x===null?'—':x.toFixed(1);
const signed=x=>x===null?'—':(x>0?'+':'')+x.toFixed(1);
function render(data){
 const s=summary(data);
 const recent=s.rows.slice(-5),dots=Array.from({length:Math.max(0,5-recent.length)},()=>
  '<span class="cbb-glance-dot cbb-glance-unplayed" title="No game" aria-hidden="true"></span>')
  .concat(recent.map(g=>'<span class="cbb-glance-dot '+(g.win?'cbb-glance-win':'cbb-glance-loss')+
   '" title="'+esc(g.day+' · '+(g.win?'Win':'Loss')+' '+g.for+'–'+g.against)+'" aria-hidden="true"></span>')).join('');
 const form=recent.length?recent.map(g=>g.win?'win':'loss').join(', '):'no verified finals';
 const stat=(label,value)=>'<div class="cbb-glance-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>';
 return '<div class="cbb-glance-title">2026–27 · Season at a glance</div>'+
  '<div class="cbb-glance-grid">'+
  stat('Overall',s.wins+'–'+s.losses)+stat('Conference',s.conference)+
  stat('Points for / game',fmt(s.ppg))+stat('Points against / game',fmt(s.papg))+
  stat('Average margin',signed(s.margin))+stat('Current streak',s.streak)+
  '<div class="cbb-glance-stat cbb-glance-form"><small>Last five · oldest to newest</small>'+
  '<div class="cbb-glance-dots" role="img" aria-label="Last five form: '+esc(form)+'">'+dots+'</div></div></div>'+
  '<p class="cbb-glance-source">Verified published finals only · '+(women?
   'women’s season ledger':'men’s Division I and separately verified non-Division I regular-season results')+
  ' · excludes exhibitions, forecasts and disputed scores.</p>';
}
let latest=null,loading=false;
function mount(){
 const anchor=document.querySelector(women?'#desk .wbb-kpis':'#app .team-hero');
 if(!anchor)return;
 let node=document.getElementById('cbb-team-glance');
 if(!node){node=document.createElement('section');node.id='cbb-team-glance';node.className='cbb-team-glance';
   node.setAttribute('aria-label','Team season at a glance');node.innerHTML='<p>Checking published season results…</p>';}
 if(anchor.nextElementSibling!==node)anchor.insertAdjacentElement('afterend',node);
 if(latest&&node.dataset.version!==latest){
   node.innerHTML=latest;node.dataset.version=latest;
 }
}
async function update(){
 if(loading||document.hidden)return;
 loading=true;
 try{
  let data;
  if(women){
   const [master,ledger,ratings]=await Promise.all([
    get('data/ncaaw-schedules-2026-27.json'),get('data/ncaaw-2026-27-verified-games.json'),
    get('data/ncaaw-2026-27-retro-primary.json').catch(()=>null)]);
   data=womenResults(master,ledger,ratings);
  }else{
   const [retro,outside]=await Promise.all([get('data/ncaam-2026-27-retro-primary.json'),
     get('data/mbb-non-di-verified-finals-2026-27.json').catch(()=>null)]);
   data=menResults(retro,outside);
  }
  latest=render(data);
  mount();
 }catch(e){
  const node=document.getElementById('cbb-team-glance');
  if(!latest&&node)node.innerHTML='<p>Verified season summary temporarily unavailable; no projected results substituted.</p>';
  console.warn('Team glance: '+e.message);
 }finally{loading=false;}
}
function start(){
 mount();
 const obs=new MutationObserver(mount);obs.observe(document.body,{childList:true,subtree:true});
 void update();
 setInterval(()=>{mount();void update();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){mount();void update();}});
 window.addEventListener('focus',()=>{mount();void update();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();