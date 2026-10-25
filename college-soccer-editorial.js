(()=>{'use strict';
const root=document.getElementById('college-soccer-editorial');if(!root)return;
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
const showDate=s=>{const d=new Date(s);return isNaN(d)?'Date unavailable':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
const load=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p);return r.json();};
const nav=(href,name)=>{const a=el('a',name);a.href=href;if(/^https?:/.test(href)){a.target='_blank';a.rel='noopener noreferrer';}return a;};
const schoolLabel=(name,cohort,id)=>{
 const frag=el('span',null,'cs-edit-school');
 const badge=el('span',String(name).slice(0,2).toUpperCase(),'cs-edit-school-mark');
 if(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id||''))){
  const img=el('img');img.alt='';img.loading='lazy';img.decoding='async';
  img.src='https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg';
  img.addEventListener('load',()=>badge.classList.add('has-image'));
  img.addEventListener('error',()=>img.remove());badge.append(img);
 }
 frag.append(badge,nav('college-soccer-team.html?team='+encodeURIComponent(cohort+':'+id),name));
 return frag;
};
const tagged=(cohort,label)=>{const x=el('span',label,'cs-edit-tag');return x;};
(async()=>{try{
const [feed,ratings]=await Promise.all([load('data/college-soccer-team-news.json'),load('data/college-soccer-elo.json')]);
const articles=(feed.articles||[]).filter(a=>a.title&&/^https?:/.test(a.url)&&a.team_keys?.length).sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0));
root.replaceChildren();
const intro=el('div',null,'cs-edit-heading');intro.append(el('h2','Around the College Game'),el('span','SOURCED REPORTING · THE CHAMPIONSHIP RACE'));root.append(intro);
const layout=el('div',null,'cs-edit-columns');root.append(layout);
const stories=el('section',null,'cs-edit-stories');layout.append(stories);
const top=articles.slice(0,7);
if(top.length){
 const lead=top[0];const leadArticle=el('article',null,'cs-edit-lead');
 leadArticle.append(tagged(null,'THE LEAD STORY'),nav(lead.url,lead.title),el('p',(lead.source||'Original publisher')+' · '+showDate(lead.published_at),'cs-edit-byline'));
 if(lead.summary)leadArticle.append(el('p',lead.summary,'cs-edit-excerpt'));
 stories.append(leadArticle);
 const list=el('div',null,'cs-edit-headlines');
 for(const item of top.slice(1)){
  const story=el('article',null,'cs-edit-story');
  story.append(nav(item.url,item.title),el('small',(item.source||'Publisher')+' · '+showDate(item.published_at)));
  list.append(story);
 }stories.append(list);
}else stories.append(el('p','No verified program stories are available in this edition.','cs-edit-note'));
stories.append(el('p','Links open the original publisher. No synthetic or unsourced reporting is inserted.','cs-edit-note'));
const races=el('aside',null,'cs-edit-races');layout.append(races);
races.append(el('h3','The Race Watch'),el('p','Top of every division · Latest published independent Elo','cs-edit-note'));
for(const [key,label] of [['men-d1',"Men’s Division I"],['women-d1',"Women’s Division I"],['men-d2',"Men’s Division II"],['women-d2',"Women’s Division II"],['men-d3',"Men’s Division III"],['women-d3',"Women’s Division III"]]){
const cohort=ratings.cohorts?.[key];if(!cohort?.length)continue;
const winner=cohort[0],runner=cohort[1];
const block=el('div',null,'cs-edit-race');
block.append(el('small',label));
const lead=el('div',null,'cs-edit-race-lead');lead.append(schoolLabel(winner.team,key,winner.team_id),el('strong',Number(winner.elo).toFixed(1)));block.append(lead);
if(runner){const next=el('div',null,'cs-edit-race-chaser');next.append(schoolLabel(runner.team,key,runner.team_id),el('span',Number(runner.elo).toFixed(1)));block.append(next);}
races.append(block);
}
races.append(el('p','These are Elo leaders, not official conference standings or postseason qualification probabilities. Edition: '+String(ratings.as_of||'unknown')+'.','cs-edit-note'));
}catch(e){root.replaceChildren(el('p','College soccer editorial coverage is unavailable until the published source feeds load.','cs-edit-note'));console.error('College soccer editorial',e);}})();
})();