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

function initialize(edition) {
  document.getElementById('edition').textContent = edition.season + ' · Preseason';
  addOptions(controls.conference, [...new Set(edition.teams.map(team => team.conference))].sort());
  addOptions(controls.sectional, [...new Set(edition.teams.map(team => team.sectional))].sort((a, b) => a - b));
  const query = new URLSearchParams(location.search);
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
    status.textContent = shown.length
      ? shown.length + ' ' + (shown.length === 1 ? 'school' : 'schools') + ' · All tied at ' + edition.initialRating + ' entering the season'
      : 'No schools match these filters.';
    const rows = shown.map(team => {
      const row = document.createElement('tr');
      for (const [index, value] of [1, team.school, team.classification, team.conference, team.sectional, edition.initialRating].entries()) {
        const cell = row.insertCell();
        cell.textContent = value;
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
