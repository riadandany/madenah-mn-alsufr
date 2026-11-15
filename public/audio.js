// ================= أصوات اللعبة =================
// كلها تتولّد بالكود (WebAudio) — ما فيه ملفات صوت تنزل، فما تأثر على الأداء ولا حجم الصفحة.
// المتصفح يمنع الصوت قبل أول لمسة/ضغطة، فنفعّل المحرك عند أول تفاعل.
let ctx = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('mnalsifr_mute') === '1'; } catch {}
let VOL = .8;
try { const v = parseFloat(localStorage.getItem('mnalsifr_vol')); if (v >= 0 && v <= 1) VOL = v; } catch {}
let amb = {};          // آخر طلب أصوات مكان (للاختبار)
const A = {};          // الواجهة العامة
const N = {};          // عقد الأصوات المستمرة (محرك، ماء، رياح…)

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : VOL;
  const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  buildLoops();
  return ctx;
}
const ok = () => ctx && ctx.state === 'running' && !muted;

// نغمة: تردد يتغيّر من f إلى f2
function tone(f, dur, { type = 'sine', vol = .15, f2 = null, at = 0, att = .008 } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
// ضجيج مفلتر (خطوات، ماء، اصطدام…)
function noise(dur, { f = 800, f2 = null, q = 1, type = 'bandpass', vol = .1, at = 0, att = .005 } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}

// أصوات مستمرة: محرك السيارة، نافورة، بحيرة، رياح، موسيقى المول
function loopNoise(type, f, q) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return { g, fl }; }
function buildLoops() {
  N.fountain = loopNoise('bandpass', 1800, .6);
  N.lake = loopNoise('lowpass', 520, .8);
  N.wind = loopNoise('bandpass', 260, .4);
  // محرك: منشار + مربع عبر فلتر
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 60; o2.frequency.value = 30; fl.type = 'lowpass'; fl.frequency.value = 500; g.gain.value = 0;
  o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master); o1.start(); o2.start();
  N.eng = { o1, o2, fl, g };
  // صفير تيربو/سرعة الهواء
  N.air = loopNoise('highpass', 1400, .7);
  setInterval(musicTick, 520);
}
// نخفّف طلبات التغيير: كل setTargetAtTime يتراكم بجدول الصوت (كنا نرسل ~600 بالثانية فيتعب الصوت والصفحة)
const lastRamp = new WeakMap();
const ramp = (p, v, k = .15) => { if (!p || !ctx) return; const t = ctx.currentTime, l = lastRamp.get(p); if (l && t - l.t < .08 && Math.abs(v - l.v) < .25 * Math.max(Math.abs(v), .02)) return; if (l && Math.abs(v - l.v) < .004 * Math.max(Math.abs(v), .02)) return; lastRamp.set(p, { t, v }); p.setTargetAtTime(v, t, k); };

// موسيقى هادئة للمول (نغمات خماسية عشوائية)
let mallMusic = 0, beat = 0;
const PENT = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
function musicTick() {
  if (!ok() || mallMusic < .05) return; beat++;
  if (beat % 2 === 0) tone(PENT[Math.floor(Math.random() * PENT.length)], .9, { type: 'triangle', vol: .05 * mallMusic });
  if (beat % 8 === 0) { const r = PENT[Math.floor(Math.random() * 4)] / 2; tone(r, 2.2, { type: 'sine', vol: .06 * mallMusic }); tone(r * 1.5, 2.2, { type: 'sine', vol: .04 * mallMusic }); }
}

