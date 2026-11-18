(() => {
  'use strict';
  const key = name => String(name || '').normalize('NFKD')
    .replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, '');

  function group(players) {
    const groups = new Map();
    for (const player of players) {
      const name = key(player.name);
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(player);
    }
    return groups;
  }

  function join(roster, production) {
    const rosterNames = group(roster);
    const statsByName = group(production);
    const matched = new Set();
    const rows = roster.map(player => {
      const name = key(player.name);
      const candidates = statsByName.get(name);
      const stats = rosterNames.get(name)?.length === 1 && candidates?.length === 1
        ? candidates[0] : null;
      if (stats) matched.add(stats);
      return {player, stats};
    });
    for (const stats of production) {
      if (!matched.has(stats)) rows.push({player: null, stats});
    }
    return rows;
  }

  window.SLTCBBRosterProduction = {join};
})();
