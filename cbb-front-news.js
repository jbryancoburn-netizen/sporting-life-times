(()=>{'use strict';
const root=document.getElementById('cbb-front-news');
const stamp=document.getElementById('cbb-news-stamp');
if(!root||!stamp)return;

const wirePath='data/cbb-national-news.json';
const repositoryWire='https://raw.githubusercontent.com/jbryancoburn-netizen/sporting-life-times/main/'+wirePath;
const freshnessLimit=90*60*1000, maxStoryAge=72*60*60*1000;
let latestWire=null, lastRepositoryCheck=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const time=t=>{const d=new Date(t);return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'unknown'};
const womenMark=/\b(?:women(?:['’]s)?|womens|ncaaw|wbb|lady\s+\w+|ladies)\b/i;
const menMark=/\b(?:men(?:['’]s)?|mens|ncaam|mbb)\b/i;
const basketball=/\b(?:basketball|hoops|march madness|final four|ncaaw|ncaam|mbb|wbb)\b/i;
const unrelated=/\b(?:football|CFP|NFL|NBA|WNBA|MLB|NHL|soccer|baseball|hockey|quarterback|wide receiver|bowl game)\b/i;
const low=/\b(?:sportsbook|promo code|bonus bets?|parlay|wager|odds|betting|best bets?|picks|where to watch|how to watch|live stream|tv channel|highlights|top \d+ plays)\b/i;
const significant=/\b(?:upset|stuns?|shocks?|ranked|top 25|poll|ncaa tournament|bracket|champion|record|historic|major injury|suspension)\b/i;
const results=/\b(?:routs?|defeats?|beats?|edges?|holds off|falls? to|knocks off|survives?|victor(?:y|ies)|wins?|loss|loses?|rallies|comeback)\b/i;
const development=/\b(?:transfer|recruit|commit|injur|coach|conference|returns?|sidelined)\b/i;

async function get(path){
  try{
    const sep=path.includes('?')?'&':'?';
    const r=await fetch(path+sep+'t='+Date.now(),{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
    return r.ok?await r.json():null;
  }catch{return null}
}
const updatedAt=data=>{const t=Date.parse(data?.updated_at||'');return Number.isFinite(t)&&t<=Date.now()+5*60000&&Array.isArray(data?.articles)?t:0};
function validWire(data){
  if(!updatedAt(data))return false;
  const genders=new Set(data.articles.filter(a=>a?.title&&a?.source&&/^https:\/\//.test(a.url||'')).map(a=>a.gender));
  return genders.has('men')&&genders.has('women');
}
async function nationalWire(){
  const pages=await get(wirePath);
  if(validWire(pages)&&updatedAt(pages)>updatedAt(latestWire))latestWire=pages;
  if((!validWire(pages)||Date.now()-updatedAt(pages)>35*60000)&&Date.now()-lastRepositoryCheck>=5*60000){
    lastRepositoryCheck=Date.now();
    const repository=await get(repositoryWire);
    if(validWire(repository)&&updatedAt(repository)>updatedAt(latestWire))latestWire=repository;
  }
  return latestWire;
}
function correctEdition(a,edition){
  if(a?.gender!==edition||!a.title||!a.source||!/^https:\/\//.test(a.url||''))return false;
  const title=String(a.title);
  if(unrelated.test(title)||low.test(title))return false;
  const isWomen=womenMark.test(title),isMen=menMark.test(title);
  if(isWomen&&isMen)return false;
  if(isWomen)return edition==='women'&&basketball.test(title);
  if(isMen)return edition==='men'&&basketball.test(title);
  // Only the dedicated basketball publisher feed or identified team reporting
  // can classify an otherwise ambiguous title. Historical Google query tags do not.
  return a.gender_evidence==='verified_basketball_feed'&&
         (a.origin==='publisher RSS'||(a.origin==='school'&&basketball.test(title)));
}
function rank(a){
  if(Number.isFinite(Number(a.editorial_score)))return Number(a.editorial_score);
  const t=a.title||'',hours=Math.max(0,(Date.now()-Date.parse(a.published_at))/3600000);
  return (significant.test(t)?40:0)+(results.test(t)?22:0)+(development.test(t)?15:0)
     +(a.link_type==='publisher'?12:0)-Math.min(36,hours*.75);
}
const words=t=>String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>2&&!['the','and','for','with','college','basketball','ncaa','men','women','team','game','games'].includes(w));
function duplicate(a,b){
  const x=words(a.title),y=words(b.title),sa=new Set(x),sb=new Set(y);
  if(x.join('')===y.join(''))return true;
  const union=new Set([...sa,...sb]).size;
  return sa.size>=4&&sb.size>=4&&union>0&&[...sa].filter(w=>sb.has(w)).length/union>=.70;
}
function select(data,edition){
  const now=Date.now();
  const candidates=(data?.articles||[]).filter(a=>{
    const published=Date.parse(a.published_at||'');
    return Number.isFinite(published)&&published<=now+5*60000&&now-published<=maxStoryAge&&correctEdition(a,edition);
  }).sort((a,b)=>rank(b)-rank(a)||(Date.parse(b.published_at)-Date.parse(a.published_at)));
  const selected=[],sources=new Map();
  for(const article of candidates){
    const publisher=article.source.toLowerCase();
    if((sources.get(publisher)||0)>=4||selected.some(a=>a.url===article.url||duplicate(a,article)))continue;
    selected.push(article);
    sources.set(publisher,(sources.get(publisher)||0)+1);
    if(selected.length===15)break;
  }
  return selected;
}
function articleHTML(a,i){
  let url;try{const u=new URL(a.url);if(u.protocol!=='https:')return '';url=escape(u.href)}catch{return ''}
  const aggregator=(a.link_type==='aggregator'||new URL(a.url).hostname==='news.google.com');
  const attribution=escape(a.source)+(aggregator?' · via Google News':'')+' · '+escape(time(a.published_at))+' ET';
  return '<article class="cbb-news-story '+(i===0?'lead':'')+'">'
    +'<p class="cbb-news-eyebrow">'+attribution+'</p>'
    +'<h3><a href="'+url+'" target="_blank" rel="noopener noreferrer">'+escape(a.title)+'</a></h3>'
    +(a.summary?'<p class="cbb-news-description">'+escape(String(a.summary).slice(0,235))+'</p>':'')
    +'</article>';
}
async function refresh(){
  const edition=new URLSearchParams(location.search).get('gender')==='women'?'women':'men';
  const data=await nationalWire();
  const stories=select(data,edition);
  if(!stories.length){
    root.innerHTML='<p class="cbb-news-empty">No recently verified '+(edition==='women'?'women’s':'men’s')+' basketball reporting is available. The news desk will publish again after its source checks pass.</p>';
    stamp.textContent='No current verified headlines';
    return;
  }
  root.innerHTML='<div class="cbb-news-grid">'+stories.map(articleHTML).join('')+'</div>';
  const age=Date.now()-updatedAt(data);
  stamp.textContent=(age>freshnessLimit?'Reporting feed delayed · Last collected ':'National wire updated ')+time(data.updated_at)+' ET';
}
refresh();
setInterval(()=>{if(!document.hidden)refresh()},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();