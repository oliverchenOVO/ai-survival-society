export function generateHistory(log, agents, winner, elapsed) {
  const pick = types => log.filter(e => types.includes(e.event));
  const alliances = pick(['ALLIANCE_CREATED', 'COOPERATION', 'TRADE']);
  const crises = pick(['FOOD_CRISIS', 'STORM', 'PLAGUE', 'RUMOR', 'SUPPLY_DROP', 'TREASURE']);
  const betrayals = pick(['BETRAYAL', 'THEFT', 'DECEPTION']);
  const battles = pick(['ATTACK', 'DEATH']);
  const chapter = (title, events, fallback) => ({ title, text: events.length ? events.slice(0, 2).map(e => e.result).join(' ') + (events.length > 2 ? ` ${events.length - 2} more events followed.` : '') : fallback, events: events.map(e => e.id) });
  return {
    source: 'template', title: 'The island remembers',
    summary: winner ? `${winner.name} survived ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s. Twelve strangers built a society, and scarcity tested every bond.` : 'The island claimed every survivor. No society lasts without resources.',
    chapters: [
      chapter('01 · The first connections', alliances, 'Some strangers chose solitude. Others searched for a reason to trust.'),
      chapter('02 · A changing world', crises, 'The shrinking safe zone transformed plentiful space into contested ground.'),
      chapter('03 · The cost of trust', betrayals, 'Trust held through this run; no theft or betrayal was recorded.'),
      chapter('04 · The final encounters', battles.slice(-8), 'The environment, rather than combat, decided the final outcome.'),
    ],
    eventCount: log.length, actors: agents.map(a => ({ name: a.name, ...a.stats })),
  };
}
