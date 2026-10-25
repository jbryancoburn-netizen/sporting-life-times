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
 const programId=lead.team_keys?.[0];
const teamIndex=String(programId||'').indexOf(':');
const leaderCohort=teamIndex>=0?programId.slice(0,teamIndex):'';
const leaderId=teamIndex>=0?programId.slice(teamIndex+1):'';
const leadBadge=el('div',null,'cs-edit-lead-school');
if(leaderCohort&&leaderId){
 const matched=ratings.cohorts?.[leaderCohort]?.find(t=>t.team_id===leaderId);
 if(matched){
  const brandRow=schoolLabel(matched.team,leaderCohort,leaderId);
  leadBadge.append(brandRow,el('span','PROGRAM REPORT · '+leaderCohort.toUpperCase().replace('-',' ')));
 }
}
if(leadBadge.childNodes.length)leadArticle.append(leadBadge);
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
races.append(el('h3','The Results Notebook'),el('p','Recently verified finals across NCAA men’s and women’s Divisions I–III','cs-edit-note'));
const finals=(ratings.latest_finals||[]).filter(g=>g.cohort&&g.home&&g.away&&/^\\d+\\s*[-–]\\s*\\d+$/.test(String(g.score||'')))
 .sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0)).slice(0,9);
if(!finals.length)races.append(el('p','No recent verified finals in the current published edition.','cs-edit-note'));
for(const game of finals){
 const cohort=String(game.cohort),names=ratings.cohorts?.[cohort]||[];
 const home=names.find(t=>t.team===game.home),away=names.find(t=>t.team===game.away);
 const block=el('article',null,'cs-edit-race cs-edit-result');
 const division=/d([123])$/.exec(cohort)?.[1]||'?';
 const label=(cohort.startsWith('women')?'WOMEN’S':'MEN’S')+' DIVISION '+({1:'I',2:'II',3:'III'}[division]||division);
 block.append(el('small',label+' · '+showDate(game.date)));
 const matchup=el('div',null,'cs-edit-result-match');
 const namesRow=el('div',null,'cs-edit-result-teams');
 if(home)namesRow.append(schoolLabel(home.team,cohort,home.team_id));else namesRow.append(el('span',game.home));
 if(away)namesRow.append(schoolLabel(away.team,cohort,away.team_id));else namesRow.append(el('span',game.away));
 matchup.append(namesRow,el('strong',game.score,'cs-edit-result-score'));block.append(matchup);
 if(game.match_id)block.append(nav('college-soccer-match.html?game='+encodeURIComponent(game.match_id),'Match report & Elo →'));
 races.append(block);
}
races.append(el('p','Only scores recorded in the published verified-finals ledger are shown; this is not a complete NCAA scoreboard. Edition: '+String(ratings.as_of||'unknown')+'.','cs-edit-note'));
}catch(e){root.replaceChildren(el('p','College soccer editorial coverage is unavailable until the published source feeds load.','cs-edit-note'));console.error('College soccer editorial',e);}})();
})();