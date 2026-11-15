// اختبار هدف «طوّر بيتك»: لاعب خلّص التعليم ومهام اليوم وعنده بيت → الهدف = المرحلة الجاية للبيت + تسريع بالعملات
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_hgoal_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'hgoal00001', plot: 3, type: 0, name: 'صاحب', t: 1, dev: 'devH-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0, 0, 0, 0, 0] }]));
// اقتصاد مسبق: التعليم خالص ومهام اليوم خالصة ورصيد 200
const GULF = 3 * 3600e3, td = new Date(Date.now() + GULF).toISOString().slice(0, 10);
const dh = crypto.createHash('sha256').update('dev:devH-xxxxxxxx').digest('hex').slice(0, 12);
const wk = Math.floor((Math.floor((Date.now() + GULF) / 86400e3) - 2) / 7);
fs.writeFileSync(path.join(__dirname, 'economy.json'), JSON.stringify({ [dh]: { c: 200, s: 1, ld: td, d: td, tk: [{ id: 'xo', p: 2, ok: 1 }, { id: 'race', p: 1, ok: 1 }, { id: 'lk', p: 5, ok: 1 }], bx: 1, tut: [1, 1, 1, 1], fnd: [], o: [], bd: -1, wk: { w: wk, xo: 0, rc: 0 }, cap: {}, n: 'صاحب', zt: 0, lv: 1 } }));
try { fs.unlinkSync(path.join(__dirname, 'stats.json')); } catch {}
const PORT = 3964, B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA, ADMIN_TOKEN: 'admintok-xyz' }, stdio: ['ignore', 'pipe', 'inherit'] });
function client() {
  return new Promise(res => {
    const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13', Origin: B, 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 250) } });
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
srv.stdout.once('data', async () => {
  const H = await client(); H.send({ t: 'hi', d: 'devH-xxxxxxxx', n: 'صاحب' }); await wait(500);
  let g = lastEco(H) && lastEco(H).s.ng;
  ok(g && g.k === 'house' && g.t === 1 && /بيت طين/.test(g.n) && g.a === 'boost', 'خيمة: الهدف «طوّر بيتك لبيت طين» مع تسريع: ' + JSON.stringify(g));
  ok(g && g.g === 60 && g.p === 60, 'التقدّم = رصيده مقابل سعر التسريع (60)');
  // يشتري تسريع يوم → يصير بيت طين والهدف ينتقل للفيلا
  H.send({ t: 'buy', i: 'boost' }); await wait(600);
  g = lastEco(H).s.ng;
  ok(g && g.k === 'house' && g.t === 2 && /فيلا/.test(g.n), 'بعد التسريع: البيت صار طين والهدف الجاي «فيلا»: ' + JSON.stringify(g));
  ok(/ناقصك 2 يوم/.test(g.n), 'يحسب الأيام الناقصة للفيلا (يوم 4)');
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill();
  setTimeout(() => { try { fs.unlinkSync(path.join(__dirname, 'economy.json')); } catch {} process.exit(0); }, 500);   // ما نخلّي اقتصادنا المجهّز لاختبار ثاني
});
