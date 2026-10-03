import { mkdir, writeFile, rename, readdir, readFile, unlink, stat } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { buildFacts, validateSave, publicStory } from '../src/story/facts.mjs';
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const encode = (bytes) => {
  let bits = 0,
    value = 0,
    out = 'S-';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31];
    }
  }
  return out;
};
export const newStoryId = () => encode(randomBytes(10));
export const legacyStoryId = (id) =>
  encode(createHash('sha256').update(id).digest().subarray(0, 10));
export const validId = (id) => /^S-[0-9A-HJKMNP-TV-Z]{16}$/.test(id) || /^\d+-\d+$/.test(id);
const validFile = (f) => validId(f.replace(/\.json$/, '')) && f.endsWith('.json');
export class Persistence {
  constructor(root, maxStored = 30) {
    this.root = root;
    this.maxStored = maxStored;
    this.chain = Promise.resolve();
    this.identities = new WeakMap();
    this.deleted = new Set();
    this.index = new Map();
    this.records = new Map();
  }
  async atomic(file, data) {
    await writeFile(file + '.tmp', JSON.stringify(data));
    await rename(file + '.tmp', file);
  }
  async init() {
    await Promise.all(
      ['logs', 'saves'].map((p) => mkdir(path.join(this.root, p), { recursive: true })),
    );
    try {
      this.deleted = new Set(
        JSON.parse(await readFile(path.join(this.root, 'saves', '.deleted.json'), 'utf8')),
      );
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    for (const file of (await readdir(path.join(this.root, 'saves'))).filter(validFile)) {
      try {
        let d = JSON.parse(await readFile(path.join(this.root, 'saves', file), 'utf8'));
        validateSave(d);
        const id = d.simulation_id ?? legacyStoryId(d.matchId);
        if (this.deleted.has(id)) continue;
        if (!d.simulation_id || (d.status === 'finished' && !d.story)) {
          d.simulation_id = id;
          if (d.status === 'finished')
            d.story = buildFacts(d, {
              simulationId: id,
              simulationVersion: 'legacy',
              startedAt: new Date(Number(d.matchId.split('-')[0])).toISOString(),
              finishedAt: null,
            });
          await this.atomic(path.join(this.root, 'saves', file), d);
        }
        this.index.set(id, file);
        this.index.set(d.matchId, file);
        this.records.set(file, { status: d.status, date: d.startedAt ?? d.matchId.split('-')[0] });
      } catch {
        this.index.set(file.replace(/\.json$/, ''), file);
      }
    }
  }
  identity(sim) {
    if (!this.identities.has(sim))
      this.identities.set(sim, {
        simulationId: newStoryId(),
        startedAt: new Date().toISOString(),
        simulationVersion: '1.5.0',
        finishedAt: null,
      });
    return this.identities.get(sim);
  }
  capture(sim) {
    const metadata = this.identity(sim);
    const data = structuredClone(sim.export());
    data.simulation_id = metadata.simulationId;
    data.startedAt = metadata.startedAt;
    if (data.status === 'finished') {
      metadata.finishedAt ??= new Date().toISOString();
      metadata.story ??= buildFacts(data, metadata);
      data.story = metadata.story;
    }
    return data;
  }
  persist(sim) {
    const data = this.capture(sim);
    this.chain = this.chain
      .catch(() => {})
      .then(async () => {
        if (this.deleted.has(data.simulation_id)) return;
        const file = data.simulation_id + '.json';
        await this.atomic(path.join(this.root, 'saves', file), data);
        await this.atomic(path.join(this.root, 'logs', file), {
          schemaVersion: 1,
          matchId: data.matchId,
          simulation_id: data.simulation_id,
          seed: data.seed,
          events: data.events,
        });
        this.index.set(data.simulation_id, file);
        this.index.set(data.matchId, file);
        this.records.set(file, {
          status: data.status,
          date: data.startedAt ?? data.matchId.split('-')[0],
        });
        await this.prune();
      });
    return this.chain;
  }
  async read(id) {
    if (!validId(id)) throw new Error('Invalid story ID');
    await this.chain.catch(() => {});
    if (this.deleted.has(id)) {
      const e = new Error('Story deleted');
      e.status = 410;
      throw e;
    }
    const file = this.index.get(id);
    if (!file) {
      const e = new Error('Story not found');
      e.status = 404;
      throw e;
    }
    try {
      return validateSave(JSON.parse(await readFile(path.join(this.root, 'saves', file), 'utf8')));
    } catch (e) {
      e.status = e.code === 'ENOENT' ? 404 : 422;
      throw e;
    }
  }
  async story(id) {
    return publicStory(await this.read(id));
  }
  async list() {
    await this.chain.catch(() => {});
    const files = [...new Set(this.index.values())];
    const results = [];
    for (const file of files) {
      try {
        const d = validateSave(
          JSON.parse(await readFile(path.join(this.root, 'saves', file), 'utf8')),
        );
        if (this.deleted.has(d.simulation_id)) continue;
        results.push({
          id: d.simulation_id,
          matchId: d.matchId,
          seed: d.seed,
          status: d.status,
          resumable: Boolean(d.world && d.checkpoint && d.status !== 'finished'),
          outcome: d.story?.outcome ?? d.outcome ?? null,
          elapsed: d.elapsed,
          winner: d.agents.find((a) => a.id === d.winner)?.name ?? null,
          events: d.events.length,
          date: d.story?.finishedAt ?? d.story?.startedAt ?? d.startedAt ?? null,
          stats: Object.fromEntries(
            ['kills', 'trades', 'alliances', 'betrayals'].map((k) => [k, d.stats[k] ?? 0]),
          ),
        });
      } catch {
        results.push({ id: file.replace(/\.json$/, ''), status: 'corrupt', error: true });
      }
    }
    return results.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }
  remove(id) {
    if (!validId(id)) return Promise.reject(new Error('Invalid story ID'));
    this.chain = this.chain
      .catch(() => {})
      .then(async () => {
        const file = this.index.get(id);
        if (!file) {
          const e = new Error('Story not found');
          e.status = 404;
          throw e;
        }
        const canonical = file.startsWith('S-')
          ? file.replace('.json', '')
          : legacyStoryId(file.replace('.json', ''));
        this.deleted.add(canonical);
        await this.atomic(path.join(this.root, 'saves', '.deleted.json'), [...this.deleted]);
        for (const folder of ['saves', 'logs'])
          await unlink(path.join(this.root, folder, file)).catch((e) => {
            if (e.code !== 'ENOENT') throw e;
          });
        for (const [key, value] of this.index) if (value === file) this.index.delete(key);
        this.records.delete(file);
      });
    return this.chain;
  }
  async prune() {
    const files = [...new Set(this.index.values())];
    const unfinished = [];
    for (const file of files) {
      const record = this.records.get(file);
      if (record && record.status !== 'finished') unfinished.push({ file, date: record.date });
    }
    for (const { file } of unfinished
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(this.maxStored)) {
      await unlink(path.join(this.root, 'saves', file));
      this.records.delete(file);
      for (const [key, value] of this.index) if (value === file) this.index.delete(key);
    }
    const logs = await Promise.all(
      (await readdir(path.join(this.root, 'logs'))).filter(validFile).map(async (file) => ({
        file,
        time: (await stat(path.join(this.root, 'logs', file))).mtimeMs,
      })),
    );
    await Promise.all(
      logs
        .sort((a, b) => b.time - a.time)
        .slice(this.maxStored)
        .map(({ file }) => unlink(path.join(this.root, 'logs', file))),
    );
  }
}
