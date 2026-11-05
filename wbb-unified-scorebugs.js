/* Women team desk: one shared college basketball scorebug, source rows retained as game details. */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function start(){
  const desk=document.getElementById('desk'),table=desk?.querySelector('.wbb-schedule-table');
  if(!table||!window.SLTSportsScorebug)return;
  const host=table.closest('.wbb-table-wrap'),body=table.tBodies[0],rows=[...body.querySelectorAll('tr.wbb-game-entry')];
  if(!rows.length)return;
  const title=desk.querySelector('.wbb-identity h1')?.textContent?.replace(/^RETRO\s*#\d+/i,'').trim()||'Home team';
  const crest=desk.querySelector('.wbb-identity img')?.outerHTML||'';
  const palette=window.getComputedStyle(desk).getPropertyValue('--accent').trim();
  const teamColor=/^#[a-f\d]{6}$/i.test(palette)?palette:'#704a32';
  const wrap=document.createElement('div');wrap.className='wbb-scorebug-list';
  host.parentNode.insertBefore(wrap,host);
  const status=(row)=>{
   const result=row.querySelector('.wbb-result-cell strong')?.textContent?.trim()||'';
   const note=row.querySelector('.wbb-result-source')?.textContent?.trim()||'';
   if(row.dataset.calendarState==='final'||/^(?:W|L)\s+\d+\s*[–-]\s*\d+/.test(result))return 'final';
   if(/\b(?:\d{1,2}:\d{2}|halftime|half time|1st|2nd|overtime)\b/i.test(note)&&/\d+\s*[–-]\s*\d+/.test(result))return 'live';
   return 'upcoming';
  };
  const cards=new Map();
  for(const row of rows){
   const id=row.dataset.gameId;if(!id)continue;
   const details=document.createElement('details');details.className='ledger26-card ledger26-expand wbb-scorebug-card';
   const summary=document.createElement('summary');summary.className='ledger26-summary';
   const detail=document.createElement('div');detail.className='ledger26-expanded wbb-scorebug-detail';
   const info=document.createElement('dl');info.className='wbb-scorebug-facts';
   const headings=[...table.tHead.rows[0].cells].map(x=>x.textContent.trim());
   [...row.cells].forEach((cell,i)=>{
    const dt=document.createElement('dt');dt.textContent=headings[i]||'Details';
    const dd=document.createElement('dd');
    dd.innerHTML=cell.innerHTML.replace(/<button\b[^>]*class="wbb-stat-toggle"[^>]*>[\s\S]*?<\/button>/g,'');
    info.append(dt,dd);
   });
   detail.append(info);
   const gameStats=row.nextElementSibling;
   if(gameStats?.classList.contains('wbb-game-detail')){
    const link=document.createElement('a');link.href='cbb-gamefile.html?gender=women&game='+encodeURIComponent(id);
    link.textContent='Open game statistics ↗';link.className='wbb-scorebug-gamefile';detail.append(link);
   }
   details.append(summary,detail);wrap.append(details);cards.set(id,{row,summary});
  }
  const formatRecord=p=>p&&Number.isFinite(Number(p.wins))&&Number.isFinite(Number(p.losses))?
    Number(p.wins)+'–'+Number(p.losses):'—';
  const formatRetro=(p,ties)=>window.SLTSportsScorebug.formatRetro(p,ties,363);
  function renderOne(row,summary,byId,ties){
   const opponent=row.querySelector('.wbb-opponent-name')?.textContent?.trim()||'Opponent';
   const opponentCrest=row.querySelector('.wbb-matchup img')?.outerHTML||'';
   const result=row.querySelector('.wbb-result-cell strong')?.textContent?.trim()||'';
   const note=row.querySelector('.wbb-result-source')?.textContent?.trim()||'';
   const phase=status(row),scores=result.match(/(\d+)\s*[–-]\s*(\d+)/);
   const ourScore=phase==='upcoming'?null:scores?Number(scores[1]):null;
   const theirScore=phase==='upcoming'?null:scores?Number(scores[2]):null;
   const ownRating=byId.get(String(row.dataset.teamId||''));
   const oppRating=byId.get(String(row.dataset.opponentId||''));
   const ours={name:title,score:ourScore,crest,color:teamColor,
     record:formatRecord(ownRating),retro:formatRetro(ownRating,ties)};
   const opponentTeam={name:opponent,score:theirScore,crest:opponentCrest,
     color:'#655239',record:formatRecord(oppRating),retro:formatRetro(oppRating,ties)};
   // Preserve the fixture's actual away/home identities even at a neutral venue.
   const ownHome=row.dataset.homeId===row.dataset.teamId;
   const oppHome=row.dataset.homeId===row.dataset.opponentId;
   const home=ownHome?ours:oppHome?opponentTeam:row.dataset.site==='home'?ours:opponentTeam;
   const away=home===ours?opponentTeam:ours;
   const venue=row.dataset.forecastVenue||'unverified';
   let forecast=null,disclosure='';
   if(phase==='upcoming'&&venue!=='disputed'&&ownRating&&oppRating){
    const homeRating=home===ours?ownRating:oppRating;
    const awayRating=home===ours?oppRating:ownRating;
    const p=window.WBBRetroForecast?.forecast(homeRating,awayRating,venue,
      window.WBBForecastCalibration,window.WBBRetroSnapshot);
    if(p){
     const favourite=p.home_probability>=.5?home:away;
     forecast={team:favourite.name,probability:Math.max(p.home_probability,p.away_probability),
       margin:p.calibrated?Math.abs(p.projected_home_margin):null};
     const label=p.calibrated?'RETRO · HOLDOUT VALIDATED':'RETRO · PROVISIONAL CALIBRATION';
     disclosure='<small class="wbb-retro-provisional">'+label+
       (p.calibrated?' · EXPECTED SCORE: '+esc(away.name)+' '+Math.round(p.projected_away_score)+
         ' · '+esc(home.name)+' '+Math.round(p.projected_home_score):
         ' · Point-score calibration unavailable')+
       (venue==='unverified'?' · Unverified court treated as neutral':'')+'</small>';
    }
   }
   const time=row.cells[3]?.textContent?.trim()||'TIPOFF TBA';
   const markup=window.SLTSportsScorebug.render({phase,gender:'women',
     status:phase==='live'?note:phase==='final'?'FINAL':'',away,home,
     forecast,time:time.split('University-sourced')[0].trim()});
   summary.innerHTML=markup+disclosure+
     '<span class="ledger26-instruction">OPEN GAME DETAILS +</span>';
  }
  function renderAll(){
   const query=desk.querySelector('#wbb-calendar-search')?.value.trim().toLowerCase()||'';
   const view=desk.querySelector('#wbb-calendar-view')?.value||'all';
   const publication=window.WBBRetroSnapshot;
   const good=publication?.model==='retro-clean-slate'&&publication?.gender==='women'&&
     publication?.season==='2026-27'&&publication?.starting_elo===1500&&
     publication?.rankings?.length===363;
   const byId=new Map((good?publication.rankings:[]).map(p=>[String(p.team_id),p]));
   const ties=new Map();
   for(const p of byId.values()){const rank=Number(p.rank);if(Number.isInteger(rank))ties.set(rank,(ties.get(rank)||0)+1);}

   for(const {row,summary} of cards.values()){
    renderOne(row,summary,byId,ties);
    const current=status(row);
    const shown=(!query||row.dataset.opponent?.includes(query))&&
      (view==='all'||(view==='final'&&current==='final')||(view==='upcoming'&&current!=='final'));
    summary.parentElement.hidden=!shown;
   }
  }
  renderAll();
  window.addEventListener('wbb-retro-refreshed',renderAll);
  window.addEventListener('wbb-retro-forecast-ready',renderAll);
  host.classList.add('wbb-table-source-only');
  desk.querySelector('#wbb-calendar-search')?.addEventListener('input',renderAll);
  desk.querySelector('#wbb-calendar-view')?.addEventListener('change',renderAll);
  // Keep source rows as live updater targets; update the presentation when scores change.
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;renderAll();});})
   .observe(body,{subtree:true,characterData:true,childList:true});
 }
 let started=false;
 function boot(){
  if(started)return;
  if(!document.querySelector('#desk .wbb-schedule-table')||!window.SLTSportsScorebug)return;
  started=true;observer.disconnect();start();
 }
 const observer=new MutationObserver(boot);
 function watch(){
  const desk=document.getElementById('desk');
  if(desk)observer.observe(desk,{childList:true,subtree:true});
  boot();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});
 else watch();
})();
