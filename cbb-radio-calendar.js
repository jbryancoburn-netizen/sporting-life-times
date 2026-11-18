/* Radio calendars are sourced from each team's official athletics site. */
(() => {
 'use strict';
 const requests = new Map();
 const indiana = 'https://iuhoosiers.com/news/2026/3/20/general-indiana-university-athletics-announces-five-year-extension-of-flagship-radio-partnership-with-sound-management';
 const affiliates = {
  men: {
   '84': ['105.1 FM WHCC', indiana],
   '87': ['960 AM WSBT', 'https://fightingirish.com/radioaffiliates'],
   '130': ['94.7 FM WCSX', 'https://mgoblue.com/sports/2017/6/16/mens-basketball-broadcast-information']
  },
  women: {
   '84': ['96.7 FM WBWB', indiana],
   '87': ['106.1 FM WQYQ / 960 AM WSBT', 'https://fightingirish.com/radioaffiliates']
  }
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
  node.innerHTML = ['away','home'].map(side => {
   const self=game[side], other=game[side==='away'?'home':'away'];
   const id=String(self.id), team=teams[id], affiliate=affiliates[gender]?.[id];
   const names=new Set([norm(other.name),norm(other.full)].filter(Boolean));
   const matches=Object.entries(team?.games?.[game.day]||{}).filter(([opponent]) => names.has(norm(opponent)));
   const listings=matches.length===1?matches[0][1]:[];
   const info=listings.map(([label,url]) => anchor(label,url||team.source,'ledger26-network'));
   if (affiliate) info.push(anchor(affiliate[0]+' (season affiliate)',affiliate[1],'ledger26-network'));
   return '<small class="sl-radio-side"><strong>'+esc(self.name)+'</strong> '+(info.length?info.join(' · '):'Radio unconfirmed')+'</small>';
  }).join('');
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
