(function () {
"use strict";
const root=document.getElementById("nfl-app");
const page=document.body.getAttribute("data-page")||"front";
const params=new URLSearchParams(location.search);
const encode=encodeURIComponent;
const escapeHtml=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const format=(n,dec=0)=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString("en-US",{maximumFractionDigits:dec,minimumFractionDigits:dec}):"—";
const date=x=>{try{return new Date(x).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});}catch(e){return x||"TBA";}};
const urlTeam=id=>"nfl-team.html?team="+encode(id);
const urlGame=id=>"nfl-game.html?id="+encode(id);
const link=(href,title)=>'<a href="'+escapeHtml(href)+'">'+escapeHtml(title)+'</a>';
let feed={},teams={},games=[];
let liveFeed=null,liveSource='season ledger',lastLiveSignature='';
function team(id){return teams[String(id)]||{id:String(id),name:"Unknown team",code:"?",color:"#222",secondary_color:"#cfa951"};}
function crest(t,size=""){return '<span class="nfl-badge '+size+'" style="--nfl-primary:'+escapeHtml(t.color||"#222")+';--nfl-secondary:'+escapeHtml(t.secondary_color||"#cfa951")+'"><span class="nfl-badge-core"><img loading="lazy" src="'+escapeHtml(t.logo||"")+'" alt=""></span></span>';}
function side(s,showScore){const t=team(s.id);return '<div class="nfl-side">'+crest(t,"sm")+link(urlTeam(t.id),t.name)+(showScore&&s.score!=null?'<b class="nfl-score">'+s.score+'</b>':"")+'</div>';}
function panel(title,content){return '<section class="nfl-section"><h2>'+escapeHtml(title)+'</h2>'+content+'</section>';}
function note(content){return '<div class="nfl-note">'+content+'</div>';}
function gridTable(headers,rows){let out='<div style="overflow-x:auto"><table class="nfl-table"><thead><tr>';
headers.forEach(h=>out+='<th>'+escapeHtml(h)+'</th>');
out+='</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
return out;}
function club(t){return '<div class="club">'+crest(t,"sm")+link(urlTeam(t.id),t.name)+'</div>';}
function gameCard(g){const done=g.state==="post",e=g.elo||{};
let out='<article class="nfl-card '+(g.state==="in"?"nfl-is-live":"")+'"><div class="meta"><span>WEEK '+g.week+'</span><span>'+liveMark(g)+'</span></div><div class="match">';
out+=side(g.away,done||g.state==="in")+side(g.home,done||g.state==="in")+'</div>';
out+='<div class="line">'+escapeHtml(date(g.date))+(g.broadcast?" · "+escapeHtml(g.broadcast):"")+'</div>';
if(e.home_win_probability!=null)out+='<div class="line">USRS: '+team(g.home.id).code+' '+format(e.home_win_probability*100)+'% · projection '+e.away_projected_points+'–'+e.home_projected_points+'</div>';
return out+gameSnapshot(g)+'<div class="line nfl-open-game">'+link(urlGame(g.id),g.state==='in'?"Follow live game →":"Game center →")+'</div></article>';}
function gameLine(g){const done=g.state!=="pre";
return '<div class="nfl-game"><div class="meta"><span>WEEK '+g.week+' · '+liveMark(g)+'</span><span>'+escapeHtml(date(g.date))+'</span></div>'+side(g.away,done)+side(g.home,done)+'<div class="line">'+escapeHtml(g.venue||"Venue TBA")+' · '+link(urlGame(g.id),"Game details →")+'</div></div>';}
function sorted(t){return t.slice().sort((a,b)=>b.pct-a.pct||b.w-a.w||b.elo-a.elo);}
function seasonTable(t){return gridTable(["TEAM","W-L-T","PCT","PF","PA","DIFF","ELO"],sorted(t).map(x=>'<tr><td>'+club(x)+'</td><td><span class="nfl-record-nowrap">'+x.w+'–'+x.l+'–'+x.t+'</span></td><td>'+(x.pct*100).toFixed(1)+'%</td><td>'+x.pf+'</td><td>'+x.pa+'</td><td>'+x.point_diff+'</td><td><b>'+format(x.elo,1)+'</b></td></tr>'));}
function statsCaveat(){const c=feed.coverage||{};return note(c.boxscore_complete?"Player statistics represent all "+c.finals+" completed-game box scores in this edition.":"<strong>PARTIAL STATISTICS:</strong> "+c.boxscores+" of "+c.finals+" final-game box scores recovered. Player and team statistical totals are incomplete until all game boxes are verified.");}
function week(){const next=games.filter(g=>new Date(g.date).getTime()>Date.now()-86400000).sort((a,b)=>a.date.localeCompare(b.date));return next.length?next[0].week:18;}
function directory(){return '<div class="nfl-directory">'+feed.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>'<a class="nfl-tile" href="'+urlTeam(t.id)+'">'+crest(t,"sm")+'<span>'+escapeHtml(t.name)+'<span class="small">'+escapeHtml(t.division)+' · '+t.w+'-'+t.l+'-'+t.t+'</span></span></a>').join("")+'</div>';}
const leaderLabels={
 passing:{title:"PASSING",unit:"YDS",sub:"Passing yards"},rushing:{title:"RUSHING",unit:"YDS",sub:"Rushing yards"},
 receiving:{title:"RECEIVING",unit:"YDS",sub:"Receiving yards"},tackles:{title:"TACKLES",unit:"TOT",sub:"Total tackles"},
 sacks:{title:"SACKS",unit:"SACKS",sub:"Quarterback sacks"},interceptions:{title:"INTERCEPTIONS",unit:"INT",sub:"Defensive interceptions"}
};
function playerExtra(p,category){
 const s=p.stats||{},keys=category==="passing"?[["TD","TD"],["INT","INT"]]:category==="rushing"?[["CAR","ATT"],["TD","TD"]]:category==="receiving"?[["REC","REC"],["TD","TD"]]:category==="tackles"?[["SOLO","SOLO"],["TFL","TFL"]]:category==="sacks"?[["TFL","TFL"],["QB HTS","QB HITS"]]:[["YDS","RETURN YDS"],["TD","TD"]];
 return keys.filter(([key])=>s[key]!=null).map(([key,label])=>'<span><b>'+format(s[key],1)+'</b> '+label+'</span>').join("");
}
function leaderRow(p,i,category,max,compact=false){
 const t=team(p.team_id),frac=Math.max(0,Math.min(100,100*(Number(p.value)||0)/Math.max(1,max)));
 return '<div class="nfl-leader-row '+(compact?'compact':'')+'" style="--club-color:'+escapeHtml(t.color)+';--club-alt:'+escapeHtml(t.secondary_color)+'">'+
 '<span class="nfl-leader-rank">'+String(i+1).padStart(2,"0")+'</span>'+
 '<div class="nfl-leader-face"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""></div>'+
 '<div class="nfl-leader-info"><b>'+escapeHtml(p.name)+'</b><div class="nfl-leader-club">'+crest(t,"sm")+' '+link(urlTeam(t.id),t.code)+
 '<span class="nfl-leader-detail"> · '+format(p.games)+' games</span></div>'+
 '<div class="nfl-progress" aria-hidden="true"><span style="width:'+frac.toFixed(1)+'%"></span></div>'+
 (compact?'':'<div class="nfl-leader-extras">'+playerExtra(p,category)+'</div>')+'</div>'+
 '<div class="nfl-leader-value"><b>'+format(p.value,category==="sacks"?1:0)+'</b><small>'+escapeHtml(leaderLabels[category].unit)+'</small></div></div>';
}
function listLeaders(category,limit,teamFilter){
 const src=teamFilter?(((feed.team_leaders||{})[teamFilter]||{})[category]||((feed.leaders||{})[category]||[]).filter(p=>p.team_id===teamFilter)):((feed.leaders||{})[category]||[]);
 const rows=src.slice(0,limit),max=rows.length?rows[0].value:1;
 return rows.map((p,i)=>leaderRow(p,i,category,max,true)).join("")||'<p class="nfl-small">Verified player figures pending.</p>';
}
function featurePlayer(p,i,category){
 const t=team(p.team_id),label=leaderLabels[category];
 return '<article class="nfl-feature-player place-'+(i+1)+'" style="--club-color:'+escapeHtml(t.color)+';--club-alt:'+escapeHtml(t.secondary_color)+'">'+
 '<div class="nfl-feature-top"><span class="nfl-place-label">'+(i===0?"LEAGUE LEADER":i===1?"SECOND PLACE":"THIRD PLACE")+'</span>'+crest(t,"head")+'</div>'+
 '<div class="nfl-feature-portrait"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""></div>'+
 '<div class="nfl-feature-details"><p class="nfl-feature-team">'+escapeHtml(t.name)+'</p><h2>'+escapeHtml(p.name)+'</h2>'+
 '<div class="nfl-feature-number">'+format(p.value,category==="sacks"?1:0)+'<span>'+escapeHtml(label.unit)+'</span></div>'+
 '<div class="nfl-feature-extra">'+playerExtra(p,category)+'</div><p class="nfl-small">'+format(p.games)+' verified games</p></div></article>';
}

