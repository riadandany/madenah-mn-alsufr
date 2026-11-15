// اختبار الفعاليات المجدولة: السيرفر يعلن الفعالية (الحين/الجاية)، الحاضر بمكانها ياخذ عملات، والبعيد لا
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_evt_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'evth000001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
for (const f of ['economy.json', 'moderation.json', 'stats.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3963, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz', EVT_SLOT_MS: '4000', EVT_TICK_MS: '400', EVT_LIST: 'plaza' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client(ip) {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': ip || '10.0.0.' + Math.floor(Math.random() * 250) } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } else if (len === 127) { len = Number(c.buf.readBigUInt64BE(2)); off = 10; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const lastOf = (c, t) => [...c.inbox].reverse().find(m => m.t === t);
const coins = c => (lastOf(c, 'eco') || { s: { c: 0 } }).s.c;
async function until(fn, ms = 6000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(100); } return null; }
srv.stdout.once('data', async () => {
  const H = await client(); H.send({ t: 'hi', d: 'devH-xxxxxxxx', n: 'صاحب' }); await wait(400);
  const first = lastOf(H, 'evt');
  ok(first && typeof first.on === 'boolean' && first.nx && first.nx.n && first.nx.in > 0, 'عند الدخول يوصل إعلان الفعالية (الحين/الجاية): ' + JSON.stringify(first));

  // ننتظر بداية فعالية الساحة
  const on = await until(() => { const m = lastOf(H, 'evt'); return m && m.on ? m : null; }, 6000);
  ok(on && on.id === 'plaza' && /الساحة/.test(on.n) && on.d === 'plaza' && on.left > 0, 'بدأت «تجمّع الساحة» بإعلان للكل: ' + JSON.stringify(on));
  ok(on && Number.isFinite(on.x) && Number.isFinite(on.z), 'الإعلان فيه مكان الفعالية (x,z)');

  // حاضر بالساحة → عملات
  const c0 = coins(H);
  H.send({ t: 'p', x: on.x + 3, z: on.z + 3, y: 0, r: 0, m: 0 });
  const got = await until(() => H.inbox.find(m => m.t === 'eco' && /حضورك/.test(m.ev || '')), 2000);
  ok(!!got && coins(H) > c0, `الحاضر بالساحة ياخذ عملات (${c0} → ${coins(H)}): ${got && got.ev}`);

  // نروح بعيد → ما ياخذ شي بالفعالية الجاية
  H.send({ t: 'p', x: on.x + 3000, z: on.z - 3000, y: 0, r: 0, m: 0 });
  const off = await until(() => { const m = lastOf(H, 'evt'); return m && !m.on ? m : null; }, 4000);
  ok(off && off.nx && off.nx.in > 0, 'بعد ما تخلص: إعلان «الجاية» مع عدّاد: ' + JSON.stringify(off));
  await until(() => { const m = lastOf(H, 'evt'); return m && m.on ? m : null; }, 4000);
  H.inbox.length = 0; await wait(1200);
  ok(!H.inbox.some(m => m.t === 'eco' && /حضورك/.test(m.ev || '')), 'البعيد عن مكان الفعالية ما ياخذ عملات');

  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
