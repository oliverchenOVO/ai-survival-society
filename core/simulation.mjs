import { randomGenerator, clamp, distance } from './random.mjs';
import { createAgents, relation, changeRelation } from './agents.mjs';
import { EventBus, remember } from './events.mjs';
import { createResource, ZONES } from './world.mjs';
import { chooseDecision } from './utility.mjs';
import { executeAction } from './actions.mjs';
import { generateHistory } from './historian.mjs';
export const DIRECTOR_EVENTS = ['food_crisis', 'supply_drop', 'storm', 'rumor', 'treasure', 'plague'];
export class Simulation {
  constructor(config = {}) {
    this.config = { seed: 2048, tickSeconds: 0.25, decisionInterval: 2, matchDuration: 420, agentCount: 12, ...config };
    this.rng = randomGenerator(this.config.seed); this.bus = new EventBus(); this.elapsed = 0; this.safeRadius = 29;
    this.resourceId = 0; this.resources = []; this.effects = { food_crisis: 0, storm: 0, plague: 0, rumor: '' };
    this.agents = createAgents(Math.max(2, Math.min(12, this.config.agentCount)), this.rng);
    this.modelDecisions = new Map(); this.status = 'running'; this.winner = null; this.history = null;
    this.nextResource = 6; this.nextSnapshot = 0; this.timeline = []; this.matchId = `${Date.now()}-${this.config.seed}`;
    for (let i = 0; i < 36; i++) this.resources.push(createResource(this));
    this.event('WORLD_STARTED', null, null, 'Twelve strangers. One island. Every choice leaves a mark.', { seed: this.config.seed }, 0.7);
  }
  event(type, a, b, result, data = {}, importance = 0.5, relationship_change = {}) {
    const e = this.bus.emit({ timestamp: +this.elapsed.toFixed(2), actor: a?.id ?? 'WORLD', actorName: a?.name ?? 'World', target: b?.id ?? null, targetName: b?.name ?? null, event: type, position: a ? { ...a.position } : { x: 0, z: 0 }, result, relationship_change, data });
    if (a) remember(a, e, ['ATTACK','BETRAYAL','THEFT'].includes(type) ? -0.6 : 0.4, importance);
    if (b) remember(b, e, ['ATTACK','BETRAYAL','THEFT'].includes(type) ? -0.9 : 0.6, importance);
    return e;
  }
  breakAlliance(a, b, cause) {
    changeRelation(a, b, { alliance: false, trust: -0.5, hostility: 0.4 }); changeRelation(b, a, { alliance: false, trust: -0.8, hostility: 0.7 });
    a.alliance = a.alliance.filter(id => id !== b.id); b.alliance = b.alliance.filter(id => id !== a.id);
    this.event('ALLIANCE_BROKEN', a, b, `${a.name} and ${b.name}'s alliance ended: ${cause}.`, { cause }, 0.8, { alliance: false });
  }
  kill(a, killer = null, cause = 'environment') {
    if (!a.alive) return;
    a.alive = false; a.hp = 0; a.diedAt = this.elapsed; a.action = 'dead'; a.goal = 'Eliminated';
    if (killer) { killer.stats.kills++; killer.inventory.food += a.inventory.food; killer.inventory.medicine += a.inventory.medicine; }
    for (const id of [...a.alliance]) { const b = this.agents.find(b => b.id === id); if (b) this.breakAlliance(a, b, 'death'); }
    this.event('DEATH', killer ?? a, killer ? a : null, killer ? `${killer.name} eliminated ${a.name}.` : `${a.name} succumbed to ${cause}.`, { cause, victim: a.id }, 1);
  }
  tick(dt = this.config.tickSeconds) {
    if (this.status !== 'running') return;
    this.elapsed += dt;
    this.safeRadius = Math.max(1.6, 29 - this.elapsed / this.config.matchDuration * 27.4);
    if (this.elapsed > this.nextResource && this.resources.length < 55) {
      this.resources.push(createResource(this));
      this.nextResource = this.elapsed + (this.effects.food_crisis > this.elapsed ? 16.67 : 5);
    }
    for (const a of this.agents) {
      if (!a.alive) continue;
      a.hunger = clamp(a.hunger + dt * 0.2, 0, 100); a.energy = clamp(a.energy - dt * 0.1, 0, 100);
      if (a.hunger > 85) a.hp -= dt * (a.hunger - 80) * 0.045;
      if (a.infected && this.effects.plague > this.elapsed) a.hp -= dt * 0.65;
      if (distance(a.position, { x: 0, z: 0 }) > this.safeRadius) a.hp -= dt * (1.1 + this.elapsed / this.config.matchDuration * 2.5);
      // Late-round exposure is a world rule, independent of identities or scripted outcomes.
      if (this.elapsed > this.config.matchDuration) a.hp -= dt * (1.5 + (this.elapsed - this.config.matchDuration) * 0.015);
      if (a.hp <= 0) { this.kill(a, null, this.elapsed > this.config.matchDuration ? 'final exposure' : a.infected ? 'plague' : 'exposure or hunger'); continue; }
      if (this.elapsed >= a.nextDecision) { const d = chooseDecision(this, a); a.message = d.message ?? ''; a.nextDecision = this.elapsed + this.config.decisionInterval; }
      executeAction(this, a, dt);
      const alive = this.agents.filter(b => b.alive);
      if (alive.length <= 1) { this.finish(alive[0] ?? null); break; }
    }
    if (this.agents.filter(a => a.alive).length <= 1 && this.status === 'running') this.finish(this.agents.find(a => a.alive) ?? null);
    if (this.elapsed >= this.nextSnapshot) {
      this.timeline.push({ timestamp: +this.elapsed.toFixed(2), stats: this.stats(), agents: this.agents.map(a => ({ id: a.id, position: { ...a.position }, alive: a.alive, hp: +a.hp.toFixed(1), action: a.action })) });
      this.nextSnapshot = this.elapsed + 5;
    }
  }
  finish(winner) {
    this.status = 'finished'; this.winner = winner?.id ?? null;
    this.event('MATCH_ENDED', winner, null, winner ? `${winner.name} is the last survivor.` : 'No survivors remain.', {}, 1);
    this.history = generateHistory(this.bus.log, this.agents, winner, this.elapsed);
  }
  director(type) {
    if (!DIRECTOR_EVENTS.includes(type)) throw new Error('Unknown director event');
    if (this.status === 'finished') throw new Error('Start a new simulation to change the world');
    let description;
    switch (type) {
      case 'food_crisis': this.effects.food_crisis = this.elapsed + 90; this.nextResource = Math.max(this.nextResource, this.elapsed + 16.67); description = 'Food crisis: supply regeneration reduced by 70% for 90 seconds.'; break;
      case 'supply_drop': for (let i = 0; i < 9; i++) this.resources.push(createResource(this, i % 3 === 0 ? 'weapon' : i % 3 === 1 ? 'medicine' : 'food', { x: (this.rng() - 0.5) * 5, z: (this.rng() - 0.5) * 5 })); description = 'A rare supply drop landed at the central beacon.'; break;
      case 'storm': this.effects.storm = this.elapsed + 60; description = 'Storm: movement speed reduced for 60 seconds.'; break;
      case 'rumor': {
        const living = this.agents.filter(a => a.alive);
        const target = living[Math.floor(this.rng() * living.length)];
        description = `${target.name} may be hiding a large amount of food.`; this.effects.rumor = description;
        for (const a of living) if (a !== target) { changeRelation(a, target, { trust: -0.08, hostility: a.personality.greed * 0.12 }); remember(a, { actor: 'WORLD', result: description, timestamp: this.elapsed, event: 'RUMOR' }, -0.2, 0.75); }
        break;
      }
      case 'treasure': for (let i = 0; i < 6; i++) this.resources.push(createResource(this, i % 2 ? 'relic' : 'medicine')); description = 'Rare relics and medicine have appeared across the island.'; break;
      case 'plague': this.effects.plague = this.elapsed + 80; for (const a of this.agents.filter(a => a.alive)) a.infected = this.rng() < 0.45; description = 'Plague: exposed survivors lose health until treated or the outbreak ends.'; break;
    }
    this.event(type.toUpperCase(), null, null, description, { duration: type === 'food_crisis' ? 90 : type === 'storm' ? 60 : type === 'plague' ? 80 : 0 }, 0.9);
  }
  stats() {
    const alive = this.agents.filter(a => a.alive);
    const counts = {};
    for (const e of this.bus.log) counts[e.event] = (counts[e.event] ?? 0) + 1;
    const pairs = this.agents.flatMap(a => Object.values(a.relationships));
    const rank = score => [...this.agents].sort((a, b) => score(b) - score(a))[0]?.name ?? '—';
    const received = (a, key) => this.agents.reduce((s, b) => s + (b.relationships[a.id]?.[key] ?? 0), 0) / Math.max(1, this.agents.length - 1);
    return { alive: alive.length, deaths: this.agents.length - alive.length, kills: this.agents.reduce((s, a) => s + a.stats.kills, 0), trades: counts.TRADE ?? 0,
      alliances: counts.ALLIANCE_CREATED ?? 0, activeAlliances: this.agents.reduce((s, a) => s + a.alliance.length, 0) / 2,
      betrayals: counts.BETRAYAL ?? 0, conversations: counts.CONVERSATION ?? 0, cooperation: counts.COOPERATION ?? 0,
      averageTrust: pairs.length ? pairs.reduce((s, r) => s + r.trust, 0) / pairs.length : 0,
      mostTrusted: rank(a => received(a, 'trust')), mostFeared: rank(a => received(a, 'fear')),
      mostAggressive: rank(a => a.stats.attacks), mostSocial: rank(a => a.stats.conversations + a.stats.trades), counts };
  }
  snapshot() {
    return { matchId: this.matchId, seed: this.config.seed, elapsed: +this.elapsed.toFixed(2), duration: this.config.matchDuration,
      status: this.status, safeRadius: this.safeRadius, agents: this.agents, resources: this.resources, zones: ZONES, effects: this.effects,
      stats: this.stats(), events: this.bus.log.slice(-100), eventCount: this.bus.log.length, winner: this.winner, history: this.history };
  }
  export() { return { schemaVersion: 1, ...this.snapshot(), events: this.bus.log, timeline: this.timeline, config: this.config }; }
}
