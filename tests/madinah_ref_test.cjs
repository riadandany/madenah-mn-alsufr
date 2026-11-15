// اختبار دعوة صديق: الداعي ياخذ 100 ذهب لما صديقه يفتح بيت من رابطه، مع حماية من الغش
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_ref_houses.json'), PORT = 3988, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-xyz';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days: 3, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, '[]');
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
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m + (x && !c ? "  → " + x : "")); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); c.id = last(c, m => m.t === 'me').id; return c; };
const post = (o, ipx) => new Promise(r => { const d = JSON.stringify(o), q = http.request(B + '/api/house', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), 'X-Forwarded-For': ipx } }, rs => { let b = ''; rs.on('data', x => b += x); rs.on('end', () => { try { r({ s: rs.statusCode, j: JSON.parse(b) }); } catch { r({ s: rs.statusCode, j: {} }); } }); }); q.end(d); });
srv.stdout.once('data', async () => {
  await wait(700);
  const a = await post({ name: 'احمد', pin: '1234', plot: 0, device: 'devINV-aaaaaaaa' }, '10.1.0.1'); ok(a.s === 200, 'الداعي فتح بيته'); const ref = a.j.house.id;
  const A = await mk('devINV-aaaaaaaa', 'احمد'); A.send({ t: 'eco' }); await wait(400); const c0 = (last(A, m => m.t === 'eco') || {}).s.c;
  clr(A); const b = await post({ name: 'سعود', pin: '1234', plot: 1, device: 'devNEW-bbbbbbbb', ref }, '10.2.0.1'); await wait(400);
  const ev1 = last(A, m => m.t === 'eco' && m.ev); ok(b.s === 200 && ev1 && ev1.s.c === c0 + 100 && /فتح بيت من رابطك/.test(ev1.ev) && ev1.s.rf === 1, 'صديق فتح بيت من الرابط: الداعي ياخذ 100 ذهب ويوصله إشعار', JSON.stringify(ev1 && { c: ev1.s.c, c0, ev: ev1.ev }));
  clr(A); await post({ name: 'نفس الشبكة', pin: '1234', plot: 2, device: 'devNEW-cccccccc', ref }, '10.1.0.1'); await wait(400); ok(!last(A, m => m.t === 'eco' && m.ev), 'نفس شبكة الداعي (غش): ما ياخذ شي');
  clr(A); await post({ name: 'رابط غلط', pin: '1234', plot: 3, device: 'devNEW-dddddddd', ref: 'zzzz' }, '10.3.0.1'); await post({ name: 'بدون رابط', pin: '1234', plot: 4, device: 'devNEW-eeeeeeee' }, '10.4.0.1'); await wait(400); ok(!last(A, m => m.t === 'eco' && m.ev), 'رابط غلط أو بدون رابط: ما ياخذ شي');
  clr(A); const r2 = await post({ name: 'مكرر', pin: '1234', plot: 5, device: 'devNEW-bbbbbbbb', ref }, '10.5.0.1'); await wait(300); ok(r2.s === 409 && !last(A, m => m.t === 'eco' && m.ev), 'نفس الجهاز ما يقدر يفتح بيت ثاني ويكرر المكافأة');
  for (let i = 0; i < 11; i++) await post({ name: 'صديق' + 'ابتثجحخدذرز'[i], pin: '1234', plot: 10 + i, device: 'devMANY-' + i + 'xxxxxxx', ref }, '10.9.' + i + '.1');
  await wait(500); A.send({ t: 'eco' }); await wait(400); const cf = last(A, m => m.t === 'eco').s; ok(cf.rf === 10 && cf.c === c0 + 1000, 'حد أقصى 10 دعوات مكافأة باليوم', JSON.stringify({ rf: cf.rf, c: cf.c - c0 }));
  console.log(pass + ' PASS / ' + fail + ' FAIL'); srv.kill(); process.exit(fail ? 1 : 0);
});
