/* SLT Courtside Wire — independent, non-invasive score and news ticker. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validURL=s=>{try{let u=new URL(s,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const etDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isWomen=()=>new URLSearchParams(location.search).get('gender')==='women';
let last=null,timer=null,active=0;
let scorePause=false,scoreInteracted=0,scoreLast=0;
function moveScores(t){
 const el=$('.cbb-wire-score-row');
 if(el&&!scorePause&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&Date.now()>scoreInteracted&&el.scrollWidth>el.clientWidth+5){
  if(scoreLast){const n=el.scrollLeft+Math.min((t-scoreLast)*.018,2);el.scrollLeft=n>=el.scrollWidth-el.clientWidth-3?0:n;}
 }
 scoreLast=t;requestAnimationFrame(moveScores);
}
function newsLoop(items){
 const el=$('#cbb-wire-news-track');if(!el)return;
 const key=items.map(a=>a.url).join('|');if(el.dataset.key===key)return;el.dataset.key=key;
 const h=items.length?items.map(a=>'<a href="'+escape(validURL(a.url))+'" target="_blank" rel="noopener noreferrer"><strong>'+escape(a.source||'NEWS')+'</strong> '+escape(a.title)+'</a>').join('<span class="cbb-wire-separator">◆</span>'):'<span>Headlines unavailable</span>';
 el.innerHTML='<div class="cbb-wire-news-group">'+h+'</div><div class="cbb-wire-news-group" aria-hidden="true">'+h+'</div>';
 el.style.setProperty('--cbb-news-duration',Math.max(40,items.length*8)+'s');
}

function normalize(g){
 const teams=Array.isArray(g.teams)?g.teams:[],away=teams[0]||{},home=teams[1]||{};
 const state=String(g.state||'').toLowerCase();
 return {id:String(g.id||''),away:away.name||'Away team',home:home.name||'Home team',awayScore:away.score??'',homeScore:home.score??'',awayLogo:validURL(away.logo),homeLogo:validURL(home.logo),state:state==='post'?'final':state==='in'?'live':'scheduled',status:g.status||'',date:g.date||''};
}
function womenGames(d){
 const games=d.ncaa_women_crosscheck?.games||[];
 return games.map(g=>({id:String(g.espn_id||''),away:g.away_name||'Away team',home:g.home_name||'Home team',awayScore:g.away_score??'',homeScore:g.home_score??'',awayLogo:'',homeLogo:'',state:g.phase==='final'?'final':g.phase==='live'?'live':'scheduled',status:g.phase==='final'?'Final':g.phase==='live'?'Live':'Scheduled',date:g.date||''}));
}
function scoreCard(g,women){
 const status=g.state==='live'?'LIVE':g.state==='final'?'FINAL':g.date?new Date(g.date).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}):'TBA';
 const path='cbb-game-center.html'+(women?'?gender=women':'');
 const link=g.id?'cbb-gamefile.html?'+(women?'gender=women&':'')+'day='+encodeURIComponent(etDate())+'&game='+encodeURIComponent(g.id):path;
 const logo=(src,name)=>src?'<img src="'+escape(src)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<span class="cbb-wire-monogram" aria-hidden="true">'+escape(name.slice(0,1))+'</span>';
 const showScore=g.state!=='scheduled';
 return '<a class="cbb-wire-game '+(g.state==='live'?'is-live':'')+'" href="'+escape(link)+'"><span class="cbb-wire-game-status">'+(g.state==='live'?'<span class="cbb-wire-dot"></span>':'')+escape(status)+'</span><span class="cbb-wire-match"><span class="cbb-wire-team">'+logo(g.awayLogo,g.away)+'<span>'+escape(g.away)+'</span><b>'+escape(showScore?g.awayScore:'')+'</b></span><span class="cbb-wire-team">'+logo(g.homeLogo,g.home)+'<span>'+escape(g.home)+'</span><b>'+escape(showScore?g.homeScore:'')+'</b></span></span></a>';
}
function draw(){
 const root=$('#cbb-courtside-wire');if(!root||!last)return;
 const w=isWomen();const games=w?womenGames(last):(last.games||[]).map(normalize);
 games.sort((a,b)=>({live:0,final:1,scheduled:2}[a.state]-{live:0,final:1,scheduled:2}[b.state])||String(a.date).localeCompare(String(b.date)));
 const deck=$('#cbb-wire-score-track');
 const focused=document.activeElement?.closest?.('.cbb-wire-game');
 if(deck&&!focused)deck.innerHTML=games.length?games.slice(0,55).map(g=>scoreCard(g,w)).join(''):'<span class="cbb-wire-empty">No '+(w?'women’s':'men’s')+' Division I games available for this date. <a href="cbb-game-center.html'+(w?'?gender=women':'')+'">Open Game Center →</a></span>';
 const news=(last.articles||[]).filter(a=>a.title&&validURL(a.url)&&(w?a.category==='WBB':a.category==='MBB')).slice(0,18);
 const newsTarget=$('#cbb-wire-news-track');
 newsLoop(news);
 const time=last.scores_updated_at||last.attempted_at;
 const stamp=$('#cbb-wire-updated');
 if(stamp)stamp.textContent=time&&Number.isFinite(+new Date(time))?'Updated '+new Date(time).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Latest available feed';
 root.dataset.ready='true';
}
async function refresh(){
 try{
 const response=await fetch('data/mbb-live.json?wire='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Feed unavailable');
 const obj=await response.json();if(!obj||!Array.isArray(obj.articles)||!Array.isArray(obj.games))throw Error('Feed malformed');
 last=obj;draw();
 }catch(e){const stamp=$('#cbb-wire-updated');if(stamp)stamp.textContent=last?'Feed delayed · showing last received update':'Feed temporarily unavailable';}
}
function mount(){
 const header=$('.wrap > header');if(!header||$('#cbb-courtside-wire'))return;
 const root=document.createElement('section');root.id='cbb-courtside-wire';root.className='cbb-wire';root.setAttribute('aria-label','Live college basketball scores and news');
 root.innerHTML='<div class="cbb-wire-top"><span class="cbb-wire-brand"><i aria-hidden="true"></i> THE COURTSIDE WIRE</span><span id="cbb-wire-updated">Connecting to the basketball desk…</span><a href="cbb-game-center.html">ALL SCORES ↗</a></div><div class="cbb-wire-score-row"><div class="cbb-wire-score-track" id="cbb-wire-score-track"><span class="cbb-wire-empty">Loading scores…</span></div></div><div class="cbb-wire-news-row"><span class="cbb-wire-news-label">LATEST <span aria-hidden="true">●</span></span><div class="cbb-wire-news-viewport"><div id="cbb-wire-news-track" class="cbb-wire-news-track">Loading basketball headlines…</div></div><a class="cbb-wire-news-more" href="ncaam.html#news">NEWS ↗</a></div>';
 header.insertAdjacentElement('afterend',root);
 const rail=root.querySelector('.cbb-wire-score-row');
 rail.addEventListener('mouseenter',()=>{scorePause=true});rail.addEventListener('mouseleave',()=>{scorePause=false;scoreInteracted=Date.now()+1000});
 rail.addEventListener('focusin',()=>{scorePause=true});rail.addEventListener('focusout',()=>{scorePause=false;scoreInteracted=Date.now()+1000});
 rail.addEventListener('touchstart',()=>{scoreInteracted=Date.now()+10000},{passive:true});
 rail.addEventListener('pointerdown',()=>{scoreInteracted=Date.now()+10000});
 rail.addEventListener('wheel',e=>{scoreInteracted=Date.now()+8000;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){rail.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
 requestAnimationFrame(moveScores);
 refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.addEventListener('popstate',draw);
 // Gender switches sometimes change page content without navigation.
 new MutationObserver(()=>{let w=isWomen();if(w!==active){active=w;draw()}}).observe(document.body,{attributes:true,attributeFilter:['class','data-gender']});
 active=isWomen();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();