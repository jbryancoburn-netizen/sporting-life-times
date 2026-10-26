/* Sporting Life & Times shared, source-safe crest presentation.
 * No imaginary team art: only authenticated team-logo images are enhanced;
 * a short text abbreviation remains visible when the source image fails.
 * Live scoreboards and rankings are supported via MutationObserver. */
(()=>{'use strict';
const TEAM_SOURCES=/\/teamlogos\/|\/team-logos\/|\/team_logos\/|\/logos\/schools\/|\/logos\/teams\/|\/teams\/logos\/|\/team-logo\/|\/school-logos\//i;
const TEAM_CLASSES=/(?:^|[-_ ])(?:team|club|school|franchise|crest|soccer)(?:[-_ ])(?:logo|crest|mark|badge)|(?:^|[-_ ])(?:logo|crest)(?:[-_ ])(?:team|club|school)/i;
const PHOTO_CONTEXT=/\b(?:story-img|article-photo|player-photo|player-portrait|player-avatar|headshot|hero-watermark|hero-logo-bg|author-photo|news-photo|story-image|story-thumbnail)\b/i;
const PREMARKED='.slt-mark,.cs-mark,.cs-showcase-logo,.soccer-crest,.soccer-monogram';
const HERO_CONTEXT=/\b(?:team-hero|club-hero|depth-club-hero|hero-art|hero-team|team-identity|nba-team-identity|nbl-team-summary-head|matchup-hero|team-visual-hero)\b/i;
const OWNED_SELECTOR='img[src],img.team-logo,img.club-logo,img.school-logo,img.team-crest,img.club-crest,img.team-badge,img.crest';
const control=x=>(x||'').trim().toLowerCase();
function isTeamLogo(img){
 if(img.dataset.sltMarkState||img.closest(PREMARKED))return false;
 if(PHOTO_CONTEXT.test(String(img.className||''))||PHOTO_CONTEXT.test(String(img.parentElement?.className||'')))return false;
 const src=img.getAttribute('src')||'';
 const klass=String(img.className||'');
 if(TEAM_SOURCES.test(src))return true;
 if(TEAM_CLASSES.test(klass))return true;
 const parent=img.parentElement;
 const pclass=String(parent?.className||'');
 if(/\b(?:team-link|club-link|cs-team|el-club|nba-brand|nba-team-tile|score-team|slt-scorebug-identity|team-name|soccer-team|club-identity)\b/i.test(pclass)
    &&/logo|crest|badge|icon/i.test(src))return true;
 return false;
}
function initials(img){
 const parent=img.parentElement,container=img.closest('a,.team-link,.club,.score-team,.nba-live-team,.team-name,.cs-team,.slt-scorebug-identity,.slt-team')||parent;
 let word=img.getAttribute('alt')||img.getAttribute('title')||'';
 if(!word.trim())word=container?.querySelector('span,b,strong')?.textContent||container?.textContent||'';
 word=word.replace(/[\u2013\u2014\-–]+/g,' ').replace(/\([^)]*\)/g,' ').trim();
 const parts=word.split(/\s+/).filter(x=>/[\p{L}\p{N}]/u.test(x));
 if(parts.length>=2)return (parts[0][0]+parts.at(-1)[0]).toUpperCase();
 if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
 return 'TM';
}
function size(img){
 const candidates=[img.getAttribute('width'),img.style.width,img.getAttribute('height')].map(x=>parseFloat(x)).filter(Number.isFinite);
 const width=candidates[0]||img.getBoundingClientRect().width||img.width||32;
 if(width>=76||HERO_CONTEXT.test(String(img.parentElement?.className||'')))return 'large';
 if(width>=40)return 'medium';
 if(width<=25)return 'tiny';
 if(width<=29)return 'small';
 return '';
}
function mark(img){
 if(!isTeamLogo(img)||!img.parentNode)return;
 const slot=document.createElement('span');slot.className='slt-mark';slot.setAttribute('aria-hidden','true');
 const scale=size(img);if(scale)slot.classList.add('slt-mark--'+scale);
 const fallback=document.createElement('span');fallback.className='slt-mark-initial';fallback.textContent=initials(img);
 // Copy the league/team color from the nearest team identity, if present.
 let el=img.parentElement;
 while(el&&el!==document.body){
  const st=getComputedStyle(el);
  const keys=['--school-color','--club-color','--team-color','--team-primary','--color-primary'];
  let accent=keys.map(k=>st.getPropertyValue(k).trim()).find(v=>/^(?:#|rgb|hsl|color\()/.test(v));
  if(accent){slot.style.setProperty('--slt-mark-ring',accent);break}
  el=el.parentElement;
 }
 img.dataset.sltMarkState='1';
 img.before(slot);slot.append(img,fallback);
 const verify=()=>{
  if(img.complete&&img.naturalWidth===0){slot.classList.add('slt-mark--missing');img.hidden=true}
  else if(img.complete&&img.naturalWidth>0){slot.classList.remove('slt-mark--missing');slot.classList.add('slt-mark--verified');img.hidden=false}
 };
 img.addEventListener('error',()=>{slot.classList.add('slt-mark--missing');img.hidden=true});
 img.addEventListener('load',verify);
 verify();
}
function walk(node){
 if(node.nodeType!==1)return;
 if(node.tagName==='IMG'){mark(node);return}
 if(node.querySelectorAll)node.querySelectorAll(OWNED_SELECTOR).forEach(mark);
}
let pending=new Set(),scheduled=false;
function flush(){scheduled=false;const nodes=[...pending];pending.clear();for(const n of nodes)if(n.isConnected)walk(n)}
function schedule(node){pending.add(node);if(!scheduled){scheduled=true;requestAnimationFrame(flush)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(document.body),{once:true});
else schedule(document.body);
new MutationObserver(muts=>{
 for(const m of muts){if(m.type==='childList')for(const n of m.addedNodes)if(n.nodeType===1)schedule(n)}
}).observe(document.documentElement,{subtree:true,childList:true});
})();
