(()=>{'use strict';
const root=document.getElementById('nba-live-feed');if(!root)return;
const status=document.getElementById('nba-live-status');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=c=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[c]||c.toLowerCase())+'.png';
let lastOK=0;
function render(payload){
 const events=Array.isArray(payload.events)?payload.events:[];
 if(!events.length){root.innerHTML='<p class="hub-small">No NBA games listed for today.</p>';return;}
 const mapped=events.map(e=>{
  const co=e.competitions?.[0]||{};const cs=co.competitors||[];
  const away=cs.find(c=>c.homeAway==='away'),home=cs.find(c=>c.homeAway==='home');
  const st=e.status?.type||{},state=st.state||'pre',label=st.shortDetail||st.description||'Scheduled';
  if(!away||!home)return null;
  const team=c=>({name:c.team?.displayName||c.team?.name||'',code:c.team?.abbreviation||'',score:c.score??'',record:c.records?.find(r=>r.type==='total')?.summary||''});
  return {away:team(away),home:team(home),state,label,date:e.date,id:e.id};
 }).filter(Boolean);
 mapped.sort((a,b)=>({in:0,pre:1,post:2}[a.state]??3)-({in:0,pre:1,post:2}[b.state]??3));
 root.innerHTML=mapped.map(g=>{
  const playing=g.state==='in';const final=g.state==='post';const state=playing?'LIVE · '+g.label:final?'FINAL':new Date(g.date).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET';
  const team=t=>'<div class="nba-live-team"><img src="'+logo(esc(t.code))+'" alt="" loading="lazy"><span><b>'+esc(t.code)+'</b><small>'+esc(t.record)+'</small></span><strong>'+((playing||final)?esc(t.score):'–')+'</strong></div>';
  return '<a class="nba-live-match'+(playing?' playing':'')+'" href="nba-live-game.html?game='+encodeURIComponent(g.id)+'" aria-label="View live stats for '+esc(g.away.name)+' versus '+esc(g.home.name)+'"><div class="nba-live-match-head"><b>'+esc(state)+'</b><span>'+ (playing?'IN PROGRESS':final?'VERIFIED FEED FINAL':'TODAY')+'</span></div>'+team(g.away)+team(g.home)+'</a>'
 }).join('');
}
function fromNba(raw){
 const games=raw.scoreboard?.games||raw.games||[];
 return {events:games.map(g=>{
  const home=g.homeTeam||{},away=g.awayTeam||{},st=g.gameStatus||1;
  const comp=(t,side)=>({homeAway:side,team:{displayName:t.teamName?((t.teamCity||'')+' '+t.teamName).trim():t.teamTricode,abbreviation:t.teamTricode},score:t.score,records:[]});
  return {id:String(g.gameId),date:g.gameTimeUTC||g.gameTime,competitions:[{competitors:[comp(away,'away'),comp(home,'home')]}],status:{type:{state:st===3?'post':st===2?'in':'pre',shortDetail:g.gameStatusText||''}}};
 })};
}
function fromArchive(p){return {events:(p.games||[]).map(g=>({id:g.id?.replace(/^espn-nba-/,'')||'',date:g.date,competitions:[{competitors:(g.teams||[]).map(t=>({homeAway:t.home_away,team:{displayName:t.name,abbreviation:t.code},score:t.score}))}],status:{type:{state:g.state==='post'?'post':g.state==='in'?'in':'pre',shortDetail:g.status||'Scheduled'}}}))};}
async function update(){
 const dates=(()=>{const q=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return q.year+q.month+q.day})();
 const sources=[
 ['NBA live data','https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',fromNba],
 ['ESPN live data','https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+dates+'&_='+Date.now(),x=>x],
 ['published schedule','data/nba-upcoming-schedule.json?_='+Date.now(),fromArchive]
 ];
 for(const [name,url,normalize] of sources){
  try{
   const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),6500);
   let response;try{response=await fetch(url,{cache:'no-store',signal:ctrl.signal})}finally{clearTimeout(timeout)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=normalize(await response.json());if(!data.events?.length)throw Error('empty');
   render(data);lastOK=Date.now();
   status.textContent=(name==='published schedule'?'Live feeds unavailable · showing latest published schedule':'LIVE SOURCE · '+name)+' · checked '+new Date(lastOK).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET · refreshes every minute';
   return;
  }catch(e){console.warn('NBA feed failed:',name,e.message)}
 }
 status.textContent='Live sources unavailable · no current score is confirmed';
 root.innerHTML='<p class="hub-small">Live scores could not be verified. <a href="nba-game-center.html">Open the verified game archive</a>.</p>';
}
update();setInterval(()=>{if(!document.hidden)update()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();