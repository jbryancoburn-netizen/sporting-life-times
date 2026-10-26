
/* Shared NBA edition navigation for detail-only pages. Keep existing game/box-score applications intact. */
(function(){
 const links=[['nba.html','Front Page'],['nba-standings.html','Standings'],['nba-conference.html?conference=East','Conferences'],['nba-playoffs.html','Playoff Picture'],['nba-rankings.html','USRS Rankings'],['nba-players.html','Player Leaders'],['nba-matchups.html','Matchup Lab'],['nba-game-center.html','Game Center'],['nba.html#teams','Teams'],['sports.html','All Sports']];
 const root=document.createElement('div');root.className='nba-edition-shell';root.innerHTML='<div class="nba-top"><a href="index.html">Independent sports journalism & data</a><span>NBA 2026–27</span></div><div class="nba-brand-mast"><a href="index.html">The Sporting Life &amp; Times</a></div><div class="nba-edition-sub">The National Basketball Association Edition</div><nav class="nba-global-nav" aria-label="NBA newspaper navigation">'+links.map(x=>'<a href="'+x[0]+'">'+x[1]+'</a>').join('')+'</nav>';
 document.body.prepend(root);
})();
