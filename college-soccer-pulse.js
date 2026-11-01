(()=>{'use strict';
const root=document.getElementById('cs-current-scoreboard');if(!root)return;
const el=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e};
async function read(file){const r=await fetch('data/'+file+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('source unavailable');return r.json()}
async function render(){try{
 const [elo,live]=await Promise.all([read('college-soccer-elo.json'),read('college-soccer-live-scores.json').catch(()=>null)]);
 const recent=Array.isArray(elo.latest_finals)?elo.latest_finals:[];
 root.replaceChildren();
 const heading=el('div','cs-wire-heading');heading.append(el('strong',null,'THE MATCHDAY WIRE'),el('span',null,'VERIFIED FINALS THROUGH '+(elo.as_of||'unavailable')));root.append(heading);
 const fresh=live?.checked_at_utc?Date.now()-new Date(live.checked_at_utc).getTime()<20*60*1000:false;
 const liveCount=fresh?(live.games||[]).filter(g=>g.status==='live').length:0;
 root.append(el('div','cs-wire-strap',liveCount?liveCount+' match'+(liveCount===1?'':'es')+' live · NCAA scores last checked '+new Date(live.checked_at_utc).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Latest verified results · a live status appears only when the source check is recent'));
 const rail=el('div','cs-wire-rail');
 recent.slice(0,4).forEach(g=>{
  const a=el('a','cs-wire-game');a.href='college-soccer-match.html?game='+encodeURIComponent(g.match_id);
  a.append(el('span','cs-wire-game-tag',g.cohort.replace('-d',' · D').toUpperCase()+' · '+g.date));
  const teams=el('span','cs-wire-teams');
  teams.append(el('span',null,g.away),el('b',null,g.score.replace('-',' – ')),el('span',null,g.home));
  a.append(teams);rail.append(a)
 });
 if(!rail.children.length)rail.append(el('p',null,'No verified final scores available.'));
 root.append(rail);
 const foot=el('a','cs-wire-more','OPEN MATCHDAY, RECORDS & FORECASTS →');foot.href='#college-soccer-visual-desk';root.append(foot)
 }catch(error){root.replaceChildren(el('p','cs-wire-unavailable','Recent results temporarily unavailable. Check the matchday desk for verified coverage.'))}}
render();setInterval(()=>{if(document.visibilityState==='visible')render()},180000)
})();