/* Sporting Life & Times | Native expandable college basketball Gamefile.
 * No iframe, duplicate web page, or invented play/box statistics.
 * Shared by the men's and women's Daily Ledger scorecards. */
(function(global,factory){
 const api=factory(global);
 global.SLTInlineGamefile=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(global){
 'use strict';
 const cache=new Map(), selectedTabs=new Map(), inFlight=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validURL=v=>/^https:\/\/[^\s"'<>]+$/i.test(String(v||''))?String(v):'';
 const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const name=t=>String(t?.name||t?.full||'School');
 const periodTitle=(i,women)=>women?(i<=4?'Q'+i:'OT '+(i-4)):(i<=2?'H'+i:'OT '+(i-2));
 const gKey=(g,women)=>(women?'w':'m')+'-'+g.day+'-'+g.id;
 const missing=message=>'<p class="slt-gf-missing">'+esc(message)+'</p>';
 const asScore=t=>num(t?.score);
 function checkedBox(g,feed,women,section){
   if(g.kind!=='regular'||g.phase!=='final'||num(g.away?.score)===null||num(g.home?.score)===null)return null;
   const data=feed?.[section]?.games||{};
   const values=Object.values(data).filter(b=>
     String(b?.espn_id||'')===String(g.id)&&b.gender===(women?'women':'men')&&b.day===g.day&&
     validURL(b.source_url)&&num(b.away?.pts??b.away?.score)===num(g.away.score)&&
     num(b.home?.pts??b.home?.score)===num(g.home.score));
   return values.length===1?values[0]:null;
 }
 function checkedSummary(raw,g){
   if(!raw||typeof raw!=='object')return null;
   const competitors=raw?.header?.competitions?.[0]?.competitors||[];
   if(competitors.length!==2)return null;
   const away=competitors.find(x=>x.homeAway==='away'),home=competitors.find(x=>x.homeAway==='home');
   if(String(away?.team?.id||'')!==String(g.away?.id)||String(home?.team?.id||'')!==String(g.home?.id))return null;
   // A final-source conflict must not silently publish another provider's box score.
   if(g.phase==='final'){
     const a=asScore(g.away),h=asScore(g.home);
     const p=num(away.score?.value??away.score?.displayValue??away.score);
     const q=num(home.score?.value??home.score?.displayValue??home.score);
     if(a!==null&&h!==null&&p!==null&&q!==null&&(a!==p||h!==q))return null;
   }
   return raw;
 }
 async function getSummary(g,women,force){
   if(g.kind==='exhibition'||!/^\d{1,12}$/.test(String(g.id||'')))return null;
   const key=gKey(g,women),old=cache.get(key);
   const age=old?Date.now()-old.at:Infinity;
   const ttl=g.phase==='live'?25000:g.phase==='final'?900000:180000;
   if(!force&&old&&age<ttl)return old.raw;
   if(inFlight.has(key))return inFlight.get(key);
   const url='https://site.api.espn.com/apis/site/v2/sports/basketball/'+
     (women?'womens':'mens')+'-college-basketball/summary?event='+encodeURIComponent(g.id);
   const task=(async()=>{
     const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
     try{
       const res=await fetch(url,{cache:'no-store',signal:ctl.signal});
       if(!res.ok)throw Error('Provider status '+res.status);
       const raw=checkedSummary(await res.json(),g);
       cache.set(key,{at:Date.now(),raw});
       return raw;
     }catch{ return old?.raw||null; }
     finally{clearTimeout(timer);}
   })();
   inFlight.set(key,task);
   try{return await task}finally{inFlight.delete(key)}
 }
 // ESPN period cells, ESPN current score, and provider-reported box score
 // must describe one snapshot. Never mix these cells with our slower ledger feed.
 function periodScoreSnapshot(g,raw){
   const competitors=raw?.header?.competitions?.[0]?.competitors||[];
   const away=competitors.find(x=>x.homeAway==='away'),home=competitors.find(x=>x.homeAway==='home');
   if(String(away?.team?.id||'')!==String(g.away?.id)||
      String(home?.team?.id||'')!==String(g.home?.id))return null;
   const as=away?.linescores,hs=home?.linescores;
   if(!Array.isArray(as)||!Array.isArray(hs)||!as.length||as.length!==hs.length)return null;
   const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=500;
   const parse=xs=>xs.map(x=>num(x?.displayValue??x?.value));
   const awayPeriods=parse(as),homePeriods=parse(hs);
   if(!awayPeriods.every(valid)||!homePeriods.every(valid))return null;
   const awayTotal=awayPeriods.reduce((v,n)=>v+n,0),homeTotal=homePeriods.reduce((v,n)=>v+n,0);
   if(!valid(awayTotal)||!valid(homeTotal))return null;
   const sourceTotal=x=>num(x.score?.value??x.score?.displayValue??x.score);
   const reportedAway=sourceTotal(away),reportedHome=sourceTotal(home);
   if((reportedAway!==null&&reportedAway!==awayTotal)||
      (reportedHome!==null&&reportedHome!==homeTotal))return null;
   const boardAway=asScore(g.away),boardHome=asScore(g.home);
   if(g.phase==='final'&&((boardAway!==null&&boardAway!==awayTotal)||
      (boardHome!==null&&boardHome!==homeTotal)))return null;
   const behind=g.phase==='live'&&
     ((boardAway!==null&&awayTotal<boardAway)||(boardHome!==null&&homeTotal<boardHome));
   return {awayPeriods,homePeriods,awayTotal,homeTotal,behind};
 }
 function lineScore(g,raw,women){
   const s=periodScoreSnapshot(g,raw);
   if(!s)return missing('Period-by-period scoring is withheld: the source has not provided a consistent set of period scores and totals.');
   if(s.behind)return missing('Period scoring is older than the current live scoreboard and will return once the sources reconcile.');
   const headers=Array.from({length:s.awayPeriods.length},(_,i)=>'<th scope="col">'+
     esc(periodTitle(i+1,women))+'</th>').join('');
   const row=(t,items,total)=>'<tr><th scope="row">'+esc(name(t))+'</th>'+
     items.map(v=>'<td>'+v+'</td>').join('')+'<td><b>'+total+'</b></td></tr>';
   const note=g.phase==='live'&&(asScore(g.away)!==s.awayTotal||asScore(g.home)!==s.homeTotal)?
     '<p class="slt-gf-source">Live period totals are newer than the separately refreshed newspaper scoreboard. The open scorebug is being synchronized.</p>':'';
   return note+'<div class="slt-gf-scroll"><table class="slt-gf-table"><caption>Period scoring · consistent game snapshot</caption>'+
     '<thead><tr><th scope="col">SCHOOL</th>'+headers+'<th scope="col">TOTAL</th></tr></thead><tbody>'+
     row(g.away,s.awayPeriods,s.awayTotal)+row(g.home,s.homePeriods,s.homeTotal)+'</tbody></table></div>';
 }
 const ncaaTeamKeys=[
   ['fgm','Field goals made'],['fga','Field goals attempted'],['tpm','3-pointers made'],
   ['tpa','3-pointers attempted'],['ftm','Free throws made'],['fta','Free throws attempted'],
   ['oreb','Offensive rebounds'],['dreb','Defensive rebounds'],['reb','Total rebounds'],
   ['ast','Assists'],['stl','Steals'],['blk','Blocks'],['tov','Turnovers'],['pf','Personal fouls']
 ];
 function ncaaTeamStats(box,g){
   if(!box)return '';
   const rows=ncaaTeamKeys.filter(([k])=>num(box.away?.[k])!==null||num(box.home?.[k])!==null);
   if(!rows.length)return '';
   return '<p class="slt-gf-source">NCAA-origin verified team totals'+
     (validURL(box.source_url)?' · <a href="'+esc(box.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'')+
     '</p><div class="slt-gf-stat-head"><b>'+esc(name(g.away))+'</b><b>'+esc(name(g.home))+'</b></div>'+
     rows.map(([k,title])=>'<div class="slt-gf-stat-row"><b>'+esc(box.away?.[k]??'—')+
       '</b><span>'+esc(title)+'</span><b>'+esc(box.home?.[k]??'—')+'</b></div>').join('');
 }
 function espnTeamStats(raw,g){
   const groups=raw?.boxscore?.teams||[],away=groups.find(x=>String(x.team?.id)===String(g.away.id)),
     home=groups.find(x=>String(x.team?.id)===String(g.home.id));
   if(!away||!home)return '';
   const stats=x=>new Map((x.statistics||[]).map(s=>[String(s.name||s.abbreviation||s.label||'').toLowerCase(),
     {label:s.label||s.displayName||s.name||'Stat',val:s.displayValue??s.value??'—'}]));
   const a=stats(away),h=stats(home),keys=[...new Set([...a.keys(),...h.keys()])].filter(Boolean);
   if(!keys.length)return '';
   return '<p class="slt-gf-source">Live feed · team statistics</p>'+
    '<div class="slt-gf-stat-head"><b>'+esc(name(g.away))+'</b><b>'+esc(name(g.home))+'</b></div>'+
    keys.map(key=>'<div class="slt-gf-stat-row"><b>'+esc(a.get(key)?.val??'—')+
      '</b><span>'+esc(a.get(key)?.label||h.get(key)?.label||key)+'</span><b>'+esc(h.get(key)?.val??'—')+'</b></div>').join('');
 }
 function ncaaPlayers(box,g){
   if(!box)return '';
   const defs=[['min','MIN'],['pts','PTS'],['fgm','FGM'],['fga','FGA'],['tpm','3PM'],
     ['tpa','3PA'],['ftm','FTM'],['fta','FTA'],['oreb','OREB'],['dreb','DREB'],
     ['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['tov','TO'],['pf','PF']];
   return '<p class="slt-gf-source">NCAA-origin verified individual totals'+
     (validURL(box.source_url)?' · <a href="'+esc(box.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'')+'</p>'+
     ['away','home'].map(side=>{
       const players=box?.[side]?.players||[];
       if(!players.length)return missing(name(g[side])+' player box score is not available.');
       return '<div class="slt-gf-scroll"><table class="slt-gf-table"><caption>'+
         esc(name(g[side]))+' · player box score</caption><thead><tr><th scope="col">PLAYER</th>'+
         defs.map(([,label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>'+
         players.map(p=>'<tr><th scope="row">'+esc(p.name||'Unnamed player')+'</th>'+
           defs.map(([key])=>'<td>'+esc(p[key]??'—')+'</td>').join('')+'</tr>').join('')+
         '</tbody></table></div>';
     }).join('');
 }
 function espnPlayers(raw,g){
   const groups=raw?.boxscore?.players||[];
   return groups.map(group=>{
     const teamId=String(group.team?.id||'');
     const team=teamId===String(g.away.id)?g.away:teamId===String(g.home.id)?g.home:null;
     if(!team)return '';
     const sections=group.statistics||[];
     return sections.map(section=>{
       const labels=section.labels||section.names||[],players=(section.athletes||[]).filter(p=>p.athlete?.displayName&&Array.isArray(p.stats));
       if(!players.length)return '';
       return '<div class="slt-gf-scroll"><table class="slt-gf-table"><caption>'+
         esc(name(team))+' · '+esc(section.name||'player statistics')+' · live box score</caption>'+
         '<thead><tr><th scope="col">PLAYER</th>'+labels.map(v=>'<th scope="col">'+esc(v)+'</th>').join('')+
         '</tr></thead><tbody>'+players.map(p=>'<tr><th scope="row">'+esc(p.athlete.displayName)+'</th>'+
         labels.map((_,i)=>'<td>'+esc(p.stats[i]??'—')+'</td>').join('')+
         '</tr>').join('')+'</tbody></table></div>';
     }).join('');
   }).join('');
 }
 function playLog(raw,g){
   const plays=global.SLTCourt?.parsePlays?.(raw)||[];
   if(!plays.length)return missing('No source-reported play-by-play is available for this game.');
   return '<p class="slt-gf-source">'+plays.length+' source-reported events · chronological order · live play log</p>'+
     '<ol class="slt-gf-plays">'+plays.map(p=>'<li><span class="slt-gf-play-clock">'+
       esc(p.period?'P'+p.period:'—')+' · '+esc(p.clock||'—')+'</span><span>'+
       esc(p.text)+'</span><b>'+esc(p.awayScore===null?'':p.awayScore)+
       (p.awayScore!==null&&p.homeScore!==null?'–':'')+esc(p.homeScore===null?'':p.homeScore)+
       '</b></li>').join('')+'</ol>';
 }
 function courtGame(g){
   const side=t=>({team:{id:String(t.id),displayName:t.full||t.name,schoolLabel:t.name,
     color:''},score:t.score,homeAway:t===g.away?'away':'home'});
   return {id:g.id,away:side(g.away),home:side(g.home),phase:g.phase,
     disputed:false,headline:g.status||'',venue:g.venue||''};
 }
 function flow(raw,g){
   const snapshot=periodScoreSnapshot(g,raw);
   if(g.phase==='live'&&(!snapshot||snapshot.behind))
     return missing('Scoring progression is withheld while the live score sources reconcile.');
   const plays=global.SLTCourt?.parsePlays?.(raw)||[];
   const graph=global.SLTCourt?.gameFlow?.(plays,courtGame(g))||'';
   return graph||missing('A scoring graph will appear when the source provides a consistent sequence of play-by-play scores.');
 }
 function tabs(key){
   const definitions=[['summary','Game summary'],['team','Team statistics'],['players','Player box score'],['plays','Every play']];
   return '<nav class="slt-gf-tabs" role="tablist" aria-label="Game details">'+
     definitions.map(([slug,label])=>'<button type="button" role="tab" data-inline-tab="'+slug+
       '" id="'+key+'-tab-'+slug+'" aria-controls="'+key+'-panel-'+slug+'">'+label+'</button>').join('')+'</nav>';
 }
 function switchTab(node,tab){
   const choice=['summary','team','players','plays'].includes(tab)?tab:'summary';
   node.querySelectorAll('[data-inline-tab]').forEach(b=>{
     const is=b.dataset.inlineTab===choice;b.setAttribute('aria-selected',String(is));b.tabIndex=is?0:-1;
   });
   node.querySelectorAll('[data-inline-panel]').forEach(p=>{p.hidden=p.dataset.inlinePanel!==choice;});
 }
 function renderHTML(g,raw,feed,women,key){
   const teamBox=checkedBox(g,feed,women,'ncaa_team_boxscores');
   const playerBox=checkedBox(g,feed,women,'ncaa_player_boxscores');
   const team=ncaaTeamStats(teamBox,g)||espnTeamStats(raw,g)||
     missing('Verified team totals are not available. No statistics have been estimated.');
   const players=ncaaPlayers(playerBox,g)||espnPlayers(raw,g)||
     missing('Player box scores have not been published for this matchup.');
   const periods=lineScore(g,raw,women);
   const provenance=raw?'Live game summary matched to both schools and game ID':
     'No matching live game summary from the provider';
   const keyPanel=(tab,html)=>'<section role="tabpanel" id="'+key+'-panel-'+tab+
     '" aria-labelledby="'+key+'-tab-'+tab+'" data-inline-panel="'+tab+'">'+html+'</section>';
   return '<div class="slt-gf-head"><div><small>THE SPORTING LIFE & TIMES / GAMEFILE</small>'+
     '<h3>'+esc(name(g.away))+' at '+esc(name(g.home))+'</h3>'+
     '<p>'+esc(g.status||g.phase.toUpperCase())+(g.venue?' · '+esc(g.venue):'')+
     (g.broadcast?' · '+esc(g.broadcast):'')+'</p></div>'+
     '<button type="button" class="slt-gf-refresh" data-inline-refresh>↻ Refresh details</button></div>'+
     tabs(key)+
     keyPanel('summary','<h4>Period-by-period scoring</h4>'+periods+
       '<h4>Scoring progression</h4>'+flow(raw,g))+
     keyPanel('team','<h4>Complete available team statistics</h4>'+team)+
     keyPanel('players','<h4>Player-by-player box score</h4>'+players)+
     keyPanel('plays','<h4>Play-by-play · all reported events</h4>'+playLog(raw,g))+
     '<p class="slt-gf-provenance">'+esc(provenance)+
     '. NCAA-origin totals are shown instead of secondary boxes when their event ID, day and final scores agree. Missing data is never invented.</p>';
 }
 async function mount(node,g,options={}){
   if(!node||!g)return;
   const women=!!options.women,key=gKey(g,women);
   const prevKey=node.dataset.gfileKey;
   node.dataset.gfileKey=key;
   if(!node.dataset.listeners){
     node.dataset.listeners='true';
     node.addEventListener('click',e=>{
       const b=e.target.closest('[data-inline-tab],[data-inline-refresh]');
       if(!b||!node.contains(b))return;
       const tab=b.dataset.inlineTab;
       if(tab){selectedTabs.set(node.dataset.gfileKey,tab);switchTab(node,tab);}
       if(b.hasAttribute('data-inline-refresh')&&node._gfile)mount(node,node._gfile.g,{...node._gfile.options,force:true});
     });
     node.addEventListener('keydown',e=>{
       const b=e.target.closest('[data-inline-tab]');if(!b||!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
       const buttons=[...node.querySelectorAll('[data-inline-tab]')],idx=buttons.indexOf(b);
       const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:
         (idx+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
       e.preventDefault();buttons[next].focus();buttons[next].click();
     });
   }
   node._gfile={g,options};
   const prevStamp=node.dataset.snapshot;
   const stamp=[g.id,g.phase,g.away.score,g.home.score,women,options.force?'forced':''].join('|');
   if(prevStamp===stamp&&!options.force&&node.querySelector('[data-inline-panel]'))return;
   node.innerHTML='<p class="slt-gf-loading" role="status">Retrieving attributed game details…</p>';
   const raw=await getSummary(g,women,options.force);
   if(!node.isConnected||node.dataset.gfileKey!==key)return;
   const scores=g.phase==='live'?periodScoreSnapshot(g,raw):null;
   if(scores&&!scores.behind&&typeof options.onLiveScore==='function')
     options.onLiveScore({away:scores.awayTotal,home:scores.homeTotal,id:g.id,day:g.day});
   node.innerHTML=renderHTML(g,raw,options.feed,women,key);
   node.dataset.snapshot=stamp;
   switchTab(node,selectedTabs.get(key)||'summary');
 }
 return {mount,checkedSummary,checkedBox,periodScoreSnapshot,playLog,renderHTML};
});
