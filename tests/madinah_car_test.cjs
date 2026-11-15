// اختبار سيارة اللاعب: سيدان مجانية، شراء موديل، اختيار، تطوير المحرك، الحوش لسيارته بس
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_car_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'ecoh000001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3986, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
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
const lastEco = c => [...c.inbox].reverse().find(m => m.t === 'eco');
const req = (m, u, body, headers = {}) => fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.9', ...headers }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})) }));
async function join(dev, name, x) { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(250); c.send({ t: 'p', x: x || 0, z: 0, y: 0, r: 0, m: 0 }); await wait(100); return c; }
srv.stdout.once('data', async () => {
  const A = await join('devA-xxxxxxxx', 'احمد');
  let e = lastEco(A);
  ok(e && e.s.car && e.s.car.s === 2 && e.s.car.o.join() === '2' && e.s.car.en === 0, 'كل لاعب ياخذ سيدان مجانية (موديل 2) محرك 0');
  A.send({ t: 'cbuy', i: 3 }); await wait(400); ok(A.inbox.some(m => m.t === 'err' && /600/.test(m.m || '')) && lastEco(A).s.car.o.length === 1, 'شراء الرياضية (600) بدون رصيد كافي مرفوض');
  A.send({ t: 'csel', i: 3 }); await wait(300); ok(lastEco(A).s.car.s === 2, 'ما يقدر يختار موديل ما يملكه');
  // نعطيه فلوس عن طريق الكنوز (20+60+...)
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) { A.send({ t: 'fd', i }); await wait(320); }
  const c0 = lastEco(A).s.c; console.log('coins', c0);
  A.send({ t: 'cbuy', i: 6 }); await wait(400); e = lastEco(A).s;
  ok(e.car.o.includes(6) && e.car.s === 6 && e.c === c0 - 80, 'شراء السيدان الأزرق (80) نجح وصار سيارته');
  A.send({ t: 'csel', i: 2 }); await wait(400); ok(lastEco(A).s.car.s === 2 && lastEco(A).s.c === c0 - 80, 'يرجع لسيارة يملكها ببلاش');
  A.send({ t: 'cup' }); await wait(400); e = lastEco(A).s; ok(e.car.en === 1 && e.c === c0 - 180, 'تطوير المحرك مستوى 1 بـ100');
  A.send({ t: 'cbuy', i: 99 }); await wait(300); ok(lastEco(A).s.car.o.length === 2, 'رقم موديل غلط مرفوض');
  // الحوش
  const H = await join('devH-xxxxxxxx', 'صاحب');
  H.send({ t: 'pk', m: 3, s: 0 }); await wait(500); ok(H.inbox.some(m => m.t === 'err' && /سيارتك بس/.test(m.m || '')), 'الحوش: ما يركن موديل ما يملكه');
  await wait(400); H.inbox.length = 0; H.send({ t: 'pk', m: 2, s: 0 }); await wait(500); ok(H.inbox.some(m => m.t === 'hk'), 'الحوش: يركن سيارته (السيدان)');
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
