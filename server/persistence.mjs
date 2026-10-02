import { mkdir, writeFile, rename, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
export class Persistence {
  constructor(root, maxStored = 30) {
    this.root = root;
    this.maxStored = maxStored;
    this.chain = Promise.resolve();
  }
  async init() {
    await Promise.all(
      ['logs', 'saves'].map((p) => mkdir(path.join(this.root, p), { recursive: true })),
    );
  }
  persist(sim) {
    const data = sim.export();
    this.chain = this.chain
      .catch(() => {})
      .then(async () => {
        await this.init();
        for (const folder of ['logs', 'saves']) {
          const file = path.join(this.root, folder, `${data.matchId}.json`);
          await writeFile(
            `${file}.tmp`,
            JSON.stringify(
              folder === 'logs'
                ? { schemaVersion: 1, matchId: data.matchId, seed: data.seed, events: data.events }
                : data,
            ),
          );
          await rename(`${file}.tmp`, file);
        }
        await this.prune();
      });
    return this.chain;
  }
  async list() {
    await this.init();
    const files = (await readdir(path.join(this.root, 'saves')))
      .filter((f) => /^\d+-\d+\.json$/.test(f))
      .sort()
      .reverse();
    const results = await Promise.all(
      files.slice(0, this.maxStored).map(async (file) => {
        try {
          const data = JSON.parse(await readFile(path.join(this.root, 'saves', file), 'utf8'));
          return {
            id: data.matchId,
            seed: data.seed,
            status: data.status,
            outcome:
              data.outcome ??
              (data.status === 'finished' ? { kind: data.winner ? 'winner' : 'extinction' } : null),
            elapsed: data.elapsed,
            winner: data.agents.find((a) => a.id === data.winner)?.name ?? null,
            events: data.events.length,
          };
        } catch {
          return null;
        }
      }),
    );
    return results.filter(Boolean);
  }
  async read(id) {
    if (!/^\d+-\d+$/.test(id)) throw new Error('Invalid replay ID');
    return JSON.parse(await readFile(path.join(this.root, 'saves', `${id}.json`), 'utf8'));
  }
  async prune() {
    for (const folder of ['logs', 'saves']) {
      const files = (await readdir(path.join(this.root, folder)))
        .filter((f) => /^\d+-\d+\.json$/.test(f))
        .sort()
        .reverse();
      await Promise.all(
        files.slice(this.maxStored).map((file) => unlink(path.join(this.root, folder, file))),
      );
    }
  }
}
