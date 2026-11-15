// اختبار API لسيرفر مدينة — يشغّل السيرفر على ملف بيانات مؤقت
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SERVER = process.argv[2];
import { fileURLToPath } from 'node:url';
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'madinah_test_houses.json');
// بيت قديم بدون رمز (مثل بيت «محمد» الحالي)
fs.writeFileSync(DATA, JSON.stringify([{ id: 'old0000001', plot: 21, type: 0, name: 'قديم', t: 1, dev: 'olddevice-123', ip: 'x', days: 1, last: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), lk: [] }, { id: 'rich000001', plot: 22, type: 3, name: 'غني', t: 1, dev: 'richdevice-12', ip: 'y', days: 30, last: '2000-01-01', lk: [] }]));
const PORT = 3999, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok' }, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
await new Promise(r => srv.stdout.once('data', r));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const post = (u, b, ip = '10.0.0.1') => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, d: await r.json() }));

try {
  // ملفات ثابتة + ترويسات
  let r = await fetch(B + '/');
  ok(r.status === 200 && (r.headers.get('content-security-policy') || '').includes("script-src 'self'"), 'index.html + CSP');
  ok(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff');
  r = await fetch(B + '/Cairo.woff2?v=1'); ok(r.status === 200 && r.headers.get('content-type') === 'font/woff2' && /immutable/.test(r.headers.get('cache-control')), 'woff2 immutable');
  r = await fetch(B + '/app.js?v=2'); ok(r.status === 200, 'app.js');
  r = await fetch(B + '/..%2fserver.js'); ok(r.status === 403 || r.status === 404, 'path traversal blocked: ' + r.status);
  r = await fetch(B + '/%E0%A4%A'); ok(r.status === 400, 'bad uri → 400 (no crash)');

  // الهجرة: البيت القديم صار له lki
  r = await fetch(B + '/api/houses'); const et = r.headers.get('etag'); let d = await r.json();
  ok(d.count === 2 && et, 'houses + etag ' + et);
  r = await fetch(B + '/api/houses', { headers: { 'If-None-Match': et } }); ok(r.status === 304, 'ETag → 304');

  // بناء
  let x = await post('/api/house', { name: 'سالم', plot: 0, device: 'devA-123456' });
  ok(x.s === 400 && /رمز/.test(x.d.error), 'build without pin rejected');
  x = await post('/api/house', { name: 'سالم', pin: '١٢٣٤', plot: 0, device: 'devA-123456' });
  ok(x.s === 200 && x.d.hasPin, 'build with pin (arabic digits)');
  const A = x.d.house.id;
  x = await post('/api/house', { name: 'ثاني', pin: '9999', plot: 190, device: 'devZ-123456' });
  ok(x.s === 200, 'capacity ≥ 192 plots (plot 190 ok)');
  x = await post('/api/house', { name: 'بعيد', pin: '9999', plot: 400, device: 'devY-123456' });
  ok(x.s === 400, 'plot out of capacity rejected');
  r = await fetch(B + '/api/houses', { headers: { 'If-None-Match': et } }); ok(r.status === 200, 'etag changes after build');

  // أسماء
  for (const bad of ['شـرمـوط', 'fuuuck', 'sh1t', 'f u c k']) { x = await post('/api/house', { name: bad, pin: '1111', plot: 5, device: 'devbad-' + bad.length + Math.random() }, '10.9.9.9'); ok(x.s === 400, 'bad name blocked: ' + bad); }
  x = await post('/api/house', { name: 'زبير', pin: '1111', plot: 6, device: 'devzubair-1' }, '10.7.7.7'); ok(x.s === 200, 'زبير allowed');

  // الشخصيات
  r = await fetch(B + '/api/houses'); d = await r.json();
  ok(d.houses.find(h => h.id === 'old0000001').ch === 0, 'old house migrated to default char 0');
  ok(d.houses.find(h => h.id === A).ch === 0, 'build without ch → 0');
  x = await post('/api/house', { name: 'بشخصية', pin: '1111', plot: 7, device: 'devch-123456', ch: 7 }, '10.8.8.8'); ok(x.s === 200 && x.d.house.ch === 7, 'build with ch 7');
  x = await post('/api/char', { device: 'devch-123456', ch: 9 }); ok(x.s === 200 && x.d.house.ch === 9, 'change char → 9');
  x = await post('/api/char', { device: 'devch-123456', ch: 10 }); ok(x.s === 400, 'char out of range rejected');
  x = await post('/api/char', { device: 'devch-123456', ch: '3' }); ok(x.s === 400, 'char non-integer rejected');
  x = await post('/api/char', { device: 'nohouse-123456', ch: 2 }); ok(x.s === 403, 'char without house rejected');
  x = await post('/api/house', { name: 'غلط', pin: '1111', plot: 8, device: 'devch2-123456', ch: 99 }, '10.8.8.9'); ok(x.s === 200 && x.d.house.ch === 0, 'bad ch on build → default 0');

  // الجوائز والتخصيص
  ok(d.houses.find(h => h.id === 'old0000001').st.join() === '0,0,0,0,0', 'migrated st default');
  x = await post('/api/mine', { device: 'richdevice-12' }); ok(x.d.newDay === undefined && x.d.days === 31 && x.d.unl.length === 26 && x.d.rw === null && x.d.nrw === null, 'rich: days 31, all 26 unlocked, no more rewards');
  x = await post('/api/mine', { device: 'olddevice-123' }); ok(x.d.days >= 1 && x.d.unl.includes('h1') && !x.d.unl.includes('c1'), 'day-1 house has only h1');
  x = await post('/api/style', { device: 'olddevice-123', st: [1,0,0,0,0] }); ok(x.s === 200 && x.d.house.st[0] === 1, 'style: unlocked hat ok');
  x = await post('/api/style', { device: 'olddevice-123', st: [0,0,0,1,0] }); ok(x.s === 400, 'style: locked house color refused');
  x = await post('/api/style', { device: 'olddevice-123', st: [7,0,0,0,0] }); ok(x.s === 400, 'style: out of range refused');
  x = await post('/api/style', { device: 'olddevice-123', st: [1,0,0] }); ok(x.s === 400, 'style: bad shape refused');
  x = await post('/api/style', { device: 'olddevice-123', st: ['1',0,0,0,0] }); ok(x.s === 400, 'style: non-integer refused');
  x = await post('/api/style', { device: 'nobody-123456', st: [0,0,0,0,0] }); ok(x.s === 403, 'style: no house refused');
  x = await post('/api/style', { device: 'richdevice-12', st: [6,4,6,6,4] }); ok(x.s === 200 && x.d.house.st.join() === '6,4,6,6,4', 'style: rich unlocks everything');
  r = await fetch(B + '/api/houses'); d = await r.json(); ok(d.houses.find(h => h.id === 'rich000001').st.join() === '6,4,6,6,4', 'style persisted in /api/houses');

  // mine
  x = await post('/api/mine', { device: 'devA-123456' }); ok(x.d.house.id === A && x.d.hasPin === true, 'mine hasPin');
  x = await post('/api/mine', { device: 'olddevice-123' }); ok(x.d.house && x.d.hasPin === false, 'old house hasPin=false');

  // claim
  x = await post('/api/claim', { id: A, pin: '0000', device: 'devB-123456' }, '10.0.0.2'); ok(x.s === 403 && /غير صحيح/.test(x.d.error), 'claim wrong pin');
  x = await post('/api/claim', { id: A, pin: '1234', device: 'devB-123456' }, '10.0.0.2'); ok(x.s === 200, 'claim right pin');
  x = await post('/api/mine', { device: 'devA-123456' }); ok(!x.d.house, 'old device lost house');
  x = await post('/api/mine', { device: 'devB-123456' }); ok(x.d.house && x.d.house.id === A, 'new device owns house');
  x = await post('/api/claim', { id: 'old0000001', pin: '1234', device: 'devC-123456' }, '10.0.0.3'); ok(x.s === 403 && /ما له رمز/.test(x.d.error), 'claim house without pin');

  // pin for old house
  x = await post('/api/pin', { device: 'devC-123456', pin: '5555' }); ok(x.s === 403, 'set pin from non-owner rejected');
  x = await post('/api/pin', { device: 'olddevice-123', pin: '5555' }); ok(x.s === 200, 'owner sets pin on old house');
  x = await post('/api/pin', { device: 'olddevice-123', pin: '6666', old: '0000' }); ok(x.s === 403, 'change pin needs old pin');
  x = await post('/api/mine', { device: 'olddevice-123' }); ok(x.d.hasPin === true, 'old house now hasPin');

  // manage
  x = await post('/api/manage', { id: A, pin: '1234', action: 'rename', name: 'سالم الجديد' }); ok(x.s === 200 && x.d.house.name === 'سالم الجديد', 'rename');
  x = await post('/api/manage', { id: A, pin: '1234', action: 'rename', name: 'شرموط' }); ok(x.s === 400, 'rename bad name blocked');
  x = await post('/api/manage', { id: A, pin: '9', action: 'delete' }); ok(x.s === 403, 'delete wrong pin');

  // likes per network
  for (let i = 0; i < 3; i++) { x = await post('/api/like', { id: A, device: 'liker-' + i + '-xxxx' }, '10.5.5.5'); }
  ok(x.s === 200 && x.d.likes === 3, '3 likes from one network');
  x = await post('/api/like', { id: A, device: 'liker-9-xxxx' }, '10.5.5.5'); ok(x.s === 409, '4th like same network blocked');
  x = await post('/api/like', { id: A, device: 'liker-9-xxxx' }, '10.6.6.6'); ok(x.s === 200 && x.d.likes === 4, 'like from other network ok');
  x = await post('/api/like', { id: A, device: 'liker-0-xxxx' }, '10.5.5.5'); ok(x.s === 200 && !x.d.liked && x.d.likes === 3, 'unlike frees slot');

  // lockout: 10 wrong per house per day
  const Z = (await post('/api/mine', { device: 'devZ-123456' })).d.house.id;
  let last;
  for (let i = 0; i < 11; i++) last = await post('/api/claim', { id: Z, pin: 'wrong' + i, device: 'thief-123456' }, '10.200.0.' + i);
  ok(last.s === 403 && /بكرة/.test(last.d.error), 'house locked after 10 wrong pins');
  x = await post('/api/claim', { id: Z, pin: '9999', device: 'thief-123456' }, '10.201.0.1'); ok(x.s === 403, 'even right pin refused while locked');

  // per-network limiter on pin ops (15 / 10 min)
  let lim;
  for (let i = 0; i < 16; i++) lim = await post('/api/manage', { id: A, pin: 'nope' + i, action: 'rename', name: 'aa' }, '10.123.0.1');
  ok(lim.s === 429, 'pin ops rate-limited per network');

  // IPv6: نفس /64 = نفس الشبكة
  for (let i = 1; i <= 3; i++) { x = await post('/api/house', { name: 'ستة' + 'ا'.repeat(i), pin: '1111', plot: 100 + i, device: 'v6dev-' + i + '-xxxx' }, '2a02:9b0:4058:5310::' + i.toString(16) + ':abcd'); ok(x.s === 200, 'v6 house ' + i); }
  x = await post('/api/house', { name: 'ستةرابع', pin: '1111', plot: 110, device: 'v6dev-4-xxxx' }, '2a02:9b0:4058:5310:ffff:1:2:3'); ok(x.s === 409, '4th house same /64 blocked');
  x = await post('/api/house', { name: 'ستةثاني', pin: '1111', plot: 111, device: 'v6dev-5-xxxx' }, '2a02:9b0:4058:5311::1'); ok(x.s === 200, 'other /64 allowed');

  // admin delete
  r = await fetch(B + '/api/house/' + A + '?token=wrong', { method: 'DELETE' }); ok(r.status === 403, 'admin wrong token');
  r = await fetch(B + '/api/house/' + A + '?token=admintok', { method: 'DELETE' }); ok((await r.json()).removed === 1, 'admin delete');

  // manage delete by owner
  x = await post('/api/manage', { id: 'old0000001', pin: '5555', action: 'delete' }); ok(x.s === 200, 'owner delete with pin');

  // persistence: pins hashed, not stored plain
  await new Promise(r => setTimeout(r, 900));
  const raw = fs.readFileSync(DATA, 'utf8');
  ok(!raw.includes('"9999"') && raw.includes('"ph"'), 'pins stored hashed');
} finally {
  srv.kill('SIGTERM');
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
