// عدالة السجن: الشرطي 3 دقايق (هنا 4ث) ومشرف الشرطة/الأدمن 5، و3 اعتراضات مقبولة = توقف صلاحية الشرطي 24 ساعة
// node tests/madinah_jobs_test.cjs server.js
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_jailfair_houses.json'), PORT = 3989, B = `http://127.0.0.1:${PORT}`, ADMIN = 'admintok-jobs';
for (const f of ['economy.json', 'moderation.json', 'vip.json', 'accounts.json', 'jobs.json', 'craft.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const hs = (id, plot, dev, name, days) => ({ id, plot, type: 0, name, t: 1, dev, ip: 'ip' + plot, days, last: '2000-01-01', lk: [], lki: {}, ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify([hs('h000000001', 0, 'devA-xxxxxxxx', 'شرطيا', 3), hs('h000000002', 1, 'devD-xxxxxxxx', 'دكتورا', 3), hs('h000000003', 2, 'devM-xxxxxxxx', 'مولا', 3),
  hs('h000000004', 3, 'devL-xxxxxxxx', 'جديدا', 1), hs('h000000005', 4, 'devP-xxxxxxxx', 'شرطيب', 3), hs('h000000006', 5, 'devT-xxxxxxxx', 'صيادا', 3), hs('h000000007', 6, 'devG-xxxxxxxx', 'مديرا', 5)]));
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN, JOB_TICK_MS: '300', JAIL_MS: "9000", JAIL_OFF_MS: "4000", THIEF_MIN: '999' }, stdio: ['ignore', 'pipe', 'inherit'] });
let ipN = 1;
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.' + (ipN++) + '.7' } });
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
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + x : '')); };
const last = (c, f) => [...c.inbox].reverse().find(f), clr = (...cs) => cs.forEach(c => c.inbox.length = 0);
const PZ = 8 * 78;   // مركز الساحة (6 بيوت → 48 مربع → maxR 3)
const at = (c, x, z, v = -1) => c.send({ t: 'p', x, z: PZ + z, y: 0, r: 0, m: 1, v });
const mk = async (dev, name) => { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(350); at(c, 0, -60); c.id = last(c, m => m.t === 'me').id; c.ka = setInterval(() => { if (!c.sock.destroyed) c.send({ t: 'jb' }); }, 4000); return c; };   // نبقى متصلين (السيرفر يقطع اللي ساكت 20ث)
const metaOf = (c, id) => c.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m).filter(r => r[0] === id).pop();
const jb = c => last(c, m => m.t === 'jb');
const toast = (c, re) => last(c, m => (m.t === 'jx' || m.t === 'err') && re.test(m.m || ''));
const ecoEv = (c, re) => last(c, m => m.t === 'eco' && m.ev && re.test(m.ev));
const step = () => wait(320);
const keyOfName = () => '';
// نفس المسار بالسيرفر/العميل
const TP = [[0, -40], [4, -78], [3, -104], [-10, -124], [-12, -140], [6, -147], [12, -128], [9, -104], [15, -78], [28, -29], [39, -9], [40, 10], [31, 26], [15, 37], [0, 41], [-15, 37], [-28, 28], [-38, 12], [-40, -8], [-31, -26], [-16, -37]];
const TL = TP.reduce((s, a, i) => { const b = TP[(i + 1) % TP.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);
function thiefAt(d) { d = ((d % TL) + TL) % TL; for (let i = 0; i < TP.length; i++) { const a = TP[i], b = TP[(i + 1) % TP.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const u = l ? d / l : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } d -= l; } return TP[0]; }

srv.stdout.once('data', async () => {
  await wait(700);
  const A = await mk('devA-xxxxxxxx'), AD = await mk('devAdm-xxxxxxx');
  const V = []; for (let i = 1; i <= 5; i++) V.push(await mk('devV-visitor' + i, 'زائر' + i));
  AD.send({ t: 'admin', k: ADMIN }); await wait(500);
  clr(A, AD); A.send({ t: 'ja', j: 'police' }); await wait(700); AD.send({ t: 'jm' }); await step(); const jm = last(AD, m => m.t === 'jm'); AD.send({ t: 'jd', k: jm.apps[0][0], ok: true }); await wait(700);
  ok(jb(A).my && jb(A).my.j === 'police', 'أحمد صار شرطي');
  for (const v of V) at(v, 1, -60); at(A, 0, -60); await wait(600);
  // 1) مدة الشرطي أقصر من مدة المشرف
  clr(A, V[0]); A.send({ t: 'jj', f: V[0].id, r: 0 }); await wait(500); let jl = last(V[0], m => m.t === 'jl' && m.on === 1);
  ok(jl && jl.left <= 4100 && jl.left > 2500, 'سجن الشرطي العادي 3 دقايق (هنا 4ث): ' + (jl && jl.left));
  clr(AD, V[4]); AD.send({ t: 'jj', f: V[4].id, r: 0 }); await wait(500); const jla = last(V[4], m => m.t === 'jl' && m.on === 1);
  ok(jla && jla.left > 7000, 'سجن صاحب المدينة 5 دقايق (هنا 9ث): ' + (jla && jla.left));
  // 2) اعتراض + إطلاق من المشرف = اعتراض مقبول ضد الشرطي؛ 3 = توقف
  const overturn = async (v) => { clr(v); v.send({ t: 'jp' }); await step(); clr(AD, A); AD.send({ t: 'jr', f: v.id }); await wait(500); return !!last(v, m => m.t === 'jl' && m.on === 0); };
  ok(await overturn(V[0]), 'الاعتراض الأول: المشرف أطلقه');
  for (const i of [1, 2]) { clr(A); A.send({ t: 'jj', f: V[i].id, r: 1 }); await wait(500); ok(!!last(V[i], m => m.t === 'jl' && m.on === 1), 'سجن زائر ' + (i + 1)); await overturn(V[i]); }
  await wait(300); ok(toast(A, /موقوفة عنك 24 ساعة/), 'بعد 3 اعتراضات مقبولة: الشرطي يستلم «صلاحية السجن موقوفة»');
  clr(A); A.send({ t: 'jj', f: V[3].id, r: 0 }); await step(); ok(toast(A, /موقوفة/) && !last(V[3], m => m.t === 'jl' && m.on === 1), 'وما يقدر يسجن أحد');
  clr(AD); AD.send({ t: 'jj', f: V[3].id, r: 0 }); await wait(500); ok(!!last(V[3], m => m.t === 'jl' && m.on === 1), 'صاحب المدينة يقدر');
  // 3) ما يسجن نفس الشخص مرتين باليوم (بعد التبريد) — نتحقق من الرسالة عبر شرطي ثاني بدون تبريد: نفس الشخص من نفس الشرطي
  console.log(`\n${pass} PASS / ${fail} FAIL`); for (const c of [A, AD, ...V]) clearInterval(c.ka); srv.kill(); process.exit(0);
});
