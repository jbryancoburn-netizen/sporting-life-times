/* Sporting Life & Times — league-specific news and score wires. No Elo mutations. */
(()=>{'use strict';
const config={
 'nba.html':['NBA','NBA','data/nba-top-stories.json','#a42535'],
 'nfl-team.html':['NFL','NFL',null,'#136b59'],
 'nfl-game.html':['NFL','NFL',null,'#136b59'],
 'nfl-standings.html':['NFL','NFL',null,'#136b59'],
 'nfl-rankings.html':['NFL','NFL',null,'#136b59'],
 'nfl.html':['NFL','NFL',null,'#136b59'],
 'epl.html':['Premier League','PREMIER LEAGUE',null,'#63308a'],
 'college-football.html':['College Football','COLLEGE FOOTBALL',null,'#9c5825'],
 'nbl.html':['Australian NBL','AUSTRALIAN NBL',null,'#be522b'],
 'euroleague.html':['EuroLeague','EUROLEAGUE',null,'#b83d22'],
 'echl.html':['ECHL','ECHL',null,'#276b8a']
};
const page=location.pathname.split('/').pop(),c=config[page];if(!c)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const safe=s=>{try{const u=new URL(s,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const espnPath={'nba.html':'basketball/nba','nfl.html':'football/nfl','epl.html':'soccer/eng.1','college-football.html':'football/college-football','nbl.html':'basketball/australian-nbl','euroleague.html':'basketball/euroleague'};
const get=async url=>{try{const r=await fetch(url+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});return r.ok?await r.json():null}catch{return null}};
async function liveBoard(){
 const path=espnPath[page]||(page.startsWith('nfl-')?'football/nfl':null);if(!path)return null;
 try{
 const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?limit=100',{signal:AbortSignal.timeout(8000),cache:'no-store'});
 if(!r.ok)return null;const data=await r.json();
 if(!Array.isArray(data.events))return null;
 return data.events.map(e=>{
  const comp=e.competitions?.[0],teams=(comp?.competitors||[]).map(t=>({name:t.team?.shortDisplayName||t.team?.displayName||'Team',logo:t.team?.logo||t.team?.logos?.[0]?.href||'',score:t.score??'',home_away:t.homeAway}));
  return {id:e.id,url:e.links?.[0]?.href||'',date:e.date,state:e.status?.type?.state||'pre',status:e.status?.type?.shortDetail||e.status?.type?.description||'',teams};
 }).filter(g=>g.teams.length===2);
 }catch{return null}
}
const sortTeams=g=>{const teams=Array.isArray(g.teams)?g.teams:[];return [teams.find(t=>t.home_away==='away')||teams[1],teams.find(t=>t.home_away==='home')||teams[0]]};
const gameHTML=g=>{
 const [a,h]=sortTeams(g);if(!a||!h)return '';
 const live=g.state==='in',final=g.state==='post',status=live?'● LIVE':final?'FINAL':g.status||'SCHEDULED';
 const team=t=>'<span class="slt-wire-team">'+(safe(t.logo)?'<img src="'+esc(safe(t.logo))+'" alt="" loading="lazy">':'')+'<span>'+esc(t.name||'Unknown')+'</span><b>'+esc(live||final?t.score??'':'')+'</b></span>';
 const link=safe(g.url)||'#';
 return '<a class="slt-wire-game" href="'+esc(link)+'"'+(link!=='#'?' target="_blank" rel="noopener noreferrer"':'')+'><small'+(live?' class="live"':'')+'>'+esc(status)+'</small>'+team(a)+team(h)+'</a>';
};
function loop(el,html,className,duration){if(!el||el.dataset.content===html)return;el.dataset.content=html;el.innerHTML='<div class="'+className+'">'+html+'</div><div class="'+className+'" aria-hidden="true">'+html+'</div>';el.style.setProperty('--wire-speed',duration+'s')}
function mount(){
 if(document.querySelector('.slt-league-wire'))return;
 const anchor=document.querySelector('.nfl-wrap > header,.wrap > header,.edition-interior > header,header.masthead,body > header');
 if(!anchor)return;
 const section=document.createElement('section');section.className='slt-league-wire';section.style.setProperty('--wire-accent',c[3]);section.setAttribute('aria-label',c[1]+' scores and headlines');
 section.innerHTML='<div class="slt-wire-top"><strong><span class="slt-wire-beacon">●</span> '+esc(c[1])+' / LIVE WIRE</strong><span class="slt-wire-stamp">Connecting to the newsroom…</span><button type="button" class="slt-wire-pause" aria-pressed="false">PAUSE ▌▌</button></div><div class="slt-wire-score-window"><div class="slt-wire-score-track"><span class="slt-wire-empty">Checking scoreboards…</span></div></div><div class="slt-wire-news"><b>HEADLINES</b><div class="slt-wire-news-window"><div class="slt-wire-news-track">Loading latest coverage…</div></div></div>';
 anchor.insertAdjacentElement('afterend',section);
 section.querySelector('.slt-wire-pause').addEventListener('click',e=>{const pressed=e.currentTarget.getAttribute('aria-pressed')==='true';e.currentTarget.setAttribute('aria-pressed',String(!pressed));e.currentTarget.textContent=pressed?'PAUSE ▌▌':'PLAY ▶';section.classList.toggle('is-paused',!pressed)});
 const score=section.querySelector('.slt-wire-score-track'),news=section.querySelector('.slt-wire-news-track'),stamp=section.querySelector('.slt-wire-stamp');
 async function update(){
  const [boards,stories,currentGames]=await Promise.all([get('multi_scoreboards.json'),get(c[2]||'articles.json'),liveBoard()]);
  const group=boards?.leagues?.find(l=>l.league===c[0]);
  const age=boards?.updated_at?Date.now()-new Date(boards.updated_at).getTime():Infinity;
  const freshCached=age>=0&&age<36*3600*1000;
  const games=Array.isArray(currentGames)?currentGames:(freshCached?(group?.games||[]):[]).filter(g=>g.teams?.length===2);
  const key=games.map(g=>g.id+':'+g.state+':'+g.teams.map(t=>t.score).join('-')).join('|');
  if(games.length){const html=games.slice(0,30).map(gameHTML).join('');loop(score,html,'slt-wire-score-group',Math.max(45,games.length*6));}
  else{score.classList.remove('has-scores');score.innerHTML='<span class="slt-wire-empty">No verified '+esc(c[1])+' scores in the current feed.</span>';score.dataset.content='';}
  score.classList.toggle('has-scores',games.length>0);
  const candidates=(stories?.articles||[]).filter(a=>a.title&&safe(a.url));
  const tokens=c[0]==='Premier League'?/premier league|\bepl\b|arsenal|liverpool|chelsea|manchester|tottenham|everton|newcastle|fulham|sunderland|brentford|brighton|wolves|west ham|bournemouth|burnley|leeds|nottingham|crystal palace/i:c[0]==='College Football'?/college football|\bncaa football\b|\bfbs\b|\bcfp\b/i:c[0]==='Australian NBL'?/australian nbl|\bnbl\b/i:c[0]==='EuroLeague'?/euroleague/i:c[0]==='ECHL'?/\bechl\b/i:/\bnfl\b|football/i;
  const filtered=candidates.filter(a=>c[0]==='NBA'||tokens.test([a.category,a.title,a.summary,a.scope].join(' '))).slice(0,14);
  const items=filtered.length?filtered:[];const html=items.map(a=>'<a href="'+esc(safe(a.url))+'" target="_blank" rel="noopener noreferrer"><b>'+esc(a.source||'NEWS')+'</b> '+esc(a.title)+'</a>').join('<span class="slt-wire-bullet">◆</span>');
  if(items.length)loop(news,html,'slt-wire-news-group',Math.max(45,items.length*7));
  else{news.dataset.content='';news.innerHTML='<span class="slt-wire-empty">No verified '+esc(c[1])+' headlines in the current feed.</span>'}
  const date=boards?.updated_at?new Date(boards.updated_at):null;stamp.textContent=Array.isArray(currentGames)?'Score source: ESPN · refreshed now':freshCached&&date?'Cached scores: '+date.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'Current scores unavailable';
 }
 update();setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();