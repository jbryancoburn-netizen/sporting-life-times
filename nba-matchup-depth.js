/* NBA pregame scouting and interactive current-Elo comparison. Never retrospective pregame claims. */
(function(w){'use strict';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):'—';
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[t]||t.toLowerCase())+'.png';
const games=c=>Array.isArray(c.data.current?.events)?c.data.current.events.filter(g=>Number.isFinite(+g.home_score)&&Number.isFinite(+g.away_score)&&g.home_score!==g.away_score).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)):[];
const won=(g,t)=>(g.home_score>g.away_score?g.home:g.away)===t;
const own=(c,t)=>games(c).filter(g=>g.home===t||g.away===t);
const rec=(c,t)=>(c.records[t]?.w||0)+'–'+(c.records[t]?.l||0);
const winProb=(c,a,h)=>1/(1+10**(-(c.rates[h]+45-c.rates[a])/400));
const name=(c,t)=>c.meta[t]?.[0]||t;
const form=(c,t)=>{const arr=own(c,t).slice(-5).reverse();return arr.length?arr.map(g=>'<span class="'+(won(g,t)?'win':'loss')+'" title="'+e(name(c,g.home===t?g.away:g.home))+'">'+(won(g,t)?'W':'L')+'</span>').join(''):'<small>No completed finals</small>'};
const stamp=g=>{const d=new Date(g.date);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Tipoff time unavailable'};
function analysis(c,a,h,g){
 if(!c.meta[a]||!c.meta[h]||a===h)return '<p class="depth-muted">Select two different NBA teams.</p>';
 const prob=winProb(c,a,h),hist=games(c).filter(g=>(g.home===h&&g.away===a)||(g.home===a&&g.away===h));
 const hw=hist.filter(g=>won(g,h)).length,aw=hist.length-hw,rA=c.records[a]||{},rH=c.records[h]||{};
 const ag=own(c,a).length,hg=own(c,h).length;
 const best=c.rates[h]>=c.rates[a]?h:a;
 const factors=[
  ['Stronger rating',name(c,best)+' currently ranks #'+(c.ordered.indexOf(best)+1)+' in USRS Elo. The home-floor adjustment is included separately.'],
  ['Five-game form',a+' is '+own(c,a).slice(-5).filter(g=>won(g,a)).length+'–'+own(c,a).slice(-5).filter(g=>!won(g,a)).length+' across its last '+Math.min(5,ag)+' finals; '+h+' is '+own(c,h).slice(-5).filter(g=>won(g,h)).length+'–'+own(c,h).slice(-5).filter(g=>!won(g,h)).length+' across '+Math.min(5,hg)+'.'],
  ['Season head-to-head',hist.length?h+' has won '+hw+' of '+hist.length+' completed meetings against '+a+' ('+h+' '+hw+'–'+aw+').':'No completed 2026–27 head-to-head game is present in the verified ledger.'],
  ['Scoring context',a+' averages '+(ag?n(rA.pf/ag):'—')+' scored / '+(ag?n(rA.pa/ag):'—')+' allowed; '+h+' averages '+(hg?n(rH.pf/hg):'—')+' scored / '+(hg?n(rH.pa/hg):'—')+' allowed in verified finals.']
 ];
 const side=t=>'<div class="depth-scout-side"><img src="'+logo(t)+'" alt=""><b>'+e(name(c,t))+'</b><small>'+rec(c,t)+' · Elo #'+(c.ordered.indexOf(t)+1)+'</small></div>';
 const label=g?'Scheduled NBA game':'Hypothetical pairing';
 return '<article class="depth-scout-card" style="--away:'+c.meta[a][3]+';--home:'+c.meta[h][3]+'"><div class="depth-scout-top"><span>'+label+'</span><span>'+(g?e(stamp(g)):'Current USRS ratings')+'</span></div><div class="depth-scout-teams">'+side(a)+'<span>AT</span>'+side(h)+'</div><div class="depth-scout-prob"><b>'+a+' · '+n(100*(1-prob))+'%</b><small>Independent Elo win probability</small><b>'+h+' · '+n(100*prob)+'%</b></div><div class="depth-scout-bar"><i style="width:'+(100*(1-prob)).toFixed(2)+'%"></i></div><div class="depth-scout-form"><div><small>'+a+' · LAST FIVE</small><div>'+form(c,a)+'</div></div><div><small>'+h+' · LAST FIVE</small><div>'+form(c,h)+'</div></div></div><div class="depth-scout-factors">'+factors.map(([k,v])=>'<div><small>'+e(k)+'</small><p>'+e(v)+'</p></div>').join('')+'</div>'+(g?.id?'<a class="depth-scout-link" href="nba-live-game.html?game='+encodeURIComponent(String(g.id).replace(/^espn-nba-/,''))+'">Game Center ↗</a>':'')+'</article>';
}
function render(c){
 const app=document.getElementById('app');if(!app)return;
 const upcoming=(c.data.schedule?.games||[]).filter(g=>g.state==='pre'&&Date.parse(g.date)>Date.now()&&g.teams?.length>=2).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const first=upcoming[0],a=first?.teams.find(x=>x.home_away==='away')?.code||'IND',h=first?.teams.find(x=>x.home_away==='home')?.code||'BOS';
 const options=x=>Object.keys(c.meta).sort((a,b)=>name(c,a).localeCompare(name(c,b))).map(k=>'<option value="'+k+'"'+(k===x?' selected':'')+'>'+e(name(c,k))+'</option>').join('');
 const room=document.createElement('section');room.className='depth-section depth-matchroom';
 room.innerHTML='<div class="depth-label">The scouting room</div><h2>Build a matchup</h2><p class="depth-muted">Set any two clubs for a current Elo win-probability comparison, recent form, scoring performance and actual season meetings. These are scenario estimates—not retroactive pregame forecasts.</p><div class="depth-selectors"><label>Away<select id="depth-away">'+options(a)+'</select></label><b>AT</b><label>Home<select id="depth-home">'+options(h)+'</select></label></div><div id="depth-scout-preview">'+analysis(c,a,h,null)+'</div>';
 const intro=app.querySelector('.nba-note');if(intro)intro.insertAdjacentElement('afterend',room);else app.prepend(room);
 function redraw(){room.querySelector('#depth-scout-preview').innerHTML=analysis(c,room.querySelector('#depth-away').value,room.querySelector('#depth-home').value,null)}
 room.querySelector('#depth-away').addEventListener('change',redraw);room.querySelector('#depth-home').addEventListener('change',redraw);
 const title=[...app.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Coming Up After Today');
 const list=title?.nextElementSibling;
 if(list){
 const day=d=>new Date(d).toLocaleDateString('en-US',{timeZone:'America/New_York'});
 const future=upcoming.filter(g=>day(g.date)!==day(new Date())).slice(0,8);
 list.classList.add('depth-matchup-list');list.innerHTML=future.map(g=>{const a=g.teams.find(x=>x.home_away==='away')?.code,h=g.teams.find(x=>x.home_away==='home')?.code;return c.meta[a]&&c.meta[h]?analysis(c,a,h,g):''}).join('')||'<p class="depth-muted">No scheduled games after today in the current published schedule window.</p>';
 }
}
w.NBAMatchupDepth=render;
})(window);
