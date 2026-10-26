/* NBA franchise visual profile: source-derived form, Elo trace, matchup series, player spotlights. */
(function(w){'use strict';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(x,n=1)=>Number.isFinite(Number(x))?Number(x).toFixed(n):'—';
const logo=t=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[t]||t.toLowerCase())+'.png';
const photo=p=>/^\d{2,10}$/.test(String(p.id||''))?'https://a.espncdn.com/i/headshots/nba/players/full/'+p.id+'.png':'';
const date=d=>new Date(d).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
const href=t=>'nba-team-desk.html?team='+encodeURIComponent(t);
const games=c=>Array.isArray(c.data.current?.events)?c.data.current.events.filter(g=>Number.isFinite(+g.home_score)&&Number.isFinite(+g.away_score)&&g.home_score!==g.away_score).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)):[];
const foe=(g,t)=>g.home===t?g.away:g.home,won=(g,t)=>(g.home_score>g.away_score?g.home:g.away)===t;
function spark(c,t,selected){
 let points=[c.rates[t]],n=Number(c.rates[t]);for(let i=selected.length-1;i>=0;i--){let d=Number(selected[i].home_elo_change);if(!Number.isFinite(d))continue;n-=selected[i].home===t?d:-d;points.push(n)}points.reverse();
 if(points.length<2)return '<p class="depth-muted">Elo movement becomes available after a verified final.</p>';
 const hi=Math.max(...points)+4,lo=Math.min(...points)-4,poly=points.map((v,i)=>(100*i/(points.length-1)).toFixed(2)+','+(100-100*(v-lo)/(hi-lo)).toFixed(2)).join(' ');
 const delta=points.at(-1)-points[0];
 return '<div class="depth-chart-top"><div><small>CURRENT USRS ELO</small><strong>'+num(n===c.rates[t]?n:c.rates[t])+'</strong></div><span>'+((delta>=0?'+':'')+num(delta))+' over '+selected.length+' verified finals</span></div><svg class="depth-spark" viewBox="0 0 100 106" preserveAspectRatio="none" role="img" aria-label="Elo trend from '+num(points[0],0)+' to '+num(points.at(-1),0)+'"><polygon points="0,106 '+poly+' 100,106" fill="#6be3e3" fill-opacity=".14"/><polyline points="'+poly+'" stroke="#6be3e3" fill="none" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="depth-axis"><span>'+num(points[0],0)+' · first rating</span><span>'+num(points.at(-1),0)+' · latest</span></div>';
}
function leader(c,t,key,label){
 const p=(c.data.leaders?.season_totals||[]).filter(x=>x.team===t&&x.gp>0&&Number.isFinite(x[key])).sort((a,b)=>b[key]-a[key])[0];
 if(!p)return '<div class="depth-person"><small>'+e(label)+'</small><span>Captured totals unavailable</span></div>';
 const src=photo(p);return '<div class="depth-person"><small>'+e(label)+'</small><div class="depth-person-inner">'+(src?'<img src="'+src+'" alt="" loading="lazy" onerror="this.hidden=true">':'')+'<div><b>'+e(p.player)+'</b><span>'+p.gp+' captured GP</span></div></div><strong>'+num(p[key])+'</strong></div>';
}
function render(c){
 const raw=new URLSearchParams(location.search).get('team')?.toUpperCase(),t=c.meta[raw]?raw:'IND';
 const selected=games(c).filter(g=>g.home===t||g.away===t),last=selected.slice(-8).reverse(),r=c.records[t]||{w:0,l:0,pf:0,pa:0},gp=r.w+r.l;
 const brand=c.meta[t][3],name=c.meta[t][0];
 const top='<section class="depth-club-hero" style="--depth-club:'+brand+'"><div class="depth-club-title"><div class="depth-crest"><img src="'+logo(t)+'" alt=""></div><div><small>THE '+t+' FRANCHISE · 2026–27</small><h2>'+e(name)+'</h2><p>'+e(c.meta[t][2])+' Division · '+e(c.meta[t][1])+'ern Conference</p></div></div><div class="depth-club-numbers"><div><small>VERIFIED W–L</small><b>'+r.w+'–'+r.l+'</b></div><div><small>ELO POSITION</small><b>#'+(c.ordered.indexOf(t)+1)+'</b></div><div><small>POINTS / GAME</small><b>'+(gp?num(r.pf/gp):'—')+'</b></div><div><small>ALLOWED / GAME</small><b>'+(gp?num(r.pa/gp):'—')+'</b></div></div></section>';
 const form=last.map(g=>{const o=foe(g,t),w=won(g,t),a=g.home===t?g.home_score:g.away_score,b=g.home===t?g.away_score:g.home_score;return '<a class="depth-form-result '+(w?'win':'loss')+'" href="nba-game-center.html?game='+encodeURIComponent(g.id)+'"><span>'+ (w?'W':'L')+'</span><img src="'+logo(o)+'" alt=""><b>'+e(o)+'</b><small>'+e(a)+'–'+e(b)+'</small></a>'}).join('');
 const series=new Map();for(const g of selected){const o=foe(g,t),r=series.get(o)||{w:0,l:0,last:''};won(g,t)?r.w++:r.l++;r.last=g.date;series.set(o,r)}
 const seriesCards=[...series.entries()].sort((a,b)=>b[1].w+b[1].l-a[1].w-a[1].l).map(([o,x])=>'<a class="depth-series-item" href="'+href(o)+'"><img src="'+logo(o)+'" alt=""><span>'+e(c.meta[o]?.[0]||o)+'</span><strong>'+x.w+'–'+x.l+'</strong><small>Last: '+date(x.last)+'</small></a>').join('');
 const element=document.querySelector('#app .nba-team-identity');if(!element)return;
 element.insertAdjacentHTML('afterend','<div class="depth-team-upgrade">'+top+'<section class="depth-section"><div class="depth-label">Results desk</div><h2>How they are playing</h2><div class="depth-form-grid">'+(form||'<p class="depth-muted">No completed results.</p>')+'</div><p class="depth-muted">The latest eight verified finals. Select a result for its full box score.</p></section><div class="depth-columns"><section class="depth-section depth-dark"><div class="depth-label">The rating tape</div><h2>USRS Elo, game by game</h2>'+spark(c,t,selected)+'</section><section class="depth-section"><div class="depth-label">Player production</div><h2>Faces of the franchise</h2><div class="depth-person-grid">'+leader(c,t,'ppg','SCORING · PPG')+leader(c,t,'rpg','REBOUNDING · RPG')+leader(c,t,'apg','PLAYMAKING · APG')+leader(c,t,'ts_pct','EFFICIENCY · TS%')+'</div><p class="depth-muted">Captured box-score statistics only; no league-wide minutes qualification.</p></section></div><section class="depth-section"><div class="depth-label">Current-season head-to-head</div><h2>Who they have played</h2><div class="depth-series-grid">'+(seriesCards||'<p class="depth-muted">Series records populate as games finish.</p>')+'</div><p class="depth-muted">This includes only verified 2026–27 games, not historical all-time meetings.</p></section></div>');
}
w.NBATeamDepth=render;
})(window);
