const controls = {
  class: document.getElementById('class'),
  conference: document.getElementById('conference'),
  sectional: document.getElementById('sectional'),
  school: document.getElementById('school'),
};
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

function showTeam(edition, team) {
  document.title = team.school + ' | Indiana Boys Basketball RETRO';
  document.querySelector('h1').textContent = team.school;
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
    document.querySelector('h1').textContent = selected.conference || 'Indiana Boys Basketball RETRO';
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
        if (index === 1) cell.append(pageLink(value, {team: team.id}));
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

fetch('data/indiana-boys-basketball.json')
  .then(response => {
    if (!response.ok) throw new Error('School register unavailable');
    return response.json();
  })
  .then(initialize)
  .catch(() => { status.textContent = 'The school register could not load. Try refreshing the page.'; });
