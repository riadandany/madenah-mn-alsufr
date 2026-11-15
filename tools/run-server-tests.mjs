// يشغّل اختبارات السيرفر (tests/*_test.cjs) واحداً واحداً. الاستخدام: node tools/run-server-tests.mjs [جزء من الاسم]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
const only = process.argv[2];
const knownFile = path.join(TESTS, 'known-failing.txt');
const known = new Set(
  fs.existsSync(knownFile)
    ? fs.readFileSync(knownFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
    : []
);
const files = fs.readdirSync(TESTS).filter(f => f.endsWith('_test.cjs') && (!only || f.includes(only))).sort();

let failed = 0, passed = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join('tests', f), 'server.js'], { cwd: ROOT, encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = [...out.matchAll(/(\d+) PASS \/ (\d+) FAIL/g)].pop() || [...out.matchAll(/(\d+) passed, (\d+) failed/g)].pop();
  const pass = m ? +m[1] : 0, fail = m ? +m[2] : 1;
  passed += pass;
  const ok = !!m && fail === 0;
  const status = ok ? 'PASS' : known.has(f) ? 'KNOWN-FAIL' : 'FAIL';
  console.log(`${status.padEnd(10)} ${f}  ${pass} ok / ${fail} fail  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (status === 'FAIL') {
    failed++;
    console.log(out.split('\n').filter(l => /FAIL|✗|Error/.test(l)).slice(0, 8).join('\n'));
  }
}
console.log(`\n${files.length} ملف، ${passed} فحص ناجح، ${failed} ملف فاشل`);
process.exit(failed ? 1 : 0);
