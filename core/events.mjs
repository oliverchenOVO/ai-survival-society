export class EventBus {
  constructor() { this.listeners = new Set(); this.log = []; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event) {
    const entry = { id: this.log.length + 1, ...event };
    this.log.push(entry);
    for (const listener of this.listeners) listener(entry);
    return entry;
  }
}
export function remember(agent, event, emotionalImpact = 0, importance = 0.5) {
  agent.memory.push({ who: event.actor, what: event.result, when: event.timestamp, event: event.event, importance, emotionalImpact });
  if (agent.memory.length > 40) {
    const index = agent.memory.reduce((best, m, i, all) => m.importance < all[best].importance ? i : best, 0);
    agent.memory.splice(index, 1);
  }
}