function easternDay(value){
 const d=new Date(value),parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const p={};parts.forEach(x=>p[x.type]=x.value);return p.year+'-'+p.month+'-'+p.day;
}
function nextDay(day,n){
 const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
function liveClock(g){return g.state==='in'?'Q'+(g.period||'?')+' · '+(g.clock||'Live'):escapeHtml(g.status||'');}
function liveMark(g){return g.state==='in'?'<span class="nfl-live-pill"><i aria-hidden="true"></i> LIVE · '+escapeHtml(liveClock(g))+'</span>':escapeHtml(g.status||'');}
function gameSnapshot(g){
 if(g.state!=='in'&&!g.last_play)return '';
 const b=((liveFeed||{}).boxes||{})[g.id]||{},stats=b.teams||{},away=stats[g.away.id]||{},home=stats[g.home.id]||{};
 let out='';
 if(g.state==='in')out+='<p class="nfl-live-situation">'+(g.possession?escapeHtml(team(g.possession).code)+' possession · ':'')+
    escapeHtml(g.down_distance||'')+'</p>';
 if(away.totalYards!=null||home.totalYards!=null)out+='<div class="nfl-card-stats"><b>'+format(away.totalYards)+'</b><span>TEAM YARDS</span><b>'+format(home.totalYards)+'</b></div>';
 if(g.last_play)out+='<p class="nfl-last-play">'+escapeHtml(g.last_play)+'</p>';
 return out;
}
function liveLeaders(){
 const boxes=(liveFeed||{}).boxes||{},all=Object.values(boxes).flatMap(b=>b.players||[]);
 if(!all.length)return '';
 let out='<div class="nfl-live-player-grid">';
 [['passing','YDS'],['rushing','YDS'],['receiving','YDS']].forEach(([cat,key])=>{
   const rows=all.filter(p=>(p.category||'').includes(cat)&&Number(p.stats?.[key])>0)
     .sort((a,b)=>Number(b.stats[key])-Number(a.stats[key])).slice(0,3);
   out+='<section><h3>'+cat.toUpperCase()+'</h3>';
   out+=rows.map(p=>'<div class="nfl-live-player"><img loading="lazy" src="'+escapeHtml(p.headshot||'')+'" alt=""><span><b>'+escapeHtml(p.name)+'</b><small>'+escapeHtml(team(p.team_id).code)+'</small></span><strong>'+format(p.stats[key])+' <small>YDS</small></strong></div>').join('')||'<p class="nfl-small">Awaiting verified live statistics</p>';
   out+='</section>';
 });
 return out+'</div><p class="nfl-small">In-game numbers are provisional until confirmed final boxes are published.</p>';
}
function scoreByPeriod(g){
 const a=g.away.linescores||[],h=g.home.linescores||[];
 if(!a.length&&!h.length)return '';
 const n=Math.max(a.length,h.length);
 return gridTable(['TEAM'].concat(Array.from({length:n},(_,i)=>i>=4?'OT'+(i===4?'':i-3):'Q'+(i+1))).concat(['TOTAL']),
 [g.away,g.home].map(s=>'<tr><td>'+escapeHtml(team(s.id).code)+'</td>'+
 Array.from({length:n},(_,i)=>'<td>'+((s.linescores||[])[i]?.score??'—')+'</td>').join('')+
 '<td><b>'+format(s.score)+'</b></td></tr>'));
}
function liveGamePanel(g){
 if(g.state!=='in'&&!g.away.linescores?.length)return '';
 let out='<div class="nfl-live-game-panel"><div class="nfl-live-game-heading"><strong>'+liveMark(g)+'</strong><span>LIVE GAME TRACKER · source-reported details</span></div>';
 out+=scoreByPeriod(g);
 if(g.state==='in')out+='<div class="nfl-live-drive">'+(g.possession?'<strong>'+escapeHtml(team(g.possession).name)+' BALL</strong> ':'')+
 escapeHtml(g.down_distance||'')+(g.last_play?'<p>'+escapeHtml(g.last_play)+'</p>':'')+'</div>';
 return out+'</div>';
}

function home(){
 const now=new Date(),day=easternDay(now);
 const dayText=now.toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const slate=games.filter(g=>easternDay(g.date)===day).sort((a,b)=>a.date.localeCompare(b.date));
 const isGameDay=slate.length>0;
 const nextGames=games.filter(g=>g.state!=='post'&&new Date(g.date).getTime()>now.getTime()-7200000).sort((a,b)=>a.date.localeCompare(b.date));
 const shown=slate.length?slate:nextGames.slice(0,8);
 const live=slate.filter(g=>g.state==='in');
 const candidates=(live.length?live:slate.some(g=>g.state==='pre')?slate.filter(g=>g.state==='pre'):slate.length?slate:nextGames);
 const featured=(candidates.slice().sort((a,b)=>{
   const grade=x=>x.state==='in'?1000-Math.abs((x.away.score||0)-(x.home.score||0))*20+
    (Number(x.period)||0)*3:x.state==='pre'?400-Math.abs((x.elo?.home_win_probability||0.5)-0.5)*200
    :200-Math.abs((x.away.score||0)-(x.home.score||0))*3;
   return grade(b)-grade(a)||String(a.date).localeCompare(String(b.date));
 })[0])||shown[0];
 const other=shown.filter(g=>!featured||g.id!==featured.id).slice().sort((a,b)=>{
  const k=x=>x.state==='in'?3:x.state==='pre'?2:1;
  return k(b)-k(a)||String(a.date).localeCompare(String(b.date));
 }).slice(0,3);
 const allFinals=games.filter(g=>g.state==='post').slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const future=nextGames.filter(g=>!slate.some(s=>s.id===g.id)).slice(0,5);
 const model=feed.model||{},coverage=feed.coverage||{};
 const status=g=>g.state==='in'?('LIVE · '+(g.period>4?'OT':'Q'+(g.period||'?'))+' '+(g.clock||'')):g.state==='post'?'FINAL':date(g.date);
 const points=g=>g.state==='pre'?null:g;
 const rec=t=>t&&t.w!=null?t.w+'–'+t.l+(t.t?'–'+t.t:''):'';
 const kickoff=g=>g.broadcast||g.venue||date(g.date);
 function scoreRow(s,g){
  const t=team(s.id);
  return '<div class="nfl-p26-score-row">'+crest(t,'sm')+
    '<span class="nfl-p26-score-id">'+escapeHtml(t.code)+'<small>'+escapeHtml(rec(t))+'</small></span>'+
    '<span class="nfl-p26-score-val'+(g.state==='pre'?' blank':'')+'">'+(g.state==='pre'?'—':format(s.score))+'</span></div>';
 }
 function scoreCard(g){
  return '<a class="nfl-p26-score" href="'+urlGame(g.id)+'"><div class="nfl-p26-score-top"><span>WEEK '+escapeHtml(g.week)+'</span>'+
   '<span class="'+(g.state==='in'?'in':'')+'">'+(g.state==='in'?'● ':'')+escapeHtml(status(g))+'</span></div>'+
   scoreRow(g.away,g)+scoreRow(g.home,g)+
   '<div class="nfl-p26-score-bottom">'+escapeHtml(g.state==='pre'?date(g.date)+(g.broadcast?' · '+g.broadcast:''):g.broadcast||g.last_play||g.venue||'Game center →')+'</div></a>';
 }
 function featuredMatch(g){
  if(!g)return '<div class="nfl-p26-feature"><div><span class="nfl-p26-eyebrow">NFL GAME DAY</span><h2>YOUR NFL EDITION</h2><p>Game details are temporarily unavailable.</p></div></div>';
  const a=team(g.away.id),h=team(g.home.id),pre=g.state==='pre',elo=g.elo||{},homePct=elo.home_win_probability;
  const line=g.state==='in'?'LIVE · '+status(g):pre?'PREGAME SPOTLIGHT':'FINAL SCORE';
  const headline=pre?a.name+' at '+h.name:g.state==='in'?a.name+' at '+h.name:a.name+' at '+h.name;
  let out='<div class="nfl-p26-feature"><div><div class="nfl-p26-feature-kicker"><span>THE FEATURED GAME · WEEK '+escapeHtml(g.week)+'</span>'+
   '<span class="nfl-p26-status '+(pre?'pre':g.state==='post'?'post':'')+'">'+(g.state==='in'?'<i class="nfl-p26-red-dot" aria-hidden="true"></i>':'')+escapeHtml(line)+'</span></div>'+
   '<h2>'+escapeHtml(headline)+'</h2><p class="nfl-p26-feature-deck">'+escapeHtml(g.venue||g.city||'NFL regular season')+
   (g.broadcast?' · '+escapeHtml(g.broadcast):'')+'</p></div>';
  out+='<div class="nfl-p26-match"><div class="nfl-p26-match-side">'+crest(a,'lg')+
    '<span class="nfl-p26-name">'+escapeHtml(a.name)+'</span><span class="nfl-p26-record">'+escapeHtml(rec(a))+'</span></div>'+
    '<div class="nfl-p26-big-score'+(pre?' is-pregame':'')+'">'+(pre?'VS':'<span>'+format(g.away.score)+'</span><i>:</i><span>'+format(g.home.score)+'</span>')+'</div>'+
    '<div class="nfl-p26-match-side">'+crest(h,'lg')+'<span class="nfl-p26-name">'+escapeHtml(h.name)+'</span>'+
    '<span class="nfl-p26-record">'+escapeHtml(rec(h))+'</span></div></div>';
  out+='<div>';
  if(homePct!=null){
   const percent=Math.max(0,Math.min(100,100*Number(homePct)));
   out+='<div class="nfl-p26-feature-forecast"><b>USRS PREGAME</b><span>'+escapeHtml(a.code)+' '+format(100-percent,0)+'%</span>'+
    '<span class="nfl-p26-forecast-bar" role="img" aria-label="Pregame away '+format(100-percent,0)+' percent, home '+format(percent,0)+' percent"><i style="width:'+(100-percent).toFixed(1)+'%"></i></span>'+
    '<span>'+escapeHtml(h.code)+' '+format(percent,0)+'%</span></div>';
  }
  if(g.state==='in'&&(g.down_distance||g.last_play)){
    out+='<div class="nfl-p26-action"><span class="nfl-p26-eyebrow">LIVE DRIVE</span>'+
      (g.possession?'<b>'+escapeHtml(team(g.possession).code)+' BALL</b>':'')+
      (g.down_distance?'<strong>'+escapeHtml(g.down_distance)+'</strong>':'')+
      (g.last_play?'<p>'+escapeHtml(g.last_play)+'</p>':'')+'</div>';
  }
  out+='<div class="nfl-p26-feature-foot"><span>'+escapeHtml(pre?date(g.date):status(g))+
   (pre&&elo.away_projected_points!=null?' · USRS projected '+elo.away_projected_points+'–'+elo.home_projected_points:'')+
   '</span><a href="'+urlGame(g.id)+'">OPEN GAMEFILE ↗</a></div></div></div>';
  return out;
 }
 function focusRow(g){
  const a=team(g.away.id),h=team(g.home.id);
  const both=g.state!=='pre'&&g.away.score!=null&&g.home.score!=null;
  return '<a class="nfl-p26-focus-row" href="'+urlGame(g.id)+'"><div class="nfl-p26-focus-meta"><span>'+escapeHtml(g.state==='in'?'● LIVE':'WEEK '+g.week)+'</span>'+
   '<span>'+escapeHtml(status(g))+'</span></div>'+
   '<div class="nfl-p26-focus-teams">'+crest(a,'sm')+'<span>'+escapeHtml(a.code)+' <span class="nfl-p26-faint">at</span> '+escapeHtml(h.code)+'</span>'+
   '<b>'+(both?format(g.away.score)+'–'+format(g.home.score):'VS')+'</b></div>'+
   '<div class="nfl-p26-focus-line">'+escapeHtml(g.broadcast||g.venue||date(g.date))+'</div></a>';
 }
 function sectionHead(eye,title,href,cta,desc){
  return '<div class="nfl-p26-section-head"><div><span class="nfl-p26-eyebrow nfl-p26-red">'+escapeHtml(eye)+'</span><h2>'+escapeHtml(title)+'</h2>'+
   (desc?'<p>'+escapeHtml(desc)+'</p>':'')+'</div>'+(href?'<a href="'+href+'">'+escapeHtml(cta||'MORE')+' ↗</a>':'')+'</div>';
 }
 let out='<div class="nfl-p26"><div class="nfl-p26-opening"><div>'+
  '<p class="nfl-p26-eyebrow">THE SPORTING LIFE &amp; TIMES · NATIONAL FOOTBALL LEAGUE · VOL. 2026</p>'+
  '<h1 class="nfl-p26-main-title">THE GRIDIRON <em>desk.</em></h1>'+
  '<p class="nfl-p26-main-deck">The league, as it happens. Real scores, complete gamefiles, the statistical race and independently calibrated USRS Elo.</p></div>'+
  '<div class="nfl-p26-issue"><b>NFL / 2026</b><span>'+escapeHtml(dayText)+'</span><span>THE INDEPENDENT FOOTBALL EDITION</span></div></div>';
 out+='<div class="nfl-p26-topline"><div class="nfl-p26-live-ident">'+(live.length?'<i class="nfl-p26-red-dot" aria-hidden="true"></i>':'')+
   '<span>'+(live.length?'LIVE FROM '+live.length+' STADIUM'+(live.length===1?'':'S'):'THE GAME-DAY REPORT')+'</span></div>'+
   '<span class="nfl-p26-sub">LIVE UPDATES · EASTERN TIME · <a href="nfl-game-center.html">OPEN FULL GAME CENTER ↗</a></span></div>';
 out+='<div class="nfl-p26-hero">'+featuredMatch(featured)+
   '<aside class="nfl-p26-focus-rail"><span class="nfl-p26-eyebrow nfl-p26-red">AROUND THE LEAGUE</span>'+
   '<h3>'+(live.length?'In the balance.':'Next in line.')+'</h3>'+
   '<p class="nfl-p26-focus-deck">Other games on the board. Away team first, home team second.</p>'+
   '<div class="nfl-p26-focus-list">'+(other.length?other.map(focusRow).join(''):
   '<p class="nfl-p26-faint">See the full slate and upcoming kickoffs in Game Center.</p>')+'</div>'+
   '<div class="nfl-p26-rail-link"><a href="nfl-game-center.html">EVERY NFL GAME →</a></div></aside></div>';
 out+=sectionHead('01 / LIVE DESK',isGameDay?'Across today’s scoreboard':'The next kickoffs','nfl-game-center.html','ALL SCORES',
  isGameDay?'Every matchup. Live scores and game status refresh from source reporting.':'No NFL games scheduled for today; showing upcoming fixtures.');
 out+='<div class="nfl-p26-score-grid">'+(shown.length?shown.map(scoreCard).join(''):
   '<div class="nfl-p26-broken">No confirmed fixtures to display.</div>')+'</div>';
 out+='<div class="nfl-p26-data-strip"><div class="nfl-p26-data-point"><b>'+format(coverage.finals)+'</b><span>Completed season games</span></div>'+
   '<div class="nfl-p26-data-point"><b>'+format(coverage.boxscores)+'</b><span>Verified final box scores</span></div>'+
   '<div class="nfl-p26-data-point"><b>32</b><span>NFL franchises</span></div>'+
   '<div class="nfl-p26-data-point"><b>1,500</b><span>Every club’s starting Elo</span></div></div>';
 out+=sectionHead('02 / THE STAT SHEET','The players setting the pace','nfl-players.html','FULL LEADERBOARDS',
   coverage.boxscore_complete?'Season leaders calculated from every confirmed final box score.':'Season leader totals are partial pending additional game boxes.');
 out+='<div class="nfl-p26-player-grid">';
 [['passing','PASSING YARDS'],['rushing','RUSHING YARDS'],['receiving','RECEIVING YARDS']].forEach(([cat,label])=>{
  const p=((feed.leaders||{})[cat]||[])[0];
  if(!p){out+='<div class="nfl-p26-broken">Verified '+escapeHtml(cat)+' leaders pending.</div>';return;}
  const t=team(p.team_id),photo=p.headshot||'',stat=p.value;
  out+='<a class="nfl-p26-player" href="nfl-players.html?category='+cat+'" style="--club:'+escapeHtml(t.color)+'">'+
   '<div class="nfl-p26-player-copy"><small>LEAGUE LEADER / '+escapeHtml(label)+'</small>'+
   '<strong>'+escapeHtml(p.name)+'</strong><span class="nfl-p26-eyebrow">'+escapeHtml(t.name)+'</span>'+
   '<div class="nfl-p26-player-number"><b>'+format(stat)+'</b><span>YDS</span></div>'+
   '<span class="nfl-p26-player-detail">'+format(p.games)+' verified games · '+escapeHtml(t.code)+'</span></div>'+
   '<div class="nfl-p26-player-photo">'+(photo?'<img loading="lazy" src="'+escapeHtml(photo)+'" alt="">':'')+'</div></a>';
 });
 out+='</div>';
 out+='<div class="nfl-p26-editorial"><div class="nfl-p26-column nfl-p26-news">'+
  sectionHead('03 / HEADLINES','Around the NFL',null,null,'Reporting from independent and attributed sources.')+
  panel('NFL TOP STORIES','<div id="nfl-stories">Loading sourced NFL headlines…</div>')+'</div>'+
  '<div class="nfl-p26-column">'+sectionHead('04 / THE MODEL','Power & probability','nfl-rankings.html','ALL 32 CLUBS',
  'Independent USRS ratings. Every team started 2026 at 1,500.')+
  '<div class="nfl-p26-rankings">'+feed.teams.slice(0,8).map((t,i)=>{
    const pct=Math.max(2,Math.min(100,(Number(t.elo)-1250)/500*100));
    return '<a class="nfl-p26-power-row" href="'+urlTeam(t.id)+'"><span class="nfl-p26-power-rank">'+(i+1)+'</span>'+crest(t,'sm')+
    '<span class="nfl-p26-power-name">'+escapeHtml(t.name)+'<small>'+t.w+'–'+t.l+(t.t?'–'+t.t:'')+
    '</small><span class="nfl-p26-power-meter"><i style="width:'+pct.toFixed(1)+'%"></i></span></span>'+
    '<span class="nfl-p26-power-val">'+format(t.elo,0)+'</span></a>';
   }).join('')+'<div class="nfl-p26-power-foot">Historically calibrated · HFA '+format(model.home_advantage_elo)+
   ' Elo · K '+format(model.k_base)+'. Ratings update only when source-confirmed games become final.</div></div></div></div>';
 out+='<div class="nfl-p26-lower"><div class="nfl-p26-results">'+
  sectionHead('05 / THE FINAL WHISTLE','Latest results','nfl-schedule.html','SEASON SCHEDULE')+
  (allFinals.map(gameLine).join('')||'<p class="nfl-p26-broken">No verified final scores available.</p>')+'</div>'+
  '<div class="nfl-p26-results">'+sectionHead('06 / ON THE HORIZON','Coming up','nfl-schedule.html','UPCOMING GAMES')+
  (future.map(gameLine).join('')||'<p class="nfl-p26-broken">No upcoming regular-season fixtures remain.</p>')+'</div></div>';
 out+='<section id="teams" class="nfl-p26-team-list"><div><h2>The 32 clubs.</h2><span class="nfl-p26-eyebrow nfl-p26-red">CHOOSE A TEAM ↘</span></div>'+
 directory()+'</section>';
 out+='<p class="nfl-p26-method">Source-reported scores and game statistics are distinct from USRS model outputs. Pregame forecast probabilities are not in-game win probabilities. The model starts every club at 1,500 each regular season; no historical rating is carried into 2026. Live game numbers are provisional until verified final data publishes.</p>';
 return out+'</div>';
}

function standings(){
let out='<p class="nfl-kicker">REGULAR SEASON · CONFERENCE TABLES</p><h1 class="nfl-title">NFL STANDINGS</h1>';
out+=note("Standings are computed from ESPN-sourced finals. Display ties use Elo after win percentage, <strong>not</strong> the NFL’s complete official tiebreaking procedures.");
["AFC","NFC"].forEach(conf=>{
out+='<p class="nfl-kicker">'+conf+'</p><div class="nfl-grid">';
["East","North","South","West"].forEach(div=>{out+=panel(conf+" "+div,seasonTable(feed.teams.filter(t=>t.division===conf+" "+div)));});
out+='</div>';
});
return out;
}
function rankings(){
const last={};games.filter(g=>g.state==="post").forEach(g=>["away","home"].forEach(side=>last[g[side].id]=g.elo&&g.elo[side+"_delta"]));
const m=feed.model||{};
let out='<p class="nfl-kicker">THE USRS RATING DESK · HISTORICALLY CALIBRATED</p><h1 class="nfl-title">NFL ELO POWER RANKINGS</h1>';
out+='<div class="nfl-ranking-model"><span><b>1,500</b> starting Elo</span><span><b>+'+format(m.home_advantage_elo)+'</b> home field</span><span><b>K '+format(m.k_base)+'</b> margin adjusted</span><span><b>'+format(m.calibration_train_games)+'</b> training games</span></div>';
out+=note("The 2026 season starts with all 32 franchises at exactly <b>1500 Elo</b>. Home field and K are fitted to 2023–24 finals, and validated against held-out 2025 results. Prior seasons never carry ratings forward; neutral-site games have no home advantage. Ratings are independent from official NFL standings.");
out+='<div class="nfl-elo-podium">'+feed.teams.slice(0,3).map((t,i)=>'<a class="nfl-elo-podium-card" style="--team:'+escapeHtml(t.color)+'" href="'+urlTeam(t.id)+'"><span>NO. '+(i+1)+'</span>'+crest(t,"lg")+'<b>'+escapeHtml(t.name)+'</b><strong>'+format(t.elo,1)+'</strong><small>'+t.w+'–'+t.l+'–'+t.t+' · '+(t.elo_change>0?'+':'')+format(t.elo_change,1)+' from 1500</small></a>').join("")+'</div>';
const rows=feed.teams.map((t,i)=>{const pct=Math.max(2,Math.min(100,((t.elo-1250)/500)*100));
return '<tr><td><strong class="nfl-power-rank">'+(i+1)+'</strong></td><td>'+club(t)+'</td><td><span class="nfl-record-nowrap">'+t.w+'–'+t.l+'–'+t.t+'</span></td><td><div class="nfl-elo-meter" style="--elo-team:'+escapeHtml(t.color)+'"><span style="width:'+pct.toFixed(1)+'%"></span></div><b>'+format(t.elo,1)+'</b></td><td class="'+(t.elo_change>=0?'nfl-positive':'nfl-negative')+'">'+(t.elo_change>0?'+':'')+format(t.elo_change,1)+'</td><td>'+(last[t.id]==null?'—':(last[t.id]>0?'+':'')+format(last[t.id],1))+'</td></tr>';});
const cards=feed.teams.map((t,i)=>{
 const pct=Math.max(2,Math.min(100,((t.elo-1250)/500)*100));
 const delta=(t.elo_change>0?"+":"")+format(t.elo_change,1);
 const lg=last[t.id]==null?"—":(last[t.id]>0?"+":"")+format(last[t.id],1);
 return '<a class="nfl-rank-card" href="'+urlTeam(t.id)+'" style="--rank-club:'+escapeHtml(t.color)+'">'+
  '<span class="nfl-rank-card-place">'+(i+1)+'</span>'+crest(t,"sm")+
  '<span class="nfl-rank-card-identity"><strong>'+escapeHtml(t.name)+'</strong>'+
   '<span class="nfl-rank-card-record" aria-label="Wins losses ties"><em>W–L–T</em> '+t.w+'–'+t.l+'–'+t.t+'</span></span>'+
  '<span class="nfl-rank-card-rating"><strong>'+format(t.elo,1)+'</strong><small>ELO</small></span>'+
  '<span class="nfl-rank-card-meter"><i style="width:'+pct.toFixed(1)+'%"></i></span>'+
  '<span class="nfl-rank-card-changes"><span class="'+(t.elo_change>=0?'nfl-positive':'nfl-negative')+'">FROM 1500 '+delta+'</span>'+
   '<span>LAST '+lg+'</span></span></a>';
}).join("");
return out+'<div class="nfl-rank-desktop">'+gridTable(["RANK","TEAM","W-L-T","2026 ELO","FROM 1500","LAST GAME"],rows)+'</div>'+
 '<div class="nfl-rank-mobile" aria-label="NFL Elo rankings with single-line team records">'+cards+'</div>';
}
function players(){
 const categories=["passing","rushing","receiving","tackles","sacks","interceptions"];
 let cat=params.get("category")||"passing";if(!categories.includes(cat))cat="passing";
 const rows=(feed.leaders||{})[cat]||[],label=leaderLabels[cat];
 let out='<p class="nfl-kicker">THE NFL PLAYER DESK · 2026 REGULAR SEASON</p><h1 class="nfl-title">THE LEAGUE LEADERS</h1>'+
 '<p class="nfl-lede">The NFL’s standout performances, drawn from verified 2026 game box scores. Explore every major yardage and defensive category.</p>'+
 '<div class="nfl-controls nfl-stat-filters" aria-label="Statistic category">';
 categories.forEach(c=>{out+='<a class="nfl-button" aria-pressed="'+(c===cat)+'" href="nfl-players.html?category='+c+'">'+leaderLabels[c].title+'</a>';});
 out+='</div>';
 if(rows.length){
  out+='<div class="nfl-stats-hero"><div class="nfl-stats-hero-title"><span>STATISTICAL LEADERBOARD / '+label.title+'</span><strong>'+label.sub+'</strong></div>'+
    '<div class="nfl-feature-grid">'+rows.slice(0,3).map((p,i)=>featurePlayer(p,i,cat)).join("")+'</div></div>';
  out+='<section class="nfl-section nfl-leaderboard-section"><div class="nfl-leaderboard-header"><div><p class="nfl-label">THE FULL TOP 30</p><h2>'+label.title+' LEADERBOARD</h2></div><span class="nfl-small">TOTAL · '+label.unit+' · TEAM · GAMES</span></div>'+
  '<div class="nfl-leaderboard">'+rows.map((p,i)=>leaderRow(p,i,cat,rows[0].value,false)).join("")+'</div></section>';
 }else out+=note("No source-confirmed player totals for "+escapeHtml(cat)+" yet.");
 return out+statsCaveat();
}
function schedule(){
const weeks=[...new Set(games.map(g=>g.week))].sort((a,b)=>a-b);
let w=Number(params.get("week"))||week();if(!weeks.includes(w))w=weeks[0];
let out='<p class="nfl-kicker">ALL 18 WEEKS · COMPLETE REGULAR SEASON</p><h1 class="nfl-title">NFL SCHEDULE &amp; RESULTS</h1>';
out+='<div class="nfl-controls"><label for="nfl-week">WEEK</label><select id="nfl-week">';
weeks.forEach(x=>{out+='<option value="'+x+'" '+(x===w?"selected":"")+'>WEEK '+x+'</option>';});
out+='</select></div><div class="nfl-slate">'+games.filter(g=>g.week===w).map(gameCard).join("")+'</div>';
return out+note("Away team first, home team second. Kickoff times shown in Eastern Time. USRS projections are independent estimates.");
}
function gameCenter(){
const chosen=params.get("team")||"all",arg=params.get('date');
const day=arg&&/^\d{4}-\d{2}-\d{2}$/.test(arg)?arg:easternDay(new Date());
function dayUrl(d){return 'nfl-game-center.html?date='+encode(d)+(chosen!=='all'?'&team='+encode(chosen):'');}
let out='<p class="nfl-kicker">LIVE SCORES · GAME STATISTICS · PLAY-BY-PLAY</p><h1 class="nfl-title">NFL GAME CENTER</h1>';
out+='<div class="nfl-day-nav"><a href="'+dayUrl(nextDay(day,-1))+'">← PREVIOUS DAY</a><strong>'+escapeHtml(day)+'</strong><a href="'+dayUrl(nextDay(day,1))+'">NEXT DAY →</a></div>';
out+='<div class="nfl-controls"><label for="nfl-team-select">TEAM</label><select id="nfl-team-select"><option value="all">ALL TEAMS</option>';
feed.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(t=>{out+='<option value="'+t.id+'" '+(chosen===t.id?"selected":"")+'>'+escapeHtml(t.name)+'</option>';});
out+='</select><span class="nfl-small">Source-reported scores refresh automatically when available.</span></div>';
const relevant=games.filter(g=>easternDay(g.date)===day&&(chosen==="all"||g.away.id===chosen||g.home.id===chosen)).slice().sort((a,b)=>a.date.localeCompare(b.date));
out+='<div class="nfl-slate">'+(relevant.map(gameCard).join('')||note('No NFL games on this day for the selected club. Use the date arrows to browse games.'))+'</div>';
return out;
}
function teamPage(){
const id=params.get("team"),t=team(id);
if(!teams[id])return note("Unknown NFL franchise. "+link("nfl.html","Choose a team."));
const slate=games.filter(g=>g.away.id===id||g.home.id===id).sort((a,b)=>a.date.localeCompare(b.date));
let out='<div class="nfl-team-head">'+crest(t,"lg")+'<div><p class="nfl-kicker">'+escapeHtml(t.division)+'</p><h1>'+escapeHtml(t.name)+'</h1><span class="detail">'+t.w+'–'+t.l+'–'+t.t+' · '+format(t.elo,1)+' Elo · '+(t.elo_change>0?"+":"")+format(t.elo_change,1)+' this season</span></div></div>';
const metrics=[["Points for",t.pf],["Points against",t.pa],["Total yards",(t.team_stats||{}).totalYards],["Pass yards",(t.team_stats||{}).netPassingYards],["Rush yards",(t.team_stats||{}).rushingYards],["1st downs",(t.team_stats||{}).firstDowns],["Turnovers",(t.team_stats||{}).turnovers],["Point diff.",t.point_diff]];
out+='<div class="nfl-statline nfl-team-statline" style="--stat-accent:'+escapeHtml(t.color)+'">'+metrics.map(v=>'<div class="nfl-stat"><b>'+format(v[1])+'</b><span>'+escapeHtml(v[0])+'</span></div>').join("")+'</div>'+statsCaveat();
out+='<div class="nfl-duo">'+panel("RECENT RESULTS",slate.filter(g=>g.state==="post").slice(-5).reverse().map(gameLine).join(""))+panel("NEXT KICKOFFS",slate.filter(g=>g.state!=="post").slice(0,5).map(gameLine).join(""))+'</div>';
out+=panel("CLUB STATISTICAL LEADERS",'<div class="nfl-grid">'+["passing","rushing","receiving","sacks"].map(cat=>'<div class="nfl-team-leaders"><h3>'+escapeHtml(leaderLabels[cat].title)+'</h3>'+listLeaders(cat,4,id)+'</div>').join("")+'</div>');
const rows=slate.map(g=>{const atHome=g.home.id===id,other=atHome?g.away:g.home,us=atHome?g.home:g.away,opp=team(other.id);
const result=g.state==="post"?(us.score>other.score?"W ":us.score<other.score?"L ":"T ")+us.score+"–"+other.score:(g.state==="in"?"LIVE":"Scheduled");
return '<tr><td>W'+g.week+' · '+escapeHtml(date(g.date))+'</td><td>'+crest(opp,"sm")+' '+(atHome?"vs ":"@ ")+link(urlGame(g.id),opp.name)+'</td><td>'+escapeHtml(result)+'</td><td>'+format((g.elo||{})[(atHome?"home":"away")+"_before"],1)+'</td></tr>';});
out+=panel("FULL 2026 TEAM SCHEDULE",gridTable(["WEEK / DATE","OPPONENT","RESULT","PRE-GAME ELO"],rows));
return out+panel("2026 ROSTER",'<div id="nfl-roster">Checking sourced roster…</div>');
}
async function roster(){
const id=params.get("team"),el=document.getElementById("nfl-roster");if(!el)return;
try{const res=await fetch("data/nfl-2026-rosters.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error("Roster not yet published");
const json=await res.json(),rows=(json.teams||{})[id]||[];
el.innerHTML=rows.length?gridTable(["PLAYER","POSITION","NO.","STATUS"],rows.map(p=>'<tr><td><div class="nfl-player"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt="">'+escapeHtml(p.name)+'</div></td><td>'+escapeHtml(p.position)+'</td><td>'+escapeHtml(p.jersey)+'</td><td>'+escapeHtml(p.status||"")+'</td></tr>')):note("Current roster has not been verified.");}
catch(e){el.innerHTML=note("Roster feed unavailable. Club results and ratings remain available.");}
}
function gamePage(){
const g=games.find(g=>g.id===params.get("id"));if(!g)return note("Game not found. "+link("nfl-game-center.html","Open the Game Center."));
const a=team(g.away.id),h=team(g.home.id),elo=g.elo||{};
let out='<p class="nfl-kicker">WEEK '+g.week+' · '+escapeHtml(g.status)+'</p><h1 class="nfl-title">'+escapeHtml(a.name)+' at '+escapeHtml(h.name)+'</h1>';
out+='<div class="nfl-team-head" style="justify-content:space-between;flex-wrap:wrap">'+side(g.away,true)+'<strong>AT</strong>'+side(g.home,true)+'</div>';
out+='<p class="nfl-small">'+escapeHtml(date(g.date))+' · '+escapeHtml(g.venue||"Venue TBA")+' · '+escapeHtml(g.broadcast||"Broadcast TBA")+'</p>';
const stats=[["Home win chance",elo.home_win_probability==null?"—":format(100*elo.home_win_probability,1)+"%"],["Away win chance",elo.away_win_probability==null?"—":format(100*elo.away_win_probability,1)+"%"],["Predicted score",elo.away_projected_points==null?"—":elo.away_projected_points+"–"+elo.home_projected_points],["Home Elo change",elo.home_delta==null?"Pending":format(elo.home_delta,1)]];
out+='<div class="nfl-statline">'+stats.map(v=>'<div class="nfl-stat"><b>'+v[1]+'</b><span>'+v[0]+'</span></div>').join("")+'</div>';
return out+liveGamePanel(g)+panel(g.state==='in'?"LIVE BOX SCORE &amp; TEAM STATISTICS":"BOX SCORE &amp; TEAM STATISTICS",'<div id="nfl-game-box">Loading sourced box score…</div>')+'<p class="nfl-small">'+link(g.url,"ESPN source game page ↗")+'</p>';
}
async function gameBox(){
 const id=params.get("id"),el=document.getElementById("nfl-game-box");if(!el)return;
 try{const activeBox=((liveFeed||{}).boxes||{})[id];const res=activeBox?null:await fetch("data/nfl-2026-boxscores.json?t="+Date.now(),{cache:"no-store"});if(res&&!res.ok)throw Error();
 const json=res?await res.json():{games:{}},box=((liveFeed||{}).boxes||{})[id]||(json.games||{})[id];if(!box){el.innerHTML=note("Detailed statistics not available for this game yet; unverified values are never filled in.");return;}
 const g=games.find(x=>x.id===id),a=team(g.away.id),h=team(g.home.id),aa=(box.teams||{})[a.id]||{},hh=(box.teams||{})[h.id]||{};
 const pairs=[["Total yards","totalYards"],["Passing yards","netPassingYards"],["Rushing yards","rushingYards"],["First downs","firstDowns"],["Turnovers","turnovers"]];
 let out='<div class="nfl-box-comparison"><div class="nfl-box-side">'+crest(a,"head")+'<strong>'+escapeHtml(a.code)+'</strong></div>'+
 '<div class="nfl-box-comparison-center"><span>TEAM COMPARISON</span><b>'+(g.state==='in'?'LIVE · PROVISIONAL STATISTICS':'FINAL GAME STATISTICS')+'</b></div><div class="nfl-box-side">'+crest(h,"head")+'<strong>'+escapeHtml(h.code)+'</strong></div></div>';
 out+='<div class="nfl-box-bars">';
 pairs.forEach(([title,key])=>{const av=aa[key],hv=hh[key],mx=Math.max(1,Number(av)||0,Number(hv)||0);
 out+='<div class="nfl-box-row"><b>'+format(av)+'</b><div class="nfl-box-stat"><span>'+title+'</span><div class="nfl-box-compare"><i style="--bar-color:'+escapeHtml(a.color)+';width:'+((Number(av)||0)/mx*100).toFixed(1)+'%"></i><i style="--bar-color:'+escapeHtml(h.color)+';width:'+((Number(hv)||0)/mx*100).toFixed(1)+'%"></i></div></div><b>'+format(hv)+'</b></div>';});
 out+='</div>';
 out+='<div class="nfl-grid">'+[a,h].map(t=>panel(t.name+' · Complete Team Box Score',Object.entries((box.teams||{})[t.id]||{}).map(([key,v])=>'<div class="nfl-mini">'+escapeHtml(key.replace(/([A-Z])/g," $1"))+'<b>'+format(v,1)+'</b></div>').join(""))).join("")+'</div>';
 ["passing","rushing","receiving","defensive","interceptions","kicking","punting"].forEach(cat=>{
 const lines=(box.players||[]).filter(p=>(p.category||"").includes(cat));if(!lines.length)return;
 const columns=[...new Set(lines.flatMap(p=>Object.keys(p.stats||{})))].slice(0,7);
 out+=panel(cat.toUpperCase(),gridTable(["PLAYER","TEAM"].concat(columns),lines.map(p=>'<tr><td><div class="nfl-player"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""><b>'+escapeHtml(p.name)+'</b></div></td><td>'+crest(team(p.team_id),"sm")+'</td>'+columns.map(c=>'<td>'+((p.stats||{})[c]==null?"—":format(p.stats[c],1))+'</td>').join("")+'</tr>')));
 });
 el.innerHTML=out;}catch(e){el.innerHTML=note("Box-score data unavailable for this matchup.");}
}

function prng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function playoffs(){
const random=prng(20261101),count=2000,tracker={};
feed.teams.forEach(t=>tracker[t.id]={playoff:0,division:0,conference:0,champion:0});
const remaining=games.filter(g=>g.state!=="post");
function pick(a,b,home=true){const ra=team(a).elo+(home?(Number(feed.model.home_advantage_elo)||55):0),rb=team(b).elo;return random()<1/(1+Math.pow(10,-(ra-rb)/400))?a:b;}
for(let i=0;i<count;i++){
const wins={};feed.teams.forEach(t=>wins[t.id]=t.w+t.t*0.5);
remaining.forEach(g=>wins[pick(g.home.id,g.away.id,!g.neutral_site)]++);
const champs={};
["AFC","NFC"].forEach(conf=>{
const group=feed.teams.filter(t=>t.conference===conf);
const order=(a,b)=>wins[b.id]-wins[a.id]||b.elo-a.elo;
const leaders=["East","North","South","West"].map(d=>group.filter(t=>t.division===conf+" "+d).sort(order)[0]).sort(order);
const wild=group.filter(t=>!leaders.includes(t)).sort(order).slice(0,3);
const seed=leaders.concat(wild).map(t=>t.id);
seed.forEach(id=>tracker[id].playoff++);
leaders.forEach(t=>tracker[t.id].division++);
let first=[pick(seed[1],seed[6]),pick(seed[2],seed[5]),pick(seed[3],seed[4])];
first.sort((a,b)=>seed.indexOf(a)-seed.indexOf(b));
const byeOpponent=first.pop();
const semi1=pick(seed[0],byeOpponent),semi2=pick(first[0],first[1]);
const champ=pick(semi1,semi2);
tracker[champ].conference++;champs[conf]=champ;
});
tracker[pick(champs.AFC,champs.NFC,false)].champion++;
}
let out='<p class="nfl-kicker">THE PLAYOFF DESK · 2,000 SIMULATIONS</p><h1 class="nfl-title">NFL PLAYOFF PICTURE</h1>';
out+=note("Independent USRS simulation of remaining games and a 14-team postseason. Division leaders seed ahead of wild cards. Uses current Elo; does not implement all NFL official tiebreakers, account for injuries or update ratings during simulated future games. Probabilities are <b>model estimates</b>, not official NFL seedings.");
out+='<div class="nfl-sim">';
["AFC","NFC"].forEach(conf=>{
const rows=feed.teams.filter(t=>t.conference===conf).sort((a,b)=>tracker[b.id].playoff-tracker[a.id].playoff).map(t=>{
const x=tracker[t.id];return '<tr><td>'+club(t)+'</td><td>'+format(100*x.division/count,1)+'%</td><td><b>'+format(100*x.playoff/count,1)+'%</b></td><td>'+format(100*x.conference/count,1)+'%</td><td>'+format(100*x.champion/count,1)+'%</td></tr>';});
out+=panel(conf+" PLAYOFF ODDS",gridTable(["TEAM","DIV","PLAYOFF","CONF","TITLE"],rows));
});
return out+'</div>';
}
async function news(){
const target=document.getElementById("nfl-stories");if(!target)return;
try{const res=await fetch("articles.json?ts="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error();
const obj=await res.json(),items=Array.isArray(obj)?obj:(obj.articles||[]);
const relevant=items.filter(p=>/(\bnfl\b|national football league|super bowl|gridiron)/i.test([p.title,p.summary,p.category].join(" "))).slice(0,7);
target.innerHTML=relevant.length?'<div class="nfl-news">'+relevant.map(a=>'<article class="nfl-story"><a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(a.url||"#")+'">'+escapeHtml(a.title)+'</a><p>'+escapeHtml(a.source||"Source")+' · '+escapeHtml(a.published_at||"")+'</p></article>').join("")+'</div>':note("No sourced NFL headlines in the current site feed.");}
catch(e){target.innerHTML=note("Headline feed unavailable; game scores and model data remain independent.");}
}

function renderNFL(){
 const screens={front:home,standings:standings,rankings:rankings,players:players,schedule:schedule,games:gameCenter,team:teamPage,game:gamePage,playoffs:playoffs};
 root.innerHTML=(screens[page]||home)();
 let stamp="Verified NFL season ledger · "+date(feed.updated_at)+" · "+feed.coverage.games+" fixtures · "+feed.coverage.finals+" finals · "+feed.coverage.boxscores+" boxes";
 if(liveFeed)stamp+=" · "+(Date.now()-new Date(liveFeed.updated_at).getTime()<600000?"LIVE SCORES":"LIVE FEED DELAYED")+" "+date(liveFeed.updated_at)+" ("+liveSource+")";
 document.getElementById("nfl-stamp").textContent=stamp;
 if(page==="front")news();
 if(page==="team")roster();
 if(page==="game")gameBox();
 const wk=document.getElementById("nfl-week");if(wk)wk.onchange=()=>location.href="nfl-schedule.html?week="+encode(wk.value);
 const ts=document.getElementById("nfl-team-select");if(ts)ts.onchange=()=>location.href="nfl-game-center.html?date="+encode(params.get('date')||easternDay(new Date()))+"&team="+encode(ts.value);
}
function espnEventOverlay(e){
 const c=(e.competitions||[])[0]||{},s=e.status||{},types=s.type||{},sides={};
 (c.competitors||[]).forEach(x=>{
  if(!['home','away'].includes(x.homeAway))return;
  sides[x.homeAway]={id:String(x.team?.id||''),score:x.score==null?null:Number(x.score),
    linescores:(x.linescores||[]).map((l,i)=>({period:i+1,score:l.value==null?null:Number(l.value)}))};
 });
 if(!sides.home||!sides.away)return null;
 const situation=c.situation||{},last=situation.lastPlay||{};
 return {id:String(e.id),state:types.completed?'post':(types.state||'pre'),
  status:types.description||'',period:s.period||0,clock:s.displayClock||'',
  home:sides.home,away:sides.away,possession:String(situation.possession||''),
  down_distance:situation.downDistanceText||'',last_play:last.text||''};
}
async function fetchEspnLive(){
 const ymd=easternDay(new Date()).replace(/-/g,''),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+ymd+'&limit=50',
    {cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('Live source unavailable');
  const source=await response.json();
  if(!Array.isArray(source.events))throw Error('Invalid NFL scoreboard');
  return {season:2026,updated_at:new Date().toISOString(),games:source.events.map(espnEventOverlay).filter(Boolean),boxes:{}};
 }finally{clearTimeout(timer);}
}
async function refreshLive(){
 let incoming=null,origin='site live feed';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetch('data/nfl-live.json?ts='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(response.ok)incoming=await response.json();
  }finally{clearTimeout(timer);}
 }catch(e){/* Preserve the season ledger if the live service is unavailable. */}
 if(!incoming||!incoming.updated_at||Date.now()-new Date(incoming.updated_at).getTime()>600000){
  try{const instant=await fetchEspnLive();if(instant.games.length){incoming=instant;origin='direct source fallback';}}
  catch(e){/* A CORS-blocked direct source must not break the published paper. */}
 }
 if(!incoming||incoming.season!==2026||!Array.isArray(incoming.games))return;
 const canonical=new Map(feed.games.map(g=>[g.id,g]));
 const verified=incoming.games.filter(g=>{
  const c=canonical.get(String(g.id));
  return c&&String(g.away?.id)===c.away.id&&String(g.home?.id)===c.home.id&&['pre','in','post'].includes(g.state);
 });
 if(!verified.length)return;
 incoming.games=verified;
 const sig=JSON.stringify([incoming.games,incoming.boxes||{}]);
 if(sig===lastLiveSignature)return;
 lastLiveSignature=sig;liveFeed=incoming;liveSource=origin;
 const overlay=new Map(verified.map(g=>[String(g.id),g]));
 games=feed.games.map(base=>{
  const u=overlay.get(base.id);
  if(!u||(base.state==='post'&&u.state!=='post'))return base;
  return {...base,state:u.state,status:u.status||base.status,period:u.period,clock:u.clock,
   possession:u.possession,down_distance:u.down_distance,last_play:u.last_play,
   away:{...base.away,score:u.away.score,linescores:u.away.linescores},
   home:{...base.home,score:u.home.score,linescores:u.home.linescores}};
 });
 if(['front','games','game','schedule','team'].includes(page))renderNFL();
 else document.getElementById('nfl-stamp').textContent+=' · Live source '+date(incoming.updated_at);
}

async function main(){
try{const res=await fetch("data/nfl-2026-edition.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error("The NFL season data has not published yet");
feed=await res.json();if(feed.season!==2026||!Array.isArray(feed.games)||feed.games.length<200||feed.teams.length!==32)throw Error("Incomplete season feed; publication blocked");
feed.teams.forEach(t=>teams[t.id]=t);games=feed.games;
renderNFL();
refreshLive();
setInterval(refreshLive,45000);
}catch(e){
document.getElementById("nfl-stamp").textContent="NFL data verification pending";
root.innerHTML='<p class="nfl-kicker">THE NFL EDITION</p><h1 class="nfl-title">NFL DATA PUBLICATION PENDING</h1><div class="nfl-error"><p>The NFL newspaper is installed, but a complete sourced 2026 ledger has not been published. No placeholder ratings or invented player statistics will be shown.</p><p>'+escapeHtml(e.message)+'</p>'+link("sports.html","Browse the sports desks")+'</div>';
}}
main();
})();