// ---------- الواجهة ----------
A.unlock = ensure;
A.isMuted = () => muted;
A.getVolume = () => VOL;
A.setVolume = v => { VOL = Math.max(0, Math.min(1, v)); try { localStorage.setItem('mnalsifr_vol', String(VOL)); } catch {} ensure(); if (master && !muted) master.gain.setTargetAtTime(VOL, ctx.currentTime, .05); };
A.amb = () => amb;
A.toggle = () => {
  muted = !muted; try { localStorage.setItem('mnalsifr_mute', muted ? '1' : '0'); } catch {}
  ensure(); if (master) master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, .05);
  if (!muted) A.click(); return muted;
};
A.click = () => tone(620, .07, { type: 'triangle', vol: .1, f2: 880 });
A.pop = () => { tone(740, .09, { type: 'sine', vol: .12 }); tone(988, .12, { type: 'sine', vol: .1, at: .08 }); };
A.step = run => noise(.06, { f: 500 + Math.random() * 400, q: 1.2, vol: run ? .07 : .045 });
A.jump = () => tone(280, .16, { type: 'sine', vol: .12, f2: 640 });
A.land = () => noise(.12, { f: 260, type: 'lowpass', vol: .14 });
A.splash = (big = 1) => { noise(.5, { f: 1400, f2: 300, q: .7, vol: .2 * big }); noise(.3, { f: 700, type: 'lowpass', vol: .12 * big, at: .05 }); };
A.stroke = () => noise(.28, { f: 900, f2: 400, type: 'lowpass', vol: .06 });
A.warn = () => { tone(880, .08, { type: 'square', vol: .08 }); tone(880, .08, { type: 'square', vol: .08, at: .14 }); };
A.drown = () => { tone(330, 1, { type: 'sawtooth', vol: .14, f2: 70 }); for (let i = 0; i < 5; i++) tone(500 + i * 90, .09, { vol: .08, at: .15 + i * .12, f2: 900 }); };
A.beep = n => n > 0 ? tone(440, .22, { type: 'square', vol: .12 }) : (tone(880, .6, { type: 'square', vol: .13 }), tone(1320, .6, { type: 'triangle', vol: .1, at: .02 }));
A.boost = () => { noise(.6, { f: 400, f2: 5000, q: .8, type: 'highpass', vol: .12 }); tone(180, .45, { type: 'sawtooth', vol: .09, f2: 900 }); };
A.crash = v => { v = Math.min(1, v); noise(.28, { f: 320, type: 'lowpass', vol: .3 * v }); tone(110, .25, { type: 'square', vol: .12 * v, f2: 45 }); };
A.horn = () => { tone(392, .35, { type: 'square', vol: .09 }); tone(494, .35, { type: 'square', vol: .08 }); };
A.fanfare = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .22, { type: 'triangle', vol: .13, at: i * .13 }));
A.lap = () => { tone(988, .12, { type: 'triangle', vol: .12 }); tone(1319, .22, { type: 'triangle', vol: .12, at: .1 }); };
A.gate = () => tone(1180, .09, { type: 'sine', vol: .07 });
A.bubble = () => tone(500 + Math.random() * 300, .1, { vol: .06, f2: 1100 });
A.chirp = () => { const f = 2600 + Math.random() * 1400; tone(f, .07, { vol: .035, f2: f * 1.3 }); tone(f * 1.1, .07, { vol: .03, f2: f * .8, at: .1 }); };
A.win = () => A.fanfare();
A.lose = () => tone(330, .5, { type: 'sawtooth', vol: .1, f2: 120 });
A.place = () => tone(520, .07, { type: 'triangle', vol: .1, f2: 700 });
A.tick = () => tone(900, .04, { type: 'square', vol: .05 });
// 💼 الوظائف: صفارة الشرطة (v = قرب الصوت 0..1)، صافرة، قفل الزنزانة
A.siren = (v = 1) => { tone(980, .3, { type: 'square', vol: .045 * v, f2: 720 }); tone(720, .3, { type: 'square', vol: .045 * v, f2: 980, at: .32 }); };
A.whistle = () => { tone(2300, .22, { type: 'sine', vol: .09, f2: 2500 }); tone(2300, .4, { type: 'sine', vol: .09, f2: 2700, at: .26 }); };
A.cuff = () => { tone(1700, .05, { type: 'square', vol: .07 }); tone(1150, .09, { type: 'square', vol: .07, at: .07 }); tone(420, .25, { type: 'triangle', vol: .09, f2: 180, at: .16 }); };
A.door = () => { tone(660, .12, { type: 'sine', vol: .08 }); tone(880, .18, { type: 'sine', vol: .07, at: .1 }); };

// محرك السيارة: on، السرعة النسبية 0..1، دعسة البنزين، تيربو
A.engine = (on, sp, thr, boost) => {
  if (!ctx || !N.eng) return;
  const E = N.eng, run = on && ok();
  const gear = Math.min(3, Math.floor(sp * 4)), rpm = Math.min(1, (sp * 4) - gear + .08 + thr * .12);
  const f = 38 + 120 * (.2 + .8 * rpm) + gear * 4;
  ramp(E.o1.frequency, f, .06); ramp(E.o2.frequency, f * .5, .06); ramp(E.fl.frequency, 260 + rpm * 700 + thr * 300, .08);
  ramp(E.g.gain, run ? .07 + thr * .06 + sp * .03 : 0, .1);
  ramp(N.air.g.gain, run ? Math.min(.05, sp * sp * .06) + (boost ? .03 : 0) : 0, .15);
};
// أصوات المكان (كلها 0..1)
A.ambient = ({ fountain = 0, lake = 0, wind = .3, mall = 0 } = {}) => {
  amb = { fountain, lake, wind, mall };
  if (!ctx || !N.fountain) return; const on = ok();
  ramp(N.fountain.g.gain, on ? fountain * .09 : 0, .3); ramp(N.lake.g.gain, on ? lake * .11 : 0, .3);
  ramp(N.wind.g.gain, on ? wind * .03 : 0, .5);
  mallMusic = mall;
};
A.birdy = () => { if (ok() && Math.random() < .5) A.chirp(); };

// أول لمسة تفعّل الصوت
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => ensure(), { passive: true });
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
export default A;
