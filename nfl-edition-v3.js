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
/* Source-accurate pregame score estimates: no future-stat lookahead. */
function scoreForecast(g) {
 const e=g.elo||{},away=team(g.away.id),home=team(g.home.id);
 let ap=e.away_projected_points==null?NaN:Number(e.away_projected_points);
 let hp=e.home_projected_points==null?NaN:Number(e.home_projected_points);
 const prob=e.home_win_probability==null?NaN:Number(e.home_win_probability);
 if(g.state==='pre'&&!(feed.model||{}).score_projection_version){
  const n=x=>Number(x),nums=[away.pf,away.pa,away.played,home.pf,home.pa,home.played];
  const ra=Number(e.away_before),rh=Number(e.home_before);
  if(nums.every(x=>x!=null&&Number.isFinite(n(x)))&&Number.isFinite(ra)&&Number.isFinite(rh)){
   const attack=t=>(88+n(t.pf))/(4+n(t.played));
   const defense=t=>(88+n(t.pa))/(4+n(t.played));
   const aBase=(attack(away)+defense(home))/2-0.9;
   const hBase=(attack(home)+defense(away))/2+0.9;
   const total=Math.max(30,Math.min(70,aBase+hBase));
   const homeAdv=g.neutral_site?0:Number((feed.model||{}).home_advantage_elo||30);
   const margin=.65*(hBase-aBase)+.35*(rh+homeAdv-ra)/20;
   ap=Math.round(Math.max(10,Math.min(45,(total-margin)/2)));
   hp=Math.round(Math.max(10,Math.min(45,(total+margin)/2)));
  }
 }
 if(!Number.isFinite(ap)||!Number.isFinite(hp))return null;
 if(ap===hp){if(Number.isFinite(prob)&&prob<.5)ap++;else hp++;}
 return {away:ap,home:hp};
}

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
function liveClock(g){return g.state==='in'?(Number(g.period)>4?'OT':'Q'+(g.period||'?'))+' · '+(g.clock||'Live'):g.state==='post'?nflFinalStatus(g):escapeHtml(g.status||'');}
function liveMark(g){return g.state==='in'?'<span class="nfl-live-pill"><i aria-hidden="true"></i> LIVE · '+escapeHtml(liveClock(g))+'</span>':g.state==='post'?nflFinalStatus(g):escapeHtml(g.status||'');}
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


function nflOvertimeGame(g){
 return Number(g.period)>4 ||
  (g.away&&Array.isArray(g.away.linescores)&&g.away.linescores.length>4) ||
  (g.home&&Array.isArray(g.home.linescores)&&g.home.linescores.length>4) ||
  /\b(?:OT|OVERTIME)\b/i.test(String(g.status||''));
}
function nflFinalStatus(g){return nflOvertimeGame(g)?'FINAL/OT':'FINAL';}
function featurePeriod(g){
   const a=g.away.linescores||[],h=g.home.linescores||[],total=Math.min(5,Math.max(4,a.length,h.length));
   if(g.state==='pre'||total===0)return '';
   let out='<div class="nfl-p26-period-rail" aria-label="Quarter by quarter scoring"><span class="nfl-p26-period-label">SCORING</span>';
   for(let i=0;i<total;i++){
     const name=i>=4?'OT'+(i===4?'':i-3):'Q'+(i+1);
     const av=a[i]&&a[i].score!=null?format(a[i].score):'—';
     const hv=h[i]&&h[i].score!=null?format(h[i].score):'—';
     out+='<span class="nfl-p26-period'+(g.state==='in'&&Number(g.period)===i+1?' active':'')+'"><small>'+name+'</small><strong>'+av+'<i>–</i>'+hv+'</strong></span>';
   }
   return out+'</div>';
 }

