/* Sporting Life & Times: gender-aware, link-first college basketball front page.
   The full women's data desk remains at college-basketball.html?gender=women. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('gender')!=='women')return;
document.body.dataset.gender='women';
document.title='Women’s College Basketball | Sporting Life & Times';
const $=sel=>document.querySelector(sel);
const set=(selector,value)=>{const node=$(selector);if(node)node.textContent=value;};
const links=(panel,items)=>{const box=$(panel+' .slt-index-links');if(!box)return;box.replaceChildren();for(const [name,url] of items){const a=document.createElement('a');a.href=url;a.append(document.createTextNode(name+' '));const span=document.createElement('span');span.textContent='OPEN →';a.append(span);box.append(a);}};
const desk='college-basketball.html?gender=women';
set('.topline span','Women’s Division I · 2026–27');
set('.edition-line','The Women’s College Basketball Edition');
set('.slt-department-kicker span:first-child','SPORTING LIFE & TIMES / WOMEN’S COLLEGE BASKETBALL');
set('.slt-department-band p','Every women’s Division I conference, team, game and national story in one newspaper.');
set('.slt-index-folio span:first-child','WOMEN’S COLLEGE BASKETBALL / NATIONAL EDITION');
set('.slt-index-panel.slt-wide h2','Every Result in the Record');
set('.slt-index-panel.slt-wide > p:not(.slt-index-label)','Women’s schedules, results, and game reporting.');
set('.slt-index-panel.slt-narrow:nth-child(2) h2','The Women’s Power Index');
set('.slt-index-panel.slt-narrow:nth-child(2) > p:not(.slt-index-label)','Women-only RETRO ratings and conference races.');
set('.slt-index-panel.slt-narrow:nth-child(3) h2','The College Game');
set('.slt-index-panel.slt-narrow:nth-child(3) > p:not(.slt-index-label)','All 363 Division I programs and national coverage.');
links('.slt-index-panel.slt-wide',[
  ['Games & Results','ncaam-slate.html?gender=women'],['Live Gamefile','cbb-game-center.html?gender=women']
]);
links('.slt-index-panel.slt-narrow:nth-child(2)',[
  ['Women’s Ratings','ncaaw-rankings.html?poll=retro'],['Conference Desk',desk+'#wbb-standings']
]);
links('.slt-index-panel.slt-narrow:nth-child(3)',[
  ['Women’s Team Directory',desk+'#wbb-teams'],['Full Women’s Edition',desk]
]);
// Women's front page is editorial-first: lead stories immediately under the masthead,
// followed by the directory of newspaper departments. Move the real DOM section,
// keeping the existing live news renderer and its refresh schedule intact.
const newsSection=$('.cbb-front-edition');
const departmentIndex=$('.slt-edition-index');
if(newsSection&&departmentIndex){
 newsSection.after(departmentIndex);
 departmentIndex.setAttribute('aria-label','Explore the women’s basketball newspaper');
}
set('.cbb-front-head span:first-child','SPORTING LIFE & TIMES / THE WOMEN’S BASKETBALL WIRE');
set('#cbb-front-news-heading','The Leading Women’s Stories');
set('.cbb-front-deck','The most important reporting from the women’s college game, refreshed throughout the day.');
const nav=$('nav.cbb-universal-nav');
if(nav){nav.replaceChildren();
for(const [name,url] of [
 ['The Front Page','ncaam.html?gender=women'],
 ['Games & Schedule','ncaam-slate.html?gender=women'],
 ['Conferences',desk+'#wbb-standings'],
 ['Women’s Ratings','ncaaw-rankings.html?poll=retro'],
 ['Latest Stories','#cbb-front-news'],
 ['Team Directory',desk+'#wbb-teams'],
 ['All Sports','sports.html']]){
 const a=document.createElement('a');a.href=url;a.textContent=name;if(name==='The Front Page')a.setAttribute('aria-current','page');nav.append(a);
}}
})();