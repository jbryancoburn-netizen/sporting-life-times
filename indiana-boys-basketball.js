const controls = {
  class: document.getElementById('class'),
  conference: document.getElementById('conference'),
  sectional: document.getElementById('sectional'),
  school: document.getElementById('school'),
};
const artwork = {schools: {}, conferences: {}};
let transparentCrests;
const masthead = document.getElementById('masthead-title');
const table = document.querySelector('table');
const status = document.getElementById('status');

function addOptions(select, values) {
  for (const value of values) select.add(new Option(value, value));
}

function pageLink(label, params) {
  const link = document.createElement('a');
  link.href = location.pathname + '?' + new URLSearchParams(params);
  link.textContent = label;
  return link;
}

const scheduleFiles = new Map();

function schedulePanel(edition, members, showPicker) {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Varsity schedule';
  panel.append(heading);
  const content = document.createElement('div');
  let requestedTeam;
  const load = async team => {
    requestedTeam = team.id;
    content.textContent = 'Loading ' + team.school + ' schedule…';
    try {
      const classification = team.classification.toLowerCase();
      if (!scheduleFiles.has(classification)) {
        scheduleFiles.set(classification, fetch('data/indiana-boys-schedule-' + classification + '.json?v=20261116')
          .then(response => {
            if (!response.ok) throw new Error('Schedule unavailable');
            return response.json();
          })
          .catch(error => {
            scheduleFiles.delete(classification);
            throw error;
          }));
      }
      const games = (await scheduleFiles.get(classification))[team.id];
      if (requestedTeam !== team.id) return;
      if (!games?.length) {
        content.textContent = 'Schedule unavailable for ' + team.school + '.';
        return;
      }
      const schedule = document.createElement('table');
      schedule.setAttribute('aria-label', team.school + ' varsity schedule');
      const header = schedule.createTHead().insertRow();
      for (const label of ['Date', 'Site', 'Opponent', 'Time (ET)', 'Location or event']) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        header.append(cell);
      }
      const body = schedule.createTBody();
      const schools = new Map(edition.teams.map(school => [school.id, school.school]));
      for (const [day, site, opponent, time, note, conferenceGame] of games) {
        const row = body.insertRow();
        const month = Number(day.slice(0, 2));
        const date = new Date(month >= 7 ? 2026 : 2027, month - 1, Number(day.slice(3)));
        row.insertCell().textContent = date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
        row.insertCell().textContent = site === 'N' ? 'Neutral' : site === 'at' ? 'Away' : 'Home';
        const opponentCell = row.insertCell();
        if (schools.has(opponent)) opponentCell.append(pageLink(schools.get(opponent), {team: opponent}));
        else opponentCell.textContent = opponent;
        if (conferenceGame) opponentCell.append(' · Conf.');
        row.insertCell().textContent = time || 'TBD';
        row.insertCell().textContent = note || '—';
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrap';
      wrapper.append(schedule);
      content.replaceChildren(wrapper);
    } catch {
      if (requestedTeam === team.id) content.textContent = 'The schedule could not load. Try refreshing the page.';
    }
  };
  if (showPicker) {
    const label = document.createElement('label');
    label.append('Choose a conference member');
    const picker = document.createElement('select');
    for (const member of members) picker.add(new Option(member.school, member.id));
    picker.addEventListener('change', () => load(members.find(member => member.id === picker.value)));
    label.append(picker);
    panel.append(label);
  }
  panel.append(content);
  load(members[0]);
  return panel;
}

