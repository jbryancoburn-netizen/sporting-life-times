const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const target=new URLSearchParams(location.search).get('team')||'';
const dateLabel=s=>{const d=new Date(s);return isNaN(d)?'DATE TBD':new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(d)};
const patterns={
'Chicago Bears':{name:['Chicago Bears'],league:['NFL']},'Chicago Cubs':{name:['Chicago Cubs'],league:['MLB']},'Tampa Bay Rays':{name:['Tampa Bay Rays'],league:['MLB']},'Tampa Bay Lightning':{name:['Tampa Bay Lightning'],league:['NHL']},'Indiana Pacers':{name:['Indiana Pacers'],league:['NBA']},
'Fort Wayne Komets':{name:['Fort Wayne Komets'],league:['ECHL']},'Tottenham Hotspur':{name:['Tottenham Hotspur','Tottenham'],league:['Premier League','Champions League','Europa League']},
'FC Bayern Munich Basketball':{name:['Bayern Munich','FC Bayern'],league:['EuroLeague']},
'Indiana Hoosiers Football':{name:['Indiana Hoosiers','Indiana'],league:['College Football']},
"Indiana Hoosiers Men's Basketball":{name:['Indiana Hoosiers','Indiana'],league:["Men's College Basketball"]},
"Indiana Hoosiers Women's Basketball":{name:['Indiana Hoosiers','Indiana'],league:["Women's College Basketball"]},
'Indiana Hoosiers Baseball':{name:['Indiana Hoosiers','Indiana'],league:['College Baseball']},
"Indiana Hoosiers Men's Soccer":{name:['Indiana Hoosiers','Indiana'],league:["NCAA Men's Soccer"]},
'South Florida Bulls Football':{name:['South Florida Bulls','South Florida','USF Bulls'],league:['College Football']},
"South Florida Bulls Men's Basketball":{name:['South Florida Bulls','South Florida','USF Bulls'],league:["Men's College Basketball"]},
"South Florida Bulls Women's Basketball":{name:['South Florida Bulls','South Florida','USF Bulls'],league:["Women's College Basketball"]},
"Vermont Catamounts Men's Hockey":{name:['Vermont Catamounts','Vermont'],league:["NCAA Men's Hockey"]},
"Vermont Catamounts Men's Basketball":{name:['Vermont Catamounts','Vermont'],league:["Men's College Basketball"]},
'Trine Thunder Football':{name:['Trine Thunder','Trine'],league:['College Football']},
"Trine Thunder Men's Basketball":{name:['Trine Thunder','Trine'],league:["Men's College Basketball"]}
};
async function start(){
const data=await fetch('data.json').then(r=>r.json());const team=(data.teams||[]).find(t=>t.name===target);if(!team){document.querySelector('#team-title').textContent='Team not found';return}
document.title=team.name+' | The Sporting Life & Times';document.querySelector('#team-title').textContent=team.name;document.querySelector('#team-category').textContent=team.category.toUpperCase()+' · THE RABBY 20';document.querySelector('#edition-date').textContent=new Intl.DateTimeFormat('en-US',{dateStyle:'full'}).format(new Date()).toUpperCase();
const rule=patterns[target];let games=[];try{const d=await fetch('scoreboards.json?ts='+Math.floor(Date.now()/240000)).then(r=>r.json());games=(d.leagues||[]).filter(l=>rule.league.includes(l.league)).flatMap(l=>(l.games||[]).filter(g=>(g.teams||[]).some(t=>rule.name.some(n=>t.name.toLowerCase()===n.toLowerCase()||t.name.toLowerCase().includes(n.toLowerCase())))).map(g=>({...g,league:l.league,source_url:l.source_url})));}catch(e){}
const status=document.querySelector('#team-score-status');status.textContent=games.length?games.length+' sourced games in current feed window':'No verified matchups returned by current feeds. This does not mean the team has no games.';
const root=document.querySelector('#team-score-list');const groups=[['FINAL RESULTS',games.filter(g=>g.state==='post').sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))],['LIVE',games.filter(g=>g.state==='in').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))],['UPCOMING',games.filter(g=>g.state!=='post'&&g.state!=='in').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))]];
root.innerHTML=groups.filter(x=>x[1].length).map(([title,rows])=>'<div class="register-heading"><h3>'+title+'</h3><span>'+rows.length+' GAMES</span></div><div class="register-columns">'+rows.map(g=>'<article class="register-game"><div class="register-sport"><span>'+escapeHtml(dateLabel(g.date))+'</span><strong>'+escapeHtml(g.state==='post'?'FINAL':g.state==='in'?g.status:dateLabel(g.date).split(', ').slice(-1)[0])+'</strong></div>'+(g.teams||[]).map(t=>'<div class="register-team"><span class="team-with-logo">'+(t.logo?'<img class="team-logo" src="'+escapeHtml(t.logo)+'" alt="" loading="lazy">':'')+escapeHtml(t.name)+'</span><strong>'+escapeHtml(g.state==='pre'?'':t.score)+'</strong></div>').join('')+(g.venue?'<p class="register-venue">'+escapeHtml(g.venue)+'</p>':'')+(g.broadcast?'<p class="register-broadcast">TV: '+escapeHtml(g.broadcast)+'</p>':'')+'<a class="register-link" href="'+escapeHtml(g.url||g.source_url)+'" target="_blank" rel="noopener">GAME SOURCE ↗</a></article>').join('')+'</div>').join('')||'<p>No verified results or fixtures available from the current feeds.</p>';
try{const d=await fetch('articles.json').then(r=>r.json());const newsTerms={
'Indiana Hoosiers Football':['indiana football','indiana hoosiers football','hoosiers football','iu football'],
"Indiana Hoosiers Men's Basketball":['indiana basketball','indiana hoosiers basketball','hoosiers basketball','iu basketball'],
"Indiana Hoosiers Women's Basketball":['indiana women\'s basketball','hoosiers women\'s basketball','iu women\'s basketball'],
'Indiana Hoosiers Baseball':['indiana baseball','hoosiers baseball','iu baseball'],
"Indiana Hoosiers Men's Soccer":['indiana soccer','hoosiers soccer','iu soccer'],
'FC Bayern Munich Basketball':['bayern basketball','bayern munich basketball'],
'Tottenham Hotspur':['tottenham','spurs'],
'South Florida Bulls Football':['south florida football','usf football','bulls football'],
"South Florida Bulls Men's Basketball":['south florida basketball','usf basketball'],
"South Florida Bulls Women's Basketball":['south florida women\'s basketball','usf women\'s basketball'],
"Vermont Catamounts Men's Hockey":['vermont hockey','catamounts hockey'],
"Vermont Catamounts Men's Basketball":['vermont basketball','catamounts basketball'],
'Trine Thunder Football':['trine football','thunder football'],
"Trine Thunder Men's Basketball":['trine basketball']
};const keywords=newsTerms[target]||[target.toLowerCase()];const matchingText=a=>String(a.title||'').toLowerCase();const news=(d.articles||[]).filter(a=>keywords.some(w=>matchingText(a).includes(w))).slice(0,12);document.querySelector('#team-news-list').innerHTML=news.map(a=>'<article class="news-card"><p class="meta">'+escapeHtml(a.source)+'</p><h3><a href="'+escapeHtml(a.url)+'" target="_blank" rel="noopener">'+escapeHtml(a.title)+'</a></h3><p>'+escapeHtml(a.summary||'')+'</p></article>').join('')||'<p>No verified team-specific headlines available right now. Unrelated sports stories are intentionally excluded.</p>'}catch(e){}
document.querySelector('#team-coverage-note').textContent='This page uses verified scoreboard and publisher feeds where available. Current collection is a limited window, not a complete season schedule. Some NCAA divisions, ECHL and specialist competitions require additional sources; missing data is never fabricated.'}
start().catch(e=>{document.querySelector('#team-title').textContent='Team desk temporarily unavailable'});
