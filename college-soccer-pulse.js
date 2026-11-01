(()=>{'use strict';
const root=document.getElementById('cs-current-scoreboard');if(!root)return;
const make=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined&&content!==null)n.textContent=String(content);return n};
const load=async name=>{const r=await fetch('data/'+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(name+' '+r.status);return r.json()};
const divisions=['men-d1','women-d1','men-d2','women-d2','men-d3','women-d3'];
const divisionName=x=>({men:'MEN',women:'WOMEN'})[String(x).split('-')[0]]+' · D'+String(x).slice(-1);
const freshTime=when=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(when))+' ET';
const clean=name=>String(name||'').trim();
let view='live',data=null;
function balanced(rows,count){
 const result=[],used=new Set();
 for(const division of divisions){const g=rows.find(x=>x.cohort===division&&!used.has(x.match_id));if(g){result.push(g);used.add(g.match_id)}if(result.length>=count)break}
 for(const g of rows){if(result.length>=count)break;if(!used.has(g.match_id)){result.push(g);used.add(g.match_id)}}
 return result;
}
function mark(name,id,cohort,brand){
 const shell=make('span','cs-pitch-crest');
 const mark=make('span','cs-mark',clean(name).split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
 const b=brand?.teams?.[cohort+':'+id]||{};
 const colors=[b.primary,b.secondary].filter(s=>/^#[0-9A-Fa-f]{6}$/.test(s||''));
 if(colors.length)mark.style.setProperty('--cs-color',colors[0]);
 if(id){
  const img=make('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=b.logo_url||('https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+encodeURIComponent(id)+'.svg');
  img.onerror=()=>img.remove();mark.append(img);
 }
 shell.append(mark);return shell;
}
function oneCard(g,kind,brand){
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
  item.append(mark(n,g[side+'_id'],g.cohort,brand));
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
  return {match_id:g.match_id,cohort:g.cohort,away_name:g.away,home_name:g.home,away_score:scores[1],home_score:scores[0],date:g.date,status:'final'};
 }).filter(g=>Number.isInteger(g.away_score)&&Number.isInteger(g.home_score));
}
function renderHero(elo,brand){
 const host=document.getElementById('cs-hero-leader'),leader=elo.cohorts?.['men-d1']?.[0];
 if(!host||!leader)return;
 host.href='college-soccer-team.html?team='+encodeURIComponent('men-d1:'+leader.team_id);
 const meta=make('span','cs-hero-leader-meta');
 meta.append(make('strong',null,leader.team),make('small',null,leader.record+'  ·  '+Math.round(leader.elo)+' USRS ELO'));
 host.replaceChildren(make('span','cs-hero-leader-rank','01'),mark(leader.team,leader.team_id,'men-d1',brand),meta,make('span','cs-hero-leader-arrow','↗'));
}
function render(){
 if(!data)return;
 const {elo,live,brand,forecast}=data,at=Date.parse(live?.checked_at_utc||''),fresh=Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<15*60*1000;
 const forecastMap=new Map((forecast?.forecasts||[]).map(g=>[g.match_id,g]));
 const fromFeed=(live?.games||[]).map(g=>{
  const f=forecastMap.get(g.match_id)||{};
  return {...g,away_name:clean(g.away_name||f.away_name),home_name:clean(g.home_name||f.home_name),
   away_id:clean(g.away_id||f.away_team),home_id:clean(g.home_id||f.home_team)};
 }).filter(g=>g.away_name&&g.home_name&&Number.isInteger(g.away_score)&&Number.isInteger(g.home_score));
 const liveMatches=fresh?fromFeed.filter(g=>g.status==='live'):[];
 const displayLive=balanced(liveMatches,6);
 const finals=balanced(verifiedFinals(elo),6);
 const active=view==='live'&&displayLive.length?'live':'final';
 root.replaceChildren();root.className='cs-pitch-board';
 const kicker=make('div','cs-pitch-board-kicker');
 kicker.append(make('span',null,'THE PITCH  /  MATCH CENTRE'),make('span',null,'2026 NCAA SOCCER'));
 root.append(kicker);
 const header=make('div','cs-pitch-board-header');
 const title=make('div');title.append(make('p','cs-pitch-eyebrow','SIX DIVISIONS · SCORES THAT MOVE'),make('h2',null,'Matchday, live.'));
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
 for(const g of items)cards.append(oneCard(g,active,brand));
 if(!items.length)cards.append(make('p','cs-pitch-empty','No source-verified scores are available for this view.'));
 root.append(cards);
 const footer=make('div','cs-pitch-board-footer');
 footer.append(make('span',null,items.length>1?'SWIPE SCORES  →':'SOURCE-VERIFIED RESULTS'));
 const link=make('a',null,'FULL MATCH CENTRE  ↗');link.href='#college-soccer-visual-desk';footer.append(link);root.append(footer);
}
async function refresh(){
 try{
  const [elo,live,brand,forecast]=await Promise.all([load('college-soccer-elo.json'),load('college-soccer-live-scores.json').catch(()=>null),load('college-soccer-team-branding.json').catch(()=>null),load('college-soccer-prospective-v2.json').catch(()=>null)]);
  if(!elo?.cohorts)throw Error('Elo feed invalid');
  data={elo,live,brand,forecast};renderHero(elo,brand);render();
 }catch(e){root.replaceChildren(make('p','cs-pitch-error','Matchday scores are temporarily unavailable. The NCAA match centre and verified ratings remain accessible below.'))}
}
refresh();setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
})();