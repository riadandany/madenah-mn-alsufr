// غرف البيوت ثابتة: كل بيت غرفته (1000+رقم الأرض)، ما يتشارك بيتين غرفة حتى بعد الطلوع والرجوع أو تغيّر الترتيب
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_rooms_houses.json');
fs.writeFileSync(DATA, JSON.stringify([{ id: 'roomh00001', plot: 3, type: 0, name: 'بيتا', t: 1, dev: 'devA-xxxxxxxx', ip: 'z', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0,0,0,0,0] },{ id: 'roomh00002', plot: 7, type: 0, name: 'بيتب', t: 1, dev: 'devB-xxxxxxxx', ip: 'y', days: 1, last: '2000-01-01', lk: [], ch: 2, st: [0,0,0,0,0] }]));
for (const f of ['economy.json', 'moderation.json']) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
const PORT = 3990, ADMIN = 'admintok-xyz', B = `http://127.0.0.1:${PORT}`;
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
  const A = await join('devA-xxxxxxxx', 'احمد'), Bq = await join('devB-xxxxxxxx', 'بدر', 5);
  const last = (c, t) => [...c.inbox].reverse().find(m => m.t === t);
  Bq.send({ t: 'in', h: 'roomh00002' }); await wait(300); const sb = last(Bq, 'in').s;
  A.send({ t: 'in', h: 'roomh00001' }); await wait(300); const sa = last(A, 'in').s;
  ok(sa === 1003 && sb === 1007, 'كل بيت غرفته من رقم أرضه (1003 و1007): ' + sa + ',' + sb);
  Bq.send({ t: 'out' }); await wait(200); A.send({ t: 'out' }); await wait(200);
  A.send({ t: 'in', h: 'roomh00001' }); await wait(300); ok(last(A, 'in').s === 1003, 'بعد الطلوع والرجوع: نفس الغرفة (كان ياخذ غرفة بيت ثاني)');
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
