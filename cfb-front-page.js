/* College football editorial front: static sourced stories are usable without JavaScript.
   Refresh headlines from the published same-origin news wire; never blank the static edition. */
(()=>{'use strict';
 const grid=document.getElementById('cfb-headlines'),status=document.getElementById('cfb-news-status');
 if(!grid||!status)return;
 const filter=/\b(college football|ncaa football|fbs|cfp|college football playoff|bowl season)\b/i;
 const nonCfb=/\bnfl\b|professional football/i;
 const displayDate=s=>{const d=new Date(s||'');return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date unavailable'};
 function article(a,i){
  const item=document.createElement('article');
  const byline=document.createElement('p');byline.className='slt-front-byline';
  byline.textContent=(a.source||'Original publisher')+' · '+displayDate(a.published_at);
  const heading=document.createElement('h3'),link=document.createElement('a');
  link.href=a.url;link.rel='noopener noreferrer';link.target='_blank';link.textContent=a.title;
  heading.append(link);item.append(byline,heading);
  if(a.summary){const summary=document.createElement('p');summary.textContent=String(a.summary).replace(/<[^>]*>/g,'').slice(0,i===0?260:155);item.append(summary)}
  return item;
 }
 async function refresh(){
  if(document.hidden)return;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
  try{
   const response=await fetch('articles.json?cfb_news='+Math.floor(Date.now()/60000),{cache:'no-store',signal:abort.signal});
   if(!response.ok)throw Error('Source HTTP '+response.status);
   const feed=await response.json();
   if(!Array.isArray(feed.articles))throw Error('Invalid news feed');
   const seen=new Set();
   const stories=feed.articles.filter(a=>{
    if(!a||!a.title||!a.url)return false;
    const text=[a.title,a.summary,a.category].join(' ');
    if(!filter.test(text)||nonCfb.test(text))return false;
    try{const u=new URL(a.url);if(u.protocol!=='https:'&&u.protocol!=='http:')return false}catch(_){return false}
    const key=a.url.split('#')[0];if(seen.has(key))return false;seen.add(key);return true;
   }).sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0)).slice(0,12);
   if(!stories.length)throw Error('No college football stories in current source');
   grid.replaceChildren(...stories.map(article));
   status.textContent='News wire updated '+displayDate(feed.updated_at)+' ET · Checked '+displayDate(Date.now())+' ET';
  }catch(error){
   /* Keep already visible sourced articles and department links. */
   status.textContent='Showing last available sourced headlines · Live refresh temporarily unavailable';
  }finally{clearTimeout(timer)}
 }
 refresh();
 setInterval(refresh,300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();