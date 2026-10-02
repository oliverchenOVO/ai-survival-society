import { ACTIONS } from '../core/utility.mjs';
import { clamp } from '../core/random.mjs';
export const proseLanguageInstruction = (language) =>
  language === 'zh-TW'
    ? ' Prefer Traditional Chinese (zh-TW) for message and public_reason only. Keep action enums and target IDs unchanged.'
    : ' Prefer English for message and public_reason only. Keep action enums and target IDs unchanged.';
export const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'target', 'message', 'public_reason'],
  properties: {
    action: { type: 'string', enum: ACTIONS },
    target: { type: ['string', 'null'] },
    message: { type: 'string', maxLength: 240 },
    public_reason: { type: 'string', maxLength: 240 },
  },
};
export function validateDecision(value, sim, agent) {
  if (!value || typeof value !== 'object' || !ACTIONS.includes(value.action))
    throw new Error('Invalid model action');
  if (
    Object.keys(value).some(
      (key) => !['action', 'target', 'message', 'public_reason'].includes(key),
    )
  )
    throw new Error('Unexpected model fields');
  if (
    typeof value.public_reason !== 'string' ||
    !value.public_reason.trim() ||
    typeof value.message !== 'string'
  )
    throw new Error('Missing public decision fields');
  const target = value.target ?? null;
  const social = ['talk', 'trade', 'ally', 'cooperate', 'deceive', 'steal', 'attack', 'betray'];
  if (
    target !== null &&
    (typeof target !== 'string' ||
      target === agent.id ||
      (!sim.agents.some((a) => a.id === target && a.alive) &&
        !sim.resources.some((r) => r.id === target)))
  )
    throw new Error('Invalid model target');
  if (social.includes(value.action) && !sim.agents.some((a) => a.id === target && a.alive))
    throw new Error('Social action needs a living target');
  if (value.action === 'forage' && !sim.resources.some((r) => r.id === target))
    throw new Error('Forage needs a resource');
  if (['eat', 'heal', 'rest', 'explore'].includes(value.action) && target !== null)
    throw new Error('Self action must have null target');
  return {
    action: value.action,
    target,
    message: value.message.slice(0, 240),
    public_reason: value.public_reason.slice(0, 240),
  };
}
export class ModelProvider {
  constructor(config) {
    this.config = config;
  }
  async request(messages, json = true, signal) {
    const { provider, endpoint, model, temperature, timeoutMs } = this.config;
    const options = {
      method: 'POST',
      signal: signal ?? AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json' },
    };
    if (provider === 'ollama') {
      options.body = JSON.stringify({
        model,
        messages,
        stream: false,
        format: json ? DECISION_SCHEMA : undefined,
        options: {
          temperature: clamp(temperature, 0, 2),
          num_predict: json ? 220 : 700,
          num_ctx: json ? 4096 : 16384,
        },
      });
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/chat`, options);
      if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
      const result = await response.json();
      return result.message?.content ?? '';
    }
    if (provider === 'compatible') {
      if (process.env.LLM_API_KEY)
        options.headers.Authorization = `Bearer ${process.env.LLM_API_KEY}`;
      options.body = JSON.stringify({
        model,
        messages,
        temperature: clamp(temperature, 0, 2),
        max_tokens: json ? 220 : 700,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      });
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, options);
      if (!response.ok) throw new Error(`Compatible provider HTTP ${response.status}`);
      const result = await response.json();
      return result.choices?.[0]?.message?.content ?? '';
    }
    throw new Error('Fallback provider uses utility AI without a model request');
  }
}
export class ModelQueue {
  constructor(config, getSimulation) {
    this.config = config;
    this.getSimulation = getSimulation;
    this.pending = [];
    this.active = 0;
    this.generation = 0;
    this.scheduled = new Set();
    this.controllers = new Set();
    this.status = {
      state: config.enabled ? 'ready' : 'disabled',
      requests: 0,
      completed: 0,
      failed: 0,
      discarded: 0,
      lastError: null,
      lastLatencyMs: null,
    };
  }
  configure(config) {
    this.reset();
    this.config = config;
    this.status.state = config.enabled ? 'ready' : 'disabled';
  }
  reset() {
    this.generation++;
    this.pending = [];
    this.scheduled.clear();
    for (const c of this.controllers) c.abort();
  }
  schedule(sim) {
    if (!this.config.enabled || this.config.provider === 'fallback' || sim.status !== 'running')
      return;
    for (const agent of sim.agents) {
      if (!agent.alive || sim.elapsed < agent.nextLLM || this.scheduled.has(agent.id)) continue;
      if (this.pending.length >= this.config.maxQueue) break;
      agent.nextLLM = sim.elapsed + this.config.intervalSeconds;
      this.scheduled.add(agent.id);
      this.pending.push({ sim, agent, generation: this.generation });
    }
    this.drain();
  }
  drain() {
    while (this.active < this.config.concurrency && this.pending.length) {
      const job = this.pending.shift();
      this.active++;
      this.run(job).finally(() => {
        this.active--;
        if (job.generation === this.generation) this.scheduled.delete(job.agent.id);
        this.drain();
      });
    }
  }
  async run({ sim, agent, generation }) {
    if (
      !agent.alive ||
      sim !== this.getSimulation() ||
      sim.status !== 'running' ||
      generation !== this.generation
    )
      return;
    this.status.requests++;
    this.status.state = 'thinking';
    const start = Date.now();
    const controller = new AbortController();
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const context = {
        name: agent.name,
        hp: agent.hp,
        hunger: agent.hunger,
        energy: agent.energy,
        personality: agent.personality,
        inventory: agent.inventory,
        relationships: agent.relationships,
        memory: agent.memory.slice(-5),
        choices: agent.utility,
        time: sim.elapsed,
        safeRadius: sim.safeRadius,
        nearby: sim.agents
          .filter((a) => a.alive && a.id !== agent.id)
          .map((a) => ({ id: a.id, name: a.name, hp: a.hp, position: a.position })),
        resources: sim.resources.slice(0, 8),
      };
      const content = await new ModelProvider(this.config).request(
        [
          {
            role: 'system',
            content: `You are a survival simulation character. Choose ONE of the provided utility choices, with a legal target ID. Return only JSON with action, target, message, public_reason. Public reason is a brief player-facing explanation, never private reasoning. Allowed actions: ${ACTIONS.join(', ')}. Do not invent resources or execute code. Use short natural dialogue. Reflect on recent memory in the public reason.${proseLanguageInstruction(this.config.responseLanguage)}`,
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
        true,
        controller.signal,
      );
      const clean = content.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
      const decision = validateDecision(JSON.parse(clean), sim, agent);
      if (
        generation !== this.generation ||
        sim !== this.getSimulation() ||
        !agent.alive ||
        sim.status !== 'running'
      ) {
        this.status.discarded++;
        return;
      }
      sim.modelDecisions.set(agent.id, { ...decision, time: sim.elapsed });
      agent.reflection = decision.public_reason;
      this.status.completed++;
      this.status.lastError = null;
    } catch (error) {
      this.status.failed++;
      this.status.lastError =
        error.name === 'AbortError' || error.name === 'TimeoutError'
          ? 'Model timed out; utility AI continues.'
          : String(error.message).slice(0, 160);
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
      this.status.lastLatencyMs = Date.now() - start;
      if (generation === this.generation)
        this.status.state = this.config.enabled ? 'ready' : 'disabled';
    }
  }
  snapshot() {
    return {
      ...this.status,
      pending: this.pending.length,
      active: this.active,
      enabled: this.config.enabled,
      provider: this.config.provider,
      model: this.config.model,
    };
  }
  async historian(sim) {
    if (!this.config.enabled || sim.status !== 'finished') return;
    try {
      // Every event is included, grouped into deterministic chapter facts to fit smaller model contexts.
      const grouped = {};
      for (const e of sim.bus.log) {
        const key = `${e.event}:${e.actor}:${e.target}`;
        const entry = (grouped[key] ??= {
          type: e.event,
          actor: e.actorName,
          target: e.targetName,
          count: 0,
          first: e.timestamp,
          last: e.timestamp,
          example: e.result,
        });
        entry.count++;
        entry.last = e.timestamp;
      }
      const output = await new ModelProvider(this.config).request(
        [
          {
            role: 'system',
            content:
              'Write a concise four-chapter history of this simulation based only on supplied event facts. No hidden reasoning. Under 450 words. Mention cooperation, scarcity, betrayal if recorded, and the final survivor. Plain text only.' +
              (this.config.responseLanguage === 'zh-TW'
                ? ' Prefer Traditional Chinese (zh-TW).'
                : ' Prefer English.'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              summary: sim.history.summary,
              eventCount: sim.bus.log.length,
              allEventGroups: Object.values(grouped),
            }),
          },
        ],
        false,
      );
      if (output.trim())
        sim.history = { ...sim.history, source: 'llm', narration: output.slice(0, 6000) };
    } catch {
      /* The event-derived template is already complete. */
    }
  }
}
