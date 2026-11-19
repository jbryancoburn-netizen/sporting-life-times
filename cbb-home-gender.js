(() => {
'use strict';
if (new URLSearchParams(location.search).get('gender') !== 'women') return;
document.body.dataset.gender = 'women';
document.title = 'Women’s College Basketball | Sporting Life & Times';
const edition = document.getElementById('chronicle-edition');
if (edition) edition.textContent = 'Women’s Division I Basketball';
for (const link of document.querySelectorAll('.chronicle-desks [data-women]')) {
  link.href = link.dataset.women;
  if (link.dataset.womenLabel) link.textContent = link.dataset.womenLabel;
}
})();
