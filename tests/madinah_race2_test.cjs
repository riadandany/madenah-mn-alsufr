// السباق: لاعب جديد يعرف الحالة، والمتعطّل (ما يعدّي نقاط) يطلع تلقائياً ولا يعلّق السباق
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_race2_houses.json'); fs.writeFileSync(DATA, '[]');
const PORT = 3967, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, RACE_STUCK_MS: '2500' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 250) } });
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
const last = (c, f) => [...c.inbox].reverse().find(f);
srv.stdout.once('data', async () => {
  const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(250); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); return c; };
  const A = await mk('devA-xxxxxxxx', 'أ'), Bc = await mk('devB-xxxxxxxx', 'ب');
  setInterval(() => { for (const c of [A, Bc]) { c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.send({ t: 'rj' }); } }, 2500).unref();
  const m0 = last(A, m => m.t === 'race'); ok(m0 && m0.s === 'idle', 'لاعب جديد يستلم حالة السباق (idle) عند الدخول');
  A.send({ t: 'rj' }); Bc.send({ t: 'rj' });
  for (let k = 0; k < 40 && !last(A, m => m.t === 'race' && m.s === 'go'); k++) await wait(500);
  ok(last(A, m => m.t === 'race' && m.s === 'go'), 'السباق بدأ بلاعبين (لوبي → عدّ → انطلاق)');
  const C = await mk('devC-xxxxxxxx', 'ج'); const mc = last(C, m => m.t === 'race'); ok(mc && mc.s === 'run', 'لاعب دخل أثناء السباق: يعرف إن فيه سباق جارٍ (run) — ما يعلق بحالة قديمة');
  // ما عدّوا أي نقطة: السيرفر يطلّعهم ويقفل السباق (نتحقق من الرسائل اللي توصل بعد بداية السباق فقط)
  const mA = A.inbox.length, mB = Bc.inbox.length, mC = C.inbox.length, idleAfter = (c, i) => c.inbox.slice(i).some(m => m.t === 'race' && m.s === 'idle');
  for (let k = 0; k < 40 && !idleAfter(A, mA); k++) await wait(300);
  ok(idleAfter(A, mA) && idleAfter(Bc, mB), 'المتعطّلين انشالوا من السباق تلقائياً (ما يعلقون)');
  await wait(800); ok(idleAfter(C, mC), 'السباق انتهى والمتفرّج يعرف');
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill('SIGTERM'); process.exit(fail ? 1 : 0);
});
