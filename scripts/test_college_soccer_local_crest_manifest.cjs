'use strict';
/* Verify every current NCAA-format bracket team uses a real local image,
 * and enforce 2026 seeded badges without adding an external-image dependency. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const f=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const manifest=f('data/college-soccer-local-crest-manifest.json');
const field=f('data/college-soccer-ncaa-selection-forecast.json').field;
const branding=f('data/college-soccer-team-branding.json');
const palette=f('data/dual-ring-team-palette.json').soccer;
const cup=fs.readFileSync('college-soccer-cup-ui.js','utf8');
const selection=fs.readFileSync('college-soccer-selection.js','utf8');
const bracket=fs.readFileSync('college-soccer-national-bracket.js','utf8');
const css=fs.readFileSync('college-soccer-national-bracket.css','utf8');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
assert.equal(manifest.covered_team_count,Object.keys(manifest.teams).length);
assert.equal(manifest.covered_team_count,211);
assert.deepEqual(manifest.unresolved,['men-d1:lindenwood-mo','men-d1:queens-nc']);
assert.equal(field.length,48);
assert.equal(new Set(field.map(x=>x.team_id)).size,48);
for(const [key,entry] of Object.entries(manifest.teams)){
 assert(/^assets\/cbb-[a-z0-9/-]+\.png$/.test(entry.src),key+' unsafe local path');
 assert(fs.existsSync(entry.src),key+' missing local file: '+entry.src);
 assert(fs.statSync(entry.src).size>1000,key+' empty/suspicious asset');
 assert(['artwork','precomposed'].includes(entry.render_mode),key+' unsupported rendering');
}
for(const entry of field){
 const key='men-d1:'+entry.team_id;
 assert(manifest.teams[key],entry.team+' missing local logo mapping');
 assert.equal(manifest.teams[key].render_mode,'artwork',entry.team+' would double-render a precomposed ring');
}
assert(selection.includes("file('data/college-soccer-local-crest-manifest.json')"),
 'Selection must load approved local crests before creating any team marks');
assert(bracket.includes("window.CollegeSoccerCupUI.crest(team.team,team.team_id,'men-d1',branding)"),
 'National bracket must use the common two-ring crest');
assert(bracket.includes('snb-seed-badge')&&css.includes('.snb-seed-badge'),
 'The NCAA-format bracket must display prominent projected seed numbers');
assert(bracket.includes('forecastSeed=team.forecast_rank<=24'),
 'The protected 24 team seed positions must display at every matchup');
assert(bracket.includes('NOT an official NCAA seed'),
 'Projected seeds must never be labeled as committee results');
assert(html.includes('college-soccer-cup-ui.js?v=')&&html.includes('college-soccer-national-bracket.js?v='),
 'The live HTML must reference versioned bracket scripts');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.className='';this.dataset={};this.style={cssText:'',props:{},setProperty:(k,v,p)=>this.style.props[k]={value:v,priority:p||''}};this.naturalWidth=0;this.naturalHeight=0;}
 append(...xs){for(const x of xs){this.children.push(x);if(x instanceof Element)x.parent=this;}}
 setAttribute(key,value){this[key]=value;}
 addEventListener(n,fn){this.events[n]=fn;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 set src(s){this.url=s;this.history=(this.history||[]).concat(s);}
 get src(){return this.url;}
}
const window={};
vm.runInNewContext(cup,{window,document:{createElement:t=>new Element(t)},Math,Number,String,RegExp,console},{timeout:1500});
for(const entry of field){
 const key='men-d1:'+entry.team_id;
 const mark=window.CollegeSoccerCupUI.crest(entry.team,entry.team_id,'men-d1',{
  ...branding,soccer_palette:palette,local_crests:manifest.teams
 });
 assert.equal(mark.dataset.logoOrigin,'repository-local',entry.team+' must load local first');
 assert.equal(mark.dataset.ringCount,'2',entry.team+' must preserve two colors');
 const img=mark.children.find(x=>x.tag==='img');
 assert(img,entry.team+' missing actual image');
 assert.equal(img.src,manifest.teams[key].src,entry.team+' loads external URL before archived logo');
 img.naturalWidth=150;img.naturalHeight=150;img.events.load();
 assert.equal(mark.dataset.logoStatus,'loaded',entry.team+' local image not loadable');
 assert.equal(mark.dataset.logoOrigin,'repository-local',entry.team+' incorrectly switched to external image');
 assert.equal(img.style.props.display.value,'block',entry.team+' image remains hidden');
}
console.log('PASS: all 48 current soccer bracket teams use local archived image first; 211/213 mapped Division I programs, 24 seed badges, no third-party dependency or duplicate rings.');