const crestColors = {
  Angola: ["#4b227b","#f5b92e"],
  CentralNoble: ["#7b1736","#c8c9cc"],
  Churubusco: ["#171717","#c6a34b"],
  Eastside: ["#08713b","#171717"],
  Fairfield: ["#072e4d","#f8d12b"],
  Fremont: ["#b21d24","#101b34"],
  Garrett: ["#69232e","#1c3154"],
  Lakeland: ["#89b9dd","#b51f30"],
  PrairieHeights: ["#d21d31","#111111"],
  WestNoble: ["#29357c","#c92331"],
  Westview: ["#b82030","#c69a2a"],
  Bellmont: ["#9b1837","#112f57"],
  ColumbiaCity: ["#671e32","#d5a64d"],
  DeKalb: ["#9b162e","#161616"],
  EastNoble: ["#124d8b","#d7aa3e"],
  HuntingtonNorth: ["#b92030","#111111"],
  Leo: ["#51277b","#d2b66d"],
  NewHaven: ["#a52131","#161616"],
  Norwell: ["#142e54","#c8a15d"],
  Chesterton: ['#742634', '#c79732'],
  CrownPoint: ['#ad1d2d', '#f1eee8'],
  LakeCentral: ['#153765', '#f1eee8'],
  LaPorte: ['#cb4d16', '#282422'],
  Merrillville: ['#52237d', '#f1eee8'],
  MichiganCity: ['#1f365e', '#9caec7'],
  Portage: ['#a9202c', '#f1eee8'],
  Valparaiso: ['#22583a', '#f1eee8'],
  Duneland: ['#b8242d', '#282324'],
  BloomingtonNorth: ['#692b24', '#c29946'],
  DecaturCentral: ['#173859', '#c9a550'],
  Franklin: ['#145580', '#e3e4e2'],
  Martinsville: ['#a82636', '#154473'],
  Mooresville: ['#1a3461', '#c69836'],
  PerryMeridian: ['#174370', '#899bab'],
  Plainfield: ['#a22232', '#173e70'],
  Whiteland: ['#234a81', '#f1eee8'],
  'Mid-State': ['#252422', '#b39b67'],
  BrebeufJesuit: ['#732539', '#c39a54'],
  GuerinCatholic: ['#4c3571', '#b89957'],
  IndianapolisChatard: ['#2e5b86', '#f1eee8'],
  IndianapolisRoncalli: ['#a82634', '#f1eee8'],
  'Circle City': ['#292725', '#a8a29a'],
  ColumbusNorth: ['#173e69', '#f1eee8'],
  Danville: ['#a32032', '#a6a6a8'],
  'Greenfield-Central': ['#19436e', '#cca44d'],
  IndianapolisCathedral: ['#c7a950', '#18496f'],
  McCutcheon: ['#a22c39', '#c1a15b'],
  Northview: ['#a9a9ac', '#7b243c'],
  Southport: ['#ab2433', '#f1eee8'],
  TerreHauteSouth: ['#a92532', '#f1eee8'],
  Yorktown: ['#205b40', '#dad9cb'],
  Concord: ['#16583c', '#202423'],
  Goshen: ['#ae222c', '#222222'],
  Mishawaka: ['#751d37', '#ded7c9'],
  Northridge: ['#185438', '#d6af3d'],
  NorthWood: ['#222222', '#a91e2b'],
  Plymouth: ['#a91f2c', '#202020'],
  Warsaw: ['#cc601e', '#242424'],
  Wawasee: ['#1a5237', '#c4a143'],
  'Northern Lakes': ['#155339', '#222222'],
  BenDavis: ['#4b2784', '#efd996'],
  Carmel: ['#124386', '#efb827'],
  CenterGrove: ['#bf1827', '#202020'],
  LawrenceCentral: ['#692936', '#d1aa70'],
  LawrenceNorth: ['#005238', '#a51e2d'],
  NorthCentralIndianapolis: ['#262626', '#ad1728'],
  Pike: ['#aa1428', '#b7b9bd'],
  WarrenCentral: ['#222222', '#c29e52'],
  Metropolitan: ['#272420', '#bc9a58'],
  Fishers: ['#a6192e', '#b1b4b7'],
  Avon: ['#161616', '#c99626'],
  Brownsburg: ['#492477', '#b7bbc1'],
  FranklinCentral: ['#113f78', '#aab9c8'],
  HamiltonSoutheastern: ['#165594', '#93a7b7'],
  Westfield: ['#15533b', '#bb9f60'],
  Zionsville: ['#16572b', '#242424'],
  Noblesville: ['#202020', '#b79b55'],
  'Hoosier Crossroads': ['#17427c', '#bd922c'],
  AdamsCentral: ['#c8102e', '#111111'],
};


