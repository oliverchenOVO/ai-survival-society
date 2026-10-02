import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
export class Preferences {
  constructor(root) {
    this.file = path.join(root, '.runtime', 'ui-preferences.json');
    this.language = 'zh-TW';
    this.chain = Promise.resolve();
  }
  async init() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (['zh-TW', 'en'].includes(value.language)) this.language = value.language;
    } catch {}
    return this;
  }
  async set(language) {
    if (!['zh-TW', 'en'].includes(language)) throw new Error('Unsupported interface language');
    const data = JSON.stringify({ schemaVersion: 1, language });
    this.chain = this.chain
      .catch(() => {})
      .then(async () => {
        await mkdir(path.dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', data);
        await rename(this.file + '.tmp', this.file);
        this.language = language;
      });
    await this.chain;
    return { language: this.language };
  }
}
