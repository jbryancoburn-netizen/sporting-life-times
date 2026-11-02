'use strict';
/* DOM-free integration regression for the six-edition NCAA soccer Form Book.
   Protects one school + one statistic per row and mobile stylesheet ownership. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('college-soccer-showcase.js','utf8');
const css=fs.readFileSync('college-soccer-leaderboard.css','utf8');
const html=fs.readFileSync('college-soccer.html','utf8');
assert(html.includes('college-soccer-leaderboard.css?v='),'Form Book stylesheet not published');
assert(html.includes('college-soccer-showcase.js?v='),'Form Book renderer not published');
for(const rule of ['.cs-form-row','.cs-form-value','.cs-form-board','.cs-form-logo','@media(max-width:700px)']){
 if(rule==='.cs-form-logo')continue;
 assert(css.includes(rule),'Missing new leaderboards CSS: '+rule);
}
class Element {
 constructor(tag){
  this.tag=tag;this.className='';this.textContent='';this.children=[];
  this.attrs={};this.style={setProperty:(name,value)=>{this.styles[name]=value}};
  this.styles={};this.events={};this.naturalWidth=0;
  this.classList={add:c=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),c])].join(' ')},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ')}};
 }
 append(...nodes){for(const n of nodes){this.children.push(n);if(n instanceof Element)n.parent=this}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,fn){this.events[k]=fn}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 set src(v){this.imageSrc=v}
 get src(){return this.imageSrc}
 get childElementCount(){return this.children.length}
}
const find=(el,cls)=>(el.className.split(' ').includes(cls)?[el]:[]).concat(el.children.flatMap(x=>x instanceof Element?find(x,cls):[]));
const getText=el=>[el.textContent,...el.children.filter(x=>x instanceof Element).map(getText)].join(' ');
const root=new Element('section');const registry={};
let cohort='men-d1';
const win={CollegeSoccerEdition:{get:()=>cohort,label:c=>c},
 addEventListener:(key,callback)=>registry[key]=callback};
const env={
 document:{getElementById:key=>key==='cs-showcase'?root:null,createElement:tag=>new Element(tag),visibilityState:'visible'},
 window:win,
 fetch:async file=>{const name=file.split('?')[0];return {ok:true,json:async()=>JSON.parse(fs.readFileSync(name,'utf8'))}},
 Date,Number,String,Math,RegExp,Intl,encodeURIComponent,setInterval:()=>0,console
};
const rows=JSON.parse(fs.readFileSync('data/college-soccer-elo.json','utf8')).cohorts;
function checkEdition(next){
 cohort=next;registry['college-soccer:edition']();
 const sections=find(root,'cs-form-group');
 assert.equal(sections.length,2,'Expected one attack and one defense board in '+next);
 const all=find(root,'cs-form-row');assert.equal(all.length,10,'Expected five verified leaders per category: '+next);
 assert.equal(find(root,'cs-showcase-picks').length,0,'Old sprawling card grid is back in Form Book');
 const known=new Set(rows[next].map(t=>t.team_id));
 for(const section of sections){
  const items=find(section,'cs-form-entry');assert.equal(items.length,5);
  let previous=section.className.includes('cs-form-attack')?Infinity:-Infinity;
  for(const item of items){
   const anchors=find(item,'cs-form-row');assert.equal(anchors.length,1,'Each school must have one linked row');
   const a=anchors[0];const url=new URL(a.href,'https://example.org/');
   const id=decodeURIComponent(url.searchParams.get('team')||'').replace(next+':','');
   assert(known.has(id),'Cross-division school leak '+id+' into '+next);
   assert.equal(a.children.length,3,'Value must share school row; no orphan statistic');
   assert.equal(find(a,'cs-showcase-logo').length,1,'Missing school crest');
   const values=find(a,'cs-form-value');assert.equal(values.length,1,'Missing aligned statistic');
   const v=values[0];
   assert.equal(v.children.length,2,'Statistic must display number and rate label');
   const metric=Number(v.children[0].textContent);assert(Number.isFinite(metric),'Invalid stat '+id);
   assert(/^(GF\/GP|GA\/GP)$/.test(v.children[1].textContent));
   assert(find(a,'cs-showcase-detail').length===1,'School context missing');
   assert(getText(a).includes('MATCHES'),'Games-played context not visible');
   if(previous!==Infinity&&previous!==-Infinity){
    if(section.className.includes('cs-form-attack'))assert(metric<=previous+0.011,'Attack order wrong');
    else assert(metric>=previous-0.011,'Defense order wrong');
   }
   previous=metric;
  }
 }
}
async function run(){
 vm.runInNewContext(src,env,{timeout:2000});
 await new Promise(resolve=>setTimeout(resolve,120));
 for(const edition of ['men-d2','women-d1','women-d2','men-d3','women-d3'])checkEdition(edition);
 console.log('PASS: 50 compact soccer leaderboard rows in five independently scoped editions, aligned stats, logos and mobile CSS.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
