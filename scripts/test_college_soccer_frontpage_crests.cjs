'use strict';
/* One-source-of-truth soccer logo test — actual renderer + CSS ownership. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const matchJs=fs.readFileSync('college-soccer-visual-desk.js','utf8');
const selectionJs=fs.readFileSync('college-soccer-showcase.js','utf8');
const dual=fs.readFileSync('slt-dual-ring.js','utf8');
const css=fs.readFileSync('college-soccer-pitch.css','utf8');
const palette=JSON.parse(fs.readFileSync('data/dual-ring-team-palette.json','utf8'));
const branding=JSON.parse(fs.readFileSync('data/college-soccer-team-branding.json','utf8'));
const overrides=JSON.parse(fs.readFileSync('data/college-soccer-crest-overrides.json','utf8'));
assert(dual.includes("img.closest('#college-soccer-visual-desk .cs-mark,#cs-showcase .cs-showcase-logo')"),'Legacy decorator must skip these exact crests');
assert(css.includes('2026-11-01 school crest audit'),'Mobile badge repair missing');
assert(css.includes('.cs-mark.has-school-colors::before')&&css.includes('.cs-showcase-logo.has-school-colors::before'),'One inner secondary ring only');
assert(css.includes('width:49px!important'),'Matchday badges should be legible on phones');
assert(css.includes('width:53px!important'),'Selection disagreement cards should display larger logos');
assert(!matchJs.includes("make('span','cs-mark'"),'Main desk must not reintroduce pitch-style ring wrapper');
class El{
 constructor(tag){this.tag=tag;this.children=[];this.className='';this.attrs={};this.properties={};this.style={setProperty:(k,v)=>this.properties[k]=v};this.classList={add:k=>this.className+=' '+k,remove:k=>this.className=this.className.replace(k,'')};this.events={};this.naturalWidth=0;this.textContent='';}
 append(...items){this.children.push(...items);items.forEach(i=>{if(typeof i==='object')i.parent=this;})}
 addEventListener(k,fn){this.events[k]=fn}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 set src(v){this.imageSrc=v}
 get src(){return this.imageSrc}
}
const E=(tag,text,cls)=>{const e=new El(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e};
const link=name=>E('a',name);
const logoFor=(cohort,id)=>branding.teams?.[cohort+':'+id]?.logo_url||branding.teams?.['men-d1:'+id]?.logo_url||'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg';
const start=matchJs.indexOf('const club='),end=matchJs.indexOf('\nconst row=',start);
assert(start>=0&&end>start,'Visual desk club function missing');
let brand=branding;
const club=new Function('E','link','logoFor','brand','palette','overrides','return ('+matchJs.slice(start,end).replace(/;\s*$/,'')+')')(E,link,logoFor,brand,palette,overrides);
const sj=selectionJs.indexOf('const badge='),se=selectionJs.indexOf(';async function render(){',sj);
assert(sj>=0&&se>sj,'Selection badge renderer missing');
const S=(tag,cls,txt)=>{const e=new El(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
const badge=new Function('E','return ('+selectionJs.slice(sj,se)+')')(S);
const rows=[
 ['men-d1','georgetown','Georgetown'],
 ['men-d1','memphis','Memphis'],
 ['women-d1','memphis','Memphis'],
 ['men-d1','smu','SMU'],
 ['women-d1','howard','Howard'],
 ['men-d2','cal-poly-pomona','Cal Poly Pomona']
];
for(const [cohort,id,name] of rows){
 const wrap=club(name,cohort,id);
 const mark=wrap.children[0];
 const colors=palette.soccer?.[cohort+':'+id]||(cohort==='women-d1'?palette.soccer?.['men-d1:'+id]:null)||overrides.schools?.[id];
 assert(mark.className.includes('has-school-colors'),cohort+':'+id+' must use school palette');
 assert.equal(mark.properties['--crest-primary'].toLowerCase(),colors.primary.toLowerCase());
 assert.equal(mark.properties['--crest-secondary'].toLowerCase(),colors.secondary.toLowerCase());
 assert(!mark.className.includes('slt-dual-shell'),'Cannot add duplicate ring shell');
 const img=mark.children.find(x=>x.tag==='img');
 assert(img,'Expected source crest image');
 assert(!mark.className.includes('cs-has-logo'));
 img.naturalWidth=200;img.events.load();
 assert(mark.className.includes('cs-has-logo'),'Loaded image must toggle without initials underneath');
}
for(const id of ['georgetown','smu','memphis']){
 const el=badge({team_id:id,team:id.toUpperCase(),conference:'big-east'},branding,palette);
 const mark=el.children[0];
 assert(mark.className.includes('has-school-colors'));
 assert.equal(mark.properties['--crest-primary'].toLowerCase(),palette.soccer['men-d1:'+id].primary.toLowerCase());
 assert(!mark.className.includes('slt-dual-shell'));
 const img=mark.children.find(x=>x.tag==='img');
 img.naturalWidth=150;img.events.load();
 assert(mark.className.includes('has-image'));
 assert.equal(mark.children.filter(x=>x.className.includes('cs-showcase-initials')).length,0,'Initial fallback must be removed on successful load');
}
console.log('PASS: 6 visual-desk and 3 selection crests use one owner, two color strokes, no initials overlap; mobile sizes checked.');
