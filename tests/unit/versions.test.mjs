import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init, verify, bump } from '../../tools/versions.mjs';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ver-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/app.js?v=1"></script>\n');
  fs.writeFileSync(path.join(dir, 'app.js'), "import {a} from '/a.js?v=1';\nconsole.log(a);\n");
  fs.writeFileSync(path.join(dir, 'a.js'), 'export const a = 1;\n');
  return { dir, man: path.join(dir, 'versions.json') };
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('بعد init كل شي نظيف', () => {
  const { dir, man } = fixture();
  init(dir, man);
  assert.deepEqual(verify(dir, man), []);
});

test('تعديل ملف بدون bump يظهر كمتأخر', () => {
  const { dir, man } = fixture();
  init(dir, man);
  fs.writeFileSync(path.join(dir, 'a.js'), 'export const a = 2;\n');
  assert.deepEqual(verify(dir, man), ['a.js']);
});

test('bump يرفع الرقم ويمشي على كل من يستورده', () => {
  const { dir, man } = fixture();
  init(dir, man);
  fs.writeFileSync(path.join(dir, 'a.js'), 'export const a = 2;\n');
  const bumped = bump(dir, man);
  assert.deepEqual(bumped.sort(), ['a.js', 'app.js']);
  assert.match(read(dir, 'app.js'), /\/a\.js\?v=2/);
  assert.match(read(dir, 'index.html'), /\/app\.js\?v=2/);
  assert.deepEqual(verify(dir, man), []);
});

test('bump مرة ثانية بدون تغيير ما يسوي شي', () => {
  const { dir, man } = fixture();
  init(dir, man);
  fs.writeFileSync(path.join(dir, 'a.js'), 'export const a = 2;\n');
  bump(dir, man);
  assert.deepEqual(bump(dir, man), []);
});

test('استيراد ملف جديد يُسجَّل ويرفع رقم من استورده', () => {
  const { dir, man } = fixture();
  init(dir, man);
  fs.writeFileSync(path.join(dir, 'b.js'), 'export const b = 1;\n');
  fs.writeFileSync(path.join(dir, 'app.js'), "import {a} from '/a.js?v=1';\nimport {b} from '/b.js?v=1';\n");
  const bumped = bump(dir, man);
  assert.ok(bumped.includes('app.js'));
  assert.deepEqual(verify(dir, man), []);
});
