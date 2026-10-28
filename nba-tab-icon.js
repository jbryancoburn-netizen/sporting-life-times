/* Context-aware browser tab identity for NBA league and franchise pages. */
(()=>{'use strict';
const valid=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
const league='https://cdn.nba.com/logos/leagues/L/logo-nba.svg';
const p=new URLSearchParams(location.search);
const raw=(p.get('team')||p.get('club')||'').trim().toUpperCase();
const alias={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS'};
const team=alias[raw]||raw;
const franchise=/nba-team-desk\.html$/i.test(location.pathname);
const url=franchise&&valid.has(team)?'assets/nba-logos/'+team+'.png':league;
const link=document.querySelector('link[rel="icon"]')||document.createElement('link');
link.rel='icon';link.type=url.endsWith('.png')?'image/png':'image/svg+xml';link.href=url;
if(!link.isConnected)document.head.appendChild(link);
if(franchise&&valid.has(team)){
 const image=new Image();
 image.onerror=()=>{link.type='image/svg+xml';link.href=league;};
 image.src=url;
}
})();