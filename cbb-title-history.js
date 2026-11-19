(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const group = $('title-series');
  const search = $('title-search');
  const status = $('title-status');
  const source = $('title-source');
  const body = $('title-results');
  const params = new URLSearchParams(location.search);
  if (params.get('gender') === 'women') group.value = 'women-d1';
  const norm = value => String(value).normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase();
  fetch('data/cbb-title-history.json').then(response => {
    if (!response.ok) throw Error('Archive unavailable');
    return response.json();
  }).then(series => {
    function render() {
      const selected = series[group.value];
      source.href = selected.source;
      source.hidden = false;
      const terms = norm(search.value.trim()).split(/\s+/).filter(Boolean);
      const rows = selected.rows.filter(row => terms.every(term => norm(row.join(' ')).includes(term)));
      status.textContent = rows.length + ' of ' + selected.rows.length + ' championship entries';
      body.replaceChildren(...rows.map(([year, champion, runner, score, note]) => {
        const row = document.createElement('tr');
        [year, champion, runner || '—', score || '—', note || ''].forEach((value, index) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td');
          if (index === 0) cell.scope = 'row';
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }));
    }
    group.addEventListener('change',render);
    search.addEventListener('input',render);
    render();
  }).catch(() => { status.textContent = 'Championship records are temporarily unavailable.'; });
})();
