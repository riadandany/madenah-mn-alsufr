// اختبار سيارات الحوش المحفوظة: صاحب البيت يركن/يسحب، الكل يشوف، تنحفظ بالملف، وحماية من غير المالك
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_yard_houses.json'), PORT = 3984, B = `http://127.0.0.1:${PORT}`;
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'craft.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'بيتاحمد')]));
// احمد يملك السيدان (مجانية) والرياضية — الحوش يقبل بس سيارات يملكها
{ const k = require('crypto').createHash('sha256').update('dev:devA-xxxxxxxx').digest('hex').slice(0, 12); fs.writeFileSync(path.join(__dirname, 'economy.json'), JSON.stringify({ [k]: { c: 0, s: 0, ld: '', d: '', tk: [], bx: 0, tut: [0, 0, 0, 0], fnd: [], o: [], bd: -1, wk: { w: 0, xo: 0, rc: 0 }, cap: {}, n: '', zt: 0, car: { o: [2, 3], s: 2, en: 0 } } })); }
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client(ip) {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': ip || '10.0.0.' + Math.floor(Math.random() * 250) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 3, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
const getHouses = () => new Promise(r => http.get(B + '/api/houses', rs => { let b = ''; rs.on('data', d => b += d); rs.on('end', () => r(JSON.parse(b))); }));
srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx', 'احمد'), Bq = await mk('devB-xxxxxxxx', 'زائر');
  clr(A, Bq); A.send({ t: 'pk', m: 2, s: 0 }); await wait(300);
  const k1 = last(Bq, m => m.t === 'hk'); ok(k1 && k1.id === 'h000000001' && JSON.stringify(k1.pk) === JSON.stringify([[2, 0]]) && last(A, m => m.t === 'hk'), 'ركنت سيارة بالحوش: الكل يستلم التحديث');
  clr(A, Bq); Bq.send({ t: 'pk', m: 1, s: 1 }); await wait(300); ok(!last(A, m => m.t === 'hk'), 'غير صاحب البيت ما يقدر يركن بحوش غيره');
  await wait(800); clr(A, Bq); A.send({ t: 'pk', m: 3, s: 0 }); await wait(300); ok(last(A, m => m.t === 'err') && !last(Bq, m => m.t === 'hk'), 'مكان محجوز بسيارة ثانية: مرفوض');
  await wait(800); A.send({ t: 'pk', m: 3, s: 1 }); await wait(300); await wait(800); A.send({ t: 'pk', m: 2, s: 2 }); await wait(300); const k2 = last(Bq, m => m.t === 'hk');
  ok(k2 && JSON.stringify(k2.pk.slice().sort((a, b) => a[0] - b[0])) === JSON.stringify([[2, 2], [3, 1]]), 'أكثر من سيارة، ونقل سيارة لمكان ثاني بدون تكرار', JSON.stringify(k2 && k2.pk));
  await wait(800); clr(Bq); A.send({ t: 'pk', m: 8, s: 2 }); await wait(250); A.send({ t: 'pk', m: 1, s: 3 }); await wait(250); ok(!last(Bq, m => m.t === 'hk'), 'سيارة أو مكان غير موجود مرفوض');
  await wait(800); clr(Bq); A.send({ t: 'pu', s: 1 }); await wait(300); const k3 = last(Bq, m => m.t === 'hk'); ok(k3 && JSON.stringify(k3.pk) === JSON.stringify([[2, 2]]), 'سحب السيارة من الحوش');
  await wait(3500); const hs2 = await getHouses(); ok(JSON.stringify(hs2.houses[0].pk) === JSON.stringify([[2, 2]]), 'السيارات المركونة تظهر بقائمة البيوت العامة (للكل)');
  const file = JSON.parse(fs.readFileSync(DATA, 'utf8')); ok(JSON.stringify(file[0].pk) === JSON.stringify([[2, 2]]), 'وتنحفظ بالملف (تبقى بعد إعادة تشغيل السيرفر)');
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
