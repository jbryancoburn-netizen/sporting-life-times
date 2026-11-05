(()=>{'use strict';
const root=document.getElementById('college-soccer-editorial');if(!root)return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n};
const date=s=>{const d=new Date(s);return Number.isNaN(+d)?'Date unavailable':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const load=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p+' '+r.status);return r.json()};
const nav=(href,name)=>{const a=el('a',name);a.href=href;if(href.startsWith('http')){a.target='_blank';a.rel='noopener noreferrer'}return a};
const active=()=>window.CollegeSoccerEdition?.get()||'men-d1';
const label=c=>window.CollegeSoccerEdition?.label(c)||c.toUpperCase();
let snapshots=null;
function schoolLabel(name,cohort,id,brands,palette){
 const frag=el('span',null,'cs-edit-school'),badge=el('span',null,'cs-edit-school-mark');
 const keys=[cohort+':'+id,'men-'+cohort.split('-')[1]+':'+id,'men-d1:'+id];
 const get=o=>keys.map(k=>o?.[k]).find(Boolean)||{};
 const b=get(brands?.teams),p=get(palette?.soccer);
 const fallback=el('span',String(b.badge_text||name||id||'SC').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase(),'cs-edit-school-initial');badge.append(fallback);
 const sources=[b.logo_url,p.logo_url,/^[a-z0-9-]+$/.test(id||'')?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg':null].filter(Boolean);
 if(sources.length){const img=el('img');img.alt='';img.loading='lazy';img.decoding='async';let i=0;const next=()=>{if(i<sources.length)img.src=sources[i++];else img.remove()};img.addEventListener('load',()=>{if(img.naturalWidth>0){badge.classList.add('has-image');fallback.remove()}else next()});img.addEventListener('error',next);badge.append(img);next()}
 frag.append(badge,nav('college-soccer-team.html?team='+encodeURIComponent(cohort+':'+id),name));return frag;
}
function render(){
 if(!snapshots)return;
 const {feed,ratings,brands,palette}=snapshots,cohort=active();
 const articles=(feed.articles||[]).filter(a=>a.title&&String(a.url||'').startsWith('http')&&a.team_keys?.some(key=>key.startsWith(cohort+':'))).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0)).slice(0,7);
 const finals=(ratings.latest_finals||[]).filter(g=>g.cohort===cohort&&g.home&&g.away&&g.match_id).sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0)).slice(0,9);
 root.replaceChildren();
 const intro=el('div',null,'cs-edit-heading');intro.append(el('h2','Around the College Game'),el('span','SOURCED REPORTING · '+label(cohort)));root.append(intro);
 const layout=el('div',null,'cs-edit-columns');root.append(layout);
 const stories=el('section',null,'cs-edit-stories');layout.append(stories);
 if(articles.length){
  const lead=articles[0],article=el('article',null,'cs-edit-lead');
  const key=lead.team_keys.find(k=>k.startsWith(cohort+':')),id=key?.slice(cohort.length+1);
  const team=ratings.cohorts?.[cohort]?.find(t=>t.team_id===id);
  if(team){const banner=el('div',null,'cs-edit-lead-school');banner.append(schoolLabel(team.team,cohort,id,brands,palette),el('span','PROGRAM REPORT · '+label(cohort)));article.append(banner)}
  article.append(el('span','THE LEAD STORY','cs-edit-tag'),nav(lead.url,lead.title),el('p',(lead.source||'Original publisher')+' · '+date(lead.published_at),'cs-edit-byline'));
  if(lead.summary)article.append(el('p',lead.summary,'cs-edit-excerpt'));
  stories.append(article);
  const headlines=el('div',null,'cs-edit-headlines');
  for(const item of articles.slice(1)){const itemNode=el('article',null,'cs-edit-story');itemNode.append(nav(item.url,item.title),el('small',(item.source||'Publisher')+' · '+date(item.published_at)));headlines.append(itemNode)}
  stories.append(headlines);
 }else stories.append(el('p','No independently sourced program headlines are currently tagged for '+label(cohort)+'. Other divisions’ stories are not substituted.','cs-edit-note'));
 stories.append(el('p','Reporting links open original publishers. No fabricated coverage.','cs-edit-note'));
 const races=el('aside',null,'cs-edit-races');layout.append(races);
 races.append(el('h3','The Results Notebook'),el('p','Latest verified '+label(cohort)+' match results','cs-edit-note'));
 if(!finals.length)races.append(el('p','No verified finals in this published edition.','cs-edit-note'));
 for(const game of finals){
  const teams=ratings.cohorts?.[cohort]||[],home=teams.find(t=>t.team===game.home),away=teams.find(t=>t.team===game.away);
  const block=el('article',null,'cs-edit-race cs-edit-result');block.append(el('small',label(cohort)+' · '+date(game.date)));
  const match=el('div',null,'cs-edit-result-match'),names=el('div',null,'cs-edit-result-teams');
  if(away)names.append(schoolLabel(away.team,cohort,away.team_id,brands,palette));else names.append(el('span',game.away));
  if(home)names.append(schoolLabel(home.team,cohort,home.team_id,brands,palette));else names.append(el('span',game.home));
  match.append(names,el('strong',game.score,'cs-edit-result-score'));block.append(match);
  block.append(nav('college-soccer-match.html?game='+encodeURIComponent(game.match_id),'Match report & Elo →'));races.append(block);
 }
 races.append(el('p','Scores come only from the verified NCAA final ledger · Elo through '+String(ratings.as_of||'unknown')+'.','cs-edit-note'));
}
async function refresh(){try{
 const [feed,ratings,brands,palette]=await Promise.all([load('data/college-soccer-team-news.json'),load('data/college-soccer-elo.json'),load('data/college-soccer-team-branding.json').catch(()=>({teams:{}})),load('data/dual-ring-team-palette.json').catch(()=>({soccer:{}}))]);
 snapshots={feed,ratings,brands,palette};render();
 }catch(err){if(!snapshots)root.replaceChildren(el('p','Source-backed soccer reporting is temporarily unavailable.','cs-edit-note'));console.warn('College soccer editorial',err)}}
window.addEventListener('college-soccer:edition',render);
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();