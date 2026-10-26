/* Sporting Life & Times: dominant TEAM-color crest rings for every sport desk.
 * Known brand identity takes precedence. Otherwise sample actual nonwhite logo pixels,
 * never substitute a guessed team color. Images stay intact, initials survive failures. */
(()=>{'use strict';
const LOGOS=/\/teamlogos\/|\/team-logos\/|\/team_logos\/|\/logos\/schools\/|\/logos\/teams\/|\/teams\/logos\/|\/team-logo\/|\/school-logos\/|\/nbl-logos\/|\/ncaam-logos\/|\/club-logos\//i;
const CLASS=/\b(?:team|club|school|franchise|soccer)[-_ ](?:logo|crest|mark|badge)\b|\b(?:logo|crest)[-_ ](?:team|club|school)\b/i;
const NOT_LOGO=/\b(?:story-img|article-photo|player-photo|player-portrait|player-avatar|headshot|hero-watermark|hero-logo-bg|author-photo|news-photo|story-image|story-thumbnail)\b/i;
const ORIGINAL='.slt-mark,.cs-mark,.cs-showcase-logo,.soccer-crest,.soccer-monogram';
const COVER='.nbl-team-crest,.team-hero-logo-bg,.depth-club-mark,.nbl-team-summary-head,.club-hero,.team-hero,.depth-club-hero,.hero-team,.hero-art';
const SELECT='img[src],img.team-logo,img.club-logo,img.school-logo,img.team-crest,img.club-crest,img.team-badge,img.crest';
const NBA={
atl:'#e03a3e',bos:'#007a33',bkn:'#191919',cha:'#1d1160',chi:'#ce1141',cle:'#860038',dal:'#00538c',
den:'#0e2240',det:'#c8102e',gs:'#1d428a',gsw:'#1d428a',hou:'#ce1141',ind:'#002d62',lac:'#c8102e',
lal:'#552583',mem:'#5d76a9',mia:'#98002e',mil:'#00471b',min:'#0c2340',no:'#0c2340',nop:'#0c2340',
ny:'#006bb6',nyk:'#006bb6',okc:'#007ac1',orl:'#0077c0',phi:'#006bb6',phx:'#1d1160',por:'#e03a3e',
sac:'#5a2d81',sa:'#343a40',sas:'#343a40',tor:'#ce1141',utah:'#002b5c',uta:'#002b5c',wsh:'#002b5c',was:'#002b5c'};
const CLUB={
'arsenal':'#ef0107','aston villa':'#670e36','bournemouth':'#da291c','brentford':'#d20000',
'brighton':'#0057b8','burnley':'#6c1d45','chelsea':'#034694','crystal palace':'#1b458f',
'everton':'#003399','fulham':'#111111','leeds united':'#1d428a','liverpool':'#c8102e',
'manchester city':'#6cabdd','manchester united':'#da291c','newcastle united':'#171717',
'nottingham forest':'#dd0000','sunderland':'#eb172b','tottenham':'#132257','tottenham hotspur':'#132257',
'west ham':'#7a263a','wolves':'#fdb913','wolverhampton':'#fdb913','wolverhampton wanderers':'#fdb913',
'adelaide 36ers':'#c8102e','brisbane bullets':'#0055a4','cairns taipans':'#f36c21',
'illawarra hawks':'#c8102e','melbourne united':'#1b1b1b','new zealand breakers':'#007da8',
'perth wildcats':'#db0027','south east melbourne phoenix':'#00715c','sydney kings':'#f2aa00',
'tasmania jackjumpers':'#377b6d',
'anadolu efes':'#005baa','as monaco basketball':'#d42133','fc barcelona basketball':'#a50044','real madrid basketball':'#00529f',
'olympiacos':'#ce1126','panathinaikos':'#006c35','fenerbahce':'#ffed00','maccabi tel aviv':'#fcd116',
'partizan':'#161616','crvena zvezda':'#cc102d','red star belgrade':'#cc102d','valencia basket':'#ef6b23',
'baskonia':'#c8102e','virtus bologna':'#111111','bayern munich':'#dc052d','olimpia milano':'#d0021b',
'zalgiris':'#007236','hapoel tel aviv':'#ce1126','paris basketball':'#e30613','asvel':'#111111'};
// Verified franchise primary colors also cover NFL, MLB and NHL score rails.
// Explicit club-code palette: EuroLeague uses hash-only CDN assets without club hints in the URL.
const EUROLEAGUE={OLY:'#cf102d',ULK:'#f2c500',MAD:'#00529f',PAM:'#f36f21',PAN:'#007a3d',HTA:'#c8102e',DUB:'#bc9a57',BAR:'#a50044',RED:'#d31127',ZAL:'#007a33',PAR:'#171717',BES:'#111111',IST:'#006ab3',MUN:'#dc052d',VIR:'#191919',TEL:'#fcd116',PRS:'#171717',MIL:'#d0021b',BAS:'#d4202f',ASV:'#202020'};
const MAJOR_LEAGUE={
nfl:{ari:'#97233f',atl:'#a71930',bal:'#241773',buf:'#00338d',car:'#0085ca',chi:'#0b162a',cin:'#fb4f14',cle:'#311d00',dal:'#003594',den:'#fb4f14',det:'#0076b6',gb:'#203731',hou:'#03202f',ind:'#002c5f',jax:'#006778',kc:'#e31837',lv:'#000000',lac:'#0080c6',lar:'#003594',mia:'#008e97',min:'#4f2683',ne:'#002244',no:'#d3bc8d',nyg:'#0b2265',nyj:'#125740',phi:'#004c54',pit:'#ffb612',sf:'#aa0000',sea:'#002244',tb:'#d50a0a',ten:'#0c2340',wsh:'#5a1414'},
mlb:{ari:'#a71930',atl:'#ce1141',bal:'#df4601',bos:'#bd3039',chc:'#0e3386',chw:'#27251f',cin:'#c6011f',cle:'#e31937',col:'#333366',det:'#0c2340',hou:'#002d62',kc:'#004687',la:'#005a9c',lad:'#005a9c',laa:'#ba0021',mia:'#00a3e0',mil:'#12284b',min:'#002b5c',nym:'#002d72',nyy:'#003087',oak:'#003831',phi:'#e81828',pit:'#fdb827',sd:'#2f241d',sf:'#fd5a1e',sea:'#0c2c56',stl:'#c41e3a',tb:'#092c5c',tex:'#003278',tor:'#134a8e',wsh:'#ab0003'},
nhl:{ana:'#b9975b',ari:'#8c2633',bos:'#ffb81c',buf:'#003087',car:'#cc0000',cbj:'#002654',cgy:'#c8102e',chi:'#cf0a2c',col:'#6f263d',dal:'#006847',det:'#ce1126',edm:'#041e42',fla:'#c8102e',la:'#111111',lak:'#111111',min:'#154734',mtl:'#af1e2d',nj:'#ce1126',nsh:'#ffb81c',nyi:'#00539b',nyr:'#0038a8',ott:'#c52032',phi:'#f74902',pit:'#ffb81c',sea:'#001628',sj:'#006d75',sjs:'#006d75',stl:'#002f87',tb:'#002868',tor:'#00205b',utah:'#6bace4',van:'#00205b',vgk:'#b4975a',wpg:'#041e42',wsh:'#c8102e'}
};
const clean=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const valid=x=>{const c=String(x||'').trim();return /^(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(c)?c:''};
const colorByCollegeId=new Map(),collegeNames=new Map();
let branded=false;
function brandData(){
 if(branded)return;
 branded=true;
 // Existing independently collected school palette, keyed to the same ESPN logo IDs.
 fetch('data/mbb-branding.json',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d?.teams)return;
  for(const [id,v] of Object.entries(d.teams)){
   const color=valid('#'+String(v.color||'').replace(/^#/,''));if(!color)continue;
   colorByCollegeId.set(id,color);
   if(v.displayName)collegeNames.set(clean(v.displayName),color);
  }
  document.querySelectorAll('.slt-mark').forEach(slot=>{
   if(slot.dataset.sltColorSource==='fallback')paint(slot,slot.querySelector('img'));
  });
 }).catch(()=>{});
}
function candidates(img){
 const src=img.currentSrc||img.getAttribute('src')||'',parent=img.closest('a,.team-link,.club,.score-team,.nba-live-team,.team-name,.cs-team,.slt-scorebug-identity,.slt-team')||img.parentElement;
 return {src,word:clean([img.alt,img.title,parent?.querySelector('b,span,strong')?.textContent,parent?.textContent].filter(Boolean).join(' '))};
}
function specificVariable(img){
 for(let n=img.parentElement;n&&n!==document.body;n=n.parentElement){
  // Specific inline league branding wins; not a generic site-wide inherited color.
  for(const key of ['--club-color','--school-color','--cs-color','--team-color','--team-primary','--primary-color','--color-primary']){
   const inline=valid(n.style?.getPropertyValue(key));if(inline)return inline;
  }
 }
 // CSS-defined, team-specific values can be on the immediate identity wrapper.
 for(let n=img.parentElement,i=0;n&&n!==document.body&&i<2;n=n.parentElement,i++){
  for(const key of ['--club-color','--school-color','--cs-color','--team-color','--team-primary']){
   const value=valid(getComputedStyle(n).getPropertyValue(key));if(value)return value;
  }
 }
 return '';
}
function colorFor(img){
 if(!img)return '';
 const euroCode=String(img.dataset.euroleagueCode||'').trim().toUpperCase();
 if(euroCode&&EUROLEAGUE[euroCode])return EUROLEAGUE[euroCode];
 const {src,word}=candidates(img);
 const nba=/\/nba\/(?:\d+\/)?([a-z0-9_-]+)\.(?:png|svg|webp)/i.exec(src);
 if(nba&&NBA[nba[1].toLowerCase()])return NBA[nba[1].toLowerCase()];
 const other=/\/(nfl|nhl|mlb)\/(?:\d+\/)?([a-z0-9_-]+)\.(?:png|svg|webp)/i.exec(src);
 if(other&&MAJOR_LEAGUE[other[1].toLowerCase()]?.[other[2].toLowerCase()])
  return MAJOR_LEAGUE[other[1].toLowerCase()][other[2].toLowerCase()];

 const college=/\/ncaa\/(?:\d+\/)?([0-9]+)\.(?:png|svg|webp)/i.exec(src);
 if(college&&colorByCollegeId.has(college[1]))return colorByCollegeId.get(college[1]);
 for(const [team,c] of Object.entries(CLUB))if(word.includes(team)||clean(src).includes(team.replace(/\s/g,'')))return c;
 for(const [team,c] of collegeNames)if(word===team||word.startsWith(team+' '))return c;
 return specificVariable(img);
}
function initials(img){
 const p=img.closest('a,.team-link,.club,.score-team,.nba-live-team,.team-name,.cs-team,.slt-scorebug-identity,.slt-team')||img.parentElement;
 const label=(img.alt||img.title||p?.querySelector('span,b,strong')?.textContent||p?.textContent||'TM').trim();
 const words=label.replace(/[\u2013\u2014\-–]+/g,' ').split(/\s+/).filter(x=>/[\p{L}\p{N}]/u.test(x));
 return words.length>1?(words[0][0]+words.at(-1)[0]).toUpperCase():(words[0]||'TM').slice(0,2).toUpperCase();
}
function classify(img){
 if(img.dataset.euroleagueCode&&document.body.dataset.league==='euroleague'&&!img.dataset.sltMarkState)return true;
 if(img.dataset.sltMarkState||img.closest(ORIGINAL)||img.matches(COVER)||img.closest(COVER))return false;
 if(NOT_LOGO.test(String(img.className||''))||NOT_LOGO.test(String(img.parentElement?.className||'')))return false;
 const src=img.getAttribute('src')||'';
 return LOGOS.test(src)||CLASS.test(String(img.className||''))||
 (/\b(?:team-link|club-link|cs-team|el-club|nba-brand|nba-team-tile|score-team|slt-scorebug-identity|team-name|soccer-team|club-identity)\b/i.test(String(img.parentElement?.className||''))&&/logo|crest|badge|icon/i.test(src));
}
function size(img){
 const numbers=[img.getAttribute('width'),img.style.width,img.getAttribute('height')].map(x=>parseFloat(x)).filter(Number.isFinite);
 const w=numbers[0]||img.getBoundingClientRect().width||img.width||32;
 return w>=76?'large':w>=40?'medium':w<=25?'tiny':w<=29?'small':'';
}
function paint(slot,img){
 if(!slot||!img)return false;
 const color=colorFor(img);
 if(!color)return false;
 slot.style.setProperty('--slt-mark-ring',color);
 slot.dataset.sltColorSource='brand';
 return true;
}
// Pick the predominant chromatic pixels in real logo artwork. Fully transparent,
// off-white, neutral grey and edge anti-alias pixels do not overtake actual brand color.
function pixels(img){
 try{
  const cv=document.createElement('canvas');cv.width=cv.height=48;
  const ctx=cv.getContext('2d',{willReadFrequently:true});if(!ctx)return '';
  ctx.clearRect(0,0,48,48);ctx.drawImage(img,0,0,48,48);
  const d=ctx.getImageData(0,0,48,48).data,bins=new Map();
  for(let i=0;i<d.length;i+=4){
   if(d[i+3]<160)continue;
   const red=d[i],green=d[i+1],blue=d[i+2],mx=Math.max(red,green,blue),mn=Math.min(red,green,blue);
   if(mx>240&&mn>225)continue;
   if(mx-mn<26)continue;
   const r=Math.round(red/24)*24,g=Math.round(green/24)*24,b=Math.round(blue/24)*24;
   const key=[Math.min(255,r),Math.min(255,g),Math.min(255,b)].join(',');
   bins.set(key,(bins.get(key)||0)+1);
  }
  const leader=[...bins].sort((a,b)=>b[1]-a[1])[0];
  if(!leader||leader[1]<8)return '';
  return '#'+leader[0].split(',').map(v=>Number(v).toString(16).padStart(2,'0')).join('');
 }catch{return ''}
}
const samples=new Map();
function sampleColor(slot,img){
 if(slot.dataset.sltColorSource==='brand')return;
 const src=img.currentSrc||img.src;if(!src||src.startsWith('data:'))return;
 if(samples.has(src)){samples.get(src).then(c=>{if(c&&slot.isConnected&&slot.dataset.sltColorSource!=='brand')slot.style.setProperty('--slt-mark-ring',c)});return}
 const job=new Promise(resolve=>{
  let c=pixels(img);if(c)return resolve(c);
  // Canvas pixel access to CDN art is sometimes restricted. Try CORS safely,
  // leaving the neutral fallback if the actual source cannot be read.
  const copy=new Image();copy.crossOrigin='anonymous';
  copy.onload=()=>resolve(pixels(copy));copy.onerror=()=>resolve('');
  copy.src=src;
 });samples.set(src,job);
 job.then(c=>{if(c&&slot.isConnected&&slot.dataset.sltColorSource!=='brand')slot.style.setProperty('--slt-mark-ring',c)});
}
function enhance(img){
 if(!classify(img)||!img.parentNode)return;
 const slot=document.createElement('span');slot.className='slt-mark';slot.setAttribute('aria-hidden','true');
 const scale=size(img);if(scale)slot.classList.add('slt-mark--'+scale);
 const fallback=document.createElement('span');fallback.className='slt-mark-initial';fallback.textContent=initials(img);
 slot.dataset.sltColorSource='fallback';
 img.dataset.sltMarkState='1';img.before(slot);slot.append(img,fallback);
 paint(slot,img);
 const verify=()=>{
  if(img.complete&&img.naturalWidth===0){slot.classList.add('slt-mark--missing');img.hidden=true}
  else if(img.complete&&img.naturalWidth>0){
   slot.classList.remove('slt-mark--missing');slot.classList.add('slt-mark--verified');img.hidden=false;
   if(slot.dataset.sltColorSource!=='brand')sampleColor(slot,img);
  }
 };
 img.addEventListener('error',()=>{slot.classList.add('slt-mark--missing');img.hidden=true});
 img.addEventListener('load',verify);verify();
 if(/\/ncaa\/|logos\/schools\//i.test(img.src))brandData();
}
function process(node){
 if(node.nodeType!==1)return;
 if(node.tagName==='IMG'){enhance(node);return}
 node.querySelectorAll?.(SELECT).forEach(enhance);
 // Previously wrapped college-soccer marks still get their authentic primary ring.
 node.querySelectorAll?.('.cs-mark,.cs-showcase-logo,.soccer-crest,.soccer-monogram').forEach(el=>{
  const img=el.querySelector('img');if(!img)return;
  const color=colorFor(img);if(color)el.style.setProperty('--slt-mark-ring',color);
 });
}
let pending=new Set(),scheduled=false;
function flush(){scheduled=false;const nodes=[...pending];pending.clear();for(const n of nodes)if(n.isConnected)process(n)}
function schedule(n){pending.add(n);if(!scheduled){scheduled=true;requestAnimationFrame(flush)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(document.body),{once:true});
else schedule(document.body);
new MutationObserver(m=>{for(const x of m)if(x.type==='childList')for(const n of x.addedNodes)if(n.nodeType===1)schedule(n)}).observe(document.documentElement,{childList:true,subtree:true});
})();
