/* Radio calendars are sourced from each team's official athletics site. */
(() => {
 'use strict';
 const requests = new Map();
 const indiana = 'https://iuhoosiers.com/news/2026/3/20/general-indiana-university-athletics-announces-five-year-extension-of-flagship-radio-partnership-with-sound-management';
 const purdue = 'https://purduesports.com/radio';
 const iowa = 'https://hawkeyesports.com/hawkeye-radio-network';
 const wisconsin = 'https://uwbadgers.com/sports/2026/10/7/badger-radio-network';
 const baylor = 'https://baylorbears.com/sports/2018/5/17/radio';
 const louisville = 'https://gocards.com/sports/2023/10/16/uofl-radio-affiliates';
 const gonzaga = 'https://gozags.com/news/2024/10/4/gonzaga-athletics-gonzaga-radio-network-and-iheartmedia-announce-broadcast-partnership';
 const texas = 'https://texaslonghorns.com/coverage';
 const spartan = 'https://msuspartans.com/sports/2018/7/20/sports-m-footbl-spec-rel-radioaffiliates-html';
 const montana = 'https://gogriz.com/sports/2015/3/3/GEN_2014010141';
 const jackrabbits = 'https://gojacks.com/coverage';
 const mizzou = 'https://mutigers.com/tiger-network-radio-affiliates';
 const memphis = 'https://gotigersgo.com/news/2026/7/22/general-memphis-athletics-renews-flagship-radio-partnership-with-cumulus-media-memphis';
 const oregon = 'https://goducks.com/sports/2004/8/5/68136';
 const usc = 'https://usctrojans.com/sports/2021/9/1/download-the-new-usc-trojans-gameday-mobile-app';
 const virginia = 'https://virginiasports.com/radio';
 const uni = 'https://unipanthers.com/news/2026/8/27/general-uni-athletics-and-panther-sports-properties-announce-broadcast-renewal-with-coloff-media';
 const ndsu = 'https://gobison.com/coverage';
 const montanaState = 'https://msubobcats.com/sports/2026/11/17/fan-central';
 const affiliates = {
  men: {
   '12': ['Wildcats Radio 1290 AM', 'https://arizonawildcats.com/coverage?path=mten'],
   '153': ['Tar Heel Sports Network', 'https://goheels.com/news/2023/11/14/general-carolina-athletics-launches-redesigned-goheels-com'],
   '70': ['Vandal Radio Network', 'https://govandals.com/news/2026/11/17/mens-basketball-idaho-heads-to-reno-to-face-wolf-pack.aspx'],
   '93': ['Froggy 103.7 FM', 'https://goracers.com/sports/mens-basketball/schedule'],
   '147': ['Bobcat Sports Radio Network', montanaState],
   '2168': ['WHIO Radio', 'https://daytonflyers.com/sports/mens-basketball/schedule'],
   '2181': ['ESPN Des Moines 1350 AM / 102.1 FM', 'https://godrakebulldogs.com/sports/mens-basketball/schedule/2026-27?grid=true'],
   '2449': ['Bison 1660 · 107.9 FM The Fox', ndsu],
   '2460': ['KCVM 93.5 FM · KHAM 103.1 FM · KCHA 1580 AM / 103.3 FM', uni],
   '30': ['Trojan Radio Network', usc],
   '142': ['KTGR · Tiger Network affiliates', mizzou],
   '197': ['Cowboy Radio Network', 'https://okstate.com/listen'],
   '235': ['WKIM 98.9 FM The Roar', memphis],
   '258': ['WINA 98.9 FM / 1070 AM · Virginia Sports Radio Network', virginia],
   '265': ['KIRO 710 AM · Seattle Sports', 'https://wsucougars.com/news/2026/07/09/wsu-seattle-sports-announce-new-flagship-agreement-and-expanded-partnership'],
   '269': ['94.5 ESPN', 'https://gomarquette.com/sports/mens-basketball/schedule/'],
   '21': ['San Diego Sports 760 AM', 'https://goaztecs.com/sports/mens-basketball/schedule/season/2026-27'],
   '2483': ['Oregon Sports Network', oregon],
   '26': ['KABC 790 AM', 'https://uclabruins.com/news/2025/08/21/790-kabc-to-serve-as-flagship-station-of-ucla-bruins-audio-network'],
   '66': ['Cyclone Radio Network', 'https://cyclones.com/sports/2015/3/2/GEN_20140101327'],
   '97': ['93.9 FM The Ville', louisville],
   '127': ['Spartan Media Network', spartan],
   '149': ['Grizzly Sports Network', montana],
   '239': ['KRZI 1660 AM / 92.3 FM', baylor],
   '251': ['Longhorn Radio Network', texas],
   '275': ['Badger Radio Network', wisconsin],
   '2250': ['590 AM / 96.1 FM', gonzaga],
   '2294': ['Hawkeye Radio Network', iowa],
   '2571': ['Jackrabbit Sports Network', jackrabbits],
   '2633': ['Vol Network affiliates', 'https://utsports.com/sports/2017/6/14/volnetwork-affiliates'],
   '96': ['UK Sports Network affiliates', 'https://ukathletics.com/UK-Sports-Network/'],
   '150': ['WRAL News+ 99.3 / 96.5 FM · The Buzz 620 AM / 104.5 FM', 'https://goduke.com/sports/2022/8/6/local-radio-affiliates'],
   '2305': ['KLWN 1320 AM · The Bull 92.9 FM · Jayhawk affiliates', 'https://kuathletics.com/documents/download/2026/11/16/KUMBB_Game_Notes_UNLV.pdf'],
   '2509': ['WAZY 96.5 FM · Purdue affiliates', purdue],
   '84': ['105.1 FM WHCC', indiana],
   '87': ['960 AM WSBT', 'https://fightingirish.com/radioaffiliates'],
   '130': ['94.7 FM WCSX', 'https://mgoblue.com/sports/2017/6/16/mens-basketball-broadcast-information']
  },
  women: {
   '153': ['Tar Heel Sports Network · free game audio', 'https://goheels.com/news/2023/11/14/general-carolina-athletics-launches-redesigned-goheels-com'],
   '147': ['Bobcat Sports Radio Network', montanaState],
   '302': ['KDVS 90.3 FM', 'https://ucdavisaggies.com/schedule.aspx?path=wbball&season=2026-27'],
   '2006': ['WHLO 640 AM', 'https://gozips.com/sports/womens-basketball/schedule/'],
   '2449': ['Bison 1660', ndsu],
   '2460': ['Corn Country 106.5 FM / 93.5 HD-2', uni],
   '12': ['Freedom 1400 AM', 'https://arizonawildcats.com/sports/womens-basketball/schedule/'],
   '30': ['Trojan Radio Network', usc],
   '52': ['96.5 FM · Seminoles Game Day App', 'https://seminoles.com/sports/womens-basketball/schedule'],
   '142': ['Tiger Network affiliates', mizzou],
   '197': ['KGFY 105.5 FM', 'https://okstate.com/listen'],
   '201': ['1520 AM (Oklahoma City)', 'https://soonersports.com/sports/womens-basketball/schedule'],
   '235': ['WKIM 98.9 FM The Roar', memphis],
   '2483': ['Oregon Sports Network', oregon],
   '26': ['UCLA Bruins Audio Network', 'https://uclabruins.com/listen-live'],
   '97': ['93.9 FM The Ville', louisville],
   '149': ['KGRZ 1450 AM / 92.7 FM', montana],
   '239': ['KLRK 93.9 FM / 101.3 FM on conflicts', baylor],
   '251': ['Longhorn Radio Network', texas],
   '275': ['FOX Sports 1070', wisconsin],
   '2250': ['101.5 FM', gonzaga],
   '2294': ['Hawkeye Radio Network', iowa],
   '2571': ['Jackrabbit Sports Network', jackrabbits],
   '2633': ['Lady Vol Network', 'https://utsports.com/sports/2017/6/14/volnetwork-affiliates'],
   '41': ['ESPN 97.9 FM', 'https://uconnhuskies.com/documents/download/2026/11/10/2026-27_UConn_WBB_Media_Guide.pdf'],
   '96': ['UK Sports Network affiliates', 'https://ukathletics.com/UK-Sports-Network/'],
   '158': ['KBBK 107.3 FM · KXSP 590 AM · KRVN 880 AM', 'https://huskers.com/nebraska-womens-basketball-radio-affiliates'],
   '2509': ['WBPE 95.3 FM · Purdue affiliates', purdue],
   '84': ['96.7 FM WBWB', indiana],
   '87': ['106.1 FM WQYQ / 960 AM WSBT', 'https://fightingirish.com/radioaffiliates']
  }
 };
 // Official game notes can supply a station even when the schedule omits it.
 const gameNotes = {
  'men|2026-11-18|350|112358': ['95.9 FM The Breeze', 'https://uncwsports.com/news/2026/11/17/mens-basketball-mbb-fan-guide-liu.aspx'],
  'men|2026-11-18|2692|328': ['103.1 FM', 'https://weberstatesports.com/news/2026/11/17/mens-basketball-cats-travel-to-logan-to-take-on-utah-state-wednesday']
 };
 const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm = value => String(value || '').toLowerCase().replace(/\bst\.?$/,'state').replace(/[^a-z0-9]/g,'');
 const load = path => fetch(path).then(r => r.ok ? r.json() : null).catch(() => null);
 function calendar(gender) {
  if (!requests.has(gender)) {
   requests.set(gender, load('data/cbb-radio-calendar-'+gender+'.json').then(data =>
    data?.season==='2026-27' ? data.teams : {}));
  }
  return requests.get(gender);
 }
 function anchor(label, href, className='') {
  if (!/^https:\/\/[^\s"'<>]+$/i.test(href||'')) return esc(label);
  return '<a class="'+className+'" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';
 }
 async function mountGame(node, game, gender) {
  const teams = await calendar(gender);
  if (!node.isConnected) return;
  node.setAttribute('role','group');
  node.setAttribute('aria-label','Team radio');
  node.innerHTML = '<span class="sl-media-icon" aria-hidden="true">📻</span><span class="sl-radio-lines">'+['away','home'].map(side => {
   const self=game[side], other=game[side==='away'?'home':'away'];
   const id=String(self.id), team=teams[id], affiliate=affiliates[gender]?.[id];
   const names=new Set([norm(other.name),norm(other.full)].filter(Boolean));
   const matches=Object.entries(team?.games?.[game.day]||{}).filter(([opponent]) => names.has(norm(opponent)));
   const scheduled=matches.length===1?matches[0][1]:[];
   const note=gameNotes[[gender,game.day,id,other.id].join('|')];
   const listings=note?[note,...scheduled.filter(([label])=>norm(label)!==norm(note[0]))]:scheduled;
   const info=listings.map(([label,url]) => anchor(label,url||team.source,'ledger26-network'));
   if (affiliate) info.push(anchor(affiliate[0]+' (season affiliate)',affiliate[1],'ledger26-network'));
   return '<small class="sl-radio-side"><strong>'+esc(self.name)+'</strong> '+(info.length?info.join(' · '):'Radio unconfirmed')+'</small>';
  }).join('')+'</span>';
  node.hidden=false;
 }
 async function mountTeam(node) {
  const gender=node.dataset.teamRadio, params=new URLSearchParams(location.search);
  const key=params.get('team')||params.get('id')||'';
  if (!key) return;
  let id=key;
  if (gender==='men'&&/^ncaa:\d+$/.test(key)) {
   const walk=await load('data/ncaam-2026-27-espn-team-crosswalk.json');
   id=String(walk?.teams?.find(team=>team.id===key)?.espn_id||'');
  }
  const team=(await calendar(gender))[id], affiliate=affiliates[gender]?.[id];
  const named=new Set(Object.values(team?.games||{}).flatMap(day=>Object.values(day).flatMap(entries=>
   entries.map(([label])=>label).filter(label=>label!=='Official game audio'))));
  const details=[];
  if (affiliate) details.push(anchor(affiliate[0],affiliate[1]));
  if (named.size) details.push('Listed on the season schedule: '+esc([...named].join(' · ')));
  if (team?.source) details.push(anchor('Official schedule and game audio',team.source));
  node.innerHTML='<strong>Basketball radio</strong> · '+(details.length?details.join(' · '):
   'An official radio listing is still unconfirmed.');
  node.hidden=false;
 }
 window.SLTRadioCalendar={mountGame};
 for (const node of document.querySelectorAll('[data-team-radio]')) void mountTeam(node);
})();
