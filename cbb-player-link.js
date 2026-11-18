(() => {
  'use strict';
  window.SLTCBBPlayer = {
    href(athlete, year, gender, game, day, team) {
      const name = athlete?.displayName || athlete?.shortName;
      if (!name || !/^\d+$/.test(String(athlete.id || '')) || !Number.isInteger(year)) return '';
      const params = new URLSearchParams({player: athlete.id, season: year, gender, name, game, day});
      if (team) params.set('team', team);
      return 'cbb-player.html?' + params;
    }
  };
})();
