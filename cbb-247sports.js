(() => {
  'use strict';
  const directory = document.getElementById('cbb-247-directory');
  const schools = document.getElementById('cbb-247-school');
  const link = document.getElementById('cbb-247-school-link');
  const status = document.getElementById('cbb-247-status');
  let loaded = false;

  schools.addEventListener('change', () => {
    link.hidden = !schools.value;
    if (schools.value) {
      link.href = 'https://247sports.com/college/' + schools.value + '/news/?sport=basketball';
    } else {
      link.removeAttribute('href');
    }
  });

  directory.addEventListener('toggle', async () => {
    if (!directory.open || loaded) return;
    loaded = true;
    status.textContent = 'Loading the 247Sports team directory…';
    try {
      const response = await fetch('data/cbb-247sports-team-sites.json', {signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Directory unavailable');
      const entries = await response.json();
      for (const [slug, name] of entries) {
        if (/^[a-z0-9-]+$/.test(slug) && typeof name === 'string') schools.add(new Option(name, slug));
      }
      if (schools.options.length <= 1) throw new Error('Directory was empty');
      schools.disabled = false;
      status.textContent = '';
    } catch {
      status.textContent = 'Team lookup unavailable. Open the 247Sports Team sites link below.';
      loaded = false;
    }
  });
})();
