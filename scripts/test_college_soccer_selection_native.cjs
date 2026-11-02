'use strict';
/* Guard the universal soccer rule against the former ringless Selection exception.
   All 18 schools photographed in the Selection Split must have real two-tone colors. */
const assert=require('node:assert/strict'),fs=require('fs');
const source=fs.readFileSync('college-soccer-selection.js','utf8');
const css=fs.readFileSync('college-soccer-selection.css','utf8');
const html=fs.readFileSync('college-soccer-selection.html','utf8');
const component=fs.readFileSync('college-soccer-cup-ui.js','utf8');
const decorator=fs.readFileSync('slt-dual-ring.js','utf8');
const colors=JSON.parse(fs.readFileSync('data/dual-ring-team-palette.json')).soccer;
const branding=JSON.parse(fs.readFileSync('data/college-soccer-team-branding.json')).teams;
assert(html.includes('college-soccer-selection.css?v=20261102-double-ring4'),'Safari stylesheet cache is stale');
assert(html.includes('college-soccer-selection.js?v=20261102-double-ring4'),'Safari selection renderer cache is stale');
assert(html.includes('college-soccer-cup-ui.js?v=20261102-double-ring4'),'Two-ring component cache is stale');
assert(source.includes("window.CollegeSoccerCupUI.crest(name,entry.team_id,'men-d1',branding)"),'Selection must use the shared two-ring crest');
assert(!source.includes('nativeSchoolLogo'),'Ringless selection logo renderer is forbidden');
assert(!css.includes('.ncaa-native-mark'),'Ringless CSS must not be reintroduced');
assert(component.includes("node('span','soccer-school-mark')"),'Shared crest needs exactly one owned shell');
assert(component.includes("node('span','soccer-school-inner-ring')"),'Secondary-color ring missing');
assert(decorator.includes('.soccer-school-mark'),'Shared decorator must not stack generic rings');
const ids=['pittsburgh','south-carolina','michigan-st','xavier','notre-dame','uc-santa-barbara','syracuse','old-dominion','duquesne','unlv','cleveland-st','belmont','california-baptist','stony-brook','gardner-webb','utah-valley','grand-canyon','hofstra'];
for(const id of ids){
 const p=colors['men-d1:'+id],b=branding['men-d1:'+id];
 assert(p,'No team palette for '+id);
 for(const k of ['primary','secondary'])assert(/^#[0-9a-f]{6}$/i.test(p[k]||'')&&p[k].toLowerCase()!=='#ffffff',id+' has missing or white '+k+' ring');
 assert.notEqual(p.primary.toLowerCase(),p.secondary.toLowerCase(),id+' primary/secondary must be different');
 assert(/^https:\/\//.test(b?.logo_url||''),id+' missing genuine source artwork');
}
console.log('PASS: all 18 pictured Selection Split programs require two unique nonwhite school-color rings with genuine logos and one crest owner.');
