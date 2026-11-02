(()=>{'use strict';
const root=document.getElementById('cs-showcase');if(!root)return;
const E=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n};
const read=async f=>{const r=await fetch('data/'+f+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(f+' '+r.status);return r.json()};
let snapshots=null;
const edition=()=>window.CollegeSoccerEdition?.get()||'men-d1';
const divisionName=cohort=>window.CollegeSoccerEdition?.label(cohort)||cohort.toUpperCase();
function badge(r,cohort,brands,palette){
 const wrap=E('div','cs-showcase-school'),logo=E('span','cs-showcase-logo');
 const keys=[cohort+':'+r.team_id,'men-'+cohort.split('-')[1]+':'+r.team_id,'men-d1:'+r.team_id];
 const lookup=o=>keys.map(k=>o?.[k]).find(Boolean)||{};
 const identity=lookup(brands?.teams),colors=lookup(palette?.soccer);
 const hex=x=>/^#[a-f0-9]{6}$/i.test(String(x||''))&&String(x).toLowerCase()!=='#ffffff';
 const p=colors.primary||identity.primary,s=colors.secondary||identity.secondary||identity.accent;
 if(hex(p)&&hex(s)&&p.toLowerCase()!==s.toLowerCase()){
  logo.classList.add('has-school-colors');logo.style.setProperty('--crest-primary',p);logo.style.setProperty('--crest-secondary',s)
 }else logo.classList.add('no-verified-colors');
 const initials=E('span','cs-showcase-initials',String(identity.badge_text||r.team).split(/\\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase());
 logo.append(initials);
 const candidates=[identity.logo_url,colors.logo_url,/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.team_id)?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+r.team_id+'.svg':null].filter(Boolean);
 if(candidates.length){const img=E('img');img.loading='lazy';img.decoding='async';img.alt='';let idx=0;const next=()=>{if(idx<candidates.length)img.src=candidates[idx++];else img.remove()};img.addEventListener('load',()=>{if(img.naturalWidth>0)logo.classList.add('has-image');else next()});img.addEventListener('error',next);logo.append(img);next();}
 const detail=E('span','cs-showcase-detail');detail.append(E('strong',null,r.team),E('small',null,String(r.conference||divisionName(cohort)).replace(cohort+':','').replaceAll('-',' ').toUpperCase()));wrap.append(logo,detail);
 if(hex(p))wrap.style.setProperty('--school-color',p);return wrap;
}
function render(){
 if(!snapshots)return;
 const {elo,ncaa,usrs,brands,palette}=snapshots,cohort=edition(),ranked=(elo.cohorts?.[cohort]||[]).slice().sort((a,b)=>Number(b.elo)-Number(a.elo));
 root.replaceChildren();
 if(!ranked.length){root.append(E('p','cs-showcase-summary','No certified USRS standings are published for '+divisionName(cohort)+'.'));return;}
 const menD1=cohort==='men-d1',selReady=menD1&&ncaa?.field?.length===48&&usrs?.field?.length===48;
 const n=new Set(ncaa?.field?.map(x=>x.team_id)||[]),u=new Set(usrs?.field?.map(x=>x.team_id)||[]);
 const overlap=selReady?ncaa.field.filter(x=>u.has(x.team_id)).length:0;
 const dates=E('p','cs-showcase-summary','SOURCE CUT-OFF · USRS Elo '+(elo.as_of||'unknown')+(selReady?' · NCAA RPI '+(ncaa.ranking_as_of||'unknown')+' · Selection '+(usrs.rating_cutoff||'unknown'):'')+'. Rankings are independent; tournament fields are shown only where source-backed projections exist.');
 root.append(dates);
 const verified=(elo.latest_finals||[]).filter(x=>x.cohort===cohort);
 const metrics=menD1&&selReady?[[ranked.length,'D-I PROGRAMS','Tracked in USRS'],[48,'NCAA FIELD','Projected entrants'],[overlap,'BOTH MODELS','Same teams'],[23,'CONFERENCES','Automatic bids']]:
 [[ranked.length,'PROGRAMS','USRS rated'],[ranked.filter(t=>Number(t.gp)>0).length,'ACTIVE TEAMS','Played games in the Elo ledger'],[verified.length,'RECENT FINALS','In published score snapshot'],[Math.round(Number(ranked[0].elo)),'TOP ELO','Independent rating']];
 const rail=E('div','cs-showcase-metrics');for(const [num,title,detail] of metrics){const card=E('div','cs-showcase-metric');card.append(E('strong',null,num),E('span',null,title),E('small',null,detail));rail.append(card)}root.append(rail);
 const grid=E('div','cs-showcase-grid');root.append(grid);
 const panel=E('section','cs-showcase-panel');panel.append(E('p','cs-showcase-kicker','THE POWER BOARD · '+divisionName(cohort)),E('h2',null,'USRS TOP TEN'));
 for(const [i,t] of ranked.slice(0,10).entries()){
  const row=E('a','cs-showcase-rank');row.href='college-soccer-team.html?team='+encodeURIComponent(cohort+':'+t.team_id);
  row.append(E('b',null,String(i+1).padStart(2,'0')),badge(t,cohort,brands,palette),E('strong','cs-showcase-score',Math.round(t.elo)));
  const strength=E('div','cs-showcase-strength'),fill=E('span');fill.style.width=Math.max(8,Math.min(100,100*(Number(t.elo)-1100)/800)).toFixed(1)+'%';strength.append(fill);row.append(strength);panel.append(row);
 }
 grid.append(panel);
 const secondary=E('section','cs-showcase-panel cs-showcase-selection');
 if(selReady){
  secondary.append(E('p','cs-showcase-kicker','THE FIELD · TWO PROJECTION METHODS'),E('h2',null,'The Selection Divide'),E('p','cs-showcase-summary','The RPI-based snapshot and independent USRS field agree on '+overlap+' of 48 entrants. Neither is an official NCAA selection.'));
  for(const [heading,subset] of [['RPI SNAPSHOT ONLY',ncaa.field.filter(x=>!u.has(x.team_id))],['USRS FORECAST ONLY',usrs.field.filter(x=>!n.has(x.team_id))]]){
   secondary.append(E('h3',null,heading));const pick=E('div','cs-showcase-picks');
   for(const x of subset.slice(0,6)){const info=ranked.find(r=>r.team_id===x.team_id);if(info)pick.append(badge(info,cohort,brands,palette))}
   secondary.append(pick);
  }
  const link=E('a','cs-showcase-go','SEE TWO FIELD PROJECTIONS');link.href='college-soccer-selection.html';secondary.append(link);
 }else{
  secondary.append(E('p','cs-showcase-kicker','DIVISION NOTEBOOK · '+divisionName(cohort)),E('h2',null,'The Form Book'));
  const active=ranked.filter(r=>Number(r.gp)>0);
  secondary.append(E('p','cs-showcase-summary','Attack and defense leaders from verified season totals, not an invented tournament bracket.'));
  for(const [heading,rows,stat] of [
   ['MOST GOALS PER MATCH',active.slice().sort((a,b)=>Number(b.gf)/Number(b.gp)-Number(a.gf)/Number(a.gp)).slice(0,5),x=>(Number(x.gf)/Number(x.gp)).toFixed(2)+' GF/GP'],
   ['FEWEST GOALS CONCEDED PER MATCH',active.slice().sort((a,b)=>Number(a.ga)/Number(a.gp)-Number(b.ga)/Number(b.gp)).slice(0,5),x=>(Number(x.ga)/Number(x.gp)).toFixed(2)+' GA/GP']]){
   secondary.append(E('h3',null,heading));const pick=E('div','cs-showcase-picks');
   for(const t of rows){const a=E('a','cs-showcase-form-row');a.href='college-soccer-team.html?team='+encodeURIComponent(cohort+':'+t.team_id);a.append(badge(t,cohort,brands,palette),E('strong',null,stat(t)));pick.append(a)}
   secondary.append(pick);
  }
 }
 grid.append(secondary);
}
async function refresh(){try{
 const [elo,brands,palette,ncaa,usrs]=await Promise.all([read('college-soccer-elo.json'),read('college-soccer-team-branding.json').catch(()=>({teams:{}})),read('dual-ring-team-palette.json').catch(()=>({soccer:{}})),read('college-soccer-ncaa-rpi-forecast-2026.json').catch(()=>null),read('college-soccer-ncaa-selection-forecast.json').catch(()=>null)]);
 snapshots={elo,brands,palette,ncaa,usrs};render();
 }catch(e){if(!snapshots)root.replaceChildren(E('p','cs-showcase-summary','USRS power board temporarily unavailable.'));console.warn('Soccer power board',e)}}
window.addEventListener('college-soccer:edition',render);
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
})();