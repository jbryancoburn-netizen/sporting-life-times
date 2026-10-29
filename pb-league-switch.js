/* The Sporting Life & Times · shared, logo-based NBA/EuroLeague/NBL switcher. */
(()=>{'use strict';
const qs=new URLSearchParams(location.search),file=location.pathname.split('/').pop()||'nba.html';
const names={nba:'NBA',euroleague:'EuroLeague',nbl:'Australian NBL'};
const active=file==='nba.html'&&['euroleague','nbl'].includes(qs.get('league'))?qs.get('league'):file==='euroleague.html'?'euroleague':file.startsWith('nbl')?'nbl':'nba';
const view=file==='nba.html'?qs.get('view')||'home':file.includes('standings')?'standings':file.includes('ranking')?'rankings':file.includes('player')?'players':file.includes('matchup')?'matchups':file.includes('team')?'teams':file.includes('game')||file.includes('result')?'games':'home';
const native={home:'nba.html',standings:'nba-standings.html',rankings:'nba-rankings.html',players:'nba-players.html',matchups:'nba-matchups.html',games:'nba-game-center.html',playoffs:'nba-playoffs.html',teams:'nba.html#teams'};
const href=(l,v)=>l==='nba'?native[v]||'nba.html':'nba.html?league='+l+(v&&v!=='home'?'&view='+encodeURIComponent(v):'');
const images={nba:'https://cdn.nba.com/logos/leagues/L/logo-nba.svg',euroleague:'https://commons.wikimedia.org/wiki/Special:FilePath/EuroLeague_logo.svg',nbl:'https://en.wikipedia.org/wiki/Special:Redirect/file/NBL_(Australia)_logo.svg'};
const switcher=document.createElement('div');switcher.className='pb-league-toggle';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Choose professional basketball league');
switcher.innerHTML='<span class="pb-league-toggle-caption">PROFESSIONAL BASKETBALL</span>'+Object.keys(names).map(l=>'<a class="pb-league-option'+(active===l?' is-active':'')+'" href="'+href(l,view)+'" title="'+names[l]+'" aria-label="Switch to '+names[l]+'"'+(l===active?' aria-current="page"':'')+'><img src="'+images[l]+'" alt="" loading="eager"><span class="pb-logo-fallback" aria-hidden="true">'+(l==='euroleague'?'EL':l.toUpperCase())+'</span></a>').join('');
const anchor=document.querySelector('header .edition-line')||document.querySelector('header .edition')||document.querySelector('.mast')||document.querySelector('header .masthead');
if(anchor)anchor.insertAdjacentElement('afterend',switcher);else (document.querySelector('header')||document.body).appendChild(switcher);
switcher.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.parentElement.classList.add('pb-logo-failed')},{once:true}));
})();