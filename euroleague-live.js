(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const host=document.getElementById('el-live-scorebugs'),status=document.getElementById('el-live-status');
if(!host||!status)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const et=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
let lastGood=null;
const day = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const picker=document.getElementById('el-score-date');
const filter=document.getElementById('el-score-filter');
if(!picker||!filter)return;
const search=document.getElementById('el-score-search');
picker.value=day(Date.now());
for(const button of document.querySelectorAll('[data-el-day-step]')){
 button.addEventListener('click',()=>{
  const next=new Date(picker.value+'T12:00:00Z');
  if(!Number.isFinite(next.getTime()))return;
  next.setUTCDate(next.getUTCDate()+Number(button.dataset.elDayStep));
  picker.value=next.toISOString().slice(0,10);
  render();
 });
}
search?.addEventListener('input',()=>render());
let currentFeed=null,currentModel=null;
picker.addEventListener('change',()=>render());
filter.addEventListener('change',()=>render());

const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const fixed=(v,n=0)=>valid(v)?Number(v).toFixed(n):'—';
const clubName=t=>String(t?.name||t?.code||'Unknown club');
const smallStat=(name,value)=>'<div class="el-live-stat"><small>'+esc(name)+'</small><strong>'+esc(value)+'</strong></div>';
const clubMap=new Map(),recordMap=new Map();
const profile=t=>clubMap.get(String(t?.code||'').toUpperCase())||null;
const record=t=>recordMap.get(String(t?.code||'').toUpperCase())||profile(t);
const wins=t=>{const s=record(t);return s&&valid(s.wins)&&valid(s.losses)?s.wins+'–'+s.losses:null;};
const elo=t=>{const s=profile(t);return s&&valid(s.elo)?Math.round(Number(s.elo)):null;};
const perGame=(t,k)=>{const s=profile(t);return s&&valid(s[k])&&Number(s.played)>0?(Number(s[k])/Number(s.played)).toFixed(1):null;};
const netGame=t=>{const s=profile(t);return s&&valid(s.for)&&valid(s.against)&&Number(s.played)>0?((Number(s.for)-Number(s.against))/Number(s.played)).toFixed(1):null;};
const clubMeta=t=>[wins(t),elo(t)!==null?'Elo '+elo(t):null].filter(Boolean).join(' · ');
const compared=(title,rows,game)=>'<div class="el-live-stat-section"><h4>'+esc(title)+'</h4><div class="el-live-comparison-head"><b>Statistic</b><b>'+esc(game.away?.code||'Away')+'</b><b>'+esc(game.home?.code||'Home')+'</b></div>'+rows.map(row=>'<div class="el-live-comparison-row"><span>'+esc(row[0])+'</span><strong>'+esc(row[1]??'—')+'</strong><strong>'+esc(row[2]??'—')+'</strong></div>').join('')+'</div>';
const seasonComparison=g=>{
 const a=g.away,h=g.home;
 const rows=[['Record',wins(a),wins(h)],['Independent Elo',elo(a),elo(h)],['Scoring average',perGame(a,'for'),perGame(h,'for')],['Points allowed / game',perGame(a,'against'),perGame(h,'against')],['Net points / game',netGame(a),netGame(h)]];
 return rows.some(x=>x[1]!=null||x[2]!=null)?compared('Current-season comparison · verified results',rows,g):'';
};
const officialComparison=g=>{
 const a=g.team_stats?.away||g.away?.stats||g.boxscore?.away||null,h=g.team_stats?.home||g.home?.stats||g.boxscore?.home||null;
 if(!a&&!h)return '';
 const fields=[['FG%',['fg_pct','field_goal_pct']],['3PT%',['three_pct','three_point_pct']],['FT%',['ft_pct','free_throw_pct']],['Rebounds',['rebounds','total_rebounds']],['Assists',['assists']],['Turnovers',['turnovers']],['Steals',['steals']],['Blocks',['blocks']],['Fouls',['fouls','personal_fouls']]];
 const lookup=(o,keys)=>{for(const key of keys)if(valid(o?.[key]))return Number(o[key]);return null;};
 const rows=fields.map(([name,keys])=>{
  const av=lookup(a,keys),hv=lookup(h,keys);
  const pctValue=v=>v==null?null:(v<=1?v*100:v).toFixed(1)+'%';
  return [name,name.endsWith('%')?pctValue(av):av,name.endsWith('%')?pctValue(hv):hv];
 }).filter(row=>row[1]!=null||row[2]!=null);
 return rows.length?compared('Verified in-game team statistics',rows,g):'';
};
const forecastComparison=(g,pred)=>{
 const p=pred?.projection,prob=Number(pred?.home_win_probability);
 if(!pred)return '';
 const rows=[];
 if(valid(pred.home_win_probability)&&prob>=0&&prob<=1){rows.push(['Pregame '+clubName(g.away)+' win chance',((1-prob)*100).toFixed(1)+'%']);rows.push(['Pregame '+clubName(g.home)+' win chance',(prob*100).toFixed(1)+'%']);}
 if(valid(p?.away))rows.push(['Projected '+clubName(g.away)+' points',fixed(p.away)]);
 if(valid(p?.home))rows.push(['Projected '+clubName(g.home)+' points',fixed(p.home)]);
 if(valid(p?.total))rows.push(['Projected total',fixed(p.total)]);
 if(valid(p?.spread_home))rows.push(['Projected '+clubName(g.home)+' spread',(Number(p.spread_home)>0?'+':'')+fixed(p.spread_home)]);
 return rows.length?'<section class="el-live-stat-section"><h4>Independent pregame forecast</h4>'+rows.map(r=>'<div class="el-live-forecast-line"><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>').join('')+'<p class="el-live-unavailable">Elo projections are pregame estimates, not live win probabilities or official betting lines.</p></section>':'';
};

async function refresh(){
try{
 const sources=['https://raw.githubusercontent.com/jbryancoburn-netizen/sporting-life-times/main/data/euroleague-live.json','data/euroleague-live.json'];
 const feeds=await Promise.all(sources.map(async src=>{
   try{
     const response=await fetch(src+'?cb='+Date.now(),{cache:'no-store'});
     if(!response.ok)return null;
     const data=await response.json();
     if(!Array.isArray(data.games)||!Number.isFinite(Date.parse(data.checked_at||data.updated_at)))return null;
     return data;
   }catch(_error){return null;}
 }));
 const d=feeds.filter(Boolean).sort((a,b)=>Date.parse(b.checked_at||b.updated_at)-Date.parse(a.checked_at||a.updated_at))[0];
 if(!d)throw Error('Neither live-score publication is available');
 currentModel=await fetch('data/euroleague-model.json?live='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>currentModel);
 currentFeed=d;
 render();
 lastGood=d;
}catch(e){
 status.textContent=lastGood?'Live feed temporarily unavailable · Keeping last verified snapshot':'Live scores are unavailable.';
}
}
function render(){
 const d=currentFeed,forecast=currentModel;
 if(!d)return;
 const checked=Date.parse(d.checked_at||d.updated_at),stale=Date.now()-checked>15*60*1000;
 const logo=t=>/^[A-Z]{3}$/.test(String(t?.code||'').toUpperCase())?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(String(t.code).toUpperCase())+'" alt="'+esc(t.name||t.code)+' crest" src="assets/euroleague-logos/'+esc(String(t.code).toUpperCase())+'.png">':'';
 const query=search?.value.trim().toLowerCase()||'';
 const dailyGames=d.games.filter(g=>Number.isFinite(Date.parse(g.date))&&day(g.date)===picker.value);
 const games=dailyGames
  .filter(g=>!query||[g.away,g.home].some(t=>clubName(t).toLowerCase().includes(query)||String(t?.code||'').toLowerCase().includes(query)))
  .filter(g=>filter.value==='all'||g.status===filter.value)
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 clubMap.clear();recordMap.clear();
 for(const item of forecast?.rankings||[])clubMap.set(String(item.code).toUpperCase(),item);
 for(const item of forecast?.standings||[])recordMap.set(String(item.code).toUpperCase(),item);
 const byId=new Map((forecast?.fixtures||[]).map(g=>[String(g.id),g]));
 const expanded=new Set([...host.querySelectorAll('details[open][data-game-id]')].map(el=>el.dataset.gameId));
 host.innerHTML=games.map(g=>{
 const scoreStamp=Date.parse(g.score_updated_at||''),scoreFresh=Number.isFinite(scoreStamp)&&Date.now()-scoreStamp<=15*60*1000;
 const freshLive=g.status==='live'&&!stale&&scoreFresh;
 const label=freshLive?'LIVE':g.status==='final'?'FINAL':g.status==='awaiting_final'?'AWAITING FINAL':g.status==='live'?'LAST REPORTED':g.status==='scheduled'&&Date.parse(g.date)<Date.now()?'STATUS PENDING':'UPCOMING';
 const a=Number(g.away?.score),h=Number(g.home?.score),scored=g.away?.score!=null&&g.home?.score!=null;

 const periods=Array.isArray(g.period_scores)?g.period_scores.filter(q=>Number.isFinite(q.home)&&Number.isFinite(q.away)):[];
 const pred=byId.get(String(g.id));
 const probability=Number(pred?.home_win_probability);
 const quarterRows=periods.length?'<div class="el-quarter-table"><div class="el-quarter-head"><span>TEAM</span>'+periods.map(q=>'<span>'+esc(Number(q.period)>4?'OT'+(Number(q.period)-4):'Q'+q.period)+'</span>').join('')+'<strong>TOTAL</strong></div><div class="el-quarter-row"><b>'+esc(g.away.code)+'</b>'+periods.map(q=>'<span>'+esc(q.away)+'</span>').join('')+'<strong>'+esc(g.away.score??'—')+'</strong></div><div class="el-quarter-row"><b>'+esc(g.home.code)+'</b>'+periods.map(q=>'<span>'+esc(q.home)+'</span>').join('')+'<strong>'+esc(g.home.score??'—')+'</strong></div></div>':'<p class="el-live-unavailable">Quarter scores pending official confirmation.</p>';
 const margin=scored?'<div class="el-live-stat"><small>Lead</small><strong>'+Math.abs(a-h)+' pts</strong></div>':'';
 const total=scored?'<div class="el-live-stat"><small>Combined score</small><strong>'+(a+h)+'</strong></div>':'';
 const verifiedStats=officialComparison(g);
 const info='<div class="el-live-detail-inner"><h4>QUARTER-BY-QUARTER</h4>'+quarterRows+'<div class="el-live-detail-stats">'+margin+total+'</div>'+seasonComparison(g)+forecastComparison(g,pred)+verifiedStats+(!verifiedStats?'<p class="el-live-unavailable">Verified shooting, rebounding and player box scores are not yet provided by the official live feed. Season scoring averages above are not live game statistics.</p>':'')+'</div>';
 const detail=freshLive?g.status_detail||'In progress':g.status==='live'?'Last verified score · '+(Number.isFinite(scoreStamp)?et(g.score_updated_at):'time unavailable'):'';
 const rankCounts=new Map();
 for(const club of forecast?.rankings||[]){const pos=Number(club.rank);if(Number.isInteger(pos))rankCounts.set(pos,(rankCounts.get(pos)||0)+1);}
 const letterTeam=t=>{
  const p=profile(t),hex=t.primary||p?.primary||'';
  return {name:clubName(t),score:scored?t.score:null,crest:logo(t),
   color:/^#[a-f0-9]{6}$/i.test(hex)?hex:'#66503a',
   record:wins(t)||'Record pending',
   retro:window.SLTSportsScorebug?.formatRetro(p,rankCounts,20)||'RETRO —'};
 };
 const phase=g.status==='final'?'final':freshLive||scored?'live':'upcoming';
 const projected=pred?.projection,homeFavorite=probability>=.5;
 const pick=g.status==='scheduled'&&label==='UPCOMING'&&valid(pred?.home_win_probability)?{
  probability:homeFavorite?probability:1-probability,
  team:clubName(homeFavorite?g.home:g.away),
  margin:valid(projected?.spread_home)?Number(projected.spread_home):null,
  projectedAwayScore:valid(projected?.away)?Number(projected.away):null,
  projectedHomeScore:valid(projected?.home)?Number(projected.home):null
 }:null;
 const card=window.SLTSportsScorebug?.render({
  phase,gender:'euroleague',periodFormat:'quarters',gameId:String(g.id),status:detail||label,away:letterTeam(g.away),home:letterTeam(g.home),
  compactFinal:true,pulseManagedExternally:true,liveStatusOverride:phase==='live'&&!freshLive?label:'',
  tipoff:label==='UPCOMING'?et(g.date)+' ET':label,
  suppressMonogram:true,suppressPress:true,suppressTipoffFallback:true,pulseCompactOnly:true,forecast:pick
 })||'<p class="hub-small">Scorebug unavailable.</p>';
 return '<article class="el-live-card ledger26-card">'+
  '<div class="ledger26-meta"><span>'+esc(g.venue||'')+'</span><span>'+esc(phase==='upcoming'?'':et(g.date)+' ET')+'</span></div>'+
  '<details class="ledger26-expand" data-game-id="'+esc(g.id)+'"><summary class="ledger26-summary">'+
  card+'<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+
  '<div class="ledger26-expanded">'+info+
  '<p class="ledger26-detail-note">Official result feed · '+(scoreFresh?'Updated '+esc(et(g.score_updated_at)):'Latest published snapshot')+'</p>'+
  '</div></details></article>';
 }).join('')||'<p class="hub-small">No games for this date and status in the published feed.</p>';
 host.querySelectorAll('details[data-game-id]').forEach(el=>{if(expanded.has(el.dataset.gameId))el.open=true});
 const officialLive=Number(d.header_responses)||0;
 const activeWindow=d.games.some(g=>['live','awaiting_final'].includes(g.status)||(g.status==='scheduled'&&Date.parse(g.date)<=Date.now()&&Date.now()-Date.parse(g.date)<5*3600000));
 const providerNote=d.provider_degraded?' · Official live-stat provider degraded; displaying last verified scores':officialLive===0&&activeWindow?' · Official in-game updates not confirmed; showing published scores only':'';
 const pending=dailyGames.filter(g=>g.status==='awaiting_final'||(g.status==='scheduled'&&Date.parse(g.date)<=Date.now())).length;
 const counts=games.length+' of '+dailyGames.length+' games shown'+(pending?' · '+pending+' awaiting a score or result update':'');
 status.textContent=counts+' · '+(stale?'Score feed delayed · Last checked ':'Score feed checked ')+et(d.checked_at||d.updated_at)+' ET · Checks every 60 seconds'+providerNote;

}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('focus',()=>{if(!document.hidden)refresh()});
})();