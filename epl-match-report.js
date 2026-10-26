(()=>{'use strict';
const id=new URLSearchParams(location.search).get('game'),target=document.getElementById('report-content'),title=document.getElementById('match-title');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=x=>String(x).replace('Tottenham Hotspur','Tottenham').replace('Newcastle United','Newcastle').replace('Nottingham Forest',"Nott'm Forest");
const colors={
'Arsenal':'#ef0107','Aston Villa':'#670e36','Bournemouth':'#d71920','AFC Bournemouth':'#d71920',
'Brentford':'#e30613','Brighton':'#0057b8','Brighton & Hove Albion':'#0057b8',
'Chelsea':'#034694','Coventry':'#77c8e8','Coventry City':'#77c8e8',
'Crystal Palace':'#1b458f','Everton':'#003399','Fulham':'#242424',
'Hull':'#f18a00','Hull City':'#f18a00','Ipswich':'#0044a9','Ipswich Town':'#0044a9',
'Leeds United':'#ffcd00','Liverpool':'#c8102e','Manchester City':'#6cabdd','Manchester United':'#da291c',
'Newcastle':'#242424','Newcastle United':'#242424',"Nott'm Forest":'#dd0000','Nottingham Forest':'#dd0000',
'Sunderland':'#eb172b','Tottenham':'#132257','Tottenham Hotspur':'#132257'
};
const ids={
'Arsenal':359,'Aston Villa':362,'Bournemouth':349,'AFC Bournemouth':349,
'Brentford':337,'Brighton':331,'Brighton & Hove Albion':331,
'Chelsea':363,'Coventry':388,'Coventry City':388,'Crystal Palace':384,
'Everton':368,'Fulham':370,'Hull':306,'Hull City':306,
'Ipswich':373,'Ipswich Town':373,'Leeds United':357,'Liverpool':364,
'Manchester City':382,'Manchester United':360,'Newcastle':361,'Newcastle United':361,
"Nott'm Forest":393,'Nottingham Forest':393,'Sunderland':366,'Tottenham':367,'Tottenham Hotspur':367
};
const crest=x=>'<span class="match-crest-badge" style="display:grid;place-items:center;background:#fffdf5;border:3px solid #eee7d8;border-radius:50%;width:clamp(80px,12vw,146px);height:clamp(80px,12vw,146px);padding:13px;box-sizing:border-box;box-shadow:0 6px 20px #0006;isolation:isolate" aria-label="'+esc(name(x))+' crest">'+(ids[name(x)]?'<img src="https://a.espncdn.com/i/teamlogos/soccer/500/'+ids[name(x)]+'.png" alt="" loading="eager" style="display:block;width:100%;height:100%;object-fit:contain;filter:none;mix-blend-mode:normal" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span class="match-crest-fallback" style="display:none">'+esc(name(x).slice(0,3).toUpperCase())+'</span>':'<span class="match-crest-fallback">'+esc(name(x).slice(0,3).toUpperCase())+'</span>')+'</span>';
if(!id||!/^\d+$/.test(id)){title.textContent='Invalid match';target.textContent='Match ID unavailable';return;}
Promise.all([fetch('data/epl-match-reports.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Report feed');return r.json()}),fetch('data/epl-ratings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Results feed');return r.json()})]).then(([d,ratings])=>{
const g=d.matches?.[id];
if(!g){
 const match=(ratings.season_results||[]).find(x=>String(x.fixture_id)===id);
 if(!match){title.textContent='Match unavailable';target.textContent='This fixture has not been confirmed in the published results archive.';return;}
 const home=name(match.home),away=name(match.away);
 title.textContent=home+' vs '+away;
 document.getElementById('match-date').textContent=new Date(match.kickoff_utc).toLocaleString('en-US',{dateStyle:'full',timeStyle:'short',timeZone:'America/New_York'});
 target.innerHTML='<div class="match-hero" style="--home:'+esc(colors[home]||'#587c66')+';--away:'+esc(colors[away]||'#68768b')+'"><div class="match-scorebug"><div class="match-club">'+crest(home)+'<span>'+esc(home)+'</span></div><strong class="match-score-numbers"><span class="match-home-score">'+esc(match.home_score)+'</span><span class="match-score-dash" aria-hidden="true">–</span><span class="match-away-score">'+esc(match.away_score)+'</span></strong><div class="match-club">'+crest(away)+'<span>'+esc(away)+'</span></div></div></div><section class="match-columns"><div><h2 class="graphic-title">Verified final</h2><p>Full time · '+esc(home)+' '+esc(match.home_score)+'–'+esc(match.away_score)+' '+esc(away)+'</p><p class="muted">This score and fixture were verified in the season results archive. Detailed event and player statistics have not yet been sourced for this match.</p></div><div><h2 class="graphic-title">Match details</h2><p>Premier League · '+esc(new Date(match.kickoff_utc).toLocaleString('en-US',{dateStyle:'long',timeStyle:'short',timeZone:'America/New_York'}))+' ET</p><p><a href="epl.html">Return to Premier League desk</a></p></div></section><p class="match-source-line">Verified final score archive · '+esc(ratings.completed_matches)+' confirmed league finals as of '+esc(ratings.as_of_date)+'. Event details and player stats are intentionally omitted until sourced.</p>';
 return;
}
title.textContent=name(g.home)+' vs '+name(g.away);document.getElementById('match-date').textContent=new Date(g.kickoff_utc).toLocaleString('en-US',{dateStyle:'full',timeStyle:'short',timeZone:'America/New_York'});
const left=g.teams?.find(t=>name(t.team)===name(g.home))||g.teams?.[0],right=g.teams?.find(t=>name(t.team)===name(g.away))||g.teams?.[1];
const map=t=>Object.fromEntries((t?.statistics||[]).map(v=>[v.name,v]));const a=map(left),b=map(right);
const keys=['possessionPct','totalShots','shotsOnTarget','wonCorners','accuratePasses','saves','foulsCommitted','yellowCards','redCards'];
const stats=keys.filter(k=>a[k]&&b[k]).map(k=>{const va=Number(a[k].displayValue),vb=Number(b[k].displayValue),max=Math.max(va+vb,1),label=a[k].label||k;return '<div class="comparison-row"><span class="value">'+esc(a[k].displayValue)+'</span><div class="comparison-bar" style="--bar:var(--home)"><i style="width:'+(100*va/max)+'%"></i></div><span class="metric">'+esc(label)+'</span><div class="comparison-bar away" style="--bar:var(--away)"><i style="width:'+(100*vb/max)+'%"></i></div><span class="value">'+esc(b[k].displayValue)+'</span></div>'}).join('');
const classify=v=>{const type=String(v.type||'').toLowerCase();if(type.includes('goal')||type.includes('penalty - scored'))return ['goal','GOAL','⚽'];if(type.includes('red card'))return ['red','RED CARD','▮'];if(type.includes('yellow card'))return ['yellow','YELLOW CARD','▮'];if(type.includes('substitution'))return ['sub','SUBSTITUTION','↔'];if(type.includes('half')||type.includes('kickoff')||type.includes('regular time'))return ['period',String(v.type||'MATCH PHASE').toUpperCase(),'◷'];return ['other',String(v.type||'MATCH EVENT').toUpperCase(),'•'];};
const priority=v=>classify(v)[0]!=='other';
const primary=(g.events||[]).filter(v=>(v.text||v.type)&&priority(v));
const other=(g.events||[]).filter(v=>(v.text||v.type)&&!priority(v));
const renderEvent=v=>{const [kind,label,symbol]=classify(v);return '<div class="event-grid event-'+kind+'"><div class="event-minute">'+esc(v.clock||'—')+'<span class="event-symbol" aria-hidden="true">'+symbol+'</span></div><div><div class="event-category">'+esc(label)+(v.team?' · '+esc(name(v.team)):'')+'</div><div class="event-detail">'+esc(v.text||v.type)+'</div></div></div>'};
const events=primary.map(renderEvent).join('')+(other.length?'<details class="event-extra"><summary>Show '+other.length+' additional match events</summary>'+other.map(renderEvent).join('')+'</details>':'');
const playerGroups=(g.players||[]).map(p=>'<section><h2>'+esc(p.name||'Players')+'</h2>'+(p.athletes||[]).flatMap(t=>(t.athletes||[]).map(x=>'<div class="playerline">'+esc(x.athlete?.displayName||'Player')+' · '+(x.stats||[]).map(esc).join(' / ')+'</div>')).join('')+'</section>').join('');
const home=name(g.home),away=name(g.away);
target.innerHTML='<div class="match-hero" style="--home:'+esc(colors[home]||'#587c66')+';--away:'+esc(colors[away]||'#68768b')+'"><div class="match-scorebug"><div class="match-club">'+crest(home)+'<span>'+esc(home)+'</span></div><strong class="match-score-numbers"><span class="match-home-score">'+esc(g.home_score)+'</span><span class="match-score-dash" aria-hidden="true">–</span><span class="match-away-score">'+esc(g.away_score)+'</span></strong><div class="match-club">'+crest(away)+'<span>'+esc(away)+'</span></div></div></div><div class="match-columns" style="--home:'+esc(colors[home]||'#587c66')+';--away:'+esc(colors[away]||'#68768b')+'"><div><h2 class="graphic-title">Inside the numbers</h2><div class="stat-headings"><span>'+esc(home.toUpperCase())+'</span><span>'+esc(away.toUpperCase())+'</span></div>'+(stats||'<p class="muted">Source did not provide comparable team statistics.</p>')+playerGroups+'</div><div><h2 class="graphic-title">Match timeline</h2>'+(events||'<p class="muted">Event details unavailable.</p>')+'</div></div><p class="match-source-line">All match statistics and events are sourced, not estimated. <a href="'+esc(g.source_url)+'" target="_blank" rel="noopener noreferrer">Original match report</a> · Updated '+esc(new Date(d.updated_at).toLocaleString('en-US',{timeZone:'America/New_York'}))+'</p>';
}).catch(()=>{title.textContent='Report unavailable';target.textContent='Match data could not be verified.'});
})();