function featuredMatch(g){
   if(!g)return '<div class="nfl-p26-feature"><div class="nfl-p26-feature-top"><b>GAME OF THE MOMENT</b></div><p>Verified game details are temporarily unavailable.</p></div>';
   const a=team(g.away.id),h=team(g.home.id),pre=g.state==='pre',elo=g.elo||{},homePct=elo.home_win_probability;
   const short=t=>t.name.split(' ').slice(-1)[0];
   const rec=t=>t&&t.w!=null?t.w+'–'+t.l+(t.t?'–'+t.t:''):'';
   // When orange is the brighter club color (e.g., Denver), put the darker
   // official alternate behind the score and retain orange as the accent.
   // Badges intentionally keep their original two club-color rings.
   const paint=t=>{
      const primary=String(t.color||'#23344a'),alternate=String(t.secondary_color||'#d2a14c');
      const rgb=s=>/^#[0-9a-f]{6}$/i.test(s)?[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)):[0,0,0];
      const p=rgb(primary),isOrange=p[0]>180&&p[1]>45&&p[1]<155&&p[2]<90&&p[0]>p[1]*1.5;
      const dark=rgb(alternate).reduce((sum,x)=>sum+x,0)<175;
      return isOrange&&dark?{base:alternate,accent:primary}:{base:primary,accent:alternate};
   };
   const pa=paint(a),ph=paint(h);

   const stateLabel=g.state==='in'?(g.period>4?'OVERTIME':'QUARTER '+(g.period||'?')):g.state==='post'?nflFinalStatus(g):'UP NEXT';
   const detail=g.state==='in'?((g.period>4?'OT':'Q'+(g.period||'?'))+' · '+(g.clock||'IN PROGRESS')):g.state==='post'?nflFinalStatus(g):date(g.date);
   const clockLabel=g.state==='in'?'LIVE · '+detail:g.state==='post'?nflFinalStatus(g):'KICKOFF · '+date(g.date);
   let out='<section class="nfl-p26-feature" aria-label="Featured NFL matchup: '+escapeHtml(a.name)+' at '+escapeHtml(h.name)+'">'+
     '<div class="nfl-p26-feature-top"><span class="nfl-p26-hero-identity">FEATURED MATCHUP <small>· WEEK '+escapeHtml(g.week)+'</small></span>'+
     '<span class="nfl-p26-hero-state '+(g.state==='in'?'is-live':pre?'is-pre':'is-final')+'">'+
     (g.state==='in'?'<i class="nfl-p26-red-dot"></i>':'')+escapeHtml(detail)+'</span></div>'+
     '<div class="nfl-p26-score-stage nfl-p26-box-score" style="--nfl-away-color:'+escapeHtml(pa.base)+';--nfl-away-accent:'+escapeHtml(pa.accent)+';--nfl-home-color:'+escapeHtml(ph.base)+';--nfl-home-accent:'+escapeHtml(ph.accent)+'">'+
       '<div class="nfl-p26-box-team nfl-p26-box-away" style="--nfl-box-color:'+escapeHtml(pa.base)+';--nfl-box-alt:'+escapeHtml(pa.accent)+'">'+
         '<div class="nfl-p26-box-row">'+crest(a,'lg')+
           '<strong class="nfl-p26-box-points" aria-label="'+escapeHtml(a.name)+' score">'+(pre?'—':format(g.away.score))+'</strong></div>'+
         '<div class="nfl-p26-box-identity"><b>'+escapeHtml(short(a))+'</b>'+
           '<small>'+escapeHtml(a.code)+' · '+escapeHtml(rec(a))+
           (g.state==='in'&&g.possession===a.id?' · BALL':'')+'</small></div></div>'+
       '<span class="nfl-p26-box-seam" aria-hidden="true"></span>'+
       '<div class="nfl-p26-box-team nfl-p26-box-home" style="--nfl-box-color:'+escapeHtml(ph.base)+';--nfl-box-alt:'+escapeHtml(ph.accent)+'">'+
         '<div class="nfl-p26-box-row">'+
           '<strong class="nfl-p26-box-points" aria-label="'+escapeHtml(h.name)+' score">'+(pre?'—':format(g.home.score))+'</strong>'+crest(h,'lg')+'</div>'+
         '<div class="nfl-p26-box-identity"><b>'+escapeHtml(short(h))+'</b>'+
           '<small>'+escapeHtml(h.code)+' · '+escapeHtml(rec(h))+
           (g.state==='in'&&g.possession===h.id?' · BALL':'')+'</small></div></div></div>'+
     '<div class="nfl-p26-hero-context"><span class="nfl-p26-eyebrow">'+escapeHtml(pre?'KICKOFF':g.state==='post'?nflFinalStatus(g):'FROM THE FIELD')+'</span>'+
       '<span>'+escapeHtml(g.venue||g.city||'NFL regular season')+(g.broadcast?' · '+escapeHtml(g.broadcast):'')+'</span></div>'+
     featurePeriod(g)+
     (g.state==='in'||g.state==='post'?'<div class="nfl-p26-feature-stats" id="nfl-feature-stats" data-game="'+escapeHtml(g.id)+'" hidden></div>':'');
   if(pre&&homePct!=null){
      const pct=Math.max(0,Math.min(100,Number(homePct)*100));
      out+='<div class="nfl-p26-hero-projection"><span class="nfl-p26-eyebrow">USRS PREGAME ODDS</span><b>'+escapeHtml(a.code)+' '+format(100-pct)+'%</b>'+
       '<span class="nfl-p26-hero-meter"><i style="width:'+(100-pct).toFixed(1)+'%"></i></span><b>'+escapeHtml(h.code)+' '+format(pct)+'%</b></div>';
   }
   if(g.state==='in'&&(g.down_distance||g.last_play)){
     out+='<div class="nfl-p26-action"><div class="nfl-p26-action-title"><span class="nfl-p26-live-indicator">● LIVE DRIVE</span>'+
       (g.possession?'<strong>'+escapeHtml(team(g.possession).code)+' BALL</strong>':'')+
       (g.down_distance?'<b>'+escapeHtml(g.down_distance)+'</b>':'')+'</div>'+
       (g.last_play?'<p><em>LAST PLAY</em> '+escapeHtml(g.last_play)+'</p>':'')+'</div>';
   }
   if(g.state==='in'&&homePct!=null){
      out+='<div class="nfl-p26-elo-note">USRS pregame · '+escapeHtml(a.code)+' '+format((1-homePct)*100)+'% / '+escapeHtml(h.code)+' '+format(homePct*100)+'% <span>Not an in-game win probability</span></div>';
   }
   out+='<div class="nfl-p26-hero-footer"><span>'+escapeHtml(clockLabel)+'</span>'+
     '<a href="'+(page==='game'?'#nfl-game-box':urlGame(g.id))+'">'+(page==='game'?'BOX SCORE &amp; STATS':g.state==='in'?'FOLLOW THE GAME':'OPEN GAMEFILE')+' <span aria-hidden="true">'+(page==='game'?'↓':'↗')+'</span></a></div></section>';
   return out;
 }

