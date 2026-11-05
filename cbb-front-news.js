(()=>{'use strict';
const root=document.getElementById('cbb-front-news'),stamp=document.getElementById('cbb-news-stamp');
if(!root)return;
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=async p=>{try{let r=await fetch(p+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});return r.ok?await r.json():null}catch{return null}};
const relevant=a=>{let t=(a.title||'')+' '+(a.summary||'');return !/\b(college football|nfl|nba|wnba|mlb|nhl|premier league|soccer|baseball|hockey)\b/i.test(t)&&(/\b(college basketball|ncaa basketball|men.s basketball|women.s basketball|basketball|march madness|hoops|final four|bracketology|AP top 25)\b/i.test(t)||/\b(MBB|WBB)\b/.test(a.category||''))};
const low=a=>/\b(odds|betting|bonus|promo|spread|parlay|watch|stream|tv channel|where to watch|prediction|picks|top 5 plays|highlights)\b/i.test(a.title||'');
const score=a=>{let t=a.title||'',s=0;if(/\b(NCAA|AP top 25|rankings|tournament|conference|national|upset|injur|transfer|commit|coach|victor|defeat|wins?|beats?)\b/i.test(t))s+=35;if(/\b(women|men|basketball)\b/i.test(t))s+=8;if(low(a))s-=90;let age=(Date.now()-new Date(a.published_at||0).getTime())/36e5;if(Number.isFinite(age))s+=Math.max(-50,30-age*1.5);return s};
const time=a=>{let d=new Date(a.published_at);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''};
const article=(a,i)=>{let href;try{let u=new URL(a.url);if(!/^https?:$/.test(u.protocol))return '';href=clean(u.href)}catch{return ''}return '<article class="cbb-news-story '+(i===0?'lead':'')+'"><p class="cbb-news-eyebrow">'+clean(a.source||'College basketball')+(time(a)?' · '+clean(time(a)):'')+'</p><h3><a href="'+href+'" target="_blank" rel="noopener noreferrer">'+clean(a.title)+'</a></h3>'+(a.summary&&!low(a)?'<p class="cbb-news-description">'+clean(a.summary.slice(0,235))+'</p>':'')+'</article>'};
async function refresh(){const [national,bigTen,dedicated]=await Promise.all([get('articles.json'),get('data/mbb-team-news/big-ten.json'),get('data/cbb-national-news.json')]);let sources=[...(dedicated?.articles||[]),...(national?.articles||[]),...(bigTen?.articles||[])].filter(relevant);
const womens=new URLSearchParams(location.search).get('gender')==='women';
const explicitWomen=a=>/\b(?:women(?:'s|’s|s)?|lady|ladies|NCAAW|WBB)\b/i.test((a.title||'')+' '+(a.summary||'')) && /\b(?:basketball|hoops|NCAAW|WBB|lady|ladies)\b/i.test((a.title||'')+' '+(a.summary||''));
const explicitMen=a=>/\b(?:men(?:'s|’s|s)? basketball|MBB)\b/i.test((a.title||'')+' '+(a.summary||''));
if(womens){
  // Feed ingestion can mislabel school news as men, even when the headline explicitly says women.
  sources=sources.filter(a=>explicitWomen(a)||(a.gender==='women'&&!explicitMen(a)));
}else{
  sources=sources.filter(a=>!explicitWomen(a)&&a.gender!=='women'||explicitMen(a));
}const seen=new Set();sources=sources.filter(a=>{let key=(a.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,90);if(!a.url||!key||seen.has(key))return false;seen.add(key);return true});sources.sort((a,b)=>{const at=Date.parse(a.published_at||'')||0,bt=Date.parse(b.published_at||'')||0;return bt-at||score(b)-score(a)});const top=sources.filter(a=>!low(a));const selected=(top.length>=5?top:top.concat(sources.filter(low))).slice(0,15);if(!selected.length){root.innerHTML='<p class="cbb-news-empty">No current verified '+(new URLSearchParams(location.search).get('gender')==='women'?'women’s':'college basketball')+' stories in the newspaper wire. Explore the game and rankings desks below.</p>';stamp.textContent='Awaiting basketball reporting';return}root.innerHTML='<div class="cbb-news-grid">'+selected.map(article).join('')+'</div>';const updated=[dedicated?.updated_at,national?.updated_at,bigTen?.updated_at].map(x=>Date.parse(x)||0).reduce((a,b)=>Math.max(a,b),0);stamp.textContent='News wire checked '+new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'})+(updated?' · Last source update '+time({published_at:updated}):'');}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();