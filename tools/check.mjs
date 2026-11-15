// فحص سريع قبل أي رفع: صياغة كل ملفات JS + إصدارات ?v= (لو عدّلت ملف بدون bump يفشل)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verify } from './versions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'madinah-check-'));
let bad = 0;

const isModule = s => /^\s*(import|export)\s/m.test(s);

function syntax(file, asModule) {
  const probe = path.join(tmp, path.basename(file) + (asModule ? '.mjs' : '.cjs'));
  fs.writeFileSync(probe, fs.readFileSync(file));
  const r = spawnSync(process.execPath, ['--check', probe], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad++;
    console.error('✗ syntax:', path.relative(ROOT, file) + '\n' + r.stderr.split('\n').slice(0, 6).join('\n'));
  }
}

syntax(path.join(ROOT, 'server.js'), false);
for (const f of fs.readdirSync(PUB)) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(PUB, f);
  syntax(p, isModule(fs.readFileSync(p, 'latin1')));
}
for (const s of verify(PUB, path.join(ROOT, 'tools', 'versions.json'))) {
  bad++;
  console.error('✗ ملف تغيّر بدون رفع ?v= :', s, '  → شغّل: npm run versions:bump');
}
fs.rmSync(tmp, { recursive: true, force: true });
if (bad) { console.error(`\nفشل الفحص: ${bad} مشكلة`); process.exit(1); }
console.log('✓ الفحص نظيف');
