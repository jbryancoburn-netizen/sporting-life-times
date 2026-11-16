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
  status.after(profile, scheduleRow, back);
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
