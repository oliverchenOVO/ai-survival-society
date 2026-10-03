import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Check the actual unpacked payload, not only the package version label.
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const files = ['desktop/main.cjs', 'dist/index.html', 'public/assets/world-collision.json'];
for (const dir of ['core', 'server', 'src/i18n', 'src/story', 'config', 'dist/assets']) {
  const extension = dir.startsWith('src/') ? /\.mjs$/ : /\.(mjs|json|js|css|glb)$/;
  for (const name of fs.readdirSync(dir)) if (extension.test(name)) files.push(dir + '/' + name);
}
const hash = (data) => createHash('sha256').update(data).digest('hex');
const matchedFiles = files.map((file) => {
  const source = hash(fs.readFileSync(file));
  const packed = hash(fs.readFileSync(path.join('builds/win-unpacked/resources/app', file)));
  assert.equal(source, packed, 'Packaged content differs: ' + file);
  return { file, sha256: source };
});
assert.equal(
  JSON.parse(fs.readFileSync('builds/win-unpacked/resources/app/package.json', 'utf8')).version,
  version,
);
const portable = `builds/AI-Survival-Society-${version}.exe`;
const report = {
  version,
  checkedRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim(),
  date: new Date().toISOString(),
  portable: {
    file: portable,
    bytes: fs.statSync(portable).size,
    sha256: hash(fs.readFileSync(portable)),
  },
  matchedFiles,
};
fs.writeFileSync(
  `docs/qa/package-integrity-v${version.split('.').slice(0, 2).join('.')}.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  'PASS packaged source and assets match',
  files.length,
  'files; portable SHA-256 recorded',
);
