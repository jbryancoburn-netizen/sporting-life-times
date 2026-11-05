(()=>{'use strict';
const root=document.getElementById('soccer-matchday-games'),note=document.getElementById('soccer-matchday-status');
if(!root||!note)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tab='live',last=null;
const label=(name,score)=>'<div class="soccer-match-team"><span>'+esc(name)+'</span><strong>'+(Number.isInteger(score)?score:'—')+'</strong></div>';
function render(){
if(!last)return;
const {feed,ratings}=last;
const checked=Date.parse(feed.checked_at_utc||'');
const fresh=Number.isFinite(checked)&&Date.now()-checked>=-60000&&Date.now()-checked<900000;
const games=(feed.games||[]).filter(g=>g.cohort==='men-d1'&&g.match_id&&g.home_name&&g.away_name);
const live=fresh?games.filter(g=>g.status==='live'):[];
const finals=games.filter(g=>g.status==='final');
if(tab==='live'&&!live.length)tab='final';
const shown=tab==='live'?live:finals;
const stamp=Number.isFinite(checked)?new Date(checked).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'unavailable';
note.textContent=(fresh?'Source-verified NCAA match feed':'Live score feed delayed')+' · Checked '+stamp+' ET · '+live.length+' live · '+finals.length+' final'+(ratings?' · RETRO ratings through '+ratings.as_of:'');
const tabs='<div class="soccer-match-tabs" role="group" aria-label="Match status"><button type="button" data-status="live" '+(!live.length?'disabled':'')+' aria-pressed="'+(tab==='live')+'">Live ('+live.length+')</button><button type="button" data-status="final" aria-pressed="'+(tab==='final')+'">Final ('+finals.length+')</button></div>';
const cards=shown.map(g=>'<a class="soccer-match-card" href="college-soccer-match.html?game='+encodeURIComponent(g.match_id)+'"><span class="soccer-match-card-label">MEN’S DIVISION I · '+esc(tab==='live'?(g.period||'LIVE'):'FINAL')+'</span>'+label(g.away_name,g.away_score)+label(g.home_name,g.home_score)+'<span class="soccer-match-open">MATCH REPORT ↗</span></a>').join('');
root.innerHTML=tabs+'<div class="soccer-match-grid">'+(cards||'<p>No verified matches are available for this view.</p>')+'</div>';
root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{tab=b.dataset.status;render()});
}
async function refresh(){
try{
const [response,elo]=await Promise.all([fetch('data/college-soccer-live-scores.json?t='+Date.now(),{cache:'no-store'}),fetch('data/college-soccer-elo.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
if(!response.ok)throw Error('HTTP '+response.status);
last={feed:await response.json(),ratings:elo};render();
}catch(e){note.textContent='The verified soccer match feed is temporarily unavailable. '+e.message;root.replaceChildren();}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();