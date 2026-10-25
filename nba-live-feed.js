(()=>{'use strict';
const root=document.getElementById('nba-live-feed');if(!root)return;
const status=document.getElementById('nba-live-status');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=c=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[c]||c.toLowerCase())+'.png';
let lastOK=0;let fallbackRecords={};
async function refreshRecords(){try{const r=await fetch('data/nba-2026-27-current-provisional.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),rec={};for(const e of data.events||[]){if(!Number.isFinite(Number(e.home_score))||!Number.isFinite(Number(e.away_score))||Number(e.home_score)===Number(e.away_score))continue;for(const t of [e.home,e.away])rec[t]??={w:0,l:0};const win=Number(e.home_score)>Number(e.away_score)?e.home:e.away,lose=win===e.home?e.away:e.home;rec[win].w++;rec[lose].l++}fallbackRecords=Object.fromEntries(Object.entries(rec).map(([k,v])=>[k,v.w+'-'+v.l]));}catch(e){console.warn('NBA verified record fallback unavailable',e.message)}}
function render(payload){
 const events=Array.isArray(payload.events)?payload.events:[];
 if(!events.length){root.innerHTML='<p class="hub-small">No NBA games listed for today.</p>';return;}
 const mapped=events.map(e=>{
  const co=e.competitions?.[0]||{};const cs=co.competitors||[];
  const away=cs.find(c=>c.homeAway==='away'),home=cs.find(c=>c.homeAway==='home');
  const st=e.status?.type||{},state=st.state||'pre',label=st.shortDetail||st.description||'Scheduled';
  if(!away||!home)return null;
  const team=c=>({name:c.team?.displayName||c.team?.name||'',code:c.team?.abbreviation||'',score:c.score??'',record:c.records?.find(r=>r.type==='total')?.summary||fallbackRecords[c.team?.abbreviation]||''});
  return {away:team(away),home:team(home),state,label,date:e.date,id:e.id};
 }).filter(g=>g&&/^[0-9]{7,12}$/.test(String(g.id)));
 if(!mapped.length){root.innerHTML='<p class="hub-small">No game details with valid provider IDs are available. <a href="nba-game-center.html">Verified archive</a>.</p>';return;}
 mapped.sort((a,b)=>({in:0,pre:1,post:2}[a.state]??3)-({in:0,pre:1,post:2}[b.state]??3));
 root.innerHTML=mapped.map(g=>{
  const playing=g.state==='in';const final=g.state==='post';const state=playing?'LIVE · '+g.label:final?'FINAL':new Date(g.date).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET';
  const team=t=>'<div class="nba-live-team"><img src="'+logo(esc(t.code))+'" alt="" loading="lazy"><span><b>'+esc(t.code)+'</b><small>'+esc(t.record)+'</small></span><strong>'+((playing||final)?esc(t.score):'–')+'</strong></div>';
  return '<a class="nba-live-match'+(playing?' playing':'')+'" href="nba-live-game.html?game='+encodeURIComponent(g.id)+'" aria-label="View live stats for '+esc(g.away.name)+' versus '+esc(g.home.name)+'"><div class="nba-live-match-head"><b>'+esc(state)+'</b><span>'+ (playing?'IN PROGRESS':final?'FEED FINAL':'TODAY')+'</span></div>'+team(g.away)+team(g.home)+'</a>'
 }).join('');
}
function fromNba(raw){
 const games=raw.scoreboard?.games||raw.games||[];
 const today=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const todayKey=today.year+today.month+today.day;
 const dated=games.filter(g=>{const d=g.gameTimeUTC||g.gameTime;if(!d)return false;const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(d)).map(x=>[x.type,x.value]));return p.year+p.month+p.day===todayKey});
 return {events:dated.map(g=>{
  const home=g.homeTeam||{},away=g.awayTeam||{},st=g.gameStatus||1;
  const comp=(t,side)=>({homeAway:side,team:{displayName:t.teamName?((t.teamCity||'')+' '+t.teamName).trim():t.teamTricode,abbreviation:t.teamTricode},score:t.score,records:[]});
  return {id:String(g.gameId),date:g.gameTimeUTC||g.gameTime,competitions:[{competitors:[comp(away,'away'),comp(home,'home')]}],status:{type:{state:st===3?'post':st===2?'in':'pre',shortDetail:g.gameStatusText||''}}};
 })};
}
function fromArchive(p){return {events:(p.games||[]).map(g=>({id:g.id?.replace(/^espn-nba-/,'')||'',date:g.date,competitions:[{competitors:(g.teams||[]).map(t=>({homeAway:t.home_away,team:{displayName:t.name,abbreviation:t.code},score:t.score}))}],status:{type:{state:g.state==='post'?'post':g.state==='in'?'in':'pre',shortDetail:g.status||'Scheduled'}}}))};}
async function update(){
 const easternKey=offset=>{const q=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+offset)).map(x=>[x.type,x.value]));return q.year+q.month+q.day};
 const today=easternKey(0),yesterday=easternKey(-24*3600000);
 const sources=[
  ['ESPN today','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+today+'&_='+Date.now(),x=>x],
  ['ESPN previous day','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+yesterday+'&_='+Date.now(),x=>x],
  ['NBA official fallback','https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',fromNba]
 ];
 const merged=new Map(),successful=[];
 for(const [name,url,normalize] of sources){
  try{
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),6500);
   let response;try{response=await fetch(url,{cache:'no-store',signal:ctrl.signal})}finally{clearTimeout(timeout)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=normalize(await response.json());
   if(!Array.isArray(data.events))throw Error('invalid events');
   successful.push(name);
   for(const event of data.events){
    const id=String(event.id||'');if(!id||merged.has(id))continue;
    const when=Date.parse(event.date||'');
    if(!Number.isFinite(when)||when<Date.now()-36*3600000||when>Date.now()+24*3600000)continue;
    const teams=event.competitions?.[0]?.competitors||[];
    const away=teams.find(x=>x.homeAway==='away')?.team?.abbreviation||'';
    const home=teams.find(x=>x.homeAway==='home')?.team?.abbreviation||'';
    const gameKey=away&&home?away+'-'+home+'-'+new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(when)):id;
    if(!merged.has(gameKey))merged.set(gameKey,event);
   }
  }catch(e){console.warn('NBA feed failed:',name,e.message)}
 }
 // Merge the published schedule even when a live provider returns an incomplete set.
 // Never let a successful but partial scoreboard silently erase a scheduled matchup.
 try{
  const response=await fetch('data/nba-upcoming-schedule.json?_='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const snapshot=await response.json();
  const publishedAt=Date.parse(snapshot.updated_at||'');
  const stale=!Number.isFinite(publishedAt)||Date.now()-publishedAt>30*60000;
  for(const event of fromArchive(snapshot).events){
   const when=Date.parse(event.date||'');
   if(!Number.isFinite(when)||when<Date.now()-48*3600000||when>Date.now()+24*3600000)continue;
   const teams=event.competitions?.[0]?.competitors||[];
   const away=teams.find(x=>x.homeAway==='away')?.team?.abbreviation||'';
   const home=teams.find(x=>x.homeAway==='home')?.team?.abbreviation||'';
   const gameKey=away&&home?away+'-'+home+'-'+new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(when)):String(event.id);
   if(merged.has(gameKey))continue;
   if(stale&&event.status?.type?.state==='in'){
    event.status.type.state='pre';
    event.status.type.shortDetail='Score update pending';
   }
   merged.set(gameKey,event);
  }
 }catch(e){console.warn('Published NBA schedule unavailable:',e.message)}
 if(merged.size){
  render({events:[...merged.values()]});lastOK=Date.now();
  status.textContent=(successful.length?'LIVE SOURCES · '+successful.join(' + '):'Live feeds unavailable · published snapshot')+' · checked '+new Date(lastOK).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET · refreshes every minute';
  return;
 }
 status.textContent='NBA score feeds unavailable · no recent game confirmed';
 root.innerHTML='<p class="hub-small">Recent scores could not be verified. <a href="nba-game-center.html">Open the verified game archive</a>.</p>';
}
refreshRecords().then(update);setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();