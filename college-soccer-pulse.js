(()=>{'use strict';
const root=document.getElementById('cs-current-scoreboard');if(!root)return;
const make=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined&&content!==null)n.textContent=String(content);return n};
const load=async name=>{const r=await fetch('data/'+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(name+' '+r.status);return r.json()};
const divisions=['men-d1','women-d1','men-d2','women-d2','men-d3','women-d3'];
const divisionName=x=>({men:'MEN',women:'WOMEN'})[String(x).split('-')[0]]+' · D'+String(x).slice(-1);
const freshTime=when=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(when))+' ET';
const clean=name=>String(name||'').trim();
const requested=new URLSearchParams(window.location.search).get('cohort');
let view='live',selectedCohort=window.CollegeSoccerEdition?.get()||(divisions.includes(requested)?requested:'men-d1'),data=null;
// A selected edition is a strict cohort boundary: never mix men's/women's or D-I/D-II/D-III.
function scoped(rows,count,cohort){
 return rows.filter(g=>g.cohort===cohort).slice(0,count);
}
const normal=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function teamId(name,cohort,id,elo){
 const rows=elo?.cohorts?.[cohort]||[];
 if(id&&rows.some(x=>x.team_id===id))return id;
 const found=rows.find(x=>normal(x.team)===normal(name));
 return found?.team_id||id||'';
}
function mark(name,id,cohort,brand,palette,overrides){
 const badge=make('span','cs-pitch-badge'),key=cohort+':'+id;
 const alternatives=[key,cohort.startsWith('women')?'men-'+cohort.split('-')[1]+':'+id:null,'men-d1:'+id].filter(Boolean);
 const pick=(dict)=>alternatives.map(k=>dict?.[k]).find(Boolean)||{};
 const team=pick(brand?.teams),shared=pick(palette?.soccer),verified=overrides?.schools?.[id]||{};
 const hex=x=>/^#[0-9a-f]{6}$/i.test(String(x||''))&&String(x).toLowerCase()!=='#ffffff';
 const primary=shared.primary||verified.primary||team.primary;
 const secondary=shared.secondary||verified.secondary||team.secondary||team.accent;
 if(hex(primary)&&hex(secondary)&&primary.toLowerCase()!==secondary.toLowerCase()){
  badge.classList.add('has-school-colors');
  badge.style.setProperty('--crest-primary',primary);
  badge.style.setProperty('--crest-secondary',secondary);
 }else badge.classList.add('is-unverified-color');
 const initials=String(team.badge_text||name||id||'?').replace(/[^A-Za-z0-9 ]/g,'').trim().split(/\s+/).filter(Boolean).map(word=>word.charAt(0)).slice(0,2).join('').toUpperCase()||'SC';
 badge.append(make('span','cs-pitch-initials',initials));
 const candidates=[team.logo_url,shared.logo_url,verified.logo_url,
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id||'')?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+id+'.svg':null]
  .filter(Boolean).filter((url,i,list)=>list.indexOf(url)===i);
 if(candidates.length){
  const img=make('img','cs-pitch-badge-logo');img.alt='';img.loading='lazy';img.decoding='async';
  let next=0;const tryNext=()=>{badge.classList.remove('has-image');if(next<candidates.length)img.src=candidates[next++];else img.remove();};
  img.addEventListener('load',()=>{if(img.naturalWidth>0)badge.classList.add('has-image');else tryNext();});
  img.addEventListener('error',tryNext);badge.append(img);tryNext();
 }
 const container=make('span','cs-pitch-crest');container.append(badge);return container;
}

function oneCard(g,kind,brand,palette,overrides){
 const box=make('a','cs-pitch-match '+(kind==='live'?'is-live':'is-final'));
 box.href='college-soccer-match.html?game='+encodeURIComponent(g.match_id);
 const top=make('div','cs-pitch-match-top');
 top.append(make('span','cs-pitch-league',divisionName(g.cohort)));
 const state=make('span','cs-pitch-match-state',kind==='live'?'● LIVE'+(g.period?' · '+g.period:''):'FULL TIME');
 top.append(state);box.append(top);
 const teams=make('div','cs-pitch-match-teams');
 for(const side of ['away','home']){
  const item=make('div','cs-pitch-side');
  const n=clean(g[side+'_name']);
  item.append(mark(n,g[side+'_id'],g.cohort,brand,palette,overrides));
  const school=make('span','cs-pitch-school',n);school.title=n;
  item.append(school,make('strong','cs-pitch-goals',g[side+'_score']));
  teams.append(item);
 }
 box.append(teams);
 box.append(make('div','cs-pitch-match-foot',kind==='live'?'LIVE SCORE · OPEN MATCH CENTRE ↗':'FINAL · MATCH REPORT & ELO ↗'));
 return box;
}
function verifiedFinals(elo){
 return (elo.latest_finals||[]).filter(g=>typeof g.score==='string'&&g.match_id).map(g=>{
  const scores=g.score.split('-').map(Number);
  return {match_id:g.match_id,cohort:g.cohort,away_name:g.away,home_name:g.home,
   away_id:teamId(g.away,g.cohort,'',elo),home_id:teamId(g.home,g.cohort,'',elo),
   away_score:scores[1],home_score:scores[0],date:g.date,status:'final'};
 }).filter(g=>Number.isInteger(g.away_score)&&Number.isInteger(g.home_score));
}

