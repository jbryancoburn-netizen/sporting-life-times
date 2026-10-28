/* Context-aware tab icon for every Sporting Life & Times edition. */
(()=>{'use strict';
const file=location.pathname.split('/').pop().toLowerCase(),params=new URLSearchParams(location.search);
const teamPages=new Set(['team.html','epl-club.html','cfb-team.html','college-soccer-team.html','ncaam-team.html','nbl-team.html','nba-team-desk.html']);
const league=(()=>{
 if(/^nba(?:-|\.)/.test(file))return 'nba';
 if(/^nbl(?:-|\.)/.test(file))return 'nbl';
 if(/^euroleague/.test(file))return 'euroleague';
 if(/^ncaam|^college-basketball|^d2-mens|^d3-mens/.test(file))return 'ncaam';
 if(/^cfb|^college-football|^d2-?football|^d3-?football|^fcs/.test(file))return 'cfb';
 if(/^college-soccer/.test(file))return 'soccer';
 if(/^epl|^championship|^english-championship|^premier/.test(file))return 'epl';
 if(/^mls/.test(file))return 'mls';
 if(/^nhl|^college-hockey/.test(file))return 'nhl';
 if(/^nfl/.test(file))return 'nfl';
 if(/^mlb|^college-baseball/.test(file))return 'mlb';
 if(/^echl/.test(file))return 'echl';
 if(/^cfl/.test(file))return 'cfl';
 if(/^wnba|^ncaaw|^womens-college/.test(file))return 'wnba';
 if(/^serie-?a|^italian-lba|^lba\./.test(file))return 'seriea';
 if(/^bundesliga/.test(file))return 'bundesliga';
 if(/^la-?liga/.test(file))return 'laliga';
 if(/^liga-?mx/.test(file))return 'ligamx';
 if(/^ligue-?1/.test(file))return 'ligue1';
 if(/^brasil|^brazil/.test(file))return 'brazil';
 if(/^ucl|^champions-league/.test(file))return 'ucl';
 if(/^uel|^europa-league/.test(file))return 'uel';
 if(/^uecl|^conference-league/.test(file))return 'uecl';
 return file.replace(/\.html$/,'').replace(/-football$/,'').replace(/-basketball$/,'');
})();
const codes=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
const id=(params.get('team')||params.get('club')||params.get('school')||'').toUpperCase(),alias={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS'},code=alias[id]||id;
const leagueIcon={nba:'https://cdn.nba.com/logos/leagues/L/logo-nba.svg',euroleague:'assets/euroleague-tab.svg',
nbl:'https://a.espncdn.com/i/leaguelogos/basketball/nbl/500/nbl.png',
nfl:'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png',
nhl:'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
mlb:'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
wnba:'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
epl:'https://a.espncdn.com/i/leaguelogos/soccer/500/eng.1.png',
mls:'https://a.espncdn.com/i/leaguelogos/soccer/500/usa.1.png',
laliga:'https://a.espncdn.com/i/leaguelogos/soccer/500/esp.1.png',
bundesliga:'https://a.espncdn.com/i/leaguelogos/soccer/500/ger.1.png',
seriea:'https://a.espncdn.com/i/leaguelogos/soccer/500/ita.1.png',
ligue1:'https://a.espncdn.com/i/leaguelogos/soccer/500/fra.1.png',
ligamx:'https://a.espncdn.com/i/leaguelogos/soccer/500/mex.1.png',
ucl:'https://a.espncdn.com/i/leaguelogos/soccer/500/uefa.champions.png',
uel:'https://a.espncdn.com/i/leaguelogos/soccer/500/uefa.europa.png',
ncaam:'https://a.espncdn.com/i/teamlogos/leagues/500/mens-college-basketball.png',
cfb:'https://a.espncdn.com/i/teamlogos/leagues/500/college-football.png'};
const svg=text=> 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="13" fill="#102d42"/><text x="32" y="39" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="'+(text.length>4?14:19)+'" fill="#fff">'+text.replace(/&/g,'&amp;')+'</text></svg>');
const base=leagueIcon[league]||svg(league.replace(/[^a-z0-9]/g,'').slice(0,5).toUpperCase()||'SLT');
const link=document.querySelector('link[rel="icon"]')||document.createElement('link');link.rel='icon';
function use(url){if(!url||url===link.href)return;link.href=url;link.type=url.includes('.svg')||url.startsWith('data:image/svg')?'image/svg+xml':'image/png';if(!link.isConnected)document.head.appendChild(link)}
use(base);
if(file==='nba-team-desk.html'&&codes.has(code)){use('assets/nba-logos/'+code+'.png');return}
if(file==='nbl-team.html'&&code){const img='assets/nbl-logos/'+encodeURIComponent(code)+'.png';/* Visible team image takes priority over abbreviations. */}
if(!teamPages.has(file))return;
const selectors=['.depth-crest img','.nba-team-identity img','.club-hero img','.club-badge img','.team-hero img','.team-logo img','.team-logo','.club-logo','.club-crest img','.team-crest img','img.team-crest','.team-header img','.hero img','.club-header img'];
let applied=false;
function find(){
 for(const selector of selectors){const x=document.querySelector(selector);if(!x)continue;
 const src=x.currentSrc||x.src||x.getAttribute('src');
 if(!src||/placeholder|fallback|default/i.test(src))continue;
 if(!/\.(png|webp|svg|jpe?g)(\?|$)/i.test(src)&&!/espncdn|logo/i.test(src))continue;
 if(x.naturalWidth===0&&x.complete)continue;use(src);applied=true;return true}
 return false;
}
function poll(){if(find())return;const imgs=[...document.querySelectorAll('img')].filter(x=>/logo|crest|badge/i.test((x.className||'')+' '+(x.alt||'')+' '+(x.src||'')));for(const x of imgs){if(!x.src||/slt|favicon/i.test(x.src))continue;if(x.naturalWidth===0&&x.complete)continue;use(x.currentSrc||x.src);applied=true;return}}
let timer;const run=()=>{clearTimeout(timer);timer=setTimeout(poll,120)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
const watch=new MutationObserver(run);watch.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>watch.disconnect(),12000);
})();