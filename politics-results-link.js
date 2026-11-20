(() => {
  const link = document.querySelector('[data-results-link]');
  const query = new URLSearchParams(location.search);
  const district = query.get('district');
  const state = query.get('state');
  const target = new URL(link.href);
  if (district) {
    target.searchParams.set('office', 'House');
    target.searchParams.set('district', district);
  } else if (state) {
    target.searchParams.set('state', state);
  }
  link.href = target.href;
})();
