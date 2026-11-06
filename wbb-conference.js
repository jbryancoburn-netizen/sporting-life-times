/* One women-only newspaper template for all 32 conferences / 363 Division I programs. */
(async()=>{
'use strict';
const app=document.getElementById('app'),params=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()};
const date=s=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return String(s);const d=new Date(s);if(!Number.isFinite(+d))return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v=k=>parts.find(x=>x.type===k)?.value||'';return v('year')+'-'+v('month')+'-'+v('day')};
const now=()=>date(new Date()),norm=s=>String(s||'').toLowerCase().replace(/\bconference\b/g,'').replace(/[^a-z0-9]/g,'');
const label=c=>c.replace(/ Conference$/,'').replace('Atlantic Coast','ACC').replace('Southeastern','SEC');
const url=c=>'ncaaw-conference.html?conference='+encodeURIComponent(c),teamURL=t=>'ncaaw-team.html?team='+encodeURIComponent(t.team_id);
const n=t=>Number(t||0),ratio=(w,l)=>w+l?w/(w+l):0,pct=(w,l)=>w+l?(w/(w+l)).toFixed(3).replace(/^0/,''):'—';
const rec=(w,l)=>w+'–'+l,elo=t=>Number.isFinite(Number(t.elo))?Math.round(Number(t.elo)).toString():'—';
const failure=s=>{app.innerHTML='<section class="panel"><h1>Women’s conference desk unavailable</h1><p>'+esc(s)+'</p><a href="ncaam.html?gender=women">Open the women’s newspaper →</a></section>'};
try{
 await window.MBBLogos.ready;
 const [directory,conferences,model,master,scoreboard,news,officialTV,wire]=await Promise.all([
  get('data/ncaaw-2026-27-teams.json'),get('data/ncaaw-2026-27-conferences.json'),
  get('data/ncaaw-2026-27-retro-primary.json'),get('data/ncaaw-schedules-2026-27.json'),
  get('data/ncaaw-2026-27-games.json').catch(()=>null),get('articles.json').catch(()=>null),
  get('data/ncaaw-2026-27-official-broadcast-overrides.json').catch(()=>null),
  get('data/mbb-live.json').catch(()=>null)
 ]);
 const roster=directory.teams||[],rankings=model.rankings||[];
 const names=[...new Set(roster.map(t=>t.conference).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const ranked=new Map(rankings.map(t=>[String(t.team_id),t]));
 if(directory.season!=='2026-27'||roster.length!==363||new Set(roster.map(t=>String(t.team_id))).size!==363||
  conferences.gender!=='women'||conferences.verified_team_count!==363||conferences.unmatched?.length||conferences.conference_count!==32||
  names.length!==32||model.gender!=='women'||model.season!=='2026-27'||model.model!=='retro-clean-slate'||
  model.starting_elo!==1500||rankings.length!==363||ranked.size!==363||master.gender!=='women'||
  master.season!=='2026-27'||Object.keys(master.teams||{}).length!==363||
  roster.some(t=>!ranked.has(String(t.team_id))||conferences.teams?.[String(t.team_id)]?.conference!==t.conference))
  throw Error('Women’s 363-team / 32-conference publication check failed; partial records withheld.');
 const all=new Map(roster.map(t=>[String(t.team_id),{...t,...ranked.get(String(t.team_id))}]));
 const members=c=>[...all.values()].filter(t=>t.conference===c);
 const badge=(t,size='small')=>window.MBBLogos.byESPN(String(t.team_id),size,t.team);
 const link=t=>'<a class="team-name" href="'+teamURL(t)+'">'+badge(t)+'<span>'+esc(t.team)+'</span></a>';
 const heading=(k,title)=>'<div class="panel-head"><div><div class="eyebrow">'+k+'</div><h2>'+title+'</h2></div></div>';
 const metric=(value,label)=>'<div class="metric"><b>'+value+'</b><span>'+label+'</span></div>';
 const retroTies=new Map();
 rankings.forEach(t=>retroTies.set(Number(t.rank),(retroTies.get(Number(t.rank))||0)+1));
 // The women's edition uses the same letterpress scorebug as the men's Big Ten.
 window.WBBRetroSnapshot=model;
 window.WBBForecastCalibration=await get('data/ncaaw-score-calibration.json').catch(()=>null);
 const cw=t=>n(t.conference_wins),cl=t=>n(t.conference_losses),ow=t=>n(t.wins),ol=t=>n(t.losses);
 const comp=(a,b,conf)=>{const aw=conf?cw(a):ow(a),al=conf?cl(a):ol(a),bw=conf?cw(b):ow(b),bl=conf?cl(b):ol(b);
  return ratio(bw,bl)-ratio(aw,al)||bw-aw||al-bl;};
 const ordered=c=>{const items=members(c),played=items.some(t=>cw(t)+cl(t)>0);
  const compare=(a,b)=>played?comp(a,b,true)||comp(a,b,false):comp(a,b,false);
  return {items:items.sort((a,b)=>compare(a,b)||n(b.elo)-n(a.elo)||a.team.localeCompare(b.team)),played,compare};};
 const finals=new Map(),results=new Map([...all.keys()].map(id=>[id,[]]));
 for(const g of model.events||[]){if(g.status!=='final'||!Number.isFinite(Number(g.home_score))||!Number.isFinite(Number(g.away_score)))continue;
  finals.set(String(g.id),g);const h=String(g.home_id),a=String(g.away_id),dt=String(g.date).slice(0,10);
  if(results.has(h)&&results.has(a)){results.get(h).push([dt,n(g.home_score)>n(g.away_score)]);results.get(a).push([dt,n(g.away_score)>n(g.home_score)])}
 }
 const streak=t=>{const list=results.get(String(t.team_id)).slice().sort((a,b)=>b[0].localeCompare(a[0]));if(!list.length)return '—';
  let count=0;for(const r of list){if(r[1]!==list[0][1])break;count++}return (list[0][1]?'W':'L')+count};
 const stamp=document.getElementById('data-stamp');if(stamp)stamp.textContent='Women’s Division I · 363 teams · 32 conferences · RETRO '+String(model.as_of||'current snapshot');
 const requested=params.get('conference'),selected=names.find(c=>c===requested)||names.find(c=>norm(c)===norm(requested));
 if(!requested){document.title='Women’s Conference Desks | Sporting Life & Times';
  app.innerHTML='<div class="eyebrow">Women’s Division I · 2026–27</div><h1>The conference desks.</h1>'+
   '<p>Each of the 32 conferences has a complete league newspaper, from the Big Ten to the smallest Division I leagues.</p>'+
   '<p class="note">All 363 teams have verified conference membership and a women-only RETRO rating. Current ratings dated '+esc(model.as_of||'not supplied')+'.</p>'+
   '<div class="conf-grid">'+names.map(c=>{const items=members(c),leader=ordered(c).items[0];
    return '<a class="conf-card" href="'+url(c)+'"><div class="eyebrow">'+items.length+' member programs</div><h3>'+esc(label(c))+'</h3>'+
     '<div class="logos">'+items.slice(0,5).map(badge).join('')+'</div><small>'+esc(leader.team)+' · RETRO '+elo(leader)+' →</small></a>'}).join('')+'</div>';
  return;
 }
 if(!selected){failure('Conference not found in the women’s 2026–27 registry.');return;}
 const c=selected,{items,played,compare}=ordered(c),leader=items[0];
 const gb=t=>!played?'—':(cw(leader)-cw(t)+cl(t)-cl(leader))/2;
 const table='<div class="conference-ledger-scroll"><table class="conference-ledger">'+
 '<colgroup><col class="ledger-place-col"><col class="ledger-team-col"><col class="ledger-conf-col">'+
 '<col class="ledger-conf-pct-col"><col class="ledger-gb-col"><col class="ledger-overall-col">'+
 '<col class="ledger-overall-pct-col"><col class="ledger-streak-col"><col class="ledger-retro-col">'+
 '<col class="ledger-projection-col"></colgroup>'+
 '<thead><tr><th>Place*</th><th>University</th><th>Conference</th><th>Conf. PCT</th>'+
 '<th>GB</th><th>Overall</th><th>Overall PCT</th><th>Streak</th>'+
 '<th>RETRO</th><th>Projected NCAA seed</th></tr></thead><tbody>'+
 items.map(t=>{
  const place=1+items.filter(other=>compare(other,t)<0).length;
  const tied=items.some(other=>other!==t&&compare(other,t)===0);
  const behind=gb(t),rank=(n(t.rank)>0?'#'+n(t.rank):'—');
  return '<tr>'+
   '<td><span class="ledger-place">'+(tied?'T':'')+place+'</span></td>'+
   '<td class="ledger-university">'+link(t)+'</td>'+
   '<td>'+rec(cw(t),cl(t))+'</td>'+
   '<td class="ledger-pct">'+pct(cw(t),cl(t))+'</td>'+
   '<td class="ledger-gb">'+(behind==='—'||behind===0?'—':Number.isInteger(behind)?behind:behind.toFixed(1))+'</td>'+
   '<td>'+rec(ow(t),ol(t))+'</td>'+
   '<td class="ledger-pct">'+pct(ow(t),ol(t))+'</td>'+
   '<td class="ledger-streak">'+streak(t)+'</td>'+
   '<td class="ledger-retro"><span class="ledger-retro-value">'+elo(t)+'</span>'+
   '<span class="ledger-retro-rank">('+(retroTies.get(n(t.rank))>1?'T-':'')+rank.replace('#','')+')</span></td>'+
   '<td class="ledger-projection">—</td></tr>';
 }).join('')+'</tbody></table></div>'+
 '<p class="note victorian-seed-note">*Order uses conference record when conference play has begun; otherwise overall record. Overall results break equal conference records. Unresolved ties remain tied until official tiebreakers are verified. GB = conference games behind the leader. Streak includes verified women’s Division I finals only. Projected NCAA seeds are withheld until a validated women’s tournament projection is published.</p>';
  const gameMap=new Map(),memberIds=new Set(items.map(t=>String(t.team_id)));
 for(const [id,school] of Object.entries(master.teams||{})){if(!memberIds.has(String(id)))continue;
  for(const g of school.games||[]){if(!/^\d+$/.test(String(g.id||'')))continue;
   if(!gameMap.has(String(g.id)))gameMap.set(String(g.id),{...g,origin_id:String(id),origin_name:school.team})}
 }
 const liveMap=new Map([...(scoreboard?.finals||[]),...(scoreboard?.upcoming||[])].map(g=>[String(g.id),g]));
 const tvMap=new Map((officialTV?.gender==='women'&&officialTV.season==='2026-27'?officialTV.rows||[]:[])
  .filter(g=>g.game_id&&g.broadcast&&/^https:\/\//.test(g.source_url||''))
  .map(g=>[String(g.game_id),g.broadcast]));
 const games=[...gameMap.values()].map(g=>{const f=liveMap.get(String(g.id)),v=finals.get(String(g.id));return {...g,...(f||{}),...(v||{}),
  origin_id:g.origin_id,origin_name:g.origin_name,published_final:!!(v||f?.status==='final'),model_final:!!v,
  broadcast:tvMap.get(String(g.id))||(g.broadcast_verified?g.broadcast:(f?.broadcast||g.broadcast))};}).filter(g=>date(g.date)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const dates=[...new Set(games.map(g=>date(g.date)))].sort(),upcoming=dates.find(d=>d>=now())||dates[dates.length-1]||now();
 const initial=/^\d{4}-\d{2}-\d{2}$/.test(params.get('day')||'')?params.get('day'):upcoming;
 const profile=(t,score=null)=>{
  if(!t)return {name:'Opponent outside Division I',crest:'',record:'—',retro:'RETRO —',color:'#655239',score};
  const colors=window.MBBLogos.colorForESPN(String(t.team_id));
  return {name:t.team,crest:badge(t,'score'),color:colors?.primary||'#655239',
   record:rec(ow(t),ol(t)),retro:window.SLTSportsScorebug.formatRetro(t,retroTies,363),score};
 };
 const displayedDate=s=>{const d=date(s);return d?d:'Date TBA'};
 const gameCard=g=>{
  const away=all.get(String(g.away_id)),home=all.get(String(g.home_id));
  const outside=id=>String(g.origin_id)===String(id)?g.origin_name:(g.opponent||'Opponent outside Division I');
  const awayProfile=away?profile(away,g.published_final?g.away_score:null):{...profile(null,g.published_final?g.away_score:null),name:outside(g.away_id)};
  const homeProfile=home?profile(home,g.published_final?g.home_score:null):{...profile(null,g.published_final?g.home_score:null),name:outside(g.home_id)};
  const venue=g.site_verified!==true?'unverified':g.neutral===true||g.site==='neutral'?'neutral':'verified-home';
  const when=new Date(g.date),timeFromFeed=Number.isFinite(+when)&&
   !/^\d{4}-\d{2}-\d{2}$/.test(String(g.date))&&
   Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(when))!==0?
   when.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET':'';
  const printed=g.official_tipoff_local||g.official_tipoff_as_printed||
   g.official_time_as_printed||g.official_school_time||g.verified_tipoff||'';
  const tipoff=printed&&!/^(TBA|TBD|unknown)$/i.test(printed)?printed+' (school local)':timeFromFeed||'TIME TBA';
  const broadcast=g.broadcast||'TV TBA';
  const final=g.published_final&&Number.isFinite(Number(g.away_score))&&Number.isFinite(Number(g.home_score));
  const phase=final?'final':'upcoming',identifier=String(g.id||'');
  const link='cbb-gamefile.html?gender=women&day='+encodeURIComponent(displayedDate(g.date))+
   '&game='+encodeURIComponent(identifier);
  let forecast=null;
  if(!final&&away&&home&&venue!=='unverified'&&!g.source_conflict&&window.WBBRetroForecast){
   const p=window.WBBRetroForecast.forecast(home,away,venue,window.WBBForecastCalibration,model);
   if(p&&Number.isFinite(Number(p.home_probability))){
    const favorite=p.home_probability>=.5?home:away;
    forecast={team:favorite.team,probability:Math.max(p.home_probability,1-p.home_probability),
     margin:p.calibrated&&Number.isFinite(Number(p.projected_home_margin))?Math.abs(Number(p.projected_home_margin)):null};
   }
  }
  const scorebug=window.SLTSportsScorebug.render({phase,gender:'women',periodFormat:'quarters',
   away:awayProfile,home:homeProfile,forecast,time:tipoff,network:broadcast,
   suppressTipoffFallback:!forecast});
  const source=final?(g.model_final?'RETRO-verified Division I final':'Published final · outside women’s current RETRO snapshot'):
    venue==='unverified'?'Court not independently verified · forecast withheld':'Verified source game listing';
  const data=final?'<div class="slt-wbb-inline" data-wbb-id="'+esc(identifier)+'" data-wbb-day="'+esc(displayedDate(g.date))+'"'+
   ' data-wbb-away="'+esc(awayProfile.name)+'" data-wbb-home="'+esc(homeProfile.name)+'"'+
   ' data-wbb-away-score="'+esc(g.away_score)+'" data-wbb-home-score="'+esc(g.home_score)+'" data-wbb-phase="final">'+
   '<p>Open this game to retrieve available women’s scoring and statistics.</p></div>':
   '<div class="note">'+esc(g.venue||'Venue TBA')+' · '+esc(source)+'</div>';
  return '<article class="ledger26-card slt-conference-game"><div class="ledger26-meta slt-fixture-meta">'+
   '<span class="ledger26-time">'+esc(displayedDate(g.date))+'</span>'+
   '<span class="slt-fixture-tipoff">'+esc(final?'FINAL':tipoff)+'</span>'+
   '<span class="slt-fixture-network">'+esc(broadcast)+'</span></div>'+
   '<details class="ledger26-expand"><summary class="ledger26-summary">'+scorebug+
   '<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+
   '<div class="ledger26-expanded">'+data+'<p class="note">'+esc(source)+
   (g.venue?' · '+esc(g.venue):'')+'</p>'+
   '<div class="slt-conference-game-link"><a href="'+esc(link)+'">OPEN GAMEFILE ↗</a></div>'+
   '</div></details></article>';
 };
 // Delegate stat loading to the same shared inline gamefile used on men's conference cards.
 document.addEventListener('toggle',async ev=>{
  const details=ev.target;
  if(!details.matches?.('.ledger26-expand[open]'))return;
  const node=details.querySelector('.slt-wbb-inline');
  if(!node||node.dataset.loaded||!window.SLTInlineGamefile)return;
  node.dataset.loaded='true';
  try{
   await window.SLTInlineGamefile.mount(node,{
    id:node.dataset.wbbId,day:node.dataset.wbbDay,kind:'regular',phase:node.dataset.wbbPhase,
    away:{name:node.dataset.wbbAway,score:Number(node.dataset.wbbAwayScore)},
    home:{name:node.dataset.wbbHome,score:Number(node.dataset.wbbHomeScore)}
   },{women:true});
  }catch(error){node.textContent='Statistics are unavailable in this gamefile. Open the full gamefile for other details.';}
 },true);

  const aliases=items.flatMap(t=>{
  const name=t.team.toLowerCase(),school=name.replace(/\s+(?:nittany lions|tar heels|blue devils|fighting irish|lady volunteers|scarlet knights|boilermakers|cornhuskers|wildcats|buckeyes|hoosiers|huskies|tigers|spartans|bruins|trojans|hawkeyes|wolverines|badgers|gophers|terrapins|ducks|knights|cardinals|bears|eagles|cougars|panthers|bulldogs|rams|pirates|falcons|rebels|mountaineers|gamecocks|aggies|owls|bison|redhawks)$/i,'').trim();
  return [name,school].filter(x=>x.length>3);
 });
 const storyPool=[...(wire?.articles||[]),...(news?.articles||[])].filter(a=>
  a?.title&&/^https:\/\//.test(a.url||'')&&
  (a.category==='WBB'||/women.s.{0,30}basketball|ncaaw|women.s march madness/i.test([a.title,a.summary,a.category].join(' '))));
 const matched=storyPool.filter(a=>aliases.some(s=>(a.title+' '+(a.summary||'')).toLowerCase().includes(s)));
 const seenStories=new Set();
 const stories=matched.filter(a=>!seenStories.has(a.url)&&seenStories.add(a.url))
  .sort((a,b)=>Date.parse(b.published_at||0)-Date.parse(a.published_at||0)).slice(0,8);
 const newsHTML=stories.length?stories.map((a,i)=>
  '<article class="story'+(!i?' lead':'')+'"><p class="source">'+esc(a.source||'Attributed reporting')+
  (a.published_at?' · '+esc(String(a.published_at).slice(0,10)):'')+'</p><h3>'+
  '<a target="_blank" rel="noopener noreferrer" href="'+esc(a.url)+'">'+esc(a.title)+'</a></h3>'+
  (a.summary?'<p>'+esc(a.summary)+'</p>':'')+'</article>').join(''):
  '<p class="note">No source-backed conference stories are currently matched to these programs. <a href="ncaam.html?gender=women#wbb-news">Women’s national news →</a></p>';

  document.title=label(c)+' Women’s Basketball | Sporting Life & Times';
 const calendar='<div class="slt-game-day-picker"><label for="conference-game-day">Games for</label>'+
  '<input type="date" id="conference-game-day" value="'+esc(initial)+'" aria-label="Choose women’s conference game date"></div>'+
  '<div id="conference-day-games"></div>';
 app.innerHTML='<div class="conference-identity"><div class="conference-identity-upper">'+
 '<span>THE CONFERENCE REGISTER</span><span>2026–27 WOMEN’S SEASON</span></div>'+
 '<div class="conference-identity-main"><h1>'+esc(c)+'</h1><p>The race for the championship</p></div>'+
 '<div class="conference-identity-meta"><span>'+items.length+' member schools</span>'+
 '<span>Conference leader: '+esc(leader?.team||'To be determined')+'</span>'+
 '<span><a href="ncaaw-conference.html">All 32 conferences →</a></span></div></div>'+
 '<div class="metrics">'+metric(items.length,'Programs')+
 metric(Math.round(items.reduce((sum,t)=>sum+n(t.elo),0)/items.length),'Average Elo')+
 metric('—','Projected NCAA bids')+
 metric(items.reduce((sum,t)=>sum+cw(t),0),'Conference finals')+'</div>'+
 '<section class="panel victorian-seed-order victorian-unified-ledger">'+
 '<div class="victorian-seed-crown" aria-hidden="true">❦ &nbsp; THE CONFERENCE REGISTER &nbsp; ❦</div>'+
 heading('The conference race','Current & Projected Standings')+table+'</section>'+
 '<div class="grid two conference-editorial-row"><div class="column">'+
 '<section class="panel conference-news-edition">'+heading('The league notebook','Conference News')+newsHTML+'</section>'+
 '</div><div class="column"><section class="panel teal">'+heading('Next on the schedule','Upcoming Games')+
 calendar+'</section></div></div>';

  const picker=document.getElementById('conference-game-day'),host=document.getElementById('conference-day-games');
 const render=d=>{
  const on=games.filter(g=>date(g.date)===d);
  host.innerHTML=on.length?on.map(gameCard).join(''):
   '<p class="note">No published games involving '+esc(label(c))+' members on this date.</p>';
 };
 picker.addEventListener('change',()=>render(picker.value));
 render(picker.value);

 }catch(err){console.error('Women’s conference desk',err);failure(err.message)}
})();