// اختبار «هدفك الجاي»: السيرفر يحسب هدفاً واحداً واضحاً لكل لاعب (تعليم ← مهام اليوم ← هدف عملات) + قمع التعليم بالإحصاءات
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_goal_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'goalh00001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
for (const f of ['economy.json', 'moderation.json', 'stats.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3962, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'inherit'] });
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
const lastEco = c => [...c.inbox].reverse().find(m => m.t === 'eco');
async function join(dev, name) { const c = await client(); c.send({ t: 'hi', d: dev, n: name }); await wait(300); c.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); await wait(100); return c; }
srv.stdout.once('data', async () => {
  // 1) زائر جديد بدون بيت: أول هدف = حط بيتك
  const V = await join('devV-xxxxxxxx', 'زائر');
  let g = lastEco(V) && lastEco(V).s.ng;
  ok(g && g.k === 'tut' && g.i === 0 && g.a === 'build' && /بيت/.test(g.n), 'زائر جديد: الهدف «حط بيتك» (build): ' + JSON.stringify(g));
  ok(g && g.g === 4 && g.p === 0, 'الهدف يعرض تقدّم البداية السريعة 0/4');

  // 2) صاحب بيت: خطوة البيت خالصة تلقائياً → الهدف التالي «العب XO مع لاعب» (games)
  const H = await join('devH-xxxxxxxx', 'صاحب');
  g = lastEco(H).s.ng;
  ok(g && g.k === 'tut' && g.i === 1 && g.a === 'games', 'صاحب بيت: الهدف التالي لعبة مع لاعب (games): ' + JSON.stringify(g));
  ok(g && g.p === 1 && g.g === 4, 'التقدّم 1/4');

  // 3) يركب سيارة → خطوة السيارة تخلص، والهدف يبقى على أول خطوة ناقصة (XO)
  H.send({ t: 'ev', e: 'car' }); await wait(400);
  g = lastEco(H).s.ng;
  ok(g && g.i === 1 && g.p === 2, 'بعد السيارة: الهدف لسه XO والتقدّم 2/4: ' + JSON.stringify(g));

  // 4) قمع التعليم بالإحصاءات (أرقام مجمّعة): خطوة 0 (صاحب البيت) وخطوة 2 (السيارة) انحسبت
  const st = await fetch(B + '/api/admin/state', { headers: { 'x-admin': ADMIN, 'X-Forwarded-For': '10.7.7.7' } }).then(r => r.json()).catch(() => null);
  const day = st && Array.isArray(st.stats) && st.stats[0];
  ok(day && Array.isArray(day.tut) && day.tut[0] >= 1 && day.tut[2] >= 1, 'الإحصاءات: قمع البداية السريعة يعدّ الخطوات: ' + JSON.stringify(day && day.tut));

  // 5) هدف العملات: لاعب خلّص كل التعليم والمهام → «اجمع X 🪙 لـ…» (mk)
  // نكمّل التعليم: الرسالة الجاهزة (خطوة 3)
  H.send({ t: 'say', k: 1 }); await wait(500);
  g = lastEco(H).s.ng;
  ok(g && g.i === 1, 'بعد الرسالة الجاهزة: باقي XO فقط: ' + JSON.stringify(g));
  ok(lastEco(H).s.tut.filter(x => x).length === 3, 'التعليم 3/4 خالص');

  // 6) لعبة فردية (الذاكرة) تكمّل خطوة «العب لعبة» — اللاعب الجديد ما يعلق لو ما لقى أحد يلعب معه
  H.send({ t: 'ev', e: 'z', g: 'memory', s: 12 }); await wait(500);
  const e6 = lastEco(H).s;
  ok(e6.tut.every(x => x), 'لعبة فردية تكمّل خطوة الألعاب → البداية السريعة 4/4');
  ok(e6.ng && e6.ng.k === 'task', 'بعد التعليم: الهدف يصير مهمة اليوم: ' + JSON.stringify(e6.ng));
  const st2 = await fetch(B + '/api/admin/state', { headers: { 'x-admin': ADMIN, 'X-Forwarded-For': '10.7.7.7' } }).then(r => r.json());
  ok(st2.stats[0].tut[4] === 1, 'القمع يعدّ اللي خلّصوا البداية كلها: ' + JSON.stringify(st2.stats[0].tut));

  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
