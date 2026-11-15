// اختبار الإحصاءات: أجهزة اليوم/الجدد/الجلسات/الأماكن/الذروة — أرقام فقط
// node tests/madinah_stats_test.cjs server.js
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_stats_houses.json'), PORT = 3974, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-st';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'push.json', 'stats.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devU-xxxxxxxx', 'عمر'), hs('h000000002', 1, 'devM-xxxxxxxx', 'مشرف'), hs('h000000003', 2, 'devW-xxxxxxxx', 'وليد'), hs('h000000004', 3, 'devG-xxxxxxxx', 'مدير')]));
fs.writeFileSync(path.join(__dirname, 'jobs.json'), JSON.stringify({ emp: { h000000004: { j: 'gm', n: 'مدير', t: Date.now() } } }));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, ST_MIN_MS: 1000 }, stdio: ['ignore', 'pipe', 'inherit'] });
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.6.' + (ipN++) + '.7' } });
    q.on('upgrade', (r, sock) => {
      const c = { sock, inbox: [], buf: Buffer.alloc(0) };
      c.send = o => { const p = Buffer.from(JSON.stringify(o)), m = crypto.randomBytes(4); const h = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0x80 | 126, p.length >> 8, p.length & 255]); const d = Buffer.from(p); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; sock.write(Buffer.concat([h, m, d])); };
      sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); while (c.buf.length >= 2) { let len = c.buf[1] & 127, off = 2; if (len === 126) { len = c.buf.readUInt16BE(2); off = 4; } if (c.buf.length < off + len) break; const op = c.buf[0] & 15; const s = c.buf.subarray(off, off + len).toString(); c.buf = c.buf.subarray(off + len); if (op === 1) { try { c.inbox.push(JSON.parse(s)); } catch {} } } });
      sock.on('error', () => {}); res(c);
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + x : '')); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async dev => { const c = await client(); c.send({ t: 'hi', d: dev }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
const req = (method, p, body) => new Promise(res => { const d = body ? JSON.stringify(body) : ''; const q = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.' + (ipN++) + '.1', Origin: B } }, r => { let s = ''; r.on('data', x => s += x); r.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch {} res({ s: r.statusCode, d: j }); }); }); q.end(d); });
const st = async () => (await new Promise(res => { const q = http.request({ host: '127.0.0.1', port: PORT, path: '/api/admin/state', headers: { 'X-Admin': ADMIN, 'X-Forwarded-For': '10.8.1.1' } }, r => { let s = ''; r.on('data', x => s += x); r.on('end', () => res(JSON.parse(s))); }); q.end(); })).stats;
srv.stdout.once('data', async () => {
  await wait(700);
  const U = await mk('devU-xxxxxxxx'), W = await mk('devW-xxxxxxxx'), N = await mk('devNEW-xxxxxxx');
  await wait(2600);
  let S = await st(), t = S && S[0];
  ok(t && t.u === 3 && t.nw === 3, 'ثلاث أجهزة دخلت اليوم وكلها جديدة', JSON.stringify(t));
  ok(t && t.pk >= 3 && t.h.length === 24 && Math.max(...t.h) >= 3, 'الذروة وأعلى متصلين بالساعة');
  ok(t && t.z.length >= 1 && t.z.reduce((a, b) => a + b[1], 0) >= 3, 'دقائق الأماكن تنحسب', JSON.stringify(t && t.z));
  U.sock.destroy(); await wait(500); const U2 = await mk('devU-xxxxxxxx'); await wait(300);
  S = await st(); t = S[0]; ok(t.u === 3, 'نفس الجهاز يرجع ما ينحسب مرتين', t.u);
  ok(t.s === 0, 'جلسة أقل من 15 ثانية ما تنحسب', t.s);
  await wait(15500); W.sock.destroy(); await wait(600);
  S = await st(); t = S[0]; ok(t.s === 1 && t.avg > 0.2 && t.s5 === 0, 'جلسة 16 ثانية انحسبت بالمتوسط', JSON.stringify(t));
  ok(t.nb === 0 && typeof t.rb === 'number', 'بيوت جديدة اليوم 0 (بيوت الاختبار قديمة)');
  await wait(1200); const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'stats.json'), 'utf8'));
  const raw = JSON.stringify(F); ok(!/devU|devW|عمر|وليد/.test(raw) && F.seen.a.every(x => /^[a-f0-9]{10}$/.test(x)), 'الملف أرقام فقط (بدون أسماء أو أجهزة)', raw.slice(0, 200));
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
