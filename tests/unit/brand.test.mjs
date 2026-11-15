import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FORBIDDEN = /ماينكرافت|ماين كرافت|ماينكرفت|minecraft|mojang|creeper|كريبر/i;

function files() {
  const out = [path.join(ROOT, 'server.js'), path.join(ROOT, 'README.md')];
  const pub = path.join(ROOT, 'public');
  for (const f of fs.readdirSync(pub)) {
    const p = path.join(pub, f);
    if (fs.statSync(p).isFile() && /\.(js|html|css|json|webmanifest)$/.test(f)) out.push(p);
  }
  return out;
}

test('لا أسماء علامات تجارية بالكود المنشور', () => {
  const hits = [];
  for (const f of files()) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (FORBIDDEN.test(l)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});
