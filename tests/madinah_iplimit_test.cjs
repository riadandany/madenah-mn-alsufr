// حد البيوت لكل شبكة: 5 بيوت جديدة خلال 24 ساعة، والبيوت القديمة ما تنحسب
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, 'madinah_iplimit_houses.json'), PORT = 3981;
const old = []; for (let p = 0; p < 6; p++) old.push({ id: 'o' + p, plot: p, type: 0, name: 'قديم' + p, t: Date.now() - 3 * 86400000, dev: 'olddev' + p + 'xxxx', ip: null, days: 1, last: '2000-01-01', lk: [], ch: 0, st: [0, 0, 0, 0, 0] });
fs.writeFileSync(DATA, JSON.stringify(old));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const srv = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, PORT, DATA_FILE: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
srv.stdout.once('data', async () => {
  try {
    const post = async (i) => { const r = await fetch(`http://127.0.0.1:${PORT}/api/house`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'بيت' + i, pin: '1234', plot: 10 + i, device: 'newdevice' + i + 'xxxx' }) }); return [r.status, (await r.json()).error || ''] };
    // البيوت القديمة بنفس الشبكة: نخليها بنفس هاش الـIP عن طريق بيت أول ثم نقرأ الهاش
    const res = []; for (let i = 0; i < 6; i++) res.push(await post(i));
    console.log(res.map(r => r[0]).join(','));
    ok(res.slice(0, 5).every(r => r[0] === 200), 'أول 5 بيوت من نفس الشبكة تنبني');
    ok(res[5][0] === 409 && res[5][1].includes('اليوم'), 'السادس باليوم ينرفض برسالة واضحة');
  } catch (e) { console.log('ERR', e); fail++; }
  console.log(`\n${pass} PASS / ${fail} FAIL`); srv.kill(); process.exit(0);
});
