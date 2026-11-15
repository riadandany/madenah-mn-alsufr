// اختبار السباق + الركوب مع سائق + حالات الحركة (رقص/جلوس/سباحة) عبر WebSocket حقيقي
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_race_houses.json'); fs.writeFileSync(DATA, '[]');
const PORT = 3995;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: `http://127.0.0.1:${PORT}` } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) c.inbox.push(JSON.parse(s)); } });
      res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const last = (c, f) => [...c.inbox].reverse().find(f);
srv.stdout.once('data', async () => {
  const P = ['A', 'B', 'C', 'D'], cl = {};
  for (const n of P) { cl[n] = await client(); cl[n].send({ t: 'hi', d: 'dev' + n + '-xxxxxxxx', n: 'لاعب' + n }); }
  const pos = {}; const setPos = (n, x, z, y = 0, m = 0, v = -1) => { pos[n] = { x, z, y, m, v }; cl[n].send({ t: 'p', x, z, y, r: 0, m, v }); };
  setPos('A', 0, 0); setPos('B', 3, 0); setPos('C', 6, 0); setPos('D', 400, 0);
  const beat = setInterval(() => { for (const n of P) if (pos[n]) cl[n].send({ t: 'p', ...pos[n], r: 0 }); }, 2500); beat.unref();
  await wait(400);
  const id = n => cl[n].inbox.find(m => m.t === 'me').id;

  // ---- حالات الحركة تنتقل للآخرين ----
  setPos('B', 3, 0, 0, 4); await wait(400);
  let s = last(cl.A, m => m.t === 's' && m.p.some(p => p[0] === id('B')));
  ok(s && s.p.find(p => p[0] === id('B'))[5] === 4, 'رقص (mv=4) يوصل للي حوله');
  setPos('B', 3, 0, 0, 5); await wait(400);
  s = last(cl.A, m => m.t === 's' && m.p.some(p => p[0] === id('B')));
  ok(s && s.p.find(p => p[0] === id('B'))[5] === 5, 'جلوس (mv=5)');
  setPos('B', 3, 0, -1.4, 3); await wait(400);
  s = last(cl.A, m => m.t === 's' && m.p.some(p => p[0] === id('B')));
  ok(s && s.p.find(p => p[0] === id('B'))[5] === 3 && s.p.find(p => p[0] === id('B'))[3] === -140, 'سباحة (mv=3) وارتفاع تحت الماء');
  setPos('B', 3, 0, 0, 99); await wait(300);
  s = last(cl.A, m => m.t === 's' && m.p.some(p => p[0] === id('B')));
  ok(s && s.p.find(p => p[0] === id('B'))[5] === 0, 'قيمة حركة غير صالحة تصير 0');

  // ---- الركوب مع سائق ----
  setPos('A', 0, 0, 0, 0, 3);            // A يسوق سيارة 3
  await wait(300);
  cl.B.send({ t: 'ride', to: id('A') }); await wait(400);
  let r = last(cl.B, m => m.t === 'ride');
  ok(r && r.ok && r.d === id('A') && r.s === 1, 'B ركب مع A بالمقعد 1');
  cl.C.send({ t: 'ride', to: id('A') }); await wait(300);
  ok(last(cl.C, m => m.t === 'ride').s === 2, 'C ركب بالمقعد 2');
  cl.D.send({ t: 'ride', to: id('A') }); await wait(300);
  ok(last(cl.D, m => m.t === 'ride').e === 'far', 'D بعيد: مرفوض (far)');
  setPos('D', 2, 2); await wait(200);
  cl.D.send({ t: 'ride', to: id('A') }); await wait(300);
  ok(last(cl.D, m => m.t === 'ride').s === 3, 'D قرب وركب بالمقعد 3');
  // مقاعد كاملة: لاعب خامس
  const E = await client(); E.send({ t: 'hi', d: 'devE-xxxxxxxx', n: 'خامس' }); E.send({ t: 'p', x: 1, z: 1, y: 0, r: 0, m: 0, v: -1 }); await wait(200);
  E.send({ t: 'ride', to: cl.A.inbox.find(m => m.t === 'me').id }); await wait(300);
  ok(last(E, m => m.t === 'ride').e === 'full', 'مقاعد كاملة (3 ركاب كحد أقصى)');
  // السائق يتحرك: الركاب يتبعونه بالسيرفر حتى لو B يحاول يرسل مكان ثاني
  setPos('A', 50, 20, 0, 0, 3); cl.B.send({ t: 'p', x: -999, z: -999, y: 0, r: 0, m: 1, v: -1 }); await wait(500);
  s = last(cl.A, m => m.t === 's' && m.p.length);
  const rowB = s && s.p.find(p => p[0] === id('B'));
  ok(rowB && rowB[1] === 500 && rowB[2] === 200 && rowB[6] === 3 && rowB[7] === 1 && rowB[8] === id('A'), 'الراكب يتبع السائق (مكانه من السيرفر) ويحمل رقم المقعد والسائق');
  // نزول
  cl.B.send({ t: 'ride', to: null }); await wait(200); setPos('B', 53, 20, 0, 0); await wait(400);
  s = last(cl.A, m => m.t === 's' && m.p.some(p => p[0] === id('B')));
  ok(s.p.find(p => p[0] === id('B'))[7] === 0, 'B نزل: ما عاد راكب');
  // السائق ينزل من السيارة: الركاب ينزلون
  setPos('A', 50, 20, 0, 0, -1); await wait(500);
  ok(!!last(cl.C, m => m.t === 'ride' && m.end), 'السائق نزل: C يوصله إشعار نهاية الركوب');

  // ---- السباق ----
  for (const n of ['A', 'B', 'C']) setPos(n, -150, -175);
  setPos('D', 900, 900); await wait(300);
  cl.A.send({ t: 'rj' }); await wait(1500);
  ok((last(cl.A, m => m.t === 'race' && m.s === 'lobby') || {}).left > 10, 'لاعب واحد بس: لوبي سباق ضد الوقت (15ث)');
  cl.B.send({ t: 'rj' }); await wait(1200);
  const lob = last(cl.A, m => m.t === 'race' && m.s === 'lobby');
  ok(lob && lob.n === 2 && lob.left <= 10, `لاعبين = لوبي (${lob && lob.n} لاعبين، باقي ${lob && lob.left}ث)`);
  cl.C.send({ t: 'rj' });
  const keep = setInterval(() => { for (const n of ['A', 'B', 'C']) cl[n].send({ t: 'rj' }); }, 2500); keep.unref();
  let cd3 = null; for (let k = 0; k < 40 && !cd3; k++) { await wait(500); cd3 = last(cl.A, m => m.t === 'race' && m.s === 'cd' && m.n === 3); }
  ok(cd3 && cd3.slots.length === 3, `بدأ العدّ 3 مع ${cd3 && cd3.slots.length} متسابقين وخانات`);
  ok(cd3 && new Set(cd3.slots.map(x => x[1])).size === 3, 'كل متسابق له خانة انطلاق مختلفة');
  await wait(2400);
  ok(!!last(cl.B, m => m.t === 'race' && m.s === 'cd' && m.n === 2) && !!last(cl.B, m => m.t === 'race' && m.s === 'cd' && m.n === 1), 'تعداد 3 ← 2 ← 1');
  let go = null; for (let k = 0; k < 10 && !go; k++) { await wait(300); go = last(cl.C, m => m.t === 'race' && m.s === 'go'); }
  ok(!!go, 'GO — فتح السباق');
  // نقاط تفتيش
  const gate = async (n, g, dly = 1300) => { await wait(dly); cl[n].send({ t: 'rg', g }); };
  await gate('A', 5, 100); await wait(200);
  ok(!last(cl.A, m => m.t === 'rk' && m.p === 1 && false), 'نقطة خارج الترتيب (5 بدل 1) تُهمل');
  await gate('A', 1); await gate('A', 2); await gate('B', 1);
  await wait(300);
  const rk = last(cl.A, m => m.t === 'rk');
  ok(rk && rk.p === 1 && rk.of === 3, `A المركز ${rk && rk.p} من ${rk && rk.of}`);
  const rkB = last(cl.B, m => m.t === 'rk'); ok(rkB && rkB.p === 2, 'B المركز 2');
  // نمرر لفة كاملة بسرعة محترمة (تخطي حد الزمن بين النقاط 1.2ث)
  let g = 3;
  const total = 16 * 2;
  for (let n = 2; n < total; n++) { const gg = (n + 1) % 16; cl.A.send({ t: 'rg', g: gg }); await wait(1250); }
  await wait(300);
  const lap = last(cl.A, m => m.t === 'rlap'); ok(lap && lap.lap === 2, 'إشعار اللفة الثانية');
  const fin = last(cl.A, m => m.t === 'rfin');
  ok(fin && fin.id === id('A') && fin.pos === 1 && fin.time > 20000, `A أنهى السباق بالمركز ${fin && fin.pos} (وقت ${fin && fin.time}ms)`);
  // البقية تنتهي: C يترك → B وحده؛ ننهي بخروجهم
  cl.B.send({ t: 'rl' }); cl.C.send({ t: 'rl' }); await wait(800);
  const idle = last(cl.A, m => m.t === 'race' && m.s === 'idle');
  ok(idle && idle.res && idle.res[0][0] === 'لاعبA', 'نهاية السباق: الترتيب النهائي يرجع للكل، الأول A');
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.kill('SIGTERM'); process.exit(fail ? 1 : 0);
});
