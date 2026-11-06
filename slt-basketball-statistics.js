/* One sourced, compact team-statistics register for every basketball edition.
   A blank or incomplete source is never turned into an estimated statistic. */
(function(w){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const safe=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const fmt=v=>safe(v)===null?'—':v.toFixed(1);
 function fromGames(games,team,options={}){
  const ids=new Set(),s={games:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0};
  const hk=options.homeKey||'home',ak=options.awayKey||'away',hsk=options.homeScoreKey||'home_score',ask=options.awayScoreKey||'away_score';
  for(const g of Array.isArray(games)?games:[]){
   if(!g||typeof g!=='object'||(options.requireFinal&&g.status!=='final')||
      (options.requireVerified&&g.verified!==true)||(options.requireEligible&&g.elo_eligible!==true))continue;
   const home=String(g[hk]??''),away=String(g[ak]??'');
   if(home===away||!home||!away||(home!==String(team)&&away!==String(team)))continue;
   const h=safe(g[hsk]),a=safe(g[ask]);
   if(h===null||a===null||h<0||a<0||h===a)continue;
   const id=String(g.id||[g.date,home,away].join('|'));
   if(ids.has(id))continue;
   ids.add(id);
   const ours=home===String(team)?h:a,theirs=home===String(team)?a:h;
   s.games++;s.wins+=Number(ours>theirs);s.losses+=Number(ours<theirs);
   s.pointsFor+=ours;s.pointsAgainst+=theirs;
  }
  return s;
 }
 function values(data){
  if(!data||!Number.isInteger(Number(data.games))||Number(data.games)<1)return null;
  const gp=Number(data.games);
  const pf=safe(data.pointsFor),pa=safe(data.pointsAgainst);
  return [
   ['Record',Number(data.wins||0)+'–'+Number(data.losses||0)],
   ['Played',String(gp)],
   ['Pts / game',pf===null?'—':fmt(pf/gp)],
   ['Allowed / game',pa===null?'—':fmt(pa/gp)],
   ['Net / game',pf===null||pa===null?'—':((pf-pa)>0?'+':'')+fmt((pf-pa)/gp)]
  ];
 }
 function register(data,config={}){
  const lines=values(data),heading=esc(config.heading||'The season in figures');
  const body=lines?'<dl class="slt-stat-figures">'+lines.map(([name,value])=>'<div><dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>':
   '<p class="slt-stat-unavailable">No eligible completed games in the published season ledger. Statistics will appear after verified finals.</p>';
  return '<section class="slt-stat-register" aria-label="'+heading+'"><div class="slt-stat-heading"><strong>'+heading+'</strong><span>'+esc(config.season||'2026–27')+'</span></div>'+
    body+(config.note?'<p class="slt-stat-provenance">'+esc(config.note)+'</p>':'')+'</section>';
 }
 function extras(entries,config={}){
  if(!Array.isArray(entries)||!entries.length)return '';
  const cleaned=entries.filter(x=>Array.isArray(x)&&x.length>=2&&x[1]!=null&&String(x[1]).trim()&&String(x[1])!=='NaN');
  if(!cleaned.length)return '';
  return '<div class="slt-stat-additional" aria-label="'+esc(config.heading||'Additional team statistics')+'"><div class="slt-stat-additional-head">'+esc(config.heading||'Additional team statistics')+'</div><dl class="slt-stat-other-figures">'+cleaned.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+
  (config.note?'<p class="slt-stat-provenance">'+esc(config.note)+'</p>':'')+'</div>';
 }
 w.SLTBasketballStats={fromGames,register,extras};
})(window);
