'use strict';
/* One owner, two strokes. Real palette fixtures reproduce the 2026 Selection Split. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cup=fs.readFileSync('college-soccer-cup-ui.js','utf8');
const generic=fs.readFileSync('slt-dual-ring.js','utf8');
const selection=fs.readFileSync('college-soccer-selection.js','utf8');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
const palette=JSON.parse(fs.readFileSync('data/dual-ring-team-palette.json','utf8')).soccer;
const brands=JSON.parse(fs.readFileSync('data/college-soccer-team-branding.json','utf8'));
const overrides=JSON.parse(fs.readFileSync('data/college-soccer-crest-overrides.json','utf8')).schools;
assert(!cup.includes("node('span','slt-mark soccer-school-mark')"),'Generic slt-mark class still adds extra borders');
assert(!cup.includes('slt-dual-shell'),'Legacy dual-shell belongs to the generic decorator, not Cup UI');
assert(generic.includes("img.closest('.cs-pitch-badge,.cs-match-badge,.soccer-school-mark,.ncaa-native-mark')"),'Shared decorator must explicitly skip owned soccer and natural-artwork crests');
assert(html.includes('college-soccer-cup-ui.js?v=20261102-single-owner1'),'Selection has stale renderer cache key');
assert(html.includes('soccer-native=20261102'),'Selection has stale generic decorator cache key');
assert(selection.includes("file('data/dual-ring-team-palette.json')"),'Selection fails to load actual school colors');
class Element{
 constructor(tag){this.tag=tag;this.className='';this.children=[];this.events={};this.attrs={};this.removed=false;this.naturalWidth=0;this.dataset={};this.style={
  cssText:'',props:{},setProperty:(k,v,p)=>{this.style.props[k]={value:v,priority:p||''}}
 };this.textContent='';}
 append(...items){for(const item of items){this.children.push(item);if(item instanceof Element)item.parent=this}}
 setAttribute(name,value){this.attrs[name]=value}
 addEventListener(k,v){this.events[k]=v}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 set src(v){this.source=v;this.sources=(this.sources||[]).concat(v)}
 get src(){return this.source}
}
const sandbox={document:{createElement:t=>new Element(t)},window:{},console,Math,Number,String,RegExp};
vm.runInNewContext(cup,sandbox,{timeout:1500});
const crest=sandbox.window.CollegeSoccerCupUI.crest;
const selectionIds=['syracuse','old-dominion','duquesne','unlv','cleveland-st','belmont','california-baptist','stony-brook','gardner-webb','utah-valley','grand-canyon','hofstra'];
for(const id of selectionIds){
 const key='men-d1:'+id,colors=palette[key];
 assert(colors,'Expected real palette for '+id);
 const school={...brands,soccer_palette:palette,crest_overrides:overrides};
 const mark=crest(id.replaceAll('-',' '),id,'men-d1',school);
 assert.equal(mark.className,'soccer-school-mark','A generic markup class added unnecessary ring for '+id);
 assert(mark.style.cssText.includes('border:2px solid '+colors.primary+'!important'),'Wrong primary ring for '+id);
 assert(mark.style.cssText.includes('box-shadow:none!important'),'Extraneous ring shadow for '+id);
 const strokes=mark.children.filter(n=>n.tag==='span'&&n.style.cssText.includes('border:2px solid '));
 assert.equal(strokes.length,1,'A third ring was added for '+id);
 assert(strokes[0].style.cssText.includes('border:2px solid '+colors.secondary+'!important'),'Wrong secondary ring '+id);
 const image=mark.children.find(n=>n.tag==='img');
 const fallback=mark.children.find(n=>n.className==='soccer-school-fallback');
 assert(image,'No primary image candidate '+id);
 assert(fallback,'No fallback image initials '+id);
 assert(image.style.cssText.includes('width:78%!important'),'Artwork too small/large '+id);
 assert(image.style.cssText.includes('clip-path:none!important'),'Logo cropped '+id);
 assert(image.style.cssText.includes('border-radius:0!important'),'Artwork should not inherit a third roundel');
 assert(image.src.startsWith('https://'),'Invalid image source for '+id);
 image.naturalWidth=400;image.events.load();
 assert.equal(image.style.props.display.value,'block','Image not visible when loaded '+id);
 assert.equal(fallback.style.props.display.value,'none','Initials overlay loaded image '+id);
}
const fallbackSchool={teams:{},soccer_palette:{},crest_overrides:{}};
const missing=crest('Unknown School','no-asset-school!','women-d3',fallbackSchool);
assert.equal(missing.children.filter(c=>c.tag==='img').length,0);
assert(missing.children.some(c=>c.className==='soccer-school-fallback'),'No fallback for missing asset');
const broken=crest('Broken Logo','bad-school','men-d1',{teams:{'men-d1:bad-school':{logo_url:'https://invalid.example/a.png',primary:'#112244'}},soccer_palette:{},crest_overrides:{}});
const img=broken.children.find(c=>c.tag==='img'),initials=broken.children.find(c=>c.className==='soccer-school-fallback');
assert(img&&img.events.error);
for(let i=0;i<6&&!img.removed;i++)img.events.error();
assert(img.removed,'Failed logo did not exhaust alternate verified school paths');
assert.equal(initials.style.props.display.value,'flex','Failed logo did not restore initials');
console.log('PASS: 12 pictured Selection Split crests use exactly two school-color strokes; no nested generic rings, no clipping, fallback verified.');
