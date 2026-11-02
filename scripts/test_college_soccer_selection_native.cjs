'use strict';
/* Visual regression contract: no artificial circle/ring over native Selection Split logos. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const js=fs.readFileSync('college-soccer-selection.js','utf8');
const css=fs.readFileSync('college-soccer-selection.css','utf8');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
const generic=fs.readFileSync('slt-dual-ring.js','utf8');
const branding=JSON.parse(fs.readFileSync('data/college-soccer-team-branding.json','utf8'));
const palette=JSON.parse(fs.readFileSync('data/dual-ring-team-palette.json','utf8')).soccer;
assert(html.includes('college-soccer-selection.css?v=20261102-native-art2'),'Safari selection stylesheet cache is stale');
assert(html.includes('college-soccer-selection.js?v=20261102-native-art2'),'Safari selection renderer cache is stale');
assert(generic.includes('.soccer-school-mark,.ncaa-native-mark'),'Shared decorator still wraps native logos in rings');
assert(css.includes('#ncaa-selection-forecast .ncaa-native-mark .ncaa-native-image'),'No explicit natural-logo CSS');
assert(css.includes('clip-path:none!important')&&css.includes('border-radius:0!important'),'School artwork still clipped to ring geometry');
const start=js.indexOf('function nativeSchoolLogo('),end=js.indexOf('\nfunction draw(',start);
assert(start>=0&&end>start,'Selection native-logo functions missing');
class El {
 constructor(tag){this.tag=tag;this.className='';this.children=[];this.events={};this.textContent='';this.attrs={};this.dataset={};this.props={};this.hidden=false;this.naturalWidth=0;this.style={setProperty:(key,val)=>{this.props[key]=val}};this.classList={add:name=>{this.className+=' '+name},remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ')}}}
 append(...children){this.children.push(...children);for(const c of children)if(c instanceof El)c.parent=this}
 addEventListener(name,fn){this.events[name]=fn}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
 set src(v){this.source=v;this.sources=(this.sources||[]).concat(v)}
 get src(){return this.source}
}
const el=(tag,txt,cls)=>{const x=new El(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x};
const functions=new Function('el','return (function(){'+js.slice(js.indexOf('const brandFor='),end)+'\nreturn {nativeSchoolLogo,schoolRow};})()')(el);
const ids=['pittsburgh','south-carolina','michigan-st','xavier','notre-dame','uc-santa-barbara','syracuse','old-dominion','duquesne','unlv','cleveland-st','belmont','california-baptist','stony-brook','gardner-webb','utah-valley','grand-canyon','hofstra'];
const entries=new Set();
for(const id of ids){
 const row=functions.schoolRow({team:id.replaceAll('-',' '),team_id:id,bid_type:'projected_aq',conference:'men-d1:acc'},{...branding,soccer_palette:palette});
 const badge=row.children.find(x=>x.className.includes('ncaa-native-mark'));
 assert(badge,'Missing natural artwork: '+id);
 assert(!badge.className.includes('slt-mark')&&!badge.className.includes('slt-dual-shell')&&!badge.className.includes('soccer-school-mark'),'Nested rings: '+id);
 assert(!badge.attrs.border,'Decorative ring border: '+id);
 assert.equal(badge.children.filter(x=>x.tag==='img').length,1,'Expected true image: '+id);
 const img=badge.children.find(x=>x.tag==='img');
 assert(img.src&&img.src.startsWith('https://'),'Missing authentic logo URL: '+id);
 assert(img.className==='ncaa-native-image','Unscoped logo: '+id);
 img.naturalWidth=120;img.events.load();
 assert(badge.className.includes('has-image'),'Loaded image not visible: '+id);
 assert.equal(badge.children.find(x=>x.className==='ncaa-native-initial').hidden,true,'Initial fallback overlaps logo: '+id);
 assert.equal(row.children.filter(c=>c.tag==='span'&&c.className==='ncaa-school-meta').length,1,'Missing row details '+id);
 entries.add(id);
}
const noLogo={teams:{},soccer_palette:{},crest_overrides:{}};
const fallback=functions.nativeSchoolLogo({team:'A School',team_id:'no-logo-unlisted!'},noLogo);
assert.equal(fallback.children.filter(c=>c.tag==='img').length,0,'Invalid slug should not fetch arbitrary logo');
assert.equal(fallback.children.filter(c=>c.className==='ncaa-native-initial').length,1);
const broken=functions.nativeSchoolLogo({team:'Broken School',team_id:'broken-school'},{
 teams:{'men-d1:broken-school':{logo_url:'https://bad.example/missing.png'}},soccer_palette:{}});
const img=broken.children.find(c=>c.tag==='img');
for(let i=0;i<6&&!img.removed;i++)img.events.error();
assert(img.removed,'Failed images must leave a readable text fallback');
console.log('PASS: '+entries.size+' selection schools render authentic unframed logos without artificial rings, with fallback and iPhone stylesheet cache keys.');
