/* MBB conference and selection comparison, independent of Elo publication. */
(()=>{'use strict';
if(!['conference','tournament'].includes(document.body.dataset.page))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fetchJSON=async p=>{try{const r=await fetch(p,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}};
const getId=g=>[g.home_id||g.home,g.away_id||g.away];
const name=t=>'<a href="ncaam-team.html?team='+encodeURIComponent(t.team_id)+'">'+esc(t.team)+'</a>';
const record=t=>((t.conference_wins||0)+'–'+(t.conference_losses||0));
const winner=g=>Number(g.home_score)>Number(g.away_score)?getId(g)[0]:getId(g)[1];
const completed=g=>g.home_score!==undefined&&g.home_score!==null&&g.away_score!==undefined&&g.away_score!==null;
function order(members,games){
 const scores=new Map(members.map(t=>[t.team_id,{t,w:0,l:0}]));
 for(const g of games){if(!completed(g))continue;const [h,a]=getId(g);if(!scores.has(h)||!scores.has(a))continue;const w=winner(g),loser=w===h?a:h;scores.get(w).w++;scores.get(loser).l++;}
 const any=[...scores.values()].some(x=>x.w+x.l);
 if(!any)return {rows:[...members].sort((a,b)=>b.elo-a.elo),earned:false,records:scores};
 const rows=[...members].sort((a,b)=>{const x=scores.get(a.team_id),y=scores.get(b.team_id);const px=x.w/(x.w+x.l||1),py=y.w/(y.w+y.l||1);return py-px||b.elo-a.elo;});
 return {rows,earned:true,records:scores};
}
function projectedBracket(rows){
 let stage=rows.map((t,i)=>({seed:i+1,team:t}));
 const rounds=[];let r=0;
 while(stage.length>1&&r<7){const n=2**Math.ceil(Math.log2(stage.length)),byes=n-stage.length,matchups=[];let contestants=[...stage];if(r===0){const upper=contestants.slice(0,byes);const lower=contestants.slice(byes);const pairs=[];while(lower.length>1){pairs.push([lower.shift(),lower.pop()]);}if(lower.length)pairs.push([lower.shift(),null]);matchups.push(...upper.map(x=>({teams:[x],bye:true})),...pairs.map(p=>({teams:p.filter(Boolean),bye:false})));}else{for(let i=0;i<contestants.length;i+=2)matchups.push({teams:contestants.slice(i,i+2)});}
 rounds.push(matchups);stage=matchups.map(m=>m.teams.reduce((a,b)=>a.seed<b.seed?a:b));r++;
 }
 return rounds;
}
function buildConference(app,teams,games,conference){
 const members=teams.filter(t=>t.conference===conference);if(!members.length)return;
 const o=order(members,games),rounds=projectedBracket(o.rows),noFinals=!o.earned;
 const section=document.createElement('section');section.className='panel';section.id='conference-tournament-watch';
 section.innerHTML='<div class="eyebrow">Conference championship projection</div><h2>Road to the automatic bid</h2><p class="note">Illustrative seed-order bracket — <strong>not an official conference tournament format</strong>. Each league’s actual field size, site, byes, exclusions, reseeding and multi-team tiebreakers must be verified before this becomes an official-format bracket. '+(noFinals?'No conference finals recorded; projected seeds use published Elo.':'Conference game records inform the initial order; tied records are NOT resolved by Elo for official standings. Elo is only a projection tiebreak.')+'</p><div class="metrics"><div><strong>'+members.length+'</strong><small>Conference members</small></div><div><strong>'+rounds.length+'</strong><small>Illustrative stages</small></div></div><div class="bracket-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">'+rounds.map((round,i)=>'<div class="region"><h3>'+(i===rounds.length-1?'Projected final':'Stage '+(i+1))+'</h3>'+round.map(m=>'<div class="match">'+m.teams.map(p=>'<div class="slot"><span class="seed">'+p.seed+'</span>'+name(p.team)+'</div>').join('')+(m.bye?'<small>Illustrative bye</small>':'')+'</div>').join('')+'</div>').join('')+'</div><p class="note">Projected seed order (not certified): '+o.rows.slice(0,12).map((t,i)=>(i+1)+'. '+esc(t.team)+' ('+record(t)+')').join(' · ')+'</p>';
 const target=app.querySelector('.grid.two')||app;target.parentNode.insertBefore(section,target.nextSibling);
}
function committee(teams,games,polls){
 const base=MBBEngine.resume(teams,games);
 const map=new Map(base.map(t=>[t.team_id,t]));
 const pollPts=new Map();
 const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
 const byName=new Map(teams.map(t=>[norm(t.team),t]));
 for(const key of ['ap','coaches'])for(const x of polls?.polls?.[key]?.rankings||[]){const t=byName.get(norm(x.team));if(t)pollPts.set(t.team_id,(pollPts.get(t.team_id)||0)+(26-x.rank));}
 const anyGames=games.some(completed),hasPolls=pollPts.size>0;
 const adjusted=teams.map(t=>{const r=map.get(t.team_id)?.resume||{};const pts=pollPts.get(t.team_id)||0;
 // Editorial committee-style proxy: résumé first when games exist; polls provide modest independent context.
 // Do not imply committee certification or official NET.
 const adjustment=(anyGames?Math.max(-190,Math.min(190,90*(r.wab||0)+3*(r.road||0))):0)+(hasPolls?pts*2.7:0);
 return {...t,elo:t.elo+adjustment};});
 const result=MBBEngine.field(adjusted,[]);
 return {result,anyGames,hasPolls};
}
function teamList(list,limit){
 const shown=Number.isInteger(limit)?list.slice(0,limit):list;
 return '<div class="selection-compact-list">'+shown.map(t=>'<div class="selection-row">'+
  '<span class="selection-seed">'+esc(t.trueSeed||'—')+'</span>'+name(t)+
  '<small>'+esc(t.bid==='Projected AQ'?'Projected AQ':t.bid||'At-large')+'</small></div>').join('')+'</div>';
}
function buildTournament(app,teams,games,polls){
 const proxy=committee(teams,games,polls),f=proxy.result;
 const elo=MBBEngine.field(teams,games);
 const eloIds=new Set(elo.selected.map(t=>t.team_id)),commIds=new Set(f.selected.map(t=>t.team_id));
 const shared=f.selected.filter(t=>eloIds.has(t.team_id));
 const onlyProxy=f.selected.filter(t=>!eloIds.has(t.team_id));
 const onlyElo=elo.selected.filter(t=>!commIds.has(t.team_id));
 const label=proxy.anyGames?'Experimental résumé model':'Preseason poll-adjusted illustration';
 const explainer=proxy.anyGames?
  'The résumé model uses game results and opponent-based adjustments; it is not a trained or validated NCAA committee simulator.':
  'No verified 2026–27 résumé exists yet. Preseason polls can illustrate a possible field, but they cannot establish committee selection or seeding.';
 const block=document.createElement('section');block.className='panel selection-comparison';block.id='committee-vs-elo';
 block.innerHTML='<div class="eyebrow">Optional analysis / not official NCAA seeding</div>'+
  '<h2>Where our models disagree</h2><p class="selection-compare-intro">'+esc(explainer)+
  ' '+(proxy.hasPolls?'Published AP and Coaches polls inform the illustration.':'Contemporary polls were unavailable.')+
  ' Independent USRS Elo ratings are not adjusted by this comparison.</p>'+
  '<div class="selection-summary">'+
    '<div><strong>'+shared.length+'</strong><span>Common picks</span></div>'+
    '<div><strong>'+onlyProxy.length+'</strong><span>'+esc(proxy.anyGames?'Résumé-only':'Poll-only')+'</span></div>'+
    '<div><strong>'+onlyElo.length+'</strong><span>USRS-only</span></div></div>'+
  '<div class="selection-exclusive"><div><h3>'+esc(proxy.anyGames?'Résumé model only':'Poll-adjusted only')+'</h3>'+
   (onlyProxy.length?teamList(onlyProxy,4):'<p>No differences.</p>')+
   (onlyProxy.length>4?'<details><summary>See all '+onlyProxy.length+' differences</summary>'+teamList(onlyProxy)+'</details>':'')+'</div>'+
  '<div><h3>USRS-only selections</h3>'+(onlyElo.length?teamList(onlyElo,4):'<p>No differences.</p>')+
   (onlyElo.length>4?'<details><summary>See all '+onlyElo.length+' differences</summary>'+teamList(onlyElo)+'</details>':'')+'</div></div>'+
  '<details class="selection-all"><summary>Compare complete 76-team fields</summary>'+
    '<p class="selection-method-note">Model order is not official NCAA seeding. All automatic bids remain projected.</p>'+
    '<details><summary>'+esc(label)+' · 76 teams</summary>'+teamList(f.selected)+'</details>'+
    '<details><summary>Independent USRS Elo · 76 teams</summary>'+teamList(elo.selected)+'</details></details>'+
  '<details class="selection-all"><summary>Compare projected regional placements and Opening Round</summary>'+
    '<p class="selection-method-note">These are not approved NCAA assignments.</p>'+
    '<div class="bracket-grid">'+f.regions.map(r=>'<div class="region"><h3>'+esc(r)+'</h3>'+
     Array.from({length:16},(_,i)=>{const s=f.bracket[r][i+1];return '<div class="slot"><span class="seed">'+(i+1)+'</span>'+s.teams.map(name).join(' / ')+'</div>'}).join('')+
     '</div>').join('')+'</div><h3>Opening Round · 12 games</h3>'+
     f.opening.map(o=>'<p>'+o.teams.map(name).join(' vs. ')+' → '+esc(o.region)+' #'+o.seed+'</p>').join('')+'</details>';
 const method=app.querySelector('#method');
 if(method)method.parentNode.insertBefore(block,method);
 else app.appendChild(block);
}

(async()=>{
 const sources=await Promise.all(['data/ncaam-2026-27-preseason-player-quality-live.json','data/ncaam-2026-27-current-provisional.json','data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-game-ledger.json','data/ncaam-2026-27-national-polls.json'].map(fetchJSON));
 const [pre,current,retro,ledger,polls]=sources;const valid=x=>x?.season==='2026-27'&&x.rankings?.length===365;
 const live=valid(current)&&current.games_played>0&&current.preseason_seed==='data/ncaam-2026-27-preseason-player-quality-live.json';
 const teams=live?current.rankings:(valid(retro)&&retro.model==='retro-roster-adjusted'?retro.rankings:pre?.rankings);
 if(!teams||!window.MBBEngine)return;
 const games=ledger?.season==='2026-27'?(ledger.games||[]):[];
 const render=()=>{const app=document.getElementById('app');if(!app||app.querySelector('#conference-tournament-watch,#committee-vs-elo'))return false;
 if(document.body.dataset.page==='conference'){const c=new URLSearchParams(location.search).get('conference');if(!c||!app.querySelector('.grid.two'))return false;buildConference(app,teams,games,c);}
 else{if(!app.querySelector('#field'))return false;buildTournament(app,teams,games,polls);}
 return true;};
 if(render())return;const observer=new MutationObserver(()=>{if(render())observer.disconnect()});observer.observe(document.getElementById('app'),{childList:true,subtree:false});setTimeout(()=>observer.disconnect(),20000);
})().catch(e=>console.error('MBB comparison desk:',e));
})();