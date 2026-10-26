(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const articleOK=a=>a&&String(a.category||'').trim().toLowerCase()==='premier league'&&typeof a.title==='string'&&/^https:\/\//i.test(String(a.url||''))&&!/\/(rugby-union|rugby-league|cricket|tennis|golf)\//i.test(String(a.url||''))&&!/^nostalgia\s*-/i.test(a.title);
const time=s=>{const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}):'Date unavailable'};
let loading=false;
async function refresh(){
 if(loading)return;loading=true;
 const main=document.getElementById('epl-independent-news'),status=document.getElementById('epl-independent-news-status');
 if(!main){loading=false;return;}
 try{
  const res=await fetch('articles.json?epl_news='+(Math.floor(Date.now()/60000)),{cache:'no-store'});
  if(!res.ok)throw Error('Feed HTTP '+res.status);
  const feed=await res.json(),seen=new Set();
  const articles=(Array.isArray(feed.articles)?feed.articles:[]).filter(articleOK).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0)).filter(a=>{const k=a.url.split('#')[0];if(seen.has(k))return false;seen.add(k);return true;});
  if(!articles.length){main.innerHTML='<p>No verified Premier League stories in the current collection.</p>';status.textContent='Collection checked '+time(feed.updated_at);return;}
  const age=Date.now()-Date.parse(feed.updated_at),delayed=!Number.isFinite(age)||age>2*3600000;
  status.textContent=articles.length+' Premier League stories · Collected '+time(feed.updated_at)+(delayed?' · Feed update overdue':'');
  main.innerHTML=articles.slice(0,18).map((a,i)=>'<article class="epl-news-article'+(i===0?' epl-news-lead':'')+'"><p class="epl-news-byline">'+esc(a.source||'Publisher')+' · '+esc(time(a.published_at))+'</p><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3>'+(i===0&&/^https:\/\//i.test(String(a.image_url||''))?'<img class="epl-news-photo" loading="lazy" alt="" src="'+esc(a.image_url)+'">':'')+(a.summary?'<p>'+esc(a.summary).slice(0,i===0?280:150)+'</p>':'')+'</article>').join('');
 }catch(err){status.textContent='News refresh unavailable';if(!main.querySelector('.epl-news-article'))main.innerHTML='<p>Premier League headlines are temporarily unavailable. <a href="newspaper.html">Read the newspaper edition</a>.</p>';}
 finally{loading=false;}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();