function renderHero(elo,brand,palette,overrides){
 const host=document.getElementById('cs-hero-leader'),leader=elo.cohorts?.[selectedCohort]?.[0];
 if(!host)return;
 if(!leader){host.replaceChildren(make('span','cs-hero-leader-pending','No published rating for this division'));return;}
 host.href='college-soccer-team.html?team='+encodeURIComponent(selectedCohort+':'+leader.team_id);
 const meta=make('span','cs-hero-leader-meta');
 meta.append(make('strong',null,leader.team),make('small',null,leader.record+' · '+Math.round(leader.elo)+' USRS ELO'));
 host.replaceChildren(make('span','cs-hero-leader-rank','01'),mark(leader.team,leader.team_id,selectedCohort,brand,palette,overrides),meta,make('span','cs-hero-leader-arrow','↗'));
}

function render(){
 if(!data)return;
 const {elo,live,brand,forecast,palette,overrides}=data,at=Date.parse(live?.checked_at_utc||''),fresh=Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<15*60*1000;
 const forecastMap=new Map((forecast?.forecasts||[]).map(g=>[g.match_id,g]));
 const fromFeed=(live?.games||[]).map(g=>{
  const f=forecastMap.get(g.match_id)||{};
  return {...g,away_name:clean(g.away_name||f.away_name),home_name:clean(g.home_name||f.home_name),
   away_id:teamId(g.away_name||f.away_name,g.cohort,clean(g.away_id||f.away_team),elo),home_id:teamId(g.home_name||f.home_name,g.cohort,clean(g.home_id||f.home_team),elo)};
 }).filter(g=>g.away_name&&g.home_name&&Number.isInteger(g.away_score)&&Number.isInteger(g.home_score));
 const liveMatches=fresh?fromFeed.filter(g=>g.status==='live'&&g.cohort===selectedCohort):[];
 const displayLive=scoped(liveMatches,6,selectedCohort);
 const finals=scoped(verifiedFinals(elo),6,selectedCohort);
 const active=view==='live'&&displayLive.length?'live':'final';
 root.replaceChildren();root.className='cs-pitch-board';
 const kicker=make('div','cs-pitch-board-kicker');
 kicker.append(make('span',null,'THE PITCH  /  MATCH CENTRE'),make('span',null,'2026 NCAA SOCCER'));
 root.append(kicker);
 const header=make('div','cs-pitch-board-header');
 const title=make('div');title.append(make('p','cs-pitch-eyebrow',divisionName(selectedCohort)+' · INDEPENDENT USRS'),make('h2',null,'Matchday, live.'));
 const count=make('div','cs-pitch-count '+(liveMatches.length?'is-active':''));
 count.append(make('b',null,liveMatches.length?liveMatches.length:'—'),make('span',null,liveMatches.length?'LIVE MATCHES':'NO VERIFIED LIVE MATCHES'));
 header.append(title,count);root.append(header);
 const status=make('p','cs-pitch-freshness');
 status.textContent=fresh?'NCAA feed checked '+freshTime(live.checked_at_utc)+' · Elo standings through '+elo.as_of:'Live feed out of date. Showing last published verified finals · Elo through '+elo.as_of;
 root.append(status);
 const tabs=make('div','cs-pitch-switch');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Choose soccer live or final scores');
 [['live','LIVE NOW'],['final','LATEST FINALS']].forEach(([key,label])=>{
  const b=make('button','cs-pitch-tab'+(active===key?' is-selected':''),label);
  b.type='button';b.disabled=key==='live'&&!displayLive.length;b.setAttribute('aria-pressed',String(active===key));
  b.addEventListener('click',()=>{view=key;render()});tabs.append(b);
 });
 root.append(tabs);
 const cards=make('div','cs-pitch-match-strip');
 const items=active==='live'?displayLive:finals;
 for(const g of items)cards.append(oneCard(g,active,brand,palette,overrides));
 if(!items.length)cards.append(make('p','cs-pitch-empty','No source-verified scores are available for this view.'));
 root.append(cards);
 const footer=make('div','cs-pitch-board-footer');
 footer.append(make('span',null,items.length>1?'SWIPE SCORES  →':'SOURCE-VERIFIED RESULTS'));
 const link=make('a',null,'FULL MATCH CENTRE  ↗');link.href='#college-soccer-visual-desk';footer.append(link);root.append(footer);
}
async function refresh(){
 try{
  const [elo,live,brand,forecast,palette,overrides]=await Promise.all([load('college-soccer-elo.json'),load('college-soccer-live-scores.json').catch(()=>null),load('college-soccer-team-branding.json').catch(()=>null),load('college-soccer-prospective-v2.json').catch(()=>null),load('dual-ring-team-palette.json').catch(()=>null),load('college-soccer-crest-overrides.json').catch(()=>null)]);
  if(!elo?.cohorts)throw Error('Elo feed invalid');
  data={elo,live,brand,forecast,palette,overrides};renderHero(elo,brand,palette,overrides);render();
 }catch(e){root.replaceChildren(make('p','cs-pitch-error','Matchday scores are temporarily unavailable. The NCAA match centre and verified ratings remain accessible below.'))}
}
window.addEventListener('college-soccer:edition',e=>{selectedCohort=e.detail.cohort;view='live';if(data){renderHero(data.elo,data.brand,data.palette,data.overrides);render();}});
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
})();