function crest(mark, size, identity) {
  const badge = document.createElement('span');
  badge.className = 'crest crest-' + size;
  if (identity === 'Metropolitan') badge.classList.add('crest-dark');
  const colors = crestColors[identity];
  if (colors) {
    badge.style.setProperty('--crest-primary', colors[0]);
    badge.style.setProperty('--crest-secondary', colors[1]);
  }
  const logo = document.createElement('img');
  logo.alt = '';
  logo.decoding = 'async';
  if (size === 'small') logo.loading = 'lazy';
  logo.addEventListener('error', () => badge.remove(), {once: true});
  const tile = transparentCrests?.schools[identity] || transparentCrests?.conferences[identity];
  if (tile) {
    const [atlas, x, y] = tile;
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const frame = document.createElementNS(svgNamespace, 'svg');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('viewBox', `${x} ${y} ${transparentCrests.tile} ${transparentCrests.tile}`);
    const sheet = document.createElementNS(svgNamespace, 'image');
    sheet.setAttribute('width', transparentCrests.size);
    sheet.setAttribute('height', transparentCrests.size);
    sheet.addEventListener('error', () => {
      logo.src = mark;
      frame.replaceWith(logo);
    }, {once: true});
    sheet.setAttribute('href', `assets/indiana-boys-crest-buttons/v1-${atlas}.webp?v=local-artwork`);
    frame.append(sheet);
    badge.append(frame);
  } else {
    logo.src = mark;
    badge.append(logo);
  }
  return badge;
}

function showMasthead(title, mark, identity) {
  const heading = document.createElement('h1');
  heading.textContent = title;
  masthead.replaceChildren(...(mark ? [crest(mark, 'large', identity), heading] : [heading]));
}

function showTeam(edition, team) {
  document.title = team.school + ' | Indiana Boys Basketball RETRO';
  showMasthead(team.school, artwork.schools[team.id], team.id);
  document.querySelector('.filters').hidden = true;
  document.querySelector('.filters').style.display = 'none';
  document.getElementById('view-title').textContent = 'Team profile';
  status.textContent = 'RETRO ' + edition.initialRating + ' · Preseason';
  const profile = document.createElement('p');
  profile.append(
    pageLink('Class ' + team.classification, {class: team.classification}),
    ' · ',
    pageLink(team.conference, {conference: team.conference}),
    ' · ',
    pageLink('Sectional ' + team.sectional, {sectional: team.sectional})
  );
  const schedule = document.createElement('a');
  schedule.href = 'http://scoreboard.homestead.com/boys/logs' + encodeURIComponent(team.id) + '.htm';
  schedule.textContent = 'Varsity schedule and results';
  const scheduleRow = document.createElement('p');
  scheduleRow.append(schedule, ' · John Harrell');
  const back = document.createElement('p');
  back.append(pageLink('Statewide rankings', {}));
  status.after(profile, back, schedulePanel(edition, [team], false), scheduleRow);
}

function initialize(edition) {
  document.getElementById('edition').textContent = edition.season + ' · Preseason';
  addOptions(controls.conference, [...new Set(edition.teams.map(team => team.conference))].sort());
  addOptions(controls.sectional, [...new Set(edition.teams.map(team => team.sectional))].sort((a, b) => a - b));
  const query = new URLSearchParams(location.search);
  if (query.has('team')) {
    const team = edition.teams.find(school => school.id === query.get('team'));
    if (team) showTeam(edition, team);
    else {
      status.textContent = 'School not found. ';
      status.append(pageLink('Statewide rankings', {}));
    }
    return;
  }
  for (const [key, control] of Object.entries(controls)) {
    if (query.has(key)) control.value = query.get(key);
  }
  const teams = [...edition.teams].sort((a, b) => a.school.localeCompare(b.school));
  const conferenceSchedule = document.getElementById('conference-schedule');
  let lastConference;
  const render = () => {
    const selected = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
    const search = selected.school.trim().toLowerCase();
    const group = teams.filter(team =>
      (!selected.class || team.classification === selected.class) &&
      (!selected.conference || team.conference === selected.conference) &&
      (!selected.sectional || String(team.sectional) === selected.sectional)
    );
    const shown = group.filter(team => team.school.toLowerCase().includes(search));
    const label = [
      selected.class && 'Class ' + selected.class,
      selected.conference,
      selected.sectional && 'Sectional ' + selected.sectional,
    ].filter(Boolean).join(' · ');
    document.getElementById('view-title').textContent = label || 'Statewide register';
    showMasthead(selected.conference || 'Indiana Boys Basketball RETRO', artwork.conferences[selected.conference], selected.conference);
    document.title = selected.conference
      ? selected.conference + ' | Indiana Boys Basketball RETRO'
      : 'Indiana Boys Basketball RETRO | Sporting Life & Times';
    status.textContent = shown.length
      ? shown.length + ' ' + (shown.length === 1 ? 'school' : 'schools') + ' · All tied at ' + edition.initialRating + ' entering the season'
      : 'No schools match these filters.';
    const rows = shown.map(team => {
      const row = document.createElement('tr');
      for (const [index, value] of [1, team.school, team.classification, team.conference, team.sectional, edition.initialRating].entries()) {
        const cell = row.insertCell();
        if (index === 1) {
          const link = pageLink(value, {team: team.id});
          const mark = artwork.schools[team.id];
          if (mark) {
            link.className = 'school-identity';
            link.prepend(crest(mark, 'small', team.id));
          }
          cell.append(link);
        }
        else if (index === 3) cell.append(pageLink(value, {conference: team.conference}));
        else cell.textContent = value;
        if ([0, 4, 5].includes(index)) cell.className = 'number';
      }
      return row;
    });
    table.tBodies[0].replaceChildren(...rows);
    table.hidden = !rows.length;
    if (lastConference !== selected.conference) {
      lastConference = selected.conference;
      const members = teams.filter(team => team.conference === selected.conference);
      conferenceSchedule.replaceChildren(...(members.length ? [schedulePanel(edition, members, true)] : []));
    }
    const params = new URLSearchParams(Object.entries(selected).filter(([, value]) => value));
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
  };
  for (const control of Object.values(controls)) control.addEventListener('input', render);
  render();
}

const crestManifests = Promise.all(
  ['indiana-boys-crests-statewide.json', 'indiana-boys-crests.json', 'indiana-boys-crests-mic.json', 'indiana-boys-crests-nlc.json', 'indiana-boys-crests-dac.json',
    'indiana-boys-crests-msc.json', 'indiana-boys-crests-circle.json', 'indiana-boys-crests-schools.json', 'indiana-boys-crests-acac.json', 'indiana-boys-crests-ne8.json', 'indiana-boys-crests-necc.json?v=local-artwork', 'indiana-boys-crests-verified-artwork.json'].map(file =>
    fetch('data/' + file)
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
  )
);

const schoolCrestColors = fetch('data/indiana-boys-crest-colors.json')
  .then(response => response.ok ? response.json() : null)
  .catch(() => null);

const transparentCrestIndex = fetch('assets/indiana-boys-crest-buttons/v1-index.json?v=local-artwork')
  .then(response => response.ok ? response.json() : null)
  .catch(() => null);

fetch('data/indiana-boys-basketball.json')
  .then(response => {
    if (!response.ok) throw new Error('School register unavailable');
    return response.json();
  })
  .then(async edition => {
    const [manifests, index, colors] = await Promise.all([crestManifests, transparentCrestIndex, schoolCrestColors]);
    Object.assign(crestColors, colors?.schools);
    transparentCrests = index;
    for (const manifest of manifests.filter(Boolean)) {
      Object.assign(artwork.schools, manifest.schools);
      Object.assign(artwork.conferences, manifest.conferences);
      const source = document.createElement('a');
      source.href = manifest.source;
      source.textContent = manifest.credit || (manifest.source.includes('themicconference.com') ? 'MIC artwork' : 'HCC artwork');
      document.querySelector('footer').append(' · ', source);
    }
    if (colors?.source) {
      const source = document.createElement('a');
      source.href = colors.source;
      source.textContent = colors.credit;
      document.querySelector('footer').append(' · ', source);
    }
    initialize(edition);
  })
  .catch(() => { status.textContent = 'The school register could not load. Try refreshing the page.'; });
