/* One women-only newspaper template for all 32 conferences / 363 Division I programs. */
(async()=>{
'use strict';
const app=document.getElementById('app'),params=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()};
const date=s=>{const d=new Date(s);if(!Number.isFinite(+d))return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v=k=>parts.find(x=>x.type===k)?.value||'';return v('year')+'-'+v('month')+'-'+v('day')};
const now=()=>date(new Date()),norm=s=>String(s||'').toLowerCase().replace(/\bconference\b/g,'').replace(/[^a-z0-9]/g,'');
const label=c=>c.replace(/ Conference$/,'').replace('Atlantic Coast','ACC').replace('Southeastern','SEC');
const url=c=>'ncaaw-conference.html?conference='+encodeURIComponent(c),teamURL=t=>'ncaaw-team.html?team='+encodeURIComponent(t.team_id);
const n=t=>Number(t||0),ratio=(w,l)=>w+l?w/(w+l):0,pct=(w,l)=>w+l?(w/(w+l)).toFixed(3).replace(/^0/,''):'—';
const rec=(w,l)=>w+'–'+l,elo=t=>Number.isFinite(Number(t.elo))?Math.round(Number(t.elo)).toString():'—';
const failure=s=>{app.innerHTML='<section class="panel"><h1>Women’s conference desk unavailable</h1><p>'+esc(s)+'</p><a href="ncaam.html?gender=women">Open the women’s newspaper →</a></section>'};
try{
 await window.MBBLogos.ready;
 const [directory,conferences,model,master,scoreboard,news]=await Promise.all([
  get('data/ncaaw-2026-27-teams.json'),get('data/ncaaw-2026-27-conferences.json'),
  get('data/ncaaw-2026-27-retro-primary.json'),get('data/ncaaw-schedules-2026-27.json'),
  get('data/ncaaw-2026-27-games.json').catch(()=>null),get('articles.json').catch(()=>null)
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
 const badge=t=>window.MBBLogos.byESPN(String(t.team_id),'small',t.team);
 const link=t=>'<a class="wbc-team" href="'+teamURL(t)+'">'+badge(t)+'<span>'+esc(t.team)+'</span></a>';
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
   '<div class="conf-grid wbc-directory">'+names.map(c=>{const items=members(c),leader=ordered(c).items[0];
    return '<a class="conf-card wbc-card" href="'+url(c)+'"><div class="eyebrow">'+items.length+' member programs</div><h3>'+esc(label(c))+'</h3>'+
     '<div class="logos">'+items.slice(0,5).map(badge).join('')+'</div><small>'+esc(leader.team)+' · RETRO '+elo(leader)+' →</small></a>'}).join('')+'</div>';
  return;
 }
 if(!selected){failure('Conference not found in the women’s 2026–27 registry.');return;}
 const c=selected,{items,played,compare}=ordered(c),leader=items[0];
 const gb=t=>!played?'—':(cw(leader)-cw(t)+cl(t)-cl(leader))/2;
 const table='<div class="wbc-ledger"><table class="conference-ledger wbc-table"><thead><tr><th>Place*</th><th>University</th><th>Conf.</th><th>Conf. PCT</th><th>GB</th><th>Overall</th><th>Overall PCT</th><th>Streak</th><th>RETRO</th></tr></thead><tbody>'+
 items.map(t=>{const place=1+items.filter(other=>compare(other,t)<0).length,tied=items.some(other=>other!==t&&compare(other,t)===0),behind=gb(t);
  return '<tr><td><span class="ledger-place">'+(tied?'T':'')+place+'</span></td><td>'+link(t)+'</td>'+
   '<td data-label="Conf.">'+rec(cw(t),cl(t))+'</td><td data-label="Conf. PCT">'+pct(cw(t),cl(t))+'</td>'+
   '<td>'+(behind==='—'||behind===0?'—':Number.isInteger(behind)?behind:behind.toFixed(1))+'</td>'+
   '<td data-label="Overall">'+rec(ow(t),ol(t))+'</td><td>'+pct(ow(t),ol(t))+'</td><td>'+streak(t)+'</td>'+
   '<td data-label="RETRO">'+elo(t)+'<small>'+(t.rank?'#'+t.rank:'—')+'</small></td></tr>'}).join('')+
 '</tbody></table></div><p class="note">*Provisional standing order, not official conference-tournament seeding. Conference winning percentage takes priority once league games are played. Overall results break equal conference records; unresolved ties remain tied. RETRO is calculated from published women’s Division I finals. Unverified NET or bracket seeds are not fabricated.</p>';
 const gameMap=new Map(),memberIds=new Set(items.map(t=>String(t.team_id)));
 for(const [id,school] of Object.entries(master.teams||{})){if(!memberIds.has(String(id)))continue;
  for(const g of school.games||[]){if(!/^\d+$/.test(String(g.id||'')))continue;
   if(!gameMap.has(String(g.id)))gameMap.set(String(g.id),{...g,origin_id:String(id),origin_name:school.team})}
 }
 const liveMap=new Map([...(scoreboard?.finals||[]),...(scoreboard?.upcoming||[])].map(g=>[String(g.id),g]));
 const games=[...gameMap.values()].map(g=>{const f=liveMap.get(String(g.id)),v=finals.get(String(g.id));return {...g,...(f||{}),...(v||{}),
  origin_id:g.origin_id,origin_name:g.origin_name,published_final:!!(v||f?.status==='final'),model_final:!!v,
  broadcast:g.broadcast_verified?g.broadcast:(f?.broadcast||g.broadcast)};}).filter(g=>date(g.date)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const dates=[...new Set(games.map(g=>date(g.date)))].sort(),upcoming=dates.find(d=>d>=now())||dates[dates.length-1]||now();
 const initial=/^\d{4}-\d{2}-\d{2}$/.test(params.get('day')||'')?params.get('day'):upcoming;
 const gameCard=g=>{const away=all.get(String(g.away_id)),home=all.get(String(g.home_id));
  const fallback=side=>String(g.origin_id)===String(side)?g.origin_name:(g.opponent||'Other-division opponent');
  const a=away?link(away):'<span>'+esc(fallback(g.away_id))+'</span>';
  const h=home?link(home):'<span>'+esc(fallback(g.home_id))+'</span>';
  const d=new Date(g.date),hour=Number.isFinite(+d)?Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(d)):0;
  const sourceTime=g.official_tipoff_local||g.official_tipoff_as_printed||g.official_time_as_printed||g.official_school_time||g.verified_tipoff||'';
  const tip=sourceTime&&!/TBA|TBD/i.test(sourceTime)?sourceTime+' (school listed)':hour?d.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET':'Time TBA';
  const result=g.published_final&&Number.isFinite(Number(g.away_score))&&Number.isFinite(Number(g.home_score))?
   '<strong>'+esc(g.away_score)+' – '+esc(g.home_score)+'</strong><small>'+(g.model_final?'RETRO-verified Division I final':'Published final, not in RETRO')+'</small>':
   '<strong>'+esc(tip)+'</strong>';
  const file='cbb-gamefile.html?gender=women&day='+encodeURIComponent(date(g.date))+'&game='+encodeURIComponent(g.id);
  return '<article class="wbc-game"><div class="wbc-game-teams"><div>'+a+'</div><small>'+(g.neutral||g.site==='neutral'?'vs':'at')+'</small><div>'+h+'</div></div>'+
   '<div class="wbc-game-score">'+result+'</div><div class="wbc-game-facts"><span>'+esc(g.venue||'Venue TBA')+'</span>'+
   '<span>'+esc(g.broadcast||'Network TBA')+'</span><a href="'+file+'">Game file →</a></div></article>';
 };
 const stories=(news?.articles||[]).filter(a=>a.title&&/^https:\/\//.test(a.url||'')&&(a.category==='WBB'||/women.s.{0,24}basketball|ncaaw/i.test([a.title,a.summary,a.category].join(' ')))&&
  items.some(t=>(String(a.title)+' '+String(a.summary||'')).toLowerCase().includes(t.team.toLowerCase().split(' ').slice(0,-1).join(' ')))).slice(0,6);
 const newsHTML=stories.length?stories.map(a=>'<article class="wbc-story"><h3><a target="_blank" rel="noopener noreferrer" href="'+esc(a.url)+'">'+esc(a.title)+'</a></h3><small>'+esc(a.source||'Attributed report')+'</small></article>').join(''):
  '<p class="note">No current sourced stories matched specifically to these schools. <a href="ncaam.html?gender=women#wbb-news">National women’s news →</a></p>';
 document.title=label(c)+' Women’s Basketball | Sporting Life & Times';
 app.innerHTML='<p class="eyebrow"><a href="ncaaw-conference.html">All Women’s Conferences</a> / '+esc(c)+'</p>'+
 '<div class="conference-identity"><div class="conference-identity-upper"><span>THE WOMEN’S CONFERENCE REGISTER</span><span>2026–27 SEASON</span></div>'+
 '<div class="conference-identity-main"><h1>'+esc(label(c))+' Basketball</h1><p>The race for the championship</p></div>'+
 '<div class="conference-identity-meta"><span>'+items.length+' member schools</span><span>'+games.length+' published fixtures</span>'+
 '<span>RETRO through '+esc(model.as_of||'latest publication')+'</span></div></div>'+
 '<div class="wbc-metrics"><div><strong>'+items.length+'</strong><small>Programs</small></div>'+
 '<div><strong>'+Math.round(items.reduce((sum,t)=>sum+n(t.elo),0)/items.length)+'</strong><small>Average RETRO</small></div>'+
 '<div><strong>'+items.reduce((sum,t)=>sum+cw(t),0)+'</strong><small>Conference wins</small></div>'+
 '<div><strong>'+n(model.games_played)+'</strong><small>National D-I finals</small></div></div>'+
 '<section class="panel victorian-seed-order victorian-unified-ledger"><div class="victorian-seed-crown">❦ THE CONFERENCE REGISTER ❦</div>'+
 '<div class="panel-head"><div><div class="eyebrow">The conference race</div><h2>Current Standings</h2></div></div>'+table+'</section>'+
 '<div class="grid two"><div class="column"><section class="panel"><div class="eyebrow">The league notebook</div><h2>Conference News</h2>'+newsHTML+'</section>'+
 '<section class="panel"><div class="eyebrow">The school register</div><h2>Every Member School</h2><div class="wbc-members">'+items.map(link).join('')+'</div></section></div>'+
 '<div class="column"><section class="panel teal"><div class="eyebrow">The season game book</div><h2>Schedule &amp; Results</h2>'+
 '<p class="note">Choose past or future games using the calendar. Unverified times and broadcasts remain labeled.</p>'+
 '<div class="wbc-date-controls"><button type="button" id="wbc-prev">‹ Previous games</button><label>Games on <input id="wbc-date" type="date" value="'+esc(initial)+'"></label>'+
 '<button type="button" id="wbc-next">Next games ›</button></div><div id="wbc-schedule"></div></section></div></div>';
 const picker=document.getElementById('wbc-date'),host=document.getElementById('wbc-schedule');
 const render=d=>{const on=games.filter(g=>date(g.date)===d);host.innerHTML='<h3 class="wbc-day-heading">'+esc(new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}))+'</h3>'+
  (on.length?on.map(gameCard).join(''):'<p class="note">No published games involving conference teams on this date.</p>')};
 const move=step=>{let index=dates.indexOf(picker.value);if(index<0){index=step>0?dates.findIndex(d=>d>picker.value)-1:dates.findIndex(d=>d>=picker.value)}
  const i=index+step;if(i>=0&&i<dates.length){picker.value=dates[i];render(picker.value)}};
 picker.addEventListener('change',()=>render(picker.value));
 document.getElementById('wbc-prev').addEventListener('click',()=>move(-1));
 document.getElementById('wbc-next').addEventListener('click',()=>move(1));render(picker.value);
}catch(err){console.error('Women’s conference desk',err);failure(err.message)}
})();