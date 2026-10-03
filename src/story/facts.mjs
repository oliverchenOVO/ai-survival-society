// Presentation facts only: no core imports, random draws or active-world dependencies.
import { translate, localizeEvent, localizeText, localizeHistory } from '../i18n/translate.mjs';
export const STORY_SCHEMA = 1;
export const DIRECTOR_TYPES = [
  'FOOD_CRISIS',
  'STORM',
  'PLAGUE',
  'RUMOR',
  'SUPPLY_DROP',
  'TREASURE',
];
const weights = {
  POI_CONTROLLED: 48,
  POI_CONTESTED: 48,
  GENERATOR_REPAIRED: 42,
  FIRE_STARTED: 40,
  BRIDGE_BLOCKED: 40,
  STATION_HEAL: 20,
  BROADCAST_SENT: 15,
  MATCH_ENDED: 150,
  DEATH: 85,
  BETRAYAL: 100,
  ALLIANCE_BROKEN: 60,
  ALLIANCE_CREATED: 55,
  ATTACK: 18,
  TRADE: 25,
  COOPERATION: 35,
  THEFT: 40,
  DECEPTION: 25,
  FOOD_CRISIS: 65,
  STORM: 55,
  PLAGUE: 65,
  RUMOR: 45,
  SUPPLY_DROP: 45,
  TREASURE: 50,
};
export const time = (v) =>
  `${Math.floor(v / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(v % 60)
    .toString()
    .padStart(2, '0')}`;
