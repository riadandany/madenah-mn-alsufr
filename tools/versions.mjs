// حارس ?v= : لكل ملف بـpublic/ مرجَع بـ"/اسم.js?v=N" نحفظ بصمته. لو تغيّر الملف بدون رفع الرقم، الفحص يفشل.
// bump: يرفع رقم كل ملف تغيّر، ويحدّث كل المراجع (ويكمل سلسلة: لو app.js تغيّر بسبب استيراد، يُرفع هو كمان).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REF = /(\/[A-Za-z0-9_.-]+)\?v=(\d+)/g;
// البصمة بعد توحيد نهايات الأسطر: نفس النتيجة على ويندوز وCI
const sha = buf => crypto.createHash('sha256').update(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1').digest('hex').slice(0, 16);
const read = (dir, name) => fs.readFileSync(path.join(dir, name));
const sources = dir => fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f));

export function scanRefs(dir) {
  const refs = new Map();
  for (const f of sources(dir)) {
    const s = read(dir, f).toString('latin1');
    for (const m of s.matchAll(REF)) {
      const name = m[1].slice(1);
      if (fs.existsSync(path.join(dir, name))) refs.set(name, Math.max(refs.get(name) || 0, +m[2]));
    }
  }
  return refs;
}

const load = p => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const save = (p, m) => fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');

export function init(dir, manifestPath) {
  const m = {};
  for (const [name, v] of scanRefs(dir)) m[name] = { v, hash: sha(read(dir, name)) };
  save(manifestPath, m);
  return m;
}

export function verify(dir, manifestPath) {
  const m = load(manifestPath), stale = [];
  for (const [name] of scanRefs(dir)) if (!m[name] || m[name].hash !== sha(read(dir, name))) stale.push(name);
  return stale;
}

function rewrite(dir, name, v) {
  const re = new RegExp('(/' + name.replace(/\./g, '\\.') + ')\\?v=\\d+', 'g');
  for (const f of sources(dir)) {
    const s = read(dir, f).toString('latin1'), t = s.replace(re, '$1?v=' + v);
    if (t !== s) fs.writeFileSync(path.join(dir, f), Buffer.from(t, 'latin1'));
  }
}

export function bump(dir, manifestPath) {
  const m = load(manifestPath), bumped = [];
  for (let round = 0; round < 10; round++) {
    let changed = false;
    for (const [name, refV] of scanRefs(dir)) {
      const h = sha(read(dir, name));
      if (!m[name]) { m[name] = { v: refV, hash: h }; changed = true; continue; }
      if (m[name].hash !== h) {
        m[name] = { v: m[name].v + 1, hash: h };
        rewrite(dir, name, m[name].v);
        bumped.push(name);
        changed = true;
      }
    }
    if (!changed) break;
  }
  save(manifestPath, m);
  return bumped;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const PUB = path.join(ROOT, 'public'), MAN = path.join(ROOT, 'tools', 'versions.json');
  const cmd = process.argv[2];
  if (cmd === 'init') { init(PUB, MAN); console.log('manifest created'); }
  else if (cmd === 'bump') { const b = bump(PUB, MAN); console.log(b.length ? 'bumped: ' + b.join(', ') : 'nothing to bump'); }
  else if (cmd === 'check') {
    const s = verify(PUB, MAN);
    if (s.length) { console.error('stale: ' + s.join(', ')); process.exit(1); }
    console.log('versions ok');
  } else { console.error('usage: versions.mjs init|bump|check'); process.exit(2); }
}
