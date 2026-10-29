(()=>{'use strict';
if(document.body.dataset.league!=='euroleague')return;
const host=document.getElementById('el-live-scorebugs'),status=document.getElementById('el-live-status');
if(!host||!status)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const et=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
let lastGood=null;

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
 const stamp=Date.parse(d.updated_at);
 if(!Number.isFinite(stamp)||!Array.isArray(d.games))throw Error('Bad feed');
 const checked=Date.parse(d.checked_at||d.updated_at),stale=Date.now()-(Number.isFinite(checked)?checked:stamp)>15*60*1000;
 const priority={live:0,awaiting_final:1,final:2,scheduled:3};
 const games=d.games.filter(g=>Object.hasOwn(priority,g.status)).sort((a,b)=>{
   const group=priority[a.status]-priority[b.status];
   if(group)return group;
   const ad=Date.parse(a.date)||0,bd=Date.parse(b.date)||0;
   return a.status==='final'?bd-ad:ad-bd;
 }).slice(0,24);
 const logo=t=>/^[A-Z]{3}$/.test(String(t?.code||'').toUpperCase())?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(String(t.code).toUpperCase())+'" alt="'+esc(t.name||t.code)+' crest" src="assets/euroleague-logos/'+esc(String(t.code).toUpperCase())+'.png">':'';
 const team=t=>'<div class="el-live-team">'+logo(t)+'<div class="el-live-team-info"><span class="el-live-team-name">'+esc(clubName(t))+'</span>'+(clubMeta(t)?'<small>'+esc(clubMeta(t))+'</small>':'')+'</div><b>'+esc(t.score??'—')+'</b></div>';
 const forecast=await fetch('data/euroleague-model.json?live='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
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
 const odds=Number.isFinite(probability)?Math.round(100*probability):null;
 const quarterRows=periods.length?'<div class="el-quarter-table"><div class="el-quarter-head"><span>TEAM</span>'+periods.map(q=>'<span>Q'+esc(q.period)+'</span>').join('')+'<strong>TOTAL</strong></div><div class="el-quarter-row"><b>'+esc(g.away.code)+'</b>'+periods.map(q=>'<span>'+esc(q.away)+'</span>').join('')+'<strong>'+esc(g.away.score??'—')+'</strong></div><div class="el-quarter-row"><b>'+esc(g.home.code)+'</b>'+periods.map(q=>'<span>'+esc(q.home)+'</span>').join('')+'<strong>'+esc(g.home.score??'—')+'</strong></div></div>':'<p class="el-live-unavailable">Quarter scores pending official confirmation.</p>';
 const pregame=odds!==null?smallStat('Pregame '+clubName(g.home)+' win chance',odds+'%')+smallStat('Pregame '+clubName(g.away)+' win chance',(100-odds)+'%'):'';
 const projection=pred?.projection;
 const forecast=projection&&valid(projection.total)?smallStat('Pregame projected total',fixed(projection.total))+((valid(projection.away)&&valid(projection.home))?smallStat('Projected score · '+esc(g.away.code)+' / '+esc(g.home.code),fixed(projection.away)+'–'+fixed(projection.home)):''):'';
 const stats=(g.status==='live'||g.status==='final')?'<div class="el-live-quickstats">'+(scored?smallStat('Combined score',a+h)+smallStat('Lead',a===h?'Tied':(a>h?clubName(g.away):clubName(g.home))+' by '+Math.abs(a-h)):'')+'</div>':((pregame||forecast)?'<div class="el-live-quickstats">'+pregame+forecast+'</div>':'');
 const margin=scored?'<div class="el-live-stat"><small>Lead</small><strong>'+Math.abs(a-h)+' pts</strong></div>':'';
 const total=scored?'<div class="el-live-stat"><small>Combined score</small><strong>'+(a+h)+'</strong></div>':'';
 const verifiedStats=officialComparison(g);
 const info='<div class="el-live-detail-inner"><h4>QUARTER-BY-QUARTER</h4>'+quarterRows+'<div class="el-live-detail-stats">'+margin+total+'</div>'+seasonComparison(g)+forecastComparison(g,pred)+verifiedStats+(!verifiedStats?'<p class="el-live-unavailable">Verified shooting, rebounding and player box scores are not yet provided by the official live feed. Season scoring averages above are not live game statistics.</p>':'')+'</div>';
 const detail=freshLive?g.status_detail||'In progress':g.status==='live'?'Last verified score · '+(Number.isFinite(scoreStamp)?et(g.score_updated_at):'time unavailable'):'';
 return '<article class="el-live-card el-live-card--enhanced"><div class="el-live-meta"><span class="'+(freshLive?'el-live-now':'')+'">'+esc(label)+'</span><small>'+esc(et(g.date))+'</small></div>'+team(g.away)+team(g.home)+(detail?'<div class="el-live-clock">'+esc(detail)+'</div>':'')+stats+'<details class="el-live-expand" data-game-id="'+esc(g.id)+'"><summary>Game center <span>Quarter scores · records · Elo · stats</span></summary>'+info+'</details><div class="el-live-foot">Official score feed · '+(scoreFresh?'Updated '+esc(et(g.score_updated_at)):'Refresh every 60 sec')+'</div></article>';
 }).join('')||'<p class="hub-small">No games in this scorebug window.</p>';
 host.querySelectorAll('details[data-game-id]').forEach(el=>{if(expanded.has(el.dataset.gameId))el.open=true});
 const officialLive=Number(d.header_responses)||0;
 const activeWindow=d.games.some(g=>['live','awaiting_final'].includes(g.status)||(g.status==='scheduled'&&Date.parse(g.date)<=Date.now()&&Date.now()-Date.parse(g.date)<5*3600000));
 const providerNote=d.provider_degraded?' · Official live-stat provider degraded; displaying last verified scores':officialLive===0&&activeWindow?' · Official in-game updates not confirmed; showing published scores only':'';
 status.textContent=(stale?'Score feed delayed · Last checked ':'Score feed checked ')+et(d.checked_at||d.updated_at)+' ET · Checks every 60 seconds'+providerNote;
 lastGood=d;
}catch(e){
 status.textContent=lastGood?'Live feed temporarily unavailable · Keeping last verified snapshot':'Live feed is awaiting its first published snapshot. Scores are not estimated.';
}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('focus',()=>{if(!document.hidden)refresh()});
})();