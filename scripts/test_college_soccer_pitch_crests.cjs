/* Contract test for soccer matchday crest ownership and fallback. No browser dependencies. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('college-soccer-pulse.js','utf8');
const palette=JSON.parse(fs.readFileSync('data/dual-ring-team-palette.json','utf8'));
const overrides=JSON.parse(fs.readFileSync('data/college-soccer-crest-overrides.json','utf8'));
const brand=JSON.parse(fs.readFileSync('data/college-soccer-team-branding.json','utf8'));
const shared=fs.readFileSync('slt-dual-ring.js','utf8');
const css=fs.readFileSync('college-soccer-pitch.css','utf8');
assert(shared.includes("if(league==='soccer'&&img.closest('.cs-pitch-badge'))return;"),'Legacy decorator must not paint pitch badges');
assert(css.includes('.cs-pitch-badge.has-school-colors::before'),'Only one secondary ring pseudo-element may be used');
assert(css.includes('.cs-pitch-badge.has-image .cs-pitch-initials{display:none!important}'),'Loaded crest must hide fallback initials');
assert(!source.includes("make('span','cs-mark'"),'Pitch badge must not inherit legacy mark ring stack');
for(const [slug,pair] of Object.entries(overrides.schools)){
 assert(/^#[0-9a-f]{6}$/i.test(pair.primary) && /^#[0-9a-f]{6}$/i.test(pair.secondary));
 assert(pair.primary.toLowerCase()!==pair.secondary.toLowerCase());
 assert(pair.primary.toLowerCase()!=='#ffffff' && pair.secondary.toLowerCase()!=='#ffffff');
 assert(/^https:\/\//.test(pair.source), 'Brand-source citation required for '+slug);
}
class Element{
 constructor(tag){this.tag=tag;this.classes=new Set();this.children=[];this.events={};this.styles={};this.style={setProperty:(key,value)=>{this.styles[key]=value}};this.classList={add:(key)=>this.classes.add(key),remove:(key)=>this.classes.delete(key),contains:(key)=>this.classes.has(key)};this.naturalWidth=0;this.removed=false;}
 append(...children){this.children.push(...children);for(const child of children)child.parent=this;}
 addEventListener(k,v){this.events[k]=v;}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 set src(v){this.source=v;}
 get src(){return this.source;}
}
const make=(tag,classes,value)=>{const e=new Element(tag);for(const c of String(classes||'').split(' ').filter(Boolean))e.classes.add(c);if(value!==undefined&&value!==null)e.textContent=String(value);return e};
const start=source.indexOf('function mark('),end=source.indexOf('\nfunction oneCard(',start);
assert(start>=0&&end>start);
const mark=new Function('make','return ('+source.slice(start,end)+')')(make);
function check(name,id,cohort,expected,primary,secondary){
 const shell=mark(name,id,cohort,brand,palette,overrides),badge=shell.children[0];
 assert.equal(shell.classList.contains('cs-pitch-crest'),true);
 assert.equal(badge.classList.contains('cs-pitch-badge'),true);
 assert.equal(badge.classList.contains('has-school-colors'),expected,'Bad palette for '+cohort+':'+id);
 if(primary)assert.equal(badge.styles['--crest-primary'].toLowerCase(),primary.toLowerCase());
 if(secondary)assert.equal(badge.styles['--crest-secondary'].toLowerCase(),secondary.toLowerCase());
 const fallback=badge.children.find(x=>x.classList.contains('cs-pitch-initials'));
 const img=badge.children.find(x=>x.tag==='img');
 assert(fallback,'Missing fallback for '+id);
 assert(img,'Missing logo candidate for '+id);
 assert(!badge.classList.contains('has-image'));
 assert(!badge.textContent,'Initials must not appear as a raw text node underneath school logo');
 img.naturalWidth=120;img.events.load();
 assert(badge.classList.contains('has-image'));
 img.events.error();
 assert(!badge.classList.contains('has-image')&&img.removed);
}
check('Georgetown','georgetown','men-d1',true,palette.soccer['men-d1:georgetown'].primary,palette.soccer['men-d1:georgetown'].secondary);
check('Houston Christian','houston-christian','women-d1',true,palette.soccer['men-d1:houston-christian'].primary,palette.soccer['men-d1:houston-christian'].secondary);
check('Lamar University','lamar','women-d1',true,overrides.schools.lamar.primary,overrides.schools.lamar.secondary);
check('Cal Poly Pomona','cal-poly-pomona','men-d2',true,overrides.schools['cal-poly-pomona'].primary,overrides.schools['cal-poly-pomona'].secondary);
check('Cal St. San Marcos','cal-st-san-marcos','men-d2',true,overrides.schools['cal-st-san-marcos'].primary,overrides.schools['cal-st-san-marcos'].secondary);
check('Stanislaus St.','cal-st-stanislaus','women-d2',true,overrides.schools['cal-st-stanislaus'].primary,overrides.schools['cal-st-stanislaus'].secondary);
check('Unknown School','no-such-program','women-d3',false);
console.log('PASS: 7 NCAA crest cases; correct source palette, no initials over logos, no extra rings, safe fallback.');