function home(){
 const now=new Date(),day=easternDay(now);
 const dayText=now.toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',year:'numeric'});
 const slate=games.filter(g=>easternDay(g.date)===day).sort((a,b)=>a.date.localeCompare(b.date));
 const isGameDay=slate.length>0;
 const nextGames=games.filter(g=>g.state!=='post'&&new Date(g.date).getTime()>now.getTime()-7200000).sort((a,b)=>a.date.localeCompare(b.date));
 const shown=(slate.length?slate:nextGames.slice(0,8)).slice().sort((a,b)=>{
   const priority=x=>x.state==='in'?0:x.state==='pre'?1:2;
   return priority(a)-priority(b)||String(a.date).localeCompare(String(b.date));
 });
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
 const status=g=>g.state==='in'?((g.period>4?'OT':'Q'+(g.period||'?'))+' '+(g.clock||'')):g.state==='post'?nflFinalStatus(g):date(g.date);
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
 function featureTicker(g){
  const tAway=team(g.away.id),tHome=team(g.home.id),pre=g.state==='pre';
  const tstate=g.state==='in'?(g.period>4?'OT':'Q'+(g.period||'?'))+' '+(g.clock||''):
    g.state==='post'?nflFinalStatus(g):date(g.date);
  const label=pre?'–':format(g.away.score)+'–'+format(g.home.score);
  return '<a class="nfl-p26-ticker-game'+(g.state==='in'?' is-live':'')+'" href="'+urlGame(g.id)+'" aria-label="'+escapeHtml(tAway.name+' at '+tHome.name+', '+tstate)+'">'+
    '<span class="nfl-p26-ticker-logos">'+crest(tAway,'sm')+crest(tHome,'sm')+'</span>'+
    '<span class="nfl-p26-ticker-text"><b>'+escapeHtml(tAway.code)+' @ '+escapeHtml(tHome.code)+'</b><small>'+escapeHtml(tstate)+'</small></span>'+
    '<strong>'+label+'</strong></a>';
 }
 function focusRow(g){
   const a=team(g.away.id),h=team(g.home.id),scores=g.state!=='pre'&&g.away.score!=null&&g.home.score!=null;
   const status=g.state==='in'?(g.period>4?'OT':'Q'+(g.period||'?'))+' '+(g.clock||''):g.state==='post'?nflFinalStatus(g):date(g.date);
   return '<a class="nfl-p26-focus-row" href="'+urlGame(g.id)+'"><div class="nfl-p26-focus-match">'+
     '<div class="nfl-p26-focus-clubs">'+crest(a,'sm')+crest(h,'sm')+'</div>'+
     '<span class="nfl-p26-focus-abbr">'+escapeHtml(a.code)+' <i>@</i> '+escapeHtml(h.code)+'</span>'+
     '<b class="nfl-p26-focus-score">'+(scores?format(g.away.score)+'<i>–</i>'+format(g.home.score):'VS')+'</b></div>'+
     '<div class="nfl-p26-focus-meta"><span class="'+(g.state==='in'?'is-live':'')+'">'+(g.state==='in'?'● ':'')+escapeHtml(status)+'</span>'+
     '<span>'+escapeHtml(g.broadcast||'OPEN GAME ↗')+'</span></div></a>';
 }
 function sectionHead(eye,title,href,cta,desc){
  return '<div class="nfl-p26-section-head"><div><span class="nfl-p26-eyebrow nfl-p26-red">'+escapeHtml(eye)+'</span><h2>'+escapeHtml(title)+'</h2>'+
   (desc?'<p>'+escapeHtml(desc)+'</p>':'')+'</div>'+(href?'<a href="'+href+'">'+escapeHtml(cta||'MORE')+' ↗</a>':'')+'</div>';
 }
 let out='<div class="nfl-p26"><div class="nfl-p26-opening"><div>'+
  '<p class="nfl-p26-eyebrow">THE SPORTING LIFE &amp; TIMES · NATIONAL FOOTBALL LEAGUE · VOL. 2026</p>'+
  '<h1 class="nfl-p26-main-title">THE GRIDIRON <em>report.</em></h1>'+
  '<p class="nfl-p26-main-deck">The league, as it happens. Real scores, complete gamefiles, the statistical race and independently calibrated USRS Elo.</p></div>'+
  '<div class="nfl-p26-issue"><b>NFL / 2026</b><span>'+escapeHtml(dayText)+'</span><span>THE INDEPENDENT FOOTBALL EDITION</span></div></div>';
 out+='<div class="nfl-p26-topline"><div class="nfl-p26-live-ident">'+(live.length?'<i class="nfl-p26-red-dot" aria-hidden="true"></i>':'')+
   '<span>'+(live.length?live.length+' GAMES LIVE':'THE GAME-DAY REPORT')+'</span></div>'+
   '<span class="nfl-p26-sub">LIVE UPDATES · EASTERN TIME · <a href="nfl-game-center.html">OPEN FULL GAME CENTER ↗</a></span></div>';
 out+='<div class="nfl-p26-ticker" role="region" aria-label="NFL live scores" tabindex="0"><div class="nfl-p26-ticker-track">'+shown.map(featureTicker).join('')+'</div></div>';
 out+='<div class="nfl-p26-hero">'+featuredMatch(featured)+
   '<aside class="nfl-p26-focus-rail"><span class="nfl-p26-eyebrow nfl-p26-red">AROUND THE LEAGUE</span>'+
   '<h3>'+(live.length?'LIVE ELSEWHERE':'MORE MATCHUPS')+'</h3>'+
   '<p class="nfl-p26-focus-deck">Scores and kickoff times.</p>'+
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
 const g=games.find(g=>g.id===params.get("id"));
 if(!g)return note("Game not found. "+link("nfl-game-center.html","Open the Game Center."));
 const a=team(g.away.id),h=team(g.home.id),elo=g.elo||{},model=feed.model||{};
 const status=g.state==='in'?'LIVE · '+liveClock(g):g.state==='post'?nflFinalStatus(g):'PREGAME';
 let out='<div class="nfl-p26 nfl-p26-game" style="--nfl-match-away:'+escapeHtml(a.color||"#ad2330")+';--nfl-match-home:'+escapeHtml(h.color||"#16416a")+'">'+
  '<div class="nfl-game-return"><a href="nfl-game-center.html">← ALL NFL GAMES</a>'+
  '<span>WEEK '+escapeHtml(g.week)+' · '+escapeHtml(status)+'</span></div>'+
  '<h1 class="nfl-title nfl-game-title">'+escapeHtml(a.name)+' at '+escapeHtml(h.name)+'</h1>'+featuredMatch(g);
 const pHome=Number(elo.home_win_probability);
 const validOdds=elo.home_win_probability!=null&&Number.isFinite(pHome);
 const homePct=validOdds?Math.max(0,Math.min(100,pHome*100)):null;
 const awayPct=homePct==null?null:100-homePct;
 const scoresReady=g.state==='post'&&g.away.score!=null&&g.home.score!=null;
 const homePoints=Number(g.home.score),awayPoints=Number(g.away.score);
 // Exact calibrated multiplier and K from scripts/build_nfl_edition.py.
 const k=Number(model.k_base),margin=Math.abs(homePoints-awayPoints);
 const multiplier=Math.min(2,1+Math.log2(1+margin)/4);
 const liveEstimate=scoresReady&&validOdds&&Number.isFinite(k)?
   k*multiplier*((homePoints>awayPoints?1:homePoints<awayPoints?0:0.5)-pHome):null;
 const verified=elo.home_delta!=null&&Number.isFinite(Number(elo.home_delta));
 const homeChange=verified?Number(elo.home_delta):liveEstimate;
 const awayChange=homeChange==null?null:-homeChange;
 const signed=x=>x==null?'—':(x>0?'+':'')+format(x,1);
 const beforeAway=elo.away_before==null?'—':format(elo.away_before,1);
 const beforeHome=elo.home_before==null?'—':format(elo.home_before,1);
 const scorePick=scoreForecast(g);
 const projected=scorePick?format(scorePick.away)+' – '+format(scorePick.home):'—';
 out+='<section class="nfl-game-model nfl-usrs-v7" style="--usrs-away:'+escapeHtml(a.color||'#ad2330')+
  ';--usrs-home:'+escapeHtml(h.color||'#163b60')+'">'+
  '<div class="nfl-usrs-title"><div><span>USRS · INDEPENDENT GAME INTELLIGENCE</span><h2>THE MATCHUP EDGE</h2></div>'+
  '<small>CALIBRATED ELO · 2026 SEASON RESET</small></div>'+
  '<div class="nfl-usrs-odds"><div class="nfl-usrs-team nfl-usrs-team-away"><b>'+escapeHtml(a.code)+'</b><strong>'+
  (awayPct==null?'—':format(awayPct,1)+'%')+'</strong><small>AWAY</small></div>'+
  '<div class="nfl-usrs-odds-track" aria-label="Pregame win probabilities"><i style="width:'+(awayPct==null?50:awayPct.toFixed(2))+'%"></i></div>'+
  '<div class="nfl-usrs-team nfl-usrs-team-home"><b>'+escapeHtml(h.code)+'</b><strong>'+
  (homePct==null?'—':format(homePct,1)+'%')+'</strong><small>HOME</small></div></div>'+
  '<div class="nfl-usrs-data"><div class="nfl-usrs-projection"><span>USRS SCORE FORECAST</span><b>'+projected+
  '</b><small>'+escapeHtml(a.code)+' AWAY · '+escapeHtml(h.code)+' HOME</small></div>'+
  '<div class="nfl-usrs-base"><span>BEFORE KICKOFF · ELO</span><div><b>'+escapeHtml(a.code)+' '+beforeAway+
  '</b><b>'+escapeHtml(h.code)+' '+beforeHome+'</b></div><small>All clubs began the 2026 season at 1,500</small></div></div>'+
  '<div class="nfl-usrs-impact"><div class="nfl-usrs-impact-heading"><span>'+
  (g.state==='post'?'ELO MOVEMENT · FINAL':'ELO MOVEMENT · AFTER THE FINAL')+'</span>'+
  '<small>'+(verified?'VERIFIED SEASON LEDGER':liveEstimate!=null?'PROVISIONAL · LIVE RESULT':'AWAITING FINAL SCORE')+
  '</small></div><div class="nfl-usrs-impact-teams">'+
  '<div class="'+(awayChange!=null?(awayChange>=0?'is-up':'is-down'):'')+'"><span>'+escapeHtml(a.code)+'</span><b>'+signed(awayChange)+'</b></div>'+
  '<div class="'+(homeChange!=null?(homeChange>=0?'is-up':'is-down'):'')+'"><span>'+escapeHtml(h.code)+'</span><b>'+signed(homeChange)+'</b></div></div>'+
  '<p>'+(verified?'Confirmed game result is included in the published independent Elo ledger.':
  liveEstimate!=null?'Live-source final; Elo movement calculated using the calibrated model. It will be verified by the next season-ledger refresh.':
  'Elo ratings move only after a confirmed final. Forecast percentages are pregame estimates, not live win probabilities.')+
  '</p></div></section>';
 out+='<section id="nfl-game-live-slot" class="nfl-game-live-slot" aria-label="Live team statistics and play-by-play"></section>';
 out+='<details class="nfl-game-deep-dive" id="nfl-game-deep-dive"><summary><span>THE VERIFIED BOX SCORE</span><strong>PLAYER STATS &amp; TEAM BREAKDOWN ↓</strong></summary>'+
  '<div id="nfl-game-box">Loading verified player box score…</div></details>';
 out+='<p class="nfl-small nfl-game-source">'+link(g.url,"SOURCE GAME RECORD ↗")+
   ' · Scores and live statistics are sourced; USRS forecasts are independent.</p></div>';
 return out;
}
async function gameBox(){
 const id=params.get("id"),el=document.getElementById("nfl-game-box");if(!el)return;
 try{const activeBox=((liveFeed||{}).boxes||{})[id];const res=activeBox?null:await fetch("data/nfl-2026-boxscores.json?t="+Date.now(),{cache:"no-store"});if(res&&!res.ok)throw Error();
 const json=res?await res.json():{games:{}},box=((liveFeed||{}).boxes||{})[id]||(json.games||{})[id];if(!box){const deep=document.getElementById("nfl-game-deep-dive");if(deep)deep.hidden=true;el.innerHTML="";return;}
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

// The summary endpoint supplies sourced in-game statistics while the season Elo ledger remains untouched.
let nflFeatureBoxRequestAt={},nflFeatureBoxCache={},nflFeatureBoxInflight={};
function featureStatView(gameId,box){
 const g=games.find(x=>x.id===gameId),target=document.getElementById('nfl-feature-stats');
 if(!g||!target||target.getAttribute('data-game')!==gameId||!box)return;
 const away=(box.teams||{})[g.away.id]||{},home=(box.teams||{})[g.home.id]||{};
 const types=[['YARDS','totalYards'],['1ST DOWNS','firstDowns'],['TURNOVERS','turnovers']];
 const lines=types.filter(([_,key])=>away[key]!=null&&home[key]!=null);
 if(!lines.length)return;
 target.hidden=false;
 target.innerHTML='<div class="nfl-p26-live-stats-head"><strong>LIVE TEAM COMPARISON</strong><span>'+escapeHtml(team(g.away.id).code)+' / '+escapeHtml(team(g.home.id).code)+'</span></div>'+
 '<div class="nfl-p26-live-stats-row">'+lines.map(([label,key])=>
 '<div class="nfl-p26-live-stat"><b>'+format(away[key])+' <i>–</i> '+format(home[key])+'</b><span>'+label+'</span></div>').join('')+'</div>';
}
async function featuredLiveStats(){
 const target=document.getElementById('nfl-feature-stats');
 if(!target||!liveFeed)return;
 const id=target.getAttribute('data-game');
 if(!id||!games.some(g=>g.id===id&&['in','post'].includes(g.state)))return;
 const age=Date.now()-Date.parse(liveFeed.updated_at);
 if(age>=0&&age<150000&&(liveFeed.boxes||{})[id]){
   featureStatView(id,liveFeed.boxes[id]);return;
 }
 const previous=nflFeatureBoxCache[id];
 if(previous&&Date.now()-previous.at<75000){featureStatView(id,previous.box);return;}
 if(nflFeatureBoxInflight[id]||Date.now()-(nflFeatureBoxRequestAt[id]||0)<45000)return;
 nflFeatureBoxRequestAt[id]=Date.now();nflFeatureBoxInflight[id]=true;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+encodeURIComponent(id),
    {cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('Summary source offline');
  const json=await response.json();
  const out={teams:{}};
  for(const t of (json.boxscore?.teams||[])){
    const tid=String(t.team?.id||'');
    if(!tid)continue;
    const stats={};
    for(const s of (t.statistics||[])){
     const key=String(s.name||''),val=String(s.displayValue??'').replace(/,/g,'');
     if(key&&/^-?\d+(?:\.\d+)?$/.test(val))stats[key]=Number(val);
    }
    out.teams[tid]=stats;
  }
  const g=games.find(x=>x.id===id);
  if(!g||!out.teams[g.away.id]||!out.teams[g.home.id])return;
  nflFeatureBoxCache[id]={box:out,at:Date.now()};
  featureStatView(id,out);
 }catch(_){/* Never invent missing game statistics. */}
 finally{clearTimeout(timer);delete nflFeatureBoxInflight[id];}
}
function renderNFL(){
 const screens={front:home,standings:standings,rankings:rankings,players:players,schedule:schedule,games:gameCenter,team:teamPage,game:gamePage,playoffs:playoffs};
 root.innerHTML=(screens[page]||home)();
 let stamp=page==="front"?"SEASON DATA · "+date(feed.updated_at):
   "Verified NFL season ledger · "+date(feed.updated_at)+" · "+feed.coverage.games+" fixtures · "+feed.coverage.finals+" finals · "+feed.coverage.boxscores+" boxes";
 if(liveFeed)stamp+=" · "+(Date.now()-new Date(liveFeed.updated_at).getTime()<600000?"LIVE SCORES":"LIVE FEED DELAYED")+" "+date(liveFeed.updated_at)+" ("+liveSource+")";
 document.getElementById("nfl-stamp").textContent=stamp;
 if(page==="front"){news();featuredLiveStats();}
 if(page==="game")featuredLiveStats();
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
 // Do not present an hours-old snapshot as current live action if the direct source fails.
 if(Date.now()-Date.parse(incoming.updated_at)>600000)return;
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