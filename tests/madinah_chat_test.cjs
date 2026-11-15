// اختبار الرسائل المكتوبة عبر WebSocket حقيقي: لاعبين A وB
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const DATA = path.join(__dirname, 'madinah_chat_houses.json'); fs.writeFileSync(DATA, JSON.stringify([...[{id:'hz0000000',plot:20,type:1,name:'احمد',t:1,dev:'devA-xxxxxxxx',ip:'z',days:2,last:'2000-01-01',lk:[],ch:2,st:[0,0,0,0,0]},{id:'hz0000001',plot:21,type:1,name:'سالم',t:1,dev:'devB-xxxxxxxx',ip:'z',days:2,last:'2000-01-01',lk:[],ch:2,st:[0,0,0,0,0]},{id:'hz0000002',plot:22,type:1,name:'قريب',t:1,dev:'devD-xxxxxxxx',ip:'z',days:2,last:'2000-01-01',lk:[],ch:2,st:[0,0,0,0,0]},{id:'hz0000003',plot:23,type:1,name:'بعيد',t:1,dev:'devC-xxxxxxxx',ip:'z',days:2,last:'2000-01-01',lk:[],ch:2,st:[0,0,0,0,0]}],{ id: 'styl000001', plot: 3, type: 1, name: 'مزيّن', t: 1, dev: 'devE-xxxxxxxx', ip: 'z', days: 9, last: '2000-01-01', lk: [], st: [2, 3, 4, 0, 0], ch: 5 }]));
const PORT = 3994;
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
srv.stdout.once('data', async () => {
  const A = await client(), B = await client(), C = await client(), D = await client();
  A.send({ t: 'hi', d: 'devA-xxxxxxxx', n: 'احمد' }); B.send({ t: 'hi', d: 'devB-xxxxxxxx', n: 'سالم' });
  C.send({ t: 'hi', d: 'devC-xxxxxxxx', n: 'بعيد' }); D.send({ t: 'hi', d: 'devD-xxxxxxxx', n: 'قريب' });
  A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); B.send({ t: 'p', x: 10, z: 0, y: 0, r: 0, m: 0 }); C.send({ t: 'p', x: 500, z: 0, y: 0, r: 0, m: 0 }); D.send({ t: 'v', x: 20, z: 20 });
  // نبضة كل 3 ثواني مثل الواجهة الحقيقية (وإلا السيرفر يقطع الخامل بعد 20 ثانية)
  setInterval(() => { A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); B.send({ t: 'p', x: 10, z: 0, y: 0, r: 0, m: 0 }); C.send({ t: 'p', x: 500, z: 0, y: 0, r: 0, m: 0 }); D.send({ t: 'v', x: 20, z: 20 }); }, 3000).unref();
  await wait(300);
  const bid = B.inbox.find(m => m.t === 'me').id;
  let S = A;   // المرسل: نستخدم C للكلمات البذيئة لأن البذيء ينمنع ساعة
  const say = async (x, expectOk, label) => {
    S.inbox.length = 0; B.inbox.length = 0; S.send({ t: 'say', to: bid, x }); await wait(1300);
    const got = B.inbox.find(m => m.t === 'msg'), err = S.inbox.find(m => m.t === 'err');
    if (expectOk) ok(got && got.x === x.trim() && got.n === 'احمد', `delivered: ${label} ${JSON.stringify(got)} ${JSON.stringify(err)}`);
    else ok(!got && err && err.e === expectOk === false ? true : !got && !!err, `blocked (${err && err.e}): ${label}`);
  };
  await say('هلا كيف حالك؟ تعال نلعب عند البرج 😄', true, 'normal arabic');
  await say('Hi bro, nice house!', true, 'normal english');
  await say('كيك لذيذ 🍰 عندي 3 بيوت', true, 'cake + small number');
  S = C; await say('يا شرموط', false, 'arabic swear');
  await say('sh1t', false, 'leet swear');
  await wait(0); await say('fuuuuck', false, 'repeated letters'); S = A;
  await say('رقمي 0551234567', false, 'phone number');
  await say('٠٥٥١٢٣٤٥٦٧', false, 'arabic digits phone');
  await say('ضيفني سناب ahmed', false, 'snapchat');
  await say('instagram: @ahmed_99', false, 'handle');
  await say('ادخل https://bad.example', false, 'link');
  await say('واتس اب', false, 'whatsapp');
  await say('x'.repeat(81), false, 'too long');
  await say('   ', false, 'empty');
  // سرعة: رسالتين ورا بعض
  A.inbox.length = 0; A.send({ t: 'say', to: bid, x: 'واحد' }); A.send({ t: 'say', to: bid, x: 'اثنين' }); await wait(400);
  ok(A.inbox.some(m => m.t === 'err' && m.e === 'slow'), 'rate limit on fast messages');
  // تجاوز بالأحرف المخفية (عكس الاتجاه)
  await wait(1300);
  S = C; await say('ش‮رموط', false, 'hidden bidi chars stripped then filtered'); S = A;
  // منع تلقائي: كس (كلمة قصيرة) ساعة، وبعدها ما يقدر يكتب، والكلمات تتراكم، والزائر رسائل ثابتة فقط
  { const T = D; T.inbox.length = 0; T.send({ t: 'say', x: 'كككس' }); await wait(400); const e = T.inbox.find(m => m.t === 'err');
    ok(e && e.e === 'banned' && /ساعة/.test(e.m || ''), 'كس = منع ساعة: ' + (e && e.m)); }
  { const G = await client(); G.send({ t: 'hi', d: 'devG-xxxxxxxx', n: 'زائر1' }); await wait(200); G.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0 }); await wait(200);
    G.inbox.length = 0; G.send({ t: 'say', x: 'مرحبا' }); await wait(300); ok(G.inbox.some(m => m.t === 'err' && m.e === 'guest'), 'الزائر بدون بيت: النص الحر مرفوض');
    await wait(1300); G.inbox.length = 0; G.send({ t: 'say', k: 0 }); await wait(300); ok(G.inbox.some(m => m.t === 'sent'), 'الزائر: الرسالة الجاهزة تنرسل'); }
  // رسالة عامة: يشوفها القريب (يمشي أو يتفرج) والبعيد لا
  await wait(1300); for (const x of [A, B, C, D]) x.inbox.length = 0;
  A.send({ t: 'say', x: 'مرحبا للكل' }); await wait(500);
  ok(B.inbox.some(m => m.t === 'msg' && m.x === 'مرحبا للكل' && !m.to), 'public msg reaches nearby walker B');
  ok(D.inbox.some(m => m.t === 'msg' && m.x === 'مرحبا للكل'), 'public msg reaches nearby viewer D');
  ok(!C.inbox.some(m => m.t === 'msg'), 'far player C does not get it');
  ok(A.inbox.some(m => m.t === 'sent' && m.heard === 3), 'sender told heard=3 (B, D, guest G)');
  await wait(1300); for (const x of [B, D]) x.inbox.length = 0;
  A.send({ t: 'say', to: bid, k: 3 }); await wait(500);
  ok(B.inbox.some(m => m.t === 'msg' && m.k === 3 && m.to === bid), 'addressed preset marks to=B');
  ok(D.inbox.some(m => m.t === 'msg' && m.k === 3 && m.to === bid), 'nearby D also sees addressed msg');
  // السيارة: A يركب سيارة رقم 3 → B يستلمه بالرقم 3 (العنصر السابع)، وقيمة غلط → -1
  const aid = A.inbox.length, aId = (await (async () => { return null; })()) ;
  A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0, v: 3 }); B.inbox.length = 0; await wait(700);
  const sA = B.inbox.filter(m => m.t === 's').flatMap(m => m.p).find(p => p[1] === 0 && p[2] === 0);
  ok(sA && sA[6] === 3, 'peer sees car index 3: ' + JSON.stringify(sA));
  A.send({ t: 'p', x: 0, z: 0, y: 0, r: 0, m: 0, v: 99 }); B.inbox.length = 0; await wait(700);
  const sB = B.inbox.filter(m => m.t === 's').flatMap(m => m.p).find(p => p[1] === 0 && p[2] === 0);
  ok(sB && sB[6] === -1, 'bad car index → -1: ' + JSON.stringify(sB));
  // أنماط اللاعبين: E صاحب بيت لابس قبعة 2 وظهر 3 وشارة 4 → B يستلمها بالـmeta
  const E = await client(); E.send({ t: 'hi', d: 'devE-xxxxxxxx', n: 'x' }); await wait(200); E.send({ t: 'p', x: 5, z: 5, y: 0, r: 0, m: 0 });
  setInterval(() => E.send({ t: 'p', x: 5, z: 5, y: 0, r: 0, m: 0 }), 3000).unref();
  B.inbox.length = 0; await wait(900);
  const metas = B.inbox.filter(m => m.t === 's' && m.m).flatMap(m => m.m);
  const me = metas.find(m => m[1] === 'مزيّن');
  ok(me && me[2] === 5 && me[4] === 2 && me[5] === 3 && me[6] === 4, 'peer meta carries char+hat+back+tag: ' + JSON.stringify(me));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.kill(); process.exit(fail ? 1 : 0);
});
setTimeout(() => { console.log('timeout'); srv.kill(); process.exit(1); }, 60000);
