(() => {
 'use strict';

 const page = location.pathname.split('/').pop();
 const query = new URLSearchParams(location.search);
 const women = /^(ncaaw|womens-college)/.test(page) || query.get('gender') === 'women' ||
  document.body.dataset.gender === 'women';
 const marks = '.mbb-mark,.logo-shell,.slt-conference-crest,.ledger26-conference-mark,.impact-conference-crest img,' +
  'img[src*="/teamlogos/ncaa_conf/"],img[src*="/teamlogos/ncaa/"],img[src*="assets/cbb-embossed-crests/"]';
 const decorative = '.ledger26-ghost,.hero-watermark,.team-hero-logo-bg,.story-img,.news-photo,.player-photo,.player-portrait';
 const teamPage = url => /^(ncaam-team|ncaaw-team|d2-team|d3-(mens|womens)-basketball)\.html\?/.test(url || '');
 const conferencePage = url => /^ncaa[mw]-conference\.html\?/.test(url || '');
 const womenIDs = new Set();

 function destination(mark) {
  if (mark.dataset.cbbTeamHref) return mark.dataset.cbbTeamHref;
  const src = mark.getAttribute('src') || '';
  const conference = window.SLTConferenceMarks?.keyForLogo?.(src);
  if (conference) return (women ? 'ncaaw' : 'ncaam') + '-conference.html?conference=' + encodeURIComponent(conference);

  const id = mark.dataset.espnId || mark.closest('.wbbr-entry')?.dataset.teamId ||
   src.match(/\/(?:ncaa\/(?:500|500-dark)|cbb-embossed-crests|cbb-retro-archive)\/(\d+)\.(?:png|svg|webp)/i)?.[1];
  if (!id) return '';
  if (women) return womenIDs.has(id) ? 'ncaaw-team.html?team=' + encodeURIComponent(id) : '';
  const canonical = window.MBBLogos?.canonicalForESPN?.(id);
  return canonical ? 'ncaam-team.html?team=' + encodeURIComponent(canonical) : '';
 }

 function apply(mark) {
  if (!mark.isConnected || mark.closest(decorative) || mark.matches('.mbb-mark img')) return;
  const inLedger = mark.closest('.ledger26-crest,.ledger26-conference-mark');
  const image = mark.tagName === 'IMG';
  if (!inLedger) mark.classList.add(image ? 'cbb-glass-image' : 'cbb-glass-mark');

  const owner = mark.closest('a[href]');
  const existing = owner?.getAttribute('href');
  const href = destination(mark);
  if ((teamPage(existing) || conferencePage(existing)) && (!href || existing === href || inLedger)) {
   owner.classList.add('cbb-glass-target');
   return;
  }

  if (!href || mark.dataset.cbbGlassLinked) return;
  const linkedName = window.MBBLogos?.schoolNameForESPN?.(mark.dataset.espnId);
  const label = mark.getAttribute('aria-label') || mark.getAttribute('alt') ||
   mark.dataset.cbbTeamName || linkedName || mark.closest('.conference-identity')?.querySelector('h1')?.textContent || 'Team';
  mark.dataset.cbbGlassLinked = 'true';
  if (owner || mark.closest('button')) {
   // Keep the containing game link valid while giving its crest a team action.
   mark.setAttribute('role', 'link');
   mark.setAttribute('aria-label', 'Open ' + label.replace(/ logo$/, '') + ' page');
   mark.tabIndex = 0;
   mark.classList.add('cbb-glass-target');
   const open = event => {
    event.preventDefault();
    event.stopPropagation();
    location.assign(href);
   };
   mark.addEventListener('click', open);
   mark.addEventListener('keydown', event => { if (event.key === 'Enter') open(event); });
   return;
  }
  const link = document.createElement('a');
  link.href = href;
  link.className = 'cbb-glass-target';
  link.setAttribute('aria-label', 'Open ' + label.replace(/ logo$/, '') + ' page');
  if (image) {
   link.classList.add('cbb-glass-frame');
   mark.replaceWith(link);
   link.append(mark);
  } else {
   link.classList.add('cbb-glass-hit');
   mark.removeAttribute('role');
   mark.removeAttribute('aria-label');
   mark.append(link);
  }
 }

 function scan(root) {
  if (root.matches?.(marks)) apply(root);
  root.querySelectorAll?.(marks).forEach(apply);
 }

 scan(document);
 new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) scan(node);
 }).observe(document.body, {childList: true, subtree: true});
 window.MBBLogos?.ready.then(() => scan(document));
 if (women) fetch('data/ncaaw-2026-27-teams.json')
  .then(response => response.json())
  .then(({teams}) => {
   for (const team of teams) womenIDs.add(String(team.team_id));
   scan(document);
  })
  .catch(() => {});
})();