export function validateSave(data) {
  if (
    data?.schemaVersion !== 1 ||
    !Array.isArray(data.agents) ||
    !data.agents.length ||
    data.agents.length > 12 ||
    !Array.isArray(data.events) ||
    data.events.length > 200000 ||
    !Array.isArray(data.timeline) ||
    !Number.isFinite(data.elapsed) ||
    data.elapsed < 0 ||
    !data.stats ||
    (data.story && data.story.storySchemaVersion !== STORY_SCHEMA)
  )
    throw new Error('Unreadable story schema');
  const ids = new Set(data.agents.map((a) => a.id));
  if (
    ids.size !== data.agents.length ||
    data.agents.some(
      (a) => typeof a.id !== 'string' || typeof a.name !== 'string' || !a.stats || !a.personality,
    )
  )
    throw new Error('Unreadable agent record');
  if (
    data.events.some(
      (e) =>
        !Number.isFinite(e.timestamp) ||
        e.timestamp < 0 ||
        typeof e.event !== 'string' ||
        typeof e.result !== 'string',
    )
  )
    throw new Error('Unreadable event record');
  if (
    data.status === 'finished' &&
    ((data.winner && !ids.has(data.winner)) ||
      data.agents.filter((a) => a.alive).length !== (data.winner ? 1 : 0))
  )
    throw new Error('Inconsistent story outcome');
  return data;
}
export function majorMoments(data, limit = 12) {
  const byId = new Map(data.events.map((e) => [e.id, e]));
  const seen = new Set();
  const deathTimes = data.events
    .filter((e) => e.event === 'DEATH')
    .map((e) => e.timestamp)
    .sort((a, b) => b - a);
  const ranked = data.events
    .map((e) => {
      const first = !seen.has(e.event);
      seen.add(e.event);
      const delta = Object.values(e.relationship_change ?? {}).reduce(
        (s, v) => s + (typeof v === 'number' ? Math.abs(v) : 0),
        0,
      );
      return {
        eventId: e.id,
        score:
          (weights[e.event] ?? 2) +
          (first ? (e.event === 'ALLIANCE_CREATED' ? 55 : 25) : 0) +
          delta * 20 +
          (e.event === 'DEATH' && e.timestamp >= (deathTimes[2] ?? Infinity) ? 35 : 0) +
          (e.event === 'ATTACK' && e.timestamp >= (deathTimes[1] ?? Infinity) ? 20 : 0) +
          (e.data?.resource === 'relic' ? 20 : 0),
        first,
      };
    })
    .sort((a, b) => b.score - a.score || a.eventId - b.eventId);
  // Prevent one repeated category monopolizing the documentary; endings/deaths stay eligible.
  const counts = {},
    selected = [];
  for (const r of ranked) {
    const e = byId.get(r.eventId);
    if (!e) continue;
    if (
      e.data?.poi &&
      e.event.startsWith('POI_') &&
      selected.filter((x) => byId.get(x.eventId)?.event.startsWith('POI_')).length >= 2
    )
      continue;
    if ((counts[e.event] ?? 0) >= 3 && !['DEATH', 'MATCH_ENDED', 'BETRAYAL'].includes(e.event))
      continue;
    counts[e.event] = (counts[e.event] ?? 0) + 1;
    selected.push(r);
    if (selected.length >= limit) break;
  }
  return selected.sort(
    (a, b) =>
      byId.get(a.eventId).timestamp - byId.get(b.eventId).timestamp || a.eventId - b.eventId,
  );
}
function best(list, value) {
  const sorted = list
    .map((id) => ({ id, value: value(id) }))
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  return sorted[0]?.value > 0
    ? sorted.filter((x) => Math.abs(x.value - sorted[0].value) < 1e-9).map((x) => x.id)
    : [];
}
export function buildFacts(data, metadata) {
  validateSave(data);
  const agents = data.agents.map((a) => {
    const death = data.events.find(
      (e) => e.event === 'DEATH' && (e.data?.victim ?? e.target ?? e.actor) === a.id,
    );
    const other = data.agents.filter((b) => b.id !== a.id).map((b) => b.id);
    const allies = other.filter((id) =>
      data.events.some(
        (e) =>
          e.event === 'ALLIANCE_CREATED' &&
          [e.actor, e.target].includes(id) &&
          [e.actor, e.target].includes(a.id),
      ),
    );
    const memoryIds = data.events
      .filter((e) => [e.actor, e.target, e.data?.victim].includes(a.id))
      .map((e) => ({ id: e.id, score: weights[e.event] ?? 1 }))
      .sort((a, b) => b.score - a.score || b.id - a.id)
      .slice(0, 6)
      .map((e) => e.id);
    return {
      id: a.id,
      places: Object.entries(a.placeStats ?? {})
        .map(([id, s]) => ({ id, ...s }))
        .sort((a, b) => b.visits - a.visits),
      finalPlace:
        data.world?.pois.find(
          (p) => Math.hypot(a.position.x - p.position.x, a.position.z - p.position.z) < 4.5,
        )?.id ?? null,
      survival: a.alive ? data.elapsed : (a.diedAt ?? death?.timestamp ?? data.elapsed),
      deathEventId: death?.id ?? null,
      killer: death?.target === a.id ? death.actor : null,
      cause: death?.data?.cause ?? null,
      traits: Object.entries(a.personality)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([key]) => key),
      closest: best(
        allies,
        (id) =>
          (a.relationships?.[id]?.trust ?? 0) +
          (data.agents.find((b) => b.id === id)?.relationships?.[a.id]?.trust ?? 0),
      ),
      trusted: best(other, (id) => a.relationships?.[id]?.trust ?? 0),
      feared: best(other, (id) => a.relationships?.[id]?.fear ?? 0),
      rival: best(
        other,
        (id) =>
          (a.relationships?.[id]?.hostility ?? 0) +
          (data.agents.find((b) => b.id === id)?.relationships?.[a.id]?.hostility ?? 0),
      ),
      memoryIds,
      lifeEventIds: [
        data.events.find(
          (e) =>
            ['ALLIANCE_CREATED', 'TRADE', 'COOPERATION', 'CONVERSATION'].includes(e.event) &&
            [e.actor, e.target].includes(a.id),
        )?.id,
        [...data.events]
          .reverse()
          .find(
            (e) =>
              ['BETRAYAL', 'ATTACK', 'THEFT', 'ALLIANCE_BROKEN'].includes(e.event) &&
              [e.actor, e.target].includes(a.id),
          )?.id,
      ].filter((id) => id !== undefined),
    };
  });
  const finalOrder = [...agents].sort(
    (a, b) =>
      (b.id === data.winner) - (a.id === data.winner) ||
      b.survival - a.survival ||
      a.id.localeCompare(b.id),
  );
  const awards = [
    [
      'trust',
      (a) =>
        data.agents
          .filter((b) => b.id !== a.id)
          .reduce((s, b) => s + (b.relationships?.[a.id]?.trust ?? 0), 0) /
        Math.max(1, data.agents.length - 1),
    ],
    [
      'fear',
      (a) =>
        data.agents
          .filter((b) => b.id !== a.id)
          .reduce((s, b) => s + (b.relationships?.[a.id]?.fear ?? 0), 0) /
        Math.max(1, data.agents.length - 1),
    ],
    ['social', (a) => (a.stats.conversations ?? 0) + (a.stats.trades ?? 0)],
    ['aggression', (a) => a.stats.attacks ?? 0],
    ['loyalty', (a) => a.personality.loyalty ?? 0],
    ['trader', (a) => a.stats.trades ?? 0],
    ['alliances', (a) => a.stats.alliances ?? 0],
    ['betrayals', (a) => a.stats.betrayals ?? 0],
    ['survival', (a) => agents.find((b) => b.id === a.id).survival],
  ].map(([key, fn]) => ({
    key,
    ids: best(
      data.agents.map((a) => a.id),
      (id) => fn(data.agents.find((a) => a.id === id)),
    ),
    value: Math.max(0, ...data.agents.map(fn)),
  }));
  const moments = majorMoments(data);
  const turning =
    moments
      .filter((m) => {
        const e = data.events.find((e) => e.id === m.eventId);
        return (
          DIRECTOR_TYPES.includes(e.event) ||
          ['BETRAYAL', 'ATTACK', 'ALLIANCE_BROKEN'].includes(e.event)
        );
      })
      .sort((a, b) => b.score - a.score)[0]?.eventId ?? null;
  return {
    storySchemaVersion: STORY_SCHEMA,
    simulationVersion: metadata.simulationVersion,
    simulationId: metadata.simulationId,
    startedAt: metadata.startedAt,
    finishedAt: metadata.finishedAt,
    duration: data.elapsed,
    outcome: data.outcome ?? { kind: data.winner ? 'winner' : 'extinction' },
    agents,
    majorMoments: moments,
    finalThree: finalOrder.slice(0, 3).map((a) => a.id),
    awards,
    summary: {
      turningEventId: turning,
      socialEventId:
        data.events.find((e) => ['ALLIANCE_CREATED', 'TRADE', 'COOPERATION'].includes(e.event))
          ?.id ?? null,
      attacks: data.events.filter((e) => e.event === 'ATTACK').length,
    },
    relationshipChanges: data.events
      .filter((e) => e.target && e.relationship_change && Object.keys(e.relationship_change).length)
      .sort(
        (a, b) =>
          Object.values(b.relationship_change).reduce(
            (s, v) => s + (typeof v === 'number' ? Math.abs(v) : 0.2),
            0,
          ) -
          Object.values(a.relationship_change).reduce(
            (s, v) => s + (typeof v === 'number' ? Math.abs(v) : 0.2),
            0,
          ),
      )
      .slice(0, 12)
      .map((e) => e.id),
  };
}
// Public data is a whitelist, not an export of runtime/config objects.
export function cleanText(value) {
  return String(value ?? '')
    .slice(0, 30000)
    .replace(/[A-Za-z]:[\\/][^\s<>"']+/g, '[redacted]')
    .replace(/\b(?:sk-[\w-]{12,}|gh[pousr]_[\w]{12,}|github_pat_[\w]+)\b/g, '[redacted]')
    .replace(/\/(?:Users|home)\/[^\s<>"']+/g, '[redacted]')
    .replace(/https?:\/\/[^\s<>"']+/g, (url) => {
      try {
        const u = new URL(url);
        return u.username || u.password || u.search ? '[redacted]' : url;
      } catch {
        return '[redacted]';
      }
    });
}
const numericObject = (o) =>
  Object.fromEntries(
    Object.entries(o ?? {}).filter(
      ([, v]) => (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean',
    ),
  );
export function publicWorld(w) {
  if (!w) return null;
  return {
    schemaVersion: 1,
    timeOfDay: cleanText(w.timeOfDay),
    weather: cleanText(w.weather),
    metrics: numericObject(w.metrics),
    walls: (w.walls ?? []).map(numericObject),
    pois: (w.pois ?? []).map((p) => ({
      id: cleanText(p.id),
      type: cleanText(p.type),
      position: numericObject(p.position),
      risk: p.risk,
      shelter: p.shelter,
      controller: cleanText(p.controller),
      controllers: (p.controllers ?? []).map(cleanText),
      occupancy: (p.occupancy ?? []).map(cleanText),
      resources: numericObject(p.resources),
      access: cleanText(p.access),
    })),
    objects: (w.objects ?? []).map((o) => ({
      id: cleanText(o.id),
      type: cleanText(o.type),
      poi: cleanText(o.poi),
      position: numericObject(o.position),
      state: cleanText(o.state),
      capacity: o.capacity,
      durability: o.durability,
      controller: cleanText(o.controller),
      usable: o.usable,
      visible: o.visible,
      metadata: {
        stock: numericObject(o.metadata?.stock),
        charges: o.metadata?.charges,
        fuel: o.metadata?.fuel,
        powerZone: cleanText(o.metadata?.powerZone),
        occupants: (o.metadata?.occupants ?? []).map(cleanText),
      },
    })),
    hazards: (w.hazards ?? []).map((h) => ({
      id: cleanText(h.id),
      type: cleanText(h.type),
      poi: cleanText(h.poi),
      position: numericObject(h.position),
      radius: h.radius,
      until: h.until,
      damage: h.damage,
    })),
  };
}
export function publicStory(data) {
  validateSave(data);
  if (!data.story || data.status !== 'finished') throw new Error('Story not completed');
  const agents = data.agents.map((a) => ({
    id: a.id,
    name: cleanText(a.name),
    index: a.index,
    color: /^#[\da-f]{6}$/i.test(a.color) ? a.color : '#8ee6c0',
    alive: Boolean(a.alive),
    position: numericObject(a.position),
    hp: a.hp,
    energy: a.energy,
    hunger: a.hunger,
    infected: Boolean(a.infected),
    inventory: numericObject(a.inventory),
    weapon: cleanText(a.weapon),
    goal: cleanText(a.goal),
    public_reason: cleanText(a.public_reason),
    observed: cleanText(a.observed),
    decisionSource: cleanText(a.decisionSource),
    utility: (a.utility ?? []).map((u) => ({
      action: cleanText(u.action),
      score: u.score,
      target: cleanText(u.target),
    })),
    alliance: (a.alliance ?? []).filter((id) => data.agents.some((b) => b.id === id)),
    target: cleanText(a.target),
    action: cleanText(a.action),
    personality: numericObject(a.personality),
    stats: numericObject(a.stats),
    diedAt: a.diedAt,
    relationships: Object.fromEntries(
      Object.entries(a.relationships ?? {})
        .filter(([id]) => data.agents.some((b) => b.id === id))
        .map(([id, r]) => [id, numericObject(r)]),
    ),
    memory: (a.memory ?? []).map((m) => ({
      poi: cleanText(m.poi),
      who: cleanText(m.who),
      what: cleanText(m.what),
      when: m.when,
      event: cleanText(m.event),
      importance: m.importance,
    })),
  }));
  const events = data.events.map((e) => ({
    id: e.id,
    event: e.event,
    timestamp: e.timestamp,
    actor: e.actor,
    target: e.target,
    actorName: cleanText(e.actorName),
    targetName: cleanText(e.targetName),
    result: cleanText(e.result),
    position: numericObject(e.position),
    relationship_change: numericObject(e.relationship_change),
    data: Object.fromEntries(
      [
        'cause',
        'victim',
        'resource',
        'damage',
        'successful',
        'detected',
        'amount',
        'poi',
        'object',
        'objectType',
        'weather',
        'hazard',
        'controller',
        'message',
      ]
        .filter((k) => e.data?.[k] !== undefined)
        .map((k) => [
          k,
          typeof e.data[k] === 'string'
            ? cleanText(e.data[k])
            : typeof e.data[k] === 'number' || typeof e.data[k] === 'boolean'
              ? e.data[k]
              : null,
        ]),
    ),
  }));
  const history = data.history
    ? {
        source: cleanText(data.history.source),
        title: cleanText(data.history.title),
        summary: cleanText(data.history.summary),
        narration: cleanText(data.history.narration),
        chapters: (data.history.chapters ?? []).map((c) => ({
          title: cleanText(c.title),
          text: cleanText(c.text),
          events: (c.events ?? []).filter((id) => typeof id === 'number'),
        })),
      }
    : null;
  const s = data.story;
  const facts = {
    storySchemaVersion: 1,
    simulationVersion: cleanText(s.simulationVersion),
    simulationId: data.simulation_id,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    duration: s.duration,
    outcome: { kind: data.winner ? 'winner' : 'extinction', survivors: data.winner ? 1 : 0 },
    agents: s.agents.map((f) => ({
      id: f.id,
      places: (f.places ?? []).map((p) => ({
        id: cleanText(p.id),
        visits: p.visits,
        controlSeconds: p.controlSeconds,
      })),
      finalPlace: cleanText(f.finalPlace),
      survival: f.survival,
      deathEventId: f.deathEventId,
      killer: f.killer,
      cause: cleanText(f.cause),
      traits: f.traits,
      closest: f.closest,
      rival: f.rival,
      trusted: f.trusted,
      feared: f.feared,
      memoryIds: f.memoryIds,
      lifeEventIds: f.lifeEventIds ?? [],
    })),
    majorMoments: s.majorMoments.map((m) => ({
      eventId: m.eventId,
      score: m.score,
      first: m.first,
    })),
    finalThree: s.finalThree,
    awards: s.awards.map((a) => ({ key: a.key, ids: a.ids, value: a.value })),
    summary: {
      turningEventId: s.summary.turningEventId,
      socialEventId: s.summary.socialEventId ?? null,
      attacks: s.summary.attacks,
    },
    relationshipChanges: s.relationshipChanges,
  };
  const stats = {
    ...numericObject(data.stats),
    counts: numericObject(data.stats.counts),
    ...Object.fromEntries(
      ['mostTrusted', 'mostFeared', 'mostAggressive', 'mostSocial']
        .filter((k) => data.stats[k] !== undefined)
        .map((k) => [k, cleanText(data.stats[k])]),
    ),
  };
  return {
    schemaVersion: 1,
    simulation_id: data.simulation_id,
    simulationId: data.simulation_id,
    matchId: data.matchId,
    seed: data.seed,
    elapsed: data.elapsed,
    duration: data.duration,
    safeRadius: data.safeRadius,
    world: publicWorld(data.world),
    status: data.status,
    winner: data.winner,
    outcome: facts.outcome,
    stats,
    agents,
    events,
    timeline: data.timeline.map((f) => ({
      timestamp: f.timestamp,
      world: publicWorld(f.world),
      stats: {
        ...numericObject(f.stats),
        counts: numericObject(f.stats?.counts),
        ...Object.fromEntries(
          ['mostTrusted', 'mostFeared', 'mostAggressive', 'mostSocial']
            .filter((k) => f.stats?.[k] !== undefined)
            .map((k) => [k, cleanText(f.stats[k])]),
        ),
      },
      agents: (f.agents ?? []).map((a) => ({
        id: a.id,
        position: numericObject(a.position),
        alive: Boolean(a.alive),
        hp: a.hp,
        action: cleanText(a.action),
      })),
    })),
    history,
    zones: (data.zones ?? []).map((z) => ({
      id: cleanText(z.id),
      name: cleanText(z.name),
      ...numericObject(z),
    })),
    resources: [],
    config: Object.fromEntries(
      ['worldRadius', 'safeZoneFinalRadius', 'safeZoneGraceFraction', 'matchDuration']
        .filter((k) => Number.isFinite(data.config?.[k]))
        .map((k) => [k, data.config[k]]),
    ),
    story: facts,
  };
}
export function biography(data, id, locale = 'zh-TW') {
  const a = data.agents.find((a) => a.id === id),
    f = data.story.agents.find((a) => a.id === id);
  const base = translate('story.bio', locale, { name: a.name, time: time(f.survival), ...a.stats });
  const death = data.events.find((e) => e.id === f.deathEventId);
  const encounters = (f.lifeEventIds ?? [])
    .map((id) => data.events.find((e) => e.id === id))
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e) => `${time(e.timestamp)} · ${localizeEvent(e, locale)}`)
    .join(' ');
  return (
    base +
    ' ' +
    encounters +
    (death
      ? ' ' + localizeEvent(death, locale)
      : ' ' +
        translate('story.winText', locale, {
          name: a.name,
          time: time(data.elapsed),
          deaths: data.stats.deaths,
        }))
  );
}
export function summary(data, locale = 'zh-TW') {
  const t = (k, p) => translate('story.' + k, locale, p),
    s = data.stats;
  return [
    {
      key: 'opening',
      text: t('openText', {
        seed: data.seed,
        count: data.agents.length,
        events: data.events.length,
      }),
    },
    {
      key: 'formation',
      text:
        t('socialText', { ...s, aid: s.cooperation ?? 0 }) +
        (data.story.summary.socialEventId
          ? ' ' +
            localizeEvent(
              data.events.find((e) => e.id === data.story.summary.socialEventId),
              locale,
            )
          : ''),
    },
    { key: 'conflict', text: t('conflictText', { ...s, attacks: data.story.summary.attacks }) },
    {
      key: 'turning',
      text: data.story.summary.turningEventId
        ? localizeEvent(
            data.events.find((e) => e.id === data.story.summary.turningEventId),
            locale,
          )
        : t('turnNone'),
    },
    {
      key: 'endgame',
      text: t(data.winner ? 'winText' : 'extinctText', {
        name: data.agents.find((a) => a.id === data.winner)?.name,
        time: time(data.elapsed),
        deaths: s.deaths,
      }),
    },
  ];
}
export function category(type) {
  return DIRECTOR_TYPES.includes(type)
    ? 'Director'
    : ['ATTACK', 'BETRAYAL', 'THEFT'].includes(type)
      ? 'Combat'
      : type === 'DEATH'
        ? 'Death'
        : type.startsWith('ALLIANCE')
          ? 'Alliance'
          : type === 'TRADE'
            ? 'Trade'
            : 'Social';
}
export const escapeXML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function shareURL(id, origin, publicBase = '') {
  const base = new URL(publicBase || origin);
  if (
    !['https:', 'http:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('Invalid public base URL');
  if (!/^S-[0-9A-HJKMNP-TV-Z]{16}$/.test(id)) throw new Error('Invalid story ID');
  return base.toString().replace(/\/$/, '') + '/story/' + id;
}
export function shareCardSVG(data, locale = 'zh-TW') {
  const t = (k, p) => escapeXML(translate(k, locale, p)),
    name = escapeXML(
      data.agents.find((a) => a.id === data.winner)?.name.toUpperCase() ??
        translate('result.claimed', locale),
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g"><stop stop-color="#112b35"/><stop offset="1" stop-color="#080f18"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><g fill="none" stroke="#36585f" stroke-width="1">${Array.from({ length: 6 }, (_, i) => `<circle cx="1020" cy="285" r="${80 + i * 45}"/>`).join('')}</g><g font-family="Segoe UI, Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif"><text x="70" y="80" fill="#b8cbd0" font-size="23" letter-spacing="4">AI SURVIVAL SOCIETY</text><text x="70" y="162" fill="#8ee6c0" font-size="22">${t(data.winner ? 'result.winner' : 'result.extinction')}</text><text x="65" y="260" fill="#e9f4f0" font-size="${data.winner ? 86 : 62}" font-weight="600">${name}</text><text x="70" y="326" fill="#a4b9bf" font-size="25">Seed ${data.seed} · ${t('story.survival', { time: time(data.elapsed) })}</text><line x1="70" y1="385" x2="1130" y2="385" stroke="#37505a"/><text x="70" y="454" fill="#e9f4f0" font-size="40">${data.stats.kills} ${t('stats.kills')}　 ${data.stats.alliances} ${t('stats.alliances')}</text><text x="70" y="553" fill="#8ee6c0" font-size="22">${escapeXML(data.simulation_id)}</text><text x="1130" y="553" text-anchor="end" fill="#a4b9bf" font-size="19">${t('story.entered', { count: data.agents.length, alive: data.winner ? 1 : 0 })}</text></g></svg>`;
}
export function markdown(data, locale = 'zh-TW') {
  const t = (k, p) => translate(k, locale, p),
    esc = (s) => String(s).replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&');
  const rows = [
    `# AI Survival Society — ${data.simulation_id}`,
    `Seed ${data.seed} · ${time(data.elapsed)}`,
    `## ${t(data.winner ? 'result.winner' : 'result.extinction')}`,
    esc(data.agents.find((a) => a.id === data.winner)?.name ?? t('result.claimed')),
    '## ' + t('story.summary'),
    ...summary(data, locale).map((p) => `### ${t('story.' + p.key)}\n${esc(p.text)}`),
    ...['deaths', 'kills', 'trades', 'alliances', 'betrayals'].map(
      (k) => `${t('stats.' + k)}: ${data.stats[k]}`,
    ),
    '## ' + t('story.moments'),
    ...data.story.majorMoments.map((m) => {
      const e = data.events.find((e) => e.id === m.eventId);
      return `- ${time(e.timestamp)} — ${esc(localizeEvent(e, locale))}`;
    }),
    ...(data.world
      ? [
          '## ' + t('world.moments'),
          ...data.events
            .filter((e) =>
              [
                'POI_CONTROLLED',
                'POI_CONTESTED',
                'GENERATOR_REPAIRED',
                'FIRE_STARTED',
                'BRIDGE_BLOCKED',
              ].includes(e.event),
            )
            .slice(0, 12)
            .map((e) => `- ${time(e.timestamp)} — ${esc(localizeEvent(e, locale))}`),
        ]
      : []),
    '## ' + t('story.cast'),
    ...data.agents.map((a) => {
      const f = data.story.agents.find((f) => f.id === a.id),
        names = (ids) =>
          ids.map((id) => data.agents.find((a) => a.id === id)?.name).join(' / ') ||
          t('story.none');
      const places = (f.places ?? []).length
        ? '\n\n' +
          esc(t('world.places')) +
          '\n' +
          f.places
            .slice(0, 5)
            .map(
              (p) =>
                '- ' +
                esc(t('world.' + p.id.replace('poi_', ''))) +
                ' · ' +
                esc(
                  t('world.placeDetail', {
                    visits: p.visits,
                    seconds: Math.round(p.controlSeconds),
                  }),
                ),
            )
            .join('\n') +
          (f.finalPlace
            ? '\n' +
              esc(t('world.deathPlace')) +
              ': ' +
              esc(t('world.' + f.finalPlace.replace('poi_', '')))
            : '')
        : '';
      return `### ${esc(a.name)}\n${esc(biography(data, a.id, locale))}\n\n${esc(t('inspector.personality'))}: ${Object.entries(
        a.personality,
      )
        .map(([key, value]) => `${esc(t('trait.' + key))} ${Math.round(value * 100)}%`)
        .join(
          ' · ',
        )}\n\n${['closest', 'rival', 'trusted', 'feared'].map((key) => `${esc(t('story.' + key))}: ${esc(names(f[key]))}`).join('\n\n')}\n\n${esc(t('story.memories'))}\n${f.memoryIds
        .map((id) => {
          const e = data.events.find((e) => e.id === id);
          return '- ' + time(e.timestamp) + ' ' + esc(localizeEvent(e, locale));
        })
        .join('\n')}${places}`;
    }),
    '## ' + t('story.historian'),
  ];
  const h = localizeHistory(data, locale);
  if (data.history?.narration) rows.push(esc(data.history.narration));
  else if (h) rows.push(...h.chapters.map((c) => `### ${esc(c.title)}\n${esc(c.text)}`));
  return rows.join('\n\n') + '\n';
}
