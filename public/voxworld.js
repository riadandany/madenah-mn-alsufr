// ================= عالم البناء داخل اللعبة نفسها (من البحيرة السابقة شرقاً بلا نهاية) =================
// المدينة صارت الجزء الصغير، وشرقها عالم مكعبات لا متناهي: تلال وغابات وبحار وكهوف ومعادن. كل اللاعبين فيه مع بعض (نفس الاتصال)،
// يشوفون بعض ويتقاتلون، والتعديلات (تكسير/بناء) مشتركة: السيرفر يخزّنها كأرقام صغيرة ويوزّعها. الكاميرا تتحول لشخص أول تلقائياً.
import * as THREE from '/vendor/three.module.min.js';
import { B, I, CH, spreadLiquid, liquidContact, treeCells, isCrop, BLOCKS, T, World, meshChunk, stepPlayer, raycast, EYE, PH, PW, NORTH_BZ, VIP_BX, VIP_BZ, inDomain, RECIPES, newInv, invAdd, invCount, invFlat, invFrom, canCraft, doCraft, breakInfo, blockDrops, itemName, isTool, toolInfo, isFood, stackMax, ITEMS, SMELT, FUEL, breakable, weaponDamage, landSpawn } from '/voxcore.js?v=8';

export const WX0 = 144;
export const PLACE_NAMES = ['🏠 بيتي', '⛏️ المنجم', '🌲 الغابة', '🏰 القلعة', '🌾 المزرعة', '🏖️ الشاطئ', '⛰️ الجبل', '🕳️ الكهف', '⭐ مكاني المفضل'];   // أسماء جاهزة (بدون كتابة حرة)
const MAX_PLACES = 8;   // بداية العالم محلياً شرق مركز الساحة (حدّ البحيرة السابقة)
const ATLAS_N = 8, EAT_T = 1.6, REACH = 5.5;
const INTERACT = new Set([B.CRAFTING, B.FURNACE, B.CHEST]);

export function createVoxWorld(C) {
  const { S, cam, WK, toast, AU, netSend, plaza, PEERS, LOW, MID, R } = C, RD = LOW ? 3 : MID ? 5 : 6;
  const sfx = k => { try { AU[k] && AU[k](); } catch {} };
  // أصوات مولّدة بالكود (تكسير/وضع/ضرب/تصنيع/أكل) — تحترم كتم الصوت ومستواه من ⚙️
  let ac = null;
  const tone = (f, d, type = 'square', vol = .06, slide = 0) => { try { if (AU.isMuted && AU.isMuted()) return; const gv = (AU.getVolume ? AU.getVolume() : 1); if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(vol * gv, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch {} };
  const noise = (d, vol = .08) => { try { if (AU.isMuted && AU.isMuted()) return; const gv = (AU.getVolume ? AU.getVolume() : 1); if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol * gv; s.buffer = b; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); } catch {} };
  const SND = { brk: () => { noise(.12, .12); tone(110, .1, 'triangle', .05, -40); }, put: () => tone(150, .07, 'square', .05, -60), hurt: () => tone(220, .22, 'sawtooth', .07, -150), hit: () => { noise(.06, .08); tone(300, .05, 'square', .04); }, craft: () => { tone(520, .08, 'sine', .06); setTimeout(() => tone(780, .1, 'sine', .06), 90); }, eat: () => tone(300, .06, 'triangle', .05), door: () => tone(180, .09, 'triangle', .05), dig: () => noise(.05, .06), pick: () => tone(680, .05, 'sine', .04, 260) };
  const snd = k => { try { SND[k] && SND[k](); } catch {} };
  const O = () => { const p = plaza(); return { x: p.x + WX0, y: .3 - 31, z: p.z }; };   // سطح الأرض عند الحدّ y=31 ← مستوى المدينة .3   // مكعب (0,0,0) ← مكان بالمدينة
  const V = { W: new World(20261113, false), fp: false, inside: false, ready: false, inv: newInv(), hot: 0, hp: 20, air: 15, P: { x: 0, y: 40, z: 0, vx: 0, vy: 0, vz: 0, onGround: false }, mining: false, mineT: 0, mineKey: '', using: false, eatT: 0, jumpIn: false, lastHit: '', wantDest: null };
  V.W.onEdit = null; V.places = []; V.pend = null;
  const plFlat = () => { const a = []; for (const p of V.places) a.push(p.ni, p.x, p.y, p.z); return a; };
  const plFrom = arr => { const out = []; if (Array.isArray(arr)) for (let i = 0; i + 3 < arr.length && out.length < MAX_PLACES; i += 4) { const ni = arr[i] | 0; if (ni >= 0 && ni < PLACE_NAMES.length) out.push({ ni, x: arr[i + 1] | 0, y: arr[i + 2] | 0, z: arr[i + 3] | 0 }); } return out; };
  const placeLabel = p => PLACE_NAMES[p.ni] + (V.places.filter(q => q.ni === p.ni).length > 1 ? ' ' + (V.places.filter(q => q.ni === p.ni).indexOf(p) + 1) : '');

  // ---------- الصورة المجمّعة (بلاطات 16×16 تتولّد بالكود) ----------
  const cv = document.createElement('canvas'); cv.width = cv.height = ATLAS_N * 16; const cg = cv.getContext('2d');
  let seedR = 12345; const rnd = () => { seedR = (seedR * 1664525 + 1013904223) >>> 0; return seedR / 4294967296; };
  const tile = (t, fn) => { const ox = (t % ATLAS_N) * 16, oy = Math.floor(t / ATLAS_N) * 16; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = fn(x, y); if (!p) continue; cg.fillStyle = `rgba(${p[0] | 0},${p[1] | 0},${p[2] | 0},${p[3] === undefined ? 1 : p[3]})`; cg.fillRect(ox + x, oy + y, 1, 1); } };
  const vr = (c, v) => { const d = (rnd() - .5) * v; return [c[0] + d, c[1] + d, c[2] + d]; };
  const DIRT = [134, 96, 67], STN = [125, 125, 125], PLK = [178, 140, 86];
  tile(T.GRASS_TOP, () => vr([92, 168, 62], 26)); tile(T.GRASS_SIDE, (x, y) => y < 3 || (y < 5 && rnd() < .5) ? vr([92, 168, 62], 26) : vr(DIRT, 20)); tile(T.DIRT, () => rnd() < .12 ? vr([100, 70, 48], 14) : vr(DIRT, 20));
  tile(T.STONE, () => vr(STN, 18)); tile(T.SAND, () => vr([219, 207, 140], 12));
  tile(T.LOG_SIDE, x => vr(x % 4 === 0 ? [78, 60, 36] : [104, 82, 50], 12)); tile(T.LOG_TOP, (x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return vr(d > 6 || (d > 3 && d < 4.2) ? [120, 94, 56] : [182, 146, 92], 10); });
  tile(T.LEAVES, () => rnd() < .16 ? [0, 0, 0, 0] : vr([48, 128, 40], 36)); tile(T.PLANKS, (x, y) => vr(y % 8 === 0 ? [130, 98, 58] : PLK, 10));
  tile(T.COBBLE, (x, y) => { const e = (x % 8 === 0 || y % 6 === 0) ? 40 : 0; return vr([118 - e, 118 - e, 118 - e], 34); });
  const ore = c => (x, y) => { const b = ((x * 7 + y * 13) % 11) < 2 || ((x + y * 5) % 17) < 2; return b ? vr(c, 18) : vr(STN, 18); };
  tile(T.COAL, ore([30, 30, 30])); tile(T.IRON, ore([216, 170, 140])); tile(T.GOLD, ore([252, 222, 60])); tile(T.DIAMOND, ore([90, 236, 230]));
  tile(T.WATER, () => vr([44, 104, 220], 12).concat([.7])); tile(T.GLASS, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 || x === y && x < 8) ? [210, 235, 255, 1] : null);
  tile(T.BRICK, (x, y) => { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0; return (y % 4 === 0 || (x + off) % 8 === 0) ? vr([200, 190, 180], 10) : vr([170, 70, 55], 18); });
  tile(T.BEDROCK, () => vr([62, 62, 62], 30));
  for (const [t, c] of [[T.WOOL_W, [236, 236, 236]], [T.WOOL_R, [200, 50, 50]], [T.WOOL_B, [50, 84, 204]], [T.WOOL_Y, [236, 212, 52]], [T.WOOL_G, [62, 162, 62]], [T.WOOL_K, [36, 36, 36]]]) tile(t, () => vr(c, 10));
  tile(T.LAMP, (x, y) => { const e = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return e > 6 ? [200, 150, 60] : vr([255, 232, 150], 16); });
  tile(T.CRAFT_TOP, (x, y) => (x % 5 === 0 || y % 5 === 0) ? vr([96, 70, 40], 8) : vr(PLK, 12)); tile(T.CRAFT_SIDE, (x, y) => (y < 3) ? vr([96, 70, 40], 8) : (x > 2 && x < 7 && y > 5 && y < 13) ? vr([70, 60, 55], 10) : (x > 9 && x < 13 && y > 5 && y < 13) ? vr([170, 120, 60], 10) : vr(PLK, 12));
  tile(T.FURNACE_TOP, () => vr([112, 112, 112], 18)); tile(T.FURNACE_SIDE, (x, y) => (x > 3 && x < 12 && y > 5 && y < 13) ? (y > 10 ? vr([240, 130, 40], 30) : vr([36, 36, 36], 8)) : vr([112, 112, 112], 22));
  tile(T.CHEST_TOP, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15) ? vr([90, 60, 30], 6) : vr([150, 105, 52], 12)); tile(T.CHEST_SIDE, (x, y) => (x > 6 && x < 9 && y > 5 && y < 9) ? [200, 200, 205] : (y === 0 || y === 15 || x === 0 || x === 15 || y === 5) ? vr([90, 60, 30], 6) : vr([150, 105, 52], 12));
  tile(T.SNOW_TOP, () => vr([240, 245, 250], 8)); tile(T.SNOW_SIDE, (x, y) => y < 4 ? vr([240, 245, 250], 8) : vr(DIRT, 20)); tile(T.CACTUS_TOP, () => vr([48, 130, 50], 14)); tile(T.CACTUS_SIDE, x => x % 5 === 0 ? vr([30, 100, 40], 10) : vr([54, 142, 56], 14));
  tile(T.TORCH, (x, y) => y < 5 ? (y < 2 ? [255, 235, 120] : [255, 170, 30]) : vr([120, 85, 45], 10)); tile(T.LAVA, () => vr([240, 110, 20], 70));
  tile(T.OBSIDIAN, (x, y) => (x + y * 3) % 7 === 0 ? vr([90, 40, 140], 30) : vr([20, 12, 32], 14)); tile(T.FARM_TOP, (x, y) => y % 4 === 0 ? vr([70, 45, 28], 10) : vr([100, 66, 40], 14));
  tile(T.SAPLING, (x, y) => (x >= 7 && x <= 8 && y >= 8) ? [90, 60, 30, 1] : (y < 9 && Math.hypot(x - 7.5, y - 4) < 4.6) ? vr([60, 170, 60], 30) : null);
  for (let s = 0; s < 8; s++) tile(T.WHEAT0 + s, (x, y) => { const h = 2 + s * 1.7; if (y < 16 - h || (x % 4 !== 1 && x % 4 !== 3)) return null; const k = s / 7; return vr([60 + 170 * k, 150 - 10 * k, 40 - 10 * k], 24); });
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const tileUV = t => { const e = .002, u0 = (t % ATLAS_N) / ATLAS_N + e, u1 = (t % ATLAS_N + 1) / ATLAS_N - e, r = Math.floor(t / ATLAS_N); return [u0, 1 - (r + 1) / ATLAS_N + e, u1, 1 - r / ATLAS_N - e]; };
  const matO = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: .5 }), matW = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: .8, depthWrite: false });
  // الإضاءة: لون الرأس = (سماء، مشعل، ظل الوجه). السطوع = max(سماء×النهار، مشعل) — الكهوف مظلمة والمشاعل تنوّر
  const dayU = { value: 1 };
  for (const m of [matO, matW]) { m.onBeforeCompile = sh => { sh.uniforms.uDay = dayU; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uDay;').replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor = vec3(max(max(color.r * uDay, color.g), 0.05) * color.b);\n#endif'); }; m.customProgramCacheKey = () => 'voxlit'; }

  // ---------- أيقونات الأغراض ----------
  const icons = {}, TCOL = ['#a97b44', '#8f9094', '#d8d8d8', '#f2d34a', '#4de3d8'];
  // 🛠️ الأدوات والعصا: بكسلات 16×16 بخامة كل مستوى + ظل وإضاءة وحد غامق (نفس الرسم للأيقونة وللمجسّم باليد)
  function toolCells(kind) {   // 0 فاضي، 1 مقبض، 2 الخامة، 3 واقي السيف — u على طول المقبض (من تحت يسار لفوق يمين)، v عمودي عليه
    const N = 16, cell = new Array(N * N).fill(0), S = [1.5, 14.5], r = Math.SQRT1_2;
    const sword = kind === 'sword', L = sword ? 4.6 : kind === 'stick' ? 16.6 : 14;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + .5 - S[0], py = y + .5 - S[1], u = (px - py) * r, v = (-px - py) * r; let c = 0;
      if (u > -.4 && u < L && Math.abs(v) < .8) c = 1;
      if (kind === 'pickaxe') { const uc = 14.3 - .1 * v * v, th = 1.55 - Math.abs(v) * .075; if (Math.abs(v) < 8 && Math.abs(u - uc) < th) c = 2; }
      else if (kind === 'axe') { if (v > .5 && v < 6) { const half = 1.6 + (v - .5) * .42; if (Math.abs(u - 12.6) < half) c = 2; } if (v <= .5 && v > -1.9 && Math.abs(u - 12.9) < 1.1) c = 2; }
      else if (kind === 'shovel') { const cu = 14.2, a = 3.6, b = 2.5; if (u > 10.4 && ((u - cu) / a) ** 2 + (v / b) ** 2 < 1) c = 2; }
      else if (kind === 'hoe') { if (u > 13 && u < 15.7 && v > -.8 && v < 6.2) c = 2; if (u > 13 && u < 15.7 && v <= -.8 && v > -2.2) c = 2; }
      else if (kind === 'sword') { if (u > 4.6 && u < 6.2 && Math.abs(v) < 3.3) c = 3; if (u >= 6.2 && u < 18.8 && Math.abs(v) < Math.min(1.5, (18.8 - u) * .6)) c = 2; }
      cell[y * N + x] = c;
    }
    return cell;
  }
  
  const TIER_RGB = ['#b8874a', '#9b9b9b', '#e4e4e4', '#f7d23c', '#4fe4d6'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const WOOD_RGB = [141, 90, 43], GUARD_RGB = [90, 58, 28], pixCache = {};
  function toolPix(id) {   // {N, c:[[r,g,b]|null], o:[حد؟]}
    if (pixCache[id]) return pixCache[id];
    const ti = isTool(id) ? toolInfo(id) : null, cells = toolCells(ti ? ti.kind : 'stick'), N = 16, at = (x, y) => x < 0 || y < 0 || x >= N || y >= N ? 0 : cells[y * N + x];
    const mixc = (c, k) => c.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))), c = [], o = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = at(x, y); if (!v) { c.push(null); o.push(!!(at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))); continue; }
      const base = v === 2 ? TIER_RGB[ti ? ti.tier : 0] : v === 3 ? GUARD_RGB : WOOD_RGB, lit = !at(x - 1, y) || !at(x, y - 1), drk = !at(x + 1, y) || !at(x, y + 1);
      c.push(mixc(base, lit && !drk ? .32 : drk && !lit ? -.28 : 0)); o.push(false);
    }
    return (pixCache[id] = { N, c, o });
  }
  const pixItem = id => isTool(id) || id === I.STICK;
  function drawItem(g, id) {
    g.lineCap = 'round'; g.lineJoin = 'round'; const stick = (x0, y0, x1, y1, w = 4, c = '#7a5230') => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (false) {
      const ti = toolInfo(id), col = TCOL[ti.tier]; g.fillStyle = col; g.strokeStyle = '#222'; g.lineWidth = 1.5;
      if (ti.kind === 'sword') { stick(8, 34, 16, 26, 4); stick(13, 22, 21, 30, 4, '#5a3a1e'); g.beginPath(); g.moveTo(17, 25); g.lineTo(32, 6); g.lineTo(35, 9); g.lineTo(20, 28); g.closePath(); g.fill(); g.stroke(); return; }
      stick(8, 34, 28, 14, 4);
      if (ti.kind === 'pickaxe') { g.beginPath(); g.moveTo(12, 14); g.quadraticCurveTo(28, 2, 36, 22); g.lineTo(32, 22); g.quadraticCurveTo(26, 10, 14, 18); g.closePath(); g.fill(); g.stroke(); }
      else if (ti.kind === 'axe') { g.beginPath(); g.moveTo(22, 8); g.lineTo(36, 10); g.lineTo(34, 24); g.lineTo(26, 20); g.closePath(); g.fill(); g.stroke(); }
      else if (ti.kind === 'shovel') { g.beginPath(); g.ellipse(30, 10, 6, 8, .78, 0, 7); g.fill(); g.stroke(); }
      else { g.beginPath(); g.moveTo(20, 10); g.lineTo(36, 12); g.lineTo(34, 17); g.lineTo(22, 15); g.closePath(); g.fill(); g.stroke(); }
      return;
    }
    if (id === I.STICK) { stick(8, 34, 32, 8, 4); return; }
    if (id === I.COAL || id === I.CHARCOAL) { g.fillStyle = id === I.COAL ? '#2a2a2a' : '#3a2e28'; g.beginPath(); g.moveTo(10, 24); g.lineTo(18, 10); g.lineTo(30, 12); g.lineTo(34, 26); g.lineTo(22, 32); g.closePath(); g.fill(); g.fillStyle = '#555'; g.fillRect(18, 15, 5, 4); return; }
    if (id === I.IRON_INGOT || id === I.GOLD_INGOT) { g.fillStyle = id === I.IRON_INGOT ? '#d8d8d8' : '#f2d34a'; g.strokeStyle = '#444'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 26); g.lineTo(14, 14); g.lineTo(34, 14); g.lineTo(30, 28); g.closePath(); g.fill(); g.stroke(); return; }
    if (id === I.DIAMOND) { g.fillStyle = '#4de3d8'; g.strokeStyle = '#1b8e87'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(20, 6); g.lineTo(33, 16); g.lineTo(20, 34); g.lineTo(7, 16); g.closePath(); g.fill(); g.stroke(); return; }
    if (id === I.APPLE) { g.fillStyle = '#d6322a'; g.beginPath(); g.arc(20, 24, 11, 0, 7); g.fill(); g.fillStyle = '#3aa648'; g.fillRect(19, 7, 3, 6); g.fillRect(22, 8, 6, 3); return; }
    if (id === I.SEEDS) { g.fillStyle = '#7aa02a'; for (const [a, b] of [[14, 20], [22, 16], [18, 28], [26, 26], [12, 28]]) g.fillRect(a, b, 4, 3); return; }
    if (id >= 110 && id <= 112) { g.fillStyle = '#cfd2d6'; g.strokeStyle = '#444'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10, 14); g.lineTo(30, 14); g.lineTo(26, 32); g.lineTo(14, 32); g.closePath(); g.fill(); g.stroke(); if (id === I.WATER_BUCKET) { g.fillStyle = '#3a78e0'; g.fillRect(12, 15, 16, 5); } if (id === I.LAVA_BUCKET) { g.fillStyle = '#f06a10'; g.fillRect(12, 15, 16, 5); } return; }
    g.fillStyle = '#aaa'; g.fillRect(10, 10, 20, 20);
  }
  const icon = id => icons[id] || (icons[id] = (() => { const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (pixItem(id)) { const P = toolPix(id), k = 3; c.width = c.height = P.N * k; for (let i = 0; i < P.N * P.N; i++) { const p = P.c[i]; if (!p && !P.o[i]) continue; g.fillStyle = p ? `rgb(${p})` : '#1c1612'; g.fillRect((i % P.N) * k, Math.floor(i / P.N) * k, k, k); } return c.toDataURL(); } if (id < 100 && BLOCKS[id]) { const t = BLOCKS[id].side; g.drawImage(cv, (t % ATLAS_N) * 16, Math.floor(t / ATLAS_N) * 16, 16, 16, 0, 0, 40, 40); } else drawItem(g, id); return c.toDataURL(); })());

  // ---------- مجسمات القطع + البث ----------
  const skyC = new THREE.Color(), markers = new Map();
  function markersFrame() {
    const o = O(), P = V.P; const keep = new Set();
    V.places.forEach(pl => { const k = pl.ni + ',' + pl.x + ',' + pl.y + ',' + pl.z; keep.add(k); let m = markers.get(k); if (!m) { m = new THREE.Group(); const beam = new THREE.Mesh(new THREE.BoxGeometry(.3, 40, .3), new THREE.MeshBasicMaterial({ color: '#35e0ff', transparent: true, opacity: .45, depthWrite: false })); beam.position.y = 20; m.add(beam); if (C.textTex) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.textTex(PLACE_NAMES[pl.ni], 512, 110, 'rgba(20,24,30,.82)', '#7ff0ff', 66), transparent: true, depthWrite: false })); sp.scale.set(5.2, 1.1, 1); sp.position.y = 3.2; sp.renderOrder = 7; m.add(sp); } S.add(m); markers.set(k, m); } m.position.set(pl.x + .5 + o.x, pl.y + o.y, pl.z + .5 + o.z); m.visible = Math.hypot(pl.x + .5 - P.x, pl.z + .5 - P.z) < 260; });
    for (const [k, m] of [...markers]) if (!keep.has(k)) { S.remove(m); markers.delete(k); }
  }
  V.teleport = (x, y, z) => { const o = O(); V.pend = { x: x + .5, y: y + .05, z: z + .5 }; WK.p.set(x + .5 + o.x, 0, z + .5 + o.z); WK.y = y + o.y; WK.jy = 0; if (V.fp) { V.P.x = x + .5; V.P.y = y + .05; V.P.z = z + .5; V.P.vx = V.P.vy = V.P.vz = 0; V.P.kx = V.P.kz = 0; V.ready = false; V.pend = null; peak = V.P.y; } };
  const meshes = new Map(), synced = new Set(), needQ = new Set(), sent = new Map(); let oKey = '', qT = 0;
  const dropMesh = k => { const m = meshes.get(k); if (!m) return; for (const x of [m.o, m.w]) if (x) { S.remove(x); x.geometry.dispose(); } meshes.delete(k); };
  const mkGeo = a => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a.p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(a.u, 2)); g.setAttribute('color', new THREE.BufferAttribute(a.c, 3)); g.setIndex(new THREE.BufferAttribute(a.i, 1)); g.computeBoundingSphere(); return g; };
  function buildMesh(cx, cz) {
    const k = cx + ',' + cz, r = meshChunk(V.W, cx, cz, tileUV); if (!r) return; dropMesh(k); const m = { o: null, w: null }, o = O();
    if (r.o.i.length) { m.o = new THREE.Mesh(mkGeo(r.o), matO); m.o.position.set(o.x, o.y, o.z); S.add(m.o); } if (r.w.i.length) { m.w = new THREE.Mesh(mkGeo(r.w), matW); m.w.renderOrder = 2; m.w.position.set(o.x, o.y, o.z); S.add(m.w); }
    meshes.set(k, m); V.W.dirty.delete(k);
  }
  const OFFS = []; for (let dx = -RD - 1; dx <= RD + 1; dx++) for (let dz = -RD - 1; dz <= RD + 1; dz++) if (dx * dx + dz * dz <= (RD + 1) * (RD + 1) + 1) OFFS.push([dx, dz, dx * dx + dz * dz]); OFFS.sort((a, b) => a[2] - b[2]);
  const chunkOK = (cx, cz) => { const x1 = cx * CH + CH - 1, z0 = cz * CH, z1 = z0 + CH - 1; return x1 >= 0 && z1 >= NORTH_BZ && !(x1 <= VIP_BX && z0 >= VIP_BZ); };
  const pv = () => { const o = O(); return { x: WK.p.x - o.x, z: WK.p.z - o.z }; };
  // بدون حد وقت (كان 7ms ويأخّر القطع البعيدة على الجوال) — تجهيز القطعة صار أسرع ×8
  V.budget = Infinity; V.stats = () => ({ meshes: meshes.size, chunks: V.W.chunks.size, dirty: V.W.dirty.size, need: needQ.size, synced: synced.size });
  function stream(bg, bm) {
    const p = pv(), pcx = Math.floor(p.x / CH), pcz = Math.floor(p.z / CH), t0 = performance.now(); let g = 0, m = 0;
    const busy = () => m > 0 && performance.now() - t0 > V.budget;   // حد وقت لكل إطار: الباقي بالإطار الجاي (ما يتقطّع)
    for (const k of [...V.W.chunks.keys()]) { const [x, z] = k.split(',').map(Number); if (Math.abs(x - pcx) > RD + 2 || Math.abs(z - pcz) > RD + 2) { dropMesh(k); V.W.unload(x, z); dropCrops(x, z); synced.delete(k); needQ.delete(k); sent.delete(k); V.W.edits.delete(k); } }
    for (const [dx, dz] of OFFS) { const cx = pcx + dx, cz = pcz + dz; if (g < bg && chunkOK(cx, cz) && !V.W.has(cx, cz)) { V.W.ensure(cx, cz); g++; const k = cx + ',' + cz; needQ.add(k); scanCrops(cx, cz); } }
    for (const k of [...V.W.dirty]) { if (m >= bm + 2 || busy()) break; const [x, z] = k.split(',').map(Number); if (V.W.has(x, z) && meshes.has(k)) { buildMesh(x, z); m++; } else V.W.dirty.delete(k); }
    for (const [dx, dz, d2] of OFFS) {
      if (m >= bm || busy()) break; if (d2 > RD * RD + 1) continue; const cx = pcx + dx, cz = pcz + dz, k = cx + ',' + cz; if (meshes.has(k) || !V.W.has(cx, cz) || !synced.has(k)) continue;
      let ok = true; for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1; b++) if (chunkOK(cx + a, cz + b) && !V.W.has(cx + a, cz + b)) { ok = false; break; } if (ok) { buildMesh(cx, cz); m++; }
    }
  }
  function flushSync(now) {
    if (needQ.size && now - qT > .12) { qT = now; const ks = [...needQ].slice(0, 24); for (const k of ks) { needQ.delete(k); sent.set(k, now); } netSend({ t: 'cwq', ks }); }
    for (const [k, t] of sent) if (now - t > 3) { sent.delete(k); synced.add(k); }   // السيرفر ما رد: نكمّل بدونه
  }
  function setEdit(x, y, z, id) {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH), k = cx + ',' + cz;
    if (V.W.has(cx, cz)) W_set(x, y, z, id); else { let ed = V.W.edits.get(k); if (!ed) V.W.edits.set(k, ed = new Map()); ed.set((y * CH + (z - cz * CH)) * CH + (x - cx * CH), id); }
  }

  // ---------- الواجهة (تظهر داخل عالم البناء بس) ----------
  const css = document.createElement('style'); css.textContent = `
#mcUI{position:fixed;inset:0;display:none;z-index:5;pointer-events:none;font-family:inherit;direction:rtl}
#mcUI>*{pointer-events:auto}#mcCross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none!important}
#mcCross:before,#mcCross:after{content:"";position:absolute;background:#fff;mix-blend-mode:difference}#mcCross:before{left:10px;top:2px;width:2px;height:18px}#mcCross:after{top:10px;left:2px;height:2px;width:18px}
#mcBar{position:absolute;left:50%;top:calc(50% + 22px);width:70px;height:6px;margin-left:-35px;background:rgba(0,0,0,.45);border-radius:3px;display:none;overflow:hidden;pointer-events:none!important}#mcBar i{display:block;height:100%;width:0;background:#ffd34d}
.mcb{position:absolute;border:0;border-radius:50%;color:#fff;font-size:26px;box-shadow:0 3px 12px rgba(0,0,0,.4);touch-action:none;display:flex;align-items:center;justify-content:center}
#mcMine{right:16px;bottom:max(196px,calc(env(safe-area-inset-bottom) + 184px));width:76px;height:76px;background:#e9573f}#mcPlace{right:16px;bottom:max(284px,calc(env(safe-area-inset-bottom) + 272px));width:64px;height:64px;background:#3a8f4a}
#mcPlB{position:absolute;left:12px;bottom:max(236px,calc(env(safe-area-inset-bottom) + 224px));background:rgba(20,24,30,.78);color:#fff;border:0;border-radius:14px;padding:9px 14px;font-size:15px;font-weight:800}
#mcPanel .pl{display:flex;align-items:center;gap:6px;background:#2e3541;border-radius:10px;padding:6px 8px;margin:4px 0;font-size:13px;flex-wrap:wrap}#mcPanel .pl b{flex:1;min-width:110px}#mcPanel .pl small{opacity:.75}#mcPanel .nm{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}#mcPanel .nm button{background:#2d6fb8}
#mcInvB{position:absolute;left:12px;bottom:max(188px,calc(env(safe-area-inset-bottom) + 176px));background:rgba(20,24,30,.78);color:#fff;border:0;border-radius:14px;padding:9px 14px;font-size:15px;font-weight:800}
#mcStat{position:absolute;left:50%;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 52px);transform:translateX(-50%);display:flex;direction:ltr;font-size:15px;text-shadow:0 1px 2px #000;pointer-events:none!important;white-space:nowrap}
#mcHot{position:absolute;left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:3px;background:rgba(20,24,30,.62);padding:4px;border-radius:12px;direction:ltr}
.mcs{width:40px;height:40px;border:2px solid rgba(255,255,255,.35);border-radius:6px;position:relative;background-size:82%;background-repeat:no-repeat;background-position:center;image-rendering:pixelated;background-color:rgba(255,255,255,.13);box-sizing:border-box}.mcs.on{border-color:#ffd34d;box-shadow:0 0 8px #ffd34d}.mcs.pk{border-color:#6fe3ff;box-shadow:0 0 8px #6fe3ff}.mcs b{position:absolute;right:2px;bottom:0;color:#fff;font-size:12px;text-shadow:0 1px 2px #000}.mcs u{position:absolute;left:3px;right:3px;bottom:2px;height:3px;background:#222;border-radius:2px;overflow:hidden}.mcs u i{display:block;height:100%}
#mcInfo{position:absolute;left:10px;top:max(52px,calc(env(safe-area-inset-top) + 44px));color:#fff;font-weight:800;text-shadow:0 1px 4px #000;font-size:13px;direction:ltr;background:rgba(0,0,0,.35);padding:3px 9px;border-radius:10px;pointer-events:none!important}
#mcPanel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(96vw,470px);max-height:86vh;overflow:auto;background:rgba(24,28,36,.97);color:#fff;border-radius:18px;padding:10px;display:none;box-sizing:border-box;direction:rtl;z-index:30}
#mcPanel h3{margin:0 0 6px;font-size:16px}#mcPanel .tabs{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}#mcPanel .tabs button,#mcPanel .rc button{background:#3a8f4a;color:#fff;border:0;border-radius:10px;padding:7px 11px;font-size:14px;font-weight:800}#mcPanel .tabs button.off{background:#444}
#mcPanel .g{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;direction:ltr;margin:4px 0}#mcPanel .g .mcs{width:auto;height:0;padding-bottom:calc(100% - 4px)}
#mcPanel .rc{display:flex;align-items:center;gap:8px;background:#2e3541;border-radius:10px;padding:6px 10px;margin:4px 0;font-size:13px}#mcPanel .rc img{width:32px;height:32px;image-rendering:pixelated}#mcPanel .rc button{margin-inline-start:auto}#mcPanel .rc.no{opacity:.45}
#mcPanel .fz{display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0;direction:ltr}#mcPanel .fz .mcs{width:56px;height:56px}#mcPanel .pr{width:60px;height:10px;background:#111;border-radius:5px;overflow:hidden}#mcPanel .pr i{display:block;height:100%;background:#ff9a2e;width:0}
#mcHurt{position:absolute;inset:0;background:rgba(220,20,20,.38);opacity:0;pointer-events:none!important;transition:opacity .35s}#mcWet{position:absolute;inset:0;background:rgba(30,90,200,.35);display:none;pointer-events:none!important}#mcLava{position:absolute;inset:0;background:rgba(240,90,10,.55);display:none;pointer-events:none!important}
#mcHelp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,410px);background:rgba(18,22,30,.96);color:#fff;border-radius:18px;padding:16px;display:none;line-height:1.85;font-size:15px;z-index:31}#mcHelp button{margin-top:8px;width:100%;background:#ffd34d;color:#1d2b36;border:0;border-radius:12px;padding:11px;font-size:17px;font-weight:900}
body.vox .doorBtn,body.vox #doorBtn,body.vox #parkBtn,body.vox #gameBtn,body.vox #fairBtn{display:none!important}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'mcUI';
  ui.innerHTML = `<div id="mcWet"></div><div id="mcLava"></div><div id="mcHurt"></div><div id="mcCross"></div><div id="mcBar"><i></i></div><div id="mcInfo"></div>
<button id="mcInvB">🎒 الشنطة</button><button id="mcPlB">📍 الأماكن</button><button class="mcb" id="mcPlace">✋</button><button class="mcb" id="mcMine">⛏️</button><div id="mcStat"></div><div id="mcHot"></div><div id="mcPanel"></div>
<div id="mcHelp"><b style="font-size:18px">⛏️ عالم البناء</b><br>🌲 اضرب الشجرة بيدك (اضغط ⛏️ مطوّلاً): يطلع خشب!<br>✋ تحط المكعب • تفتح الطاولة والفرن والصندوق • تاكل التفاحة (مطوّلاً)<br>🎒 الشنطة والتصنيع: خشب ← ألواح ← عصي ← طاولة ← معول ← حجر ← حديد ← ألماس<br>⚔️ تقدر تضرب اللاعبين اللي معك بالعالم (سيف أقوى) — وهم يضربونك!<br>🧱 كل التعديلات مشتركة: اللي تبنيه يشوفه الكل، واللي يهدمه غيرك يطيح<br>❤️ لو متّ ترجع للمدينة وأغراضك معك<br><button id="mcHelpOk">فهمت — يلا نلعب</button></div>`;
  document.body.appendChild(ui);
  const $ = id => ui.querySelector(id);

  // ---------- الشنطة واللوحة ----------
  const heldSlot = () => V.inv[V.hot], heldId = () => (V.inv[V.hot] ? V.inv[V.hot].id : 0);
  const slotHTML = (s, ref, cls = '') => `<div class="mcs ${cls}" data-r="${ref}" ${s ? `style="background-image:url(${icon(s.id)})" title="${itemName(s.id)}"` : ''}>${s && s.n > 1 ? `<b>${s.n}</b>` : ''}${s && isTool(s.id) && s.d > 0 ? `<u><i style="width:${100 - s.d / toolInfo(s.id).dur * 100}%;background:${s.d / toolInfo(s.id).dur > .75 ? '#e33' : s.d / toolInfo(s.id).dur > .4 ? '#ec3' : '#3c3'}"></i></u>` : ''}</div>`;
  const refreshHot = () => { try { updateHeld(); } catch {} $('#mcHot').innerHTML = Array.from({ length: 9 }, (_, i) => slotHTML(V.inv[i], 'i:' + i, i === V.hot ? 'on' : '')).join(''); };
  function refreshStat() { const h = Math.ceil(V.hp); let a = ''; for (let i = 0; i < 10; i++) a += `<span style="opacity:${h >= (i + 1) * 2 ? 1 : h === i * 2 + 1 ? .55 : .18}">❤️</span>`; $('#mcStat').innerHTML = a + (V.air < 15 ? ` <span>🫧${Math.max(0, Math.ceil(V.air))}</span>` : ''); }
  const refreshAll = () => { refreshHot(); refreshStat(); if ($('#mcPanel').style.display === 'block') paintPanel(); savePrefs(); };
  const nearTable = () => { const p = V.P; for (let x = -4; x <= 4; x++) for (let y = -3; y <= 3; y++) for (let z = -4; z <= 4; z++) if (V.W.get(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z) === B.CRAFTING) return true; return false; };
  let panel = { tab: 'inv', tile: null, k: null }, pick = null;
  const sref = r => { const [k, v] = r.split(':'); return k === 'C' ? 's' + v : v === 'out' ? 'o' : v; };   // اسم الخانة عند السيرفر
  const getRef = r => { const [k, v] = r.split(':'); if (k === 'i') return V.inv[+v]; const d = panel.tile; if (!d) return null; if (k === 'F') return v === 'in' ? d.i : v === 'fu' ? d.fu : d.o; return d.s ? d.s[+v] : null; };
  const okPlace = (r, it) => { const [k, v] = r.split(':'); if (k === 'F') { if (v === 'out') return false; if (v === 'in') return SMELT[it.id] !== undefined; if (v === 'fu') return FUEL[it.id] !== undefined; } return true; };
  function moveSlot(a, b) {
    if (a === b) return; const ka = a[0], kb = b[0];
    if (ka === 'i' && kb === 'i') { const A = V.inv[+a.slice(2)], Bv = V.inv[+b.slice(2)]; if (!A) return; if (!Bv) { V.inv[+b.slice(2)] = A; V.inv[+a.slice(2)] = null; } else if (Bv.id === A.id && stackMax(A.id) > 1) { const q = Math.min(A.n, stackMax(A.id) - Bv.n); Bv.n += q; A.n -= q; if (A.n <= 0) V.inv[+a.slice(2)] = null; } else { V.inv[+a.slice(2)] = Bv; V.inv[+b.slice(2)] = A; } return; }
    if (ka === 'i' && kb !== 'i') { const A = V.inv[+a.slice(2)]; if (!A || !panel.k) return; if (!okPlace(b, A)) { toast('هذا الغرض ما ينفع هنا'); return; } V.inv[+a.slice(2)] = null; netSend({ t: 'ctput', r: sref(b), it: A }); return; }
    if (ka !== 'i' && kb === 'i') { if (!panel.k || !getRef(a)) return; V.wantDest = b; netSend({ t: 'ctake', r: sref(a) }); return; }
    toast('ما يمديك تنقل بين خانتين بالصندوق');
  }
  function paintPanel() {
    const p = $('#mcPanel'), d = panel.tile; let h = `<div class="tabs"><button data-tab="inv" class="${panel.tab === 'inv' ? '' : 'off'}">🎒 الشنطة</button><button data-tab="craft" class="${panel.tab === 'craft' ? '' : 'off'}">🔨 تصنيع</button><button data-tab="pl" class="${panel.tab === 'pl' ? '' : 'off'}">📍 الأماكن</button><button data-x="1" style="background:#a33;margin-inline-start:auto">✕</button></div>`;
    const grid = () => { let g = '<div class="g">'; for (let i = 9; i < 36; i++) g += slotHTML(V.inv[i], 'i:' + i, pick === 'i:' + i ? 'pk' : ''); g += '</div><div class="g">'; for (let i = 0; i < 9; i++) g += slotHTML(V.inv[i], 'i:' + i, (pick === 'i:' + i ? 'pk ' : '') + (i === V.hot ? 'on' : '')); return g + '</div>'; };
    if (panel.tab === 'furnace' && d) { const pr = Math.min(100, (d.prog || 0) / 10 * 100); h = `<h3>🔥 فرن (مشترك)</h3><div class="tabs"><button data-x="1" style="background:#a33;margin-inline-start:auto">✕</button></div><div class="fz">${slotHTML(d.i, 'F:in', pick === 'F:in' ? 'pk' : '')}<span>${d.burn > 0 ? '🔥' : '▫️'}<div class="pr"><i style="width:${pr}%"></i></div></span>${slotHTML(d.o, 'F:out', pick === 'F:out' ? 'pk' : '')}</div><div class="fz">${slotHTML(d.fu, 'F:fu', pick === 'F:fu' ? 'pk' : '')}<small style="direction:rtl">وقود: فحم، خشب، ألواح، عصي</small></div><small>صهر: خام حديد/ذهب ← سبيكة • رمل ← زجاج • حجر مكسّر ← حجر • خشب ← فحم خشب</small>` + grid(); }
    else if (panel.tab === 'chest' && d) h = `<h3>📦 صندوق (مشترك)</h3><div class="tabs"><button data-x="1" style="background:#a33;margin-inline-start:auto">✕</button></div><div class="g">${d.s.map((s, i) => slotHTML(s, 'C:' + i, pick === 'C:' + i ? 'pk' : '')).join('')}</div>` + grid();
    else if (panel.tab === 'craft') { const nt = nearTable() || panel.viaTable; h += `<small>${nt ? '✅ قريب من طاولة تصنيع' : '⚠️ بعض الوصفات تحتاج تقرّب من طاولة تصنيع'}</small>` + RECIPES.map((r, i) => { const can = canCraft(V.inv, r, nt); return `<div class="rc ${can ? '' : 'no'}"><img src="${icon(r.out)}"><span><b>${itemName(r.out)}</b> ×${r.n}${r.table ? ' 🔨' : ''}<br><small>${r.ing.map(([id, k]) => `${itemName(id)} ×${k} (${invCount(V.inv, id)})`).join(' + ')}</small></span><button data-c="${i}" ${can ? '' : 'disabled style="opacity:.4"'}>صنّع</button></div>`; }).join(''); }
    else if (panel.tab === 'pl') {
      const P = V.P; h += `<small>احفظ أماكن مهمة (منجم، بيت، مزرعة...) وارجع لها أو اطلب من أصحابك يرافقونك لها. الحد ${MAX_PLACES} أماكن.</small>`;
      h += V.places.length < MAX_PLACES ? `<div style="margin:6px 0 2px"><b>📍 احفظ مكاني الحالي (X ${Math.floor(P.x)} Y ${Math.floor(P.y)} Z ${Math.floor(P.z)}) باسم:</b></div><div class="nm">${PLACE_NAMES.map((n, i) => `<button data-plnew="${i}">${n}</button>`).join('')}</div>` : '<small style="color:#ffb">وصلت الحد — احذف مكان عشان تحفظ جديد.</small>';
      h += V.places.map((pl, i) => `<div class="pl"><b>${placeLabel(pl)}<br><small>X ${pl.x}  Y ${pl.y}  Z ${pl.z} • ${Math.round(Math.hypot(pl.x + .5 - P.x, pl.z + .5 - P.z))} م</small></b><button data-plgo="${i}">🧭 اذهب</button><button data-plwith="${i}">👥 رافقني</button><button data-pldel="${i}" style="background:#a33">🗑️</button></div>`).join('') || '<div style="padding:10px;text-align:center">ما حفظت أماكن للحين</div>';
    }
    else h += grid();
    p.innerHTML = h;
  }
  function openPanel(tab, tile, viaTable, k) { panel = { tab, tile: tile || null, viaTable: !!viaTable, k: k || null }; pick = null; paintPanel(); $('#mcPanel').style.display = 'block'; }
  function closePanel() { if (panel.k) netSend({ t: 'ctclose' }); $('#mcPanel').style.display = 'none'; pick = null; panel = { tab: 'inv', tile: null, k: null }; refreshHot(); }
  $('#mcPanel').onclick = e => {
    const el = e.target.closest('[data-tab],[data-x],[data-c],[data-r],[data-plnew],[data-plgo],[data-plwith],[data-pldel]'); if (!el) return;
    if (el.dataset.plnew !== undefined) { if (V.places.length >= MAX_PLACES) { toast('وصلت الحد'); return; } const P = V.P; V.places.push({ ni: +el.dataset.plnew, x: Math.floor(P.x), y: Math.floor(P.y), z: Math.floor(P.z) }); toast('📍 انحفظ مكانك: ' + placeLabel(V.places[V.places.length - 1])); snd('craft'); savePrefs(); syncServer(); paintPanel(); return; }
    if (el.dataset.plgo !== undefined) { const p = V.places[+el.dataset.plgo]; if (p) { closePanel(); V.teleport(p.x, p.y, p.z); toast('🧭 رحت ' + placeLabel(p)); } return; }
    if (el.dataset.plwith !== undefined) { const p = V.places[+el.dataset.plwith]; if (p) { closePanel(); C.askCompanion && C.askCompanion([p.ni, p.x, p.y, p.z]); } return; }
    if (el.dataset.pldel !== undefined) { V.places.splice(+el.dataset.pldel, 1); savePrefs(); syncServer(); paintPanel(); return; }
    if (el.dataset.x) return closePanel(); if (el.dataset.tab) { if (panel.k) netSend({ t: 'ctclose' }); panel = { tab: el.dataset.tab, tile: null, k: null, viaTable: panel.viaTable }; pick = null; return paintPanel(); }
    if (el.dataset.c !== undefined) { const r = RECIPES[+el.dataset.c]; if (doCraft(V.inv, r, nearTable() || panel.viaTable)) { snd('craft'); toast('🔨 صنّعت ' + itemName(r.out)); refreshAll(); } else toast('ما تقدر تصنّع هذا (مواد ناقصة أو الشنطة ممتلئة)'); return; }
    if (el.dataset.r) { const r = el.dataset.r; if (!pick) { if (getRef(r)) { pick = r; paintPanel(); } } else { if (pick === r) pick = null; else { moveSlot(pick, r); pick = null; } refreshAll(); } }
  };
  $('#mcHot').onclick = e => { const d = e.target.closest('[data-r]'); if (d && d.dataset.r.startsWith('i:')) { V.hot = +d.dataset.r.slice(2); eatCancel(); refreshHot(); } };
  $('#mcPlB').onclick = () => { if ($('#mcPanel').style.display === 'block') closePanel(); else openPanel('pl'); };
  $('#mcInvB').onclick = () => { if ($('#mcPanel').style.display === 'block') closePanel(); else openPanel('inv'); };
  $('#mcHelpOk').onclick = () => { $('#mcHelp').style.display = 'none'; try { localStorage.setItem('mnalsifr_mc_help3', '1'); } catch {} };

  // ---------- تأثيرات الحفر: شقوق تتدرّج، شظايا، وأغراض ساقطة تنشفط لك لو قريبة (وإلا تبقى على الأرض لين تقرّب) ----------
  const crackTex = []; for (let s = 0; s < 10; s++) { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.6; let sd = 77; const rr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }; for (let k = 0; k <= s * 2 + 1; k++) { g.beginPath(); let x = 16 + (rr() - .5) * 12, y = 16 + (rr() - .5) * 12; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rr() - .5) * 18; y += (rr() - .5) * 18; g.lineTo(x, y); } g.stroke(); } const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; crackTex.push(t); }
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), crackM = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), crackMat); crackM.visible = false; S.add(crackM);
  const avgCol = {}, avgOf = id => avgCol[id] || (avgCol[id] = (() => { const t = BLOCKS[id] ? BLOCKS[id].side : 3, c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(cv, (t % ATLAS_N) * 16, Math.floor(t / ATLAS_N) * 16, 16, 16, 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255); })());
  const partGeo = new THREE.BoxGeometry(.13, .13, .13), partMats = {}, parts = [];
  function burst(id, x, y, z, n) { const o = O(); const m0 = partMats[id] || (partMats[id] = new THREE.MeshBasicMaterial({ color: avgOf(id) })); for (let i = 0; i < n && parts.length < 90; i++) { const m = new THREE.Mesh(partGeo, m0); m.position.set(x + .5 + (Math.random() - .5) * .8 + o.x, y + .5 + (Math.random() - .5) * .8 + o.y, z + .5 + (Math.random() - .5) * .8 + o.z); S.add(m); parts.push({ m, vx: (Math.random() - .5) * 3, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - .5) * 3, life: .55 + Math.random() * .3 }); } }
  function partsFrame(dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy -= 16 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.life -= dt; if (p.life <= 0) { S.remove(p.m); parts.splice(i, 1); } } }
  const matDrop = new THREE.MeshBasicMaterial({ map: tex, alphaTest: .5 }), dropGeo = {}, dropTex = {}, drops = [];
  function makeDropMesh(id) {
    const info = id < 100 ? BLOCKS[id] : null;
    if (info && !info.cross) { let g = dropGeo[id]; if (!g) { g = new THREE.BoxGeometry(.3, .3, .3); const uv = g.attributes.uv; for (let f = 0; f < 6; f++) { const t = f === 2 ? info.top : f === 3 ? info.bot : info.side, [u0, v0, u1, v1] = tileUV(t); uv.setXY(f * 4, u0, v1); uv.setXY(f * 4 + 1, u1, v1); uv.setXY(f * 4 + 2, u0, v0); uv.setXY(f * 4 + 3, u1, v0); } dropGeo[id] = g; } return new THREE.Mesh(g, matDrop); }
    let t = dropTex[id]; if (!t) { t = dropTex[id] = new THREE.TextureLoader().load(icon(id)); t.magFilter = THREE.NearestFilter; if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; }
    return new THREE.Mesh(new THREE.PlaneGeometry(.45, .45), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .2, side: THREE.DoubleSide }));
  }
  function spawnDrops(list, x, y, z) {
    for (const [id, n] of list) { if (drops.length > 120) { const o = drops.shift(); S.remove(o.mesh); } const m = makeDropMesh(id); S.add(m); drops.push({ id, n, d: 0, x: x + .5, y: y + .45, z: z + .5, vx: (Math.random() - .5) * 2.6, vy: 3.4, vz: (Math.random() - .5) * 2.6, age: 0, ph: Math.random() * 6.28, mesh: m }); }
  }
  const solidAt = (x, y, z) => { const b = BLOCKS[V.W.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.solid); };
  function dropsFrame(dt, t) {
    const P = V.P, o = O();
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.age += dt; if (d.age > 300) { S.remove(d.mesh); drops.splice(i, 1); continue; }
      const dx = P.x - d.x, dy = P.y + .9 - d.y, dz = P.z - d.z, dist = Math.hypot(dx, dy, dz);
      if (V.fp && d.age > .45 && dist < 3.4) {   // ينشفط لك
        const sp = Math.min(13, 4 + (3.4 - dist) * 3.2); d.x += dx / dist * sp * dt; d.y += dy / dist * sp * dt; d.z += dz / dist * sp * dt; d.vx = d.vy = d.vz = 0;
        if (dist < .75) { const left = invAdd(V.inv, d.id, d.n, d.d); if (left <= 0) { S.remove(d.mesh); drops.splice(i, 1); snd('pick'); refreshAll(); continue; } d.n = left; }
      } else {   // يطيح على الأرض
        d.vy -= 20 * dt; const nx = d.x + d.vx * dt, nz = d.z + d.vz * dt; if (solidAt(nx, d.y, d.z)) d.vx = 0; else d.x = nx; if (solidAt(d.x, d.y, nz)) d.vz = 0; else d.z = nz;
        const ny = d.y + d.vy * dt; if (solidAt(d.x, ny - .16, d.z)) { if (d.vy < 0) { d.y = Math.floor(ny - .16) + 1 + .16; d.vy = 0; d.vx *= .85; d.vz *= .85; } else d.vy = 0; } else d.y = ny;
      }
      d.mesh.position.set(d.x + o.x, d.y + o.y + Math.sin(t * 2.2 + d.ph) * .05 + .1, d.z + o.z); d.mesh.rotation.y += dt * 1.6;
    }
  }
  // ---------- يدك بمنظور الشخص الأول (مثل عالم البناء): تتأرجح وأنت تحفر/تضرب/تبني، وتحمل الغرض المختار ----------
  const matHand = new THREE.MeshBasicMaterial({ map: tex, alphaTest: .5, depthTest: false, fog: false }), skinMat = new THREE.MeshBasicMaterial({ color: '#d9a877', depthTest: false, fog: false }), sleeveMat = new THREE.MeshBasicMaterial({ color: '#2d6fb8', depthTest: false, fog: false });
  const hand = new THREE.Group(); hand.visible = false; hand.renderOrder = 999; hand.position.set(.42, -.4, -.7);
  const arm = new THREE.Group(); hand.add(arm); arm.rotation.set(-.15, .35, .1);
  const armM = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .62), skinMat), sleeveM = new THREE.Mesh(new THREE.BoxGeometry(.215, .215, .3), sleeveMat); armM.position.z = -.05; sleeveM.position.z = .2; armM.renderOrder = sleeveM.renderOrder = 999; arm.add(armM, sleeveM);
  let heldMesh = null, heldKey = '';
  // يحوّل رسم البكسلات لمجسّم له سُمك (كل بكسل مكعب صغير، الوجوه المخفية ما تنرسم) — المقبض عند (gx,gy)
  function extrudePix(P, s, gx, gy) {
    const pos = [], col = [], N = P.N, solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !!P.c[y * N + x], d = s / 2;
    const quad = (a, b, c2, d2, rgb, k) => { for (const v of [a, b, c2, a, c2, d2]) pos.push(...v); const L = v => Math.pow(v / 255 * k, 2.2); for (let i = 0; i < 6; i++) col.push(L(rgb[0]), L(rgb[1]), L(rgb[2])); };   // الألوان sRGB → خطّي (وإلا تطلع باهتة)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = P.c[y * N + x]; if (!p) continue;
      const x0 = (x - gx) * s, x1 = x0 + s, y1 = (gy - y) * s, y0 = y1 - s;
      quad([x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d], p, 1); quad([x1, y0, -d], [x0, y0, -d], [x0, y1, -d], [x1, y1, -d], p, .82);
      if (!solid(x - 1, y)) quad([x0, y0, -d], [x0, y0, d], [x0, y1, d], [x0, y1, -d], p, .62);
      if (!solid(x + 1, y)) quad([x1, y0, d], [x1, y0, -d], [x1, y1, -d], [x1, y1, d], p, .55);
      if (!solid(x, y - 1)) quad([x0, y1, d], [x1, y1, d], [x1, y1, -d], [x0, y1, -d], p, .9);
      if (!solid(x, y + 1)) quad([x0, y0, -d], [x1, y0, -d], [x1, y0, d], [x0, y0, d], p, .5);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  }
  const heldGeo = {}, heldMat = new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, fog: false });
  function updateHeld() {
    const s = V.inv[V.hot], key = s ? s.id : 0; if (key === heldKey) return; heldKey = key; if (heldMesh) { arm.remove(heldMesh); heldMesh = null; } if (!s) return;
    const id = s.id, info = id < 100 ? BLOCKS[id] : null;
    if (info && !info.cross) { const g = dropGeo[id] || (makeDropMesh(id), dropGeo[id]); heldMesh = new THREE.Mesh(g, matHand); heldMesh.scale.setScalar(1.15); heldMesh.position.set(-.02, .2, -.4); heldMesh.rotation.set(.3, .7, 0); }
    else if (pixItem(id)) {   // أداة: مجسّم ممسوك من المقبض، الرأس لفوق ولقدّام شوي (مثل عالم البناء)
      const g = heldGeo[id] || (heldGeo[id] = extrudePix(toolPix(id), .026, 3.5, 12.5)), m = new THREE.Mesh(g, heldMat); m.rotation.z = Math.PI / 4; m.renderOrder = 1000;
      heldMesh = new THREE.Group(); heldMesh.add(m); heldMesh.position.set(.01, .06, -.35); heldMesh.rotation.set(-.3, -.5, .32);
    }
    else { let t = dropTex[id]; if (!t) { t = dropTex[id] = new THREE.TextureLoader().load(icon(id)); t.magFilter = THREE.NearestFilter; if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; } heldMesh = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .2, side: THREE.DoubleSide, depthTest: false, fog: false })); heldMesh.position.set(0, .25, -.36); heldMesh.rotation.set(-.25, .2, -.65); }
    heldMesh.renderOrder = 1000; arm.add(heldMesh);
  }
  S.add(cam); cam.add(hand);
  let swingPh = 0, bobPh = 0;
  function handFrame(dt, t) {
    hand.visible = V.fp; if (!V.fp) return;
    const moving = WK.mv > 0, active = V.mining || V.swingT > 0 || V.using;
    if (V.mining || V.swingT > 0) { swingPh += dt * (V.mining ? 9 : 14); } else swingPh = 0; V.swingT = Math.max(0, (V.swingT || 0) - dt);
    bobPh += dt * (moving ? 9 : 2);
    const sw = (V.mining || V.swingT > 0) ? Math.abs(Math.sin(swingPh)) : 0, eat = V.using ? Math.sin(t * 18) * .04 : 0;
    arm.rotation.x = -.15 - sw * 1.05 + (V.using ? -.9 : 0); arm.rotation.y = .35 - sw * .25; arm.position.set(0, (moving ? Math.sin(bobPh) * .018 : Math.sin(bobPh) * .006) + (V.using ? .25 : 0) + eat, sw * -.18 + (V.using ? -.15 : 0));
    hand.position.x = .42 + (moving ? Math.cos(bobPh * .5) * .012 : 0);
  }
  // ---------- تأثير الضرب: اللاعب المضروب يتوهّج أحمر ويتطاير منه شظايا، وشاشتك تهتز ----------
  const redMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' }), flashing = new Map();
  function flashPeer(id) {
    const p = PEERS.get(id); if (!p || !p.w) { return; } const ms = p.w.meshes || []; if (!flashing.has(id)) for (const m of ms) { m.userData._om = m.material; m.material = redMat; }
    const prev = flashing.get(id); if (prev) clearTimeout(prev); flashing.set(id, setTimeout(() => { for (const m of ms) if (m.userData._om) { m.material = m.userData._om; m.userData._om = null; } flashing.delete(id); }, 280));
    const m0 = partMats.red || (partMats.red = new THREE.MeshBasicMaterial({ color: '#d11' })); for (let i = 0; i < 12 && parts.length < 90; i++) { const q = new THREE.Mesh(partGeo, m0); q.position.set(p.x + (Math.random() - .5) * .6, p.y + .4 + Math.random() * 1.2, p.z + (Math.random() - .5) * .6); S.add(q); parts.push({ m: q, vx: (Math.random() - .5) * 3.5, vy: 1 + Math.random() * 3, vz: (Math.random() - .5) * 3.5, life: .5 + Math.random() * .3 }); }
  }
  // ---------- النباتات (قمح/شتلات) تنمو بالوقت، والتعديلات المتتابعة تنرسل بقائمة (تعديل كل 60ms) ----------
  const crops = new Map(); let outQ = [], qLast = 0, growT = 0;
  function track(x, y, z, id) { const k = x + ',' + y + ',' + z; if (isCrop(id) || id === B.SAPLING) crops.set(k, [x, y, z, id]); else crops.delete(k); }
  function W_set(x, y, z, id) { const ok = V.W.set(x, y, z, id, false); if (ok) track(x, y, z, id); return ok; }
  function scanCrops(cx, cz) { const c = V.W.chunks.get(cx + ',' + cz); if (!c) return; for (let i = 0; i < c.b.length; i++) { const id = c.b[i]; if (id >= B.WHEAT0 && id <= B.WHEAT7 || id === B.SAPLING) track(cx * CH + (i % CH), Math.floor(i / (CH * CH)), cz * CH + Math.floor(i / CH) % CH, id); } }
  function dropCrops(cx, cz) { for (const k of [...crops.keys()]) { const c = crops.get(k); if (Math.floor(c[0] / CH) === cx && Math.floor(c[2] / CH) === cz) crops.delete(k); } }
  function qEdit(x, y, z, id) { if (W_set(x, y, z, id)) outQ.push([x, y, z, id]); }
  function drainQ(t) { if (outQ.length && t - qLast >= .06) { const e = outQ.shift(); netSend({ t: 'cwb', x: e[0], y: e[1], z: e[2], id: e[3] }); qLast = t; } }
  function growFrame(dt) {
    growT += dt; if (growT < 1) return; growT = 0; const P = V.P;
    for (const [k, c] of [...crops]) {
      const [x, y, z, id] = c; if (Math.abs(x + .5 - P.x) > 7 || Math.abs(z + .5 - P.z) > 7 || Math.abs(y - P.y) > 8) continue;
      if (isCrop(id) && id < B.WHEAT7) { if (Math.random() < .04) qEdit(x, y, z, id + 1); }
      else if (id === B.SAPLING && Math.random() < .008 && outQ.length < 30) { const below = V.W.get(x, y - 1, z); if (below !== B.DIRT && below !== B.GRASS) continue; let clear = true; for (let k2 = 1; k2 <= 5; k2++) if (V.W.get(x, y + k2, z) !== B.AIR) clear = false; if (!clear) continue; qEdit(x, y, z, B.AIR); for (const [a, b, c2, bid] of treeCells(V.W, x, y, z)) qEdit(a, b, c2, bid); }
    }
  }

  // ---------- تكسير ووضع واستخدام وقتال ----------
  let target = null, targetP = null, hitCd = 0; const tkey = (x, y, z) => x + ',' + y + ',' + z;
  const lookDir = () => { const yaw = WK.camYaw, pit = Math.max(-1.52, Math.min(1.52, -(WK.pitch - .635) * 2.45)), cp = Math.cos(pit); return [-Math.sin(yaw) * cp, Math.sin(pit), -Math.cos(yaw) * cp]; };
  function giveItems(list) { let lost = 0; for (const [id, n] of list) lost += invAdd(V.inv, id, n); if (lost) toast('🎒 الشنطة ممتلئة — ضاع بعض الأغراض'); refreshAll(); }
  function sendEdit(x, y, z, id) { netSend({ t: 'cwb', x, y, z, id }); }
  const isProt = (x, z) => { const R = window.__PROT_R !== undefined ? window.__PROT_R : 30; return R > 0 && (x <= R || z <= -200 + R || (x <= 71 + R && z >= 205 - R)); };   // لازم تطابق السيرفر (cwb)
  const placedByPlayer = (x, y, z) => { const cx = Math.floor(x / 16), cz = Math.floor(z / 16), ed = V.W.edits.get(cx + ',' + cz); return !!ed && (ed.get((y * 16 + (z - cz * 16)) * 16 + (x - cx * 16)) | 0) > 0; };   // مكعب حطّه لاعب (مو أرض طبيعية) — يقدر يشيله   // لازم تطابق السيرفر (cwb)
  let protToastT = 0; const protMsg = () => { const n = performance.now(); if (n - protToastT > 2500) { protToastT = n; toast('🛡️ أول ٣٠ مربع من حدود العالم محمية — ما تقدر تبني ولا تحفر فيها، ادخل لقدّام'); } };
  function breakBlock(tg) {
    const id = tg.id, bi = breakInfo(id, heldId()); W_set(tg.x, tg.y, tg.z, B.AIR); sendEdit(tg.x, tg.y, tg.z, 0); burst(id, tg.x, tg.y, tg.z, 10);
    spawnDrops(blockDrops(id, bi.ok), tg.x, tg.y, tg.z); const s = heldSlot(); snd('brk');
    const up = V.W.get(tg.x, tg.y + 1, tg.z); if (BLOCKS[up] && BLOCKS[up].cross) { W_set(tg.x, tg.y + 1, tg.z, B.AIR); sendEdit(tg.x, tg.y + 1, tg.z, 0); spawnDrops(blockDrops(up, true), tg.x, tg.y + 1, tg.z); burst(up, tg.x, tg.y + 1, tg.z, 5); }   // النبات فوقه يطيح
    if (s && isTool(s.id) && BLOCKS[id].hard > 0) { s.d = (s.d || 0) + 1; if (s.d >= toolInfo(s.id).dur) { V.inv[V.hot] = null; toast('💥 انكسرت ' + itemName(s.id)); } refreshHot(); }
  }
  function placeBlock() {
    const s = heldSlot(); if (!target || !s || s.id >= 100 || !BLOCKS[s.id]) return false; const id = s.id, x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz, P = V.P;
    if (y < 1 || y >= 63 || (V.W.get(x, y, z) !== B.AIR && V.W.get(x, y, z) !== B.WATER) || !inDomain(x, z)) return false;
    if (isProt(x, z)) { protMsg(); return false; }
    if (BLOCKS[id].solid && x + 1 > P.x - PW && x < P.x + PW && z + 1 > P.z - PW && z < P.z + PW && y + 1 > P.y && y < P.y + PH) return false;
    if ((id === B.SAPLING && ![B.DIRT, B.GRASS, B.SNOW].includes(V.W.get(x, y - 1, z))) || (isCrop(id) && V.W.get(x, y - 1, z) !== B.FARMLAND)) { toast('🌱 ينحط فوق تراب أو عشب'); return false; }
    if (!W_set(x, y, z, id)) return false; sendEdit(x, y, z, id); s.n--; if (s.n <= 0) V.inv[V.hot] = null; refreshHot(); snd('put'); V.swingT = .25; return true;
  }
  function eatCancel() { V.eatT = 0; V.using = false; }
  function useDown() {
    if (!V.fp || !V.ready || $('#mcPanel').style.display === 'block') return;
    if (target && INTERACT.has(target.id)) { const id = target.id, k = tkey(target.x, target.y, target.z); if (id === B.CRAFTING) openPanel('craft', null, true); else { panel = { tab: id === B.FURNACE ? 'furnace' : 'chest', tile: null, k, pending: true }; netSend({ t: 'ctop', k, b: id }); } snd('door'); return; }
    const hs = heldSlot(), P0 = V.P, dl = lookDir();
    if (target && hs && (hs.id >= 110 || (isTool(hs.id) && toolInfo(hs.id).kind === 'hoe') || hs.id === I.SEEDS) && isProt(target.x + target.nx, target.z + target.nz)) { protMsg(); return; }
    if (hs && hs.id === I.BUCKET) {   // دلو فاضي: يشفط ماء/حمم
      const tl = raycast(V.W, P0.x, P0.y + EYE, P0.z, dl[0], dl[1], dl[2], REACH, true); if (tl && (tl.id === B.WATER || tl.id === B.LAVA)) { const lava = tl.id === B.LAVA; W_set(tl.x, tl.y, tl.z, B.AIR); sendEdit(tl.x, tl.y, tl.z, 0); hs.id = lava ? I.LAVA_BUCKET : I.WATER_BUCKET; snd('put'); refreshAll(); } return;
    }
    if (hs && (hs.id === I.WATER_BUCKET || hs.id === I.LAVA_BUCKET)) {   // دلو مليان: يصب (ينسكب وينتشر، وماء+حمم = سبج)
      if (!target) return; const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz, lid = hs.id === I.LAVA_BUCKET ? B.LAVA : B.WATER; if (V.W.get(x, y, z) !== B.AIR || !inDomain(x, z)) return;
      const obs = liquidContact(V.W, x, y, z, lid); if (obs.length && obs[0][0] === x && obs[0][1] === y && obs[0][2] === z) { W_set(x, y, z, B.OBSIDIAN); sendEdit(x, y, z, B.OBSIDIAN); } else { W_set(x, y, z, lid); sendEdit(x, y, z, lid); for (const [a, b, c, bid] of obs) qEdit(a, b, c, bid); for (const [a, b, c] of spreadLiquid(V.W, x, y, z, lid)) { qEdit(a, b, c, lid); for (const [a2, b2, c2, bid2] of liquidContact(V.W, a, b, c, lid)) qEdit(a2, b2, c2, bid2); } }
      hs.id = I.BUCKET; snd('put'); refreshAll(); return;
    }
    if (hs && isTool(hs.id) && toolInfo(hs.id).kind === 'hoe' && target && (target.id === B.GRASS || target.id === B.DIRT) && target.ny === 1 && V.W.get(target.x, target.y + 1, target.z) === B.AIR) {   // معزقة: تحوّل التراب لأرض زراعة
      W_set(target.x, target.y, target.z, B.FARMLAND); sendEdit(target.x, target.y, target.z, B.FARMLAND); hs.d = (hs.d || 0) + 1; if (hs.d >= toolInfo(hs.id).dur) { V.inv[V.hot] = null; toast('💥 انكسرت ' + itemName(hs.id)); } snd('put'); refreshAll(); return;
    }
    if (hs && hs.id === I.SEEDS && target && target.id === B.FARMLAND && target.ny === 1 && V.W.get(target.x, target.y + 1, target.z) === B.AIR) {   // بذور على أرض زراعة
      W_set(target.x, target.y + 1, target.z, B.WHEAT0); sendEdit(target.x, target.y + 1, target.z, B.WHEAT0); hs.n--; if (hs.n <= 0) V.inv[V.hot] = null; snd('put'); refreshAll(); return;
    }
    const s = heldSlot(); if (s && isFood(s.id)) { if (V.hp >= 20) { toast('❤️ صحتك كاملة'); return; } V.using = true; V.eatT = 0; return; }
    placeBlock();
  }
  const useUp = () => eatCancel();
  function eatFrame(dt) { if (!V.using) return; const s = heldSlot(); if (!s || !isFood(s.id)) { eatCancel(); return; } V.eatT += dt; if (V.eatT >= EAT_T) { V.hp = Math.min(20, V.hp + ITEMS[s.id].food); s.n--; if (s.n <= 0) V.inv[V.hot] = null; V.eatT = 0; snd('eat'); if (V.hp >= 20) V.using = false; refreshAll(); } }
  function pickPlayer(maxD) {   // أقرب لاعب بالعالم تحت المؤشر
    const o = cam.position, d = lookDir(), ox = O(); let best = null, bd = maxD;
    for (const p of PEERS.values()) {
      if (!inDomain(p.x - ox.x, p.z - ox.z)) continue; for (const hy of [.35, .9, 1.45]) {
        const cx = p.x - o.x, cy = p.y + hy - o.y, cz = p.z - o.z, t = cx * d[0] + cy * d[1] + cz * d[2]; if (t < .3 || t > bd) continue;
        const px = cx - d[0] * t, py = cy - d[1] * t, pz = cz - d[2] * t; if (px * px + py * py + pz * pz < .22 && t < bd) { bd = t; best = p; }
      }
    } return best ? { p: best, d: bd } : null;
  }
  function attack(p) {
    if (hitCd > 0) return; hitCd = .5; V.swingT = .3; const dmg = weaponDamage(heldId()); netSend({ t: 'hit', to: p.id, d: dmg }); snd('hit'); const s = heldSlot();
    if (s && isTool(s.id)) { s.d = (s.d || 0) + 1; if (s.d >= toolInfo(s.id).dur) { V.inv[V.hot] = null; toast('💥 انكسرت ' + itemName(s.id)); } refreshHot(); }
  }
  function mineFrame(dt) {
    hitCd = Math.max(0, hitCd - dt);
    if (V.mining && targetP) { attack(targetP.p); V.mineT = 0; $('#mcBar').style.display = 'none'; return; }
    if (V.mining && target && isProt(target.x, target.z) && !placedByPlayer(target.x, target.y, target.z)) { protMsg(); V.mineT = 0; V.mineKey = ''; crackM.visible = false; $('#mcBar').style.display = 'none'; return; }
    if (!target || !breakable(target.id) || !V.mining) { V.mineT = 0; V.mineKey = ''; crackM.visible = false; $('#mcBar').style.display = 'none'; return; }
    const key = tkey(target.x, target.y, target.z); if (key !== V.mineKey) { V.mineKey = key; V.mineT = 0; V.digT = 0; } V.mineT += dt; V.digT = (V.digT || 0) + dt;
    const need = breakInfo(target.id, heldId()).t, pr = Math.min(1, V.mineT / need), o = O(); $('#mcBar').style.display = 'block'; $('#mcBar i').style.width = pr * 100 + '%';
    crackM.visible = pr > .02; crackM.position.set(target.x + .5 + o.x, target.y + .5 + o.y, target.z + .5 + o.z); crackMat.map = crackTex[Math.min(9, Math.floor(pr * 10))];
    if (V.digT > .24) { V.digT = 0; burst(target.id, target.x, target.y, target.z, 2); snd('dig'); }
    if (V.mineT >= need) { crackM.visible = false; breakBlock(target); V.mineT = 0; V.mineKey = ''; }
  }

  // ---------- الصحة (قلوب بدون جوع) والقتال ----------
  let lavaT = 0, hurtT = 0, airDmg = 0, regenT = 0, peak = 0, wasAir = false, sinceHit = 99;
  function damage(n, from) { if (n <= 0) return; V.hp = Math.max(0, V.hp - n); sinceHit = 0; if (from) V.lastHit = from; $('#mcHurt').style.opacity = .9; hurtT = .35; V.shakeT = .3; snd('hurt'); refreshStat(); if (V.hp <= 0) die(); }
  function die() {
    const now = performance.now(); V.deaths = (V.deathT && now - V.deathT < 600000) ? (V.deaths || 0) + 1 : 1; V.deathT = now; const second = V.deaths >= 2; if (second) V.deaths = 0;
    toast(second ? '💀 متّ مرتين — انتقلت لبوابة عالم البناء (أغراضك معك)' : '💀 متّ — رجعت لبداية العالم (أغراضك معك)'); netSend({ t: 'died', by: V.lastHit || '' }); V.hp = 20; V.air = 15; V.lastHit = ''; V.mining = false; eatCancel(); closePanel(); V.P.vx = V.P.vz = V.P.vy = V.P.kx = V.P.kz = 0; savePrefs();
    if (second) { exitFP(); C.respawn && C.respawn(); } else { const sy = V.W.surface(4, 0) + 1; V.teleport(4, Math.max(sy, 1), 0); }
    refreshStat();
  }
  function survivalFrame(dt) {
    const P = V.P; sinceHit += dt;
    if (!P.onGround && !P.inWater) { peak = Math.max(peak, P.y); wasAir = true; } else { if (wasAir && P.onGround && !P.inWater) { const d = peak - P.y - 3; if (d > 0) damage(Math.floor(d)); } peak = P.y; wasAir = false; }
    if (P.underwater) { V.air -= dt; if (V.air <= 0) { airDmg += dt; if (airDmg >= 1) { airDmg = 0; damage(2); } } } else V.air = Math.min(15, V.air + dt * 6);
    if (P.inLava) { lavaT += dt; if (lavaT >= .5) { lavaT = 0; damage(3); } } else lavaT = 0;
    if (V.hp < 20 && sinceHit > 8) { regenT += dt; if (regenT >= 4) { regenT = 0; V.hp = Math.min(20, V.hp + 1); refreshStat(); } } else regenT = 0;
  }

  // ---------- الحفظ: شنطتك بمتصفحك + أرقام بالسيرفر (مكانك مو محفوظ: ترجع للمدينة) ----------
  const LS = 'mnalsifr_mc_craft'; let saveT = 0, syncT = 0, fresh = false, vpT = 0;
  function savePrefs() { try { localStorage.setItem(LS, JSON.stringify({ inv: invFlat(V.inv), hot: V.hot, hp: V.hp, pl: plFlat() })); } catch {} }
  function loadPrefs() { let pr = null; try { pr = JSON.parse(localStorage.getItem(LS) || 'null'); } catch {} if (pr) { V.inv = invFrom(pr.inv); V.hot = pr.hot | 0; V.hp = pr.hp > 0 ? pr.hp : 20; V.places = plFrom(pr.pl); } else fresh = true; }
  loadPrefs();
  const syncServer = () => netSend({ t: 'mc', w: 'craft', x: Math.round(V.P.x), y: Math.round(V.P.y), z: Math.round(V.P.z), inv: invFlat(V.inv).slice(0, 144), pl: plFlat() });

  // ---------- رسائل الشبكة ----------
  V.onNet = m => {
    switch (m.t) {
      case 'cwe': { for (const k of m.ks || []) { sent.delete(k); synced.add(k); if (m.e && m.e[k]) { const arr = m.e[k], c = V.W.chunks.get(k); if (c) { const [cx, cz] = k.split(',').map(Number); for (let j = 0; j + 1 < arr.length; j += 2) { const i = arr[j]; W_set(cx * CH + i % CH, Math.floor(i / (CH * CH)), cz * CH + Math.floor(i / CH) % CH, arr[j + 1]); } } } } break; }
      case 'cwb': { if (m.f !== (C.myId && C.myId())) setEdit(m.x, m.y, m.z, m.id); break; }
      case 'cts': { if (panel.k === m.k) { if (!m.d) { closePanel(); break; } panel.tile = m.d; panel.tab = m.d.t === 'F' ? 'furnace' : 'chest'; panel.pending = false; if ($('#mcPanel').style.display !== 'block') { $('#mcPanel').style.display = 'block'; } paintPanel(); } break; }
      case 'ctg': { if (m.it) { const dst = V.wantDest; if (dst && dst.startsWith('i:') && !V.inv[+dst.slice(2)]) V.inv[+dst.slice(2)] = m.it; else if (invAdd(V.inv, m.it.id, m.it.n, m.it.d)) toast('🎒 الشنطة ممتلئة'); V.wantDest = null; refreshAll(); } break; }
      case 'ctn': { if (m.it && invAdd(V.inv, m.it.id, m.it.n, m.it.d)) toast('🎒 الشنطة ممتلئة'); refreshAll(); break; }
      case 'ctd': { for (const it of m.items || []) invAdd(V.inv, it.id, it.n, it.d); refreshAll(); break; }
      case 'hurt': { if (V.fp) { damage(Math.min(14, m.d | 0), m.f); V.P.kx = m.kx || 0; V.P.kz = m.kz || 0; V.P.vy = Math.max(V.P.vy, 4); toast('⚔️ ' + (m.n || 'لاعب') + ' ضربك!'); } break; }
      case 'hfx': { flashPeer(m.to); if (m.f === (C.myId && C.myId())) { const cr = $('#mcCross'); cr.style.filter = 'drop-shadow(0 0 4px #f22) hue-rotate(300deg)'; setTimeout(() => { cr.style.filter = ''; }, 200); snd('hit'); } break; }
      case 'kill': { toast('☠️ ' + (m.k ? m.k + ' قتل ' : '') + (m.v || 'لاعب') + (m.k ? '' : ' مات')); break; }
      case 'mcs': { if (!V.places.length && Array.isArray(m.pl) && m.pl.length) { V.places = plFrom(m.pl); refreshAll(); } if (fresh && Array.isArray(m.inv) && m.inv.length) { V.inv = invFrom(m.inv); fresh = false; refreshAll(); toast('☁️ رجّعنا أغراضك من حسابك'); } break; }
    }
  };

  // ---------- الدخول والخروج من منظور الشخص الأول + الحركة ----------
  const ADMIN_FP = () => !!(WK.on && !WK.intro && !C.blocked());
  function enterFP() {
    const o = O(), p = pv(), P = V.P; P.x = p.x; P.z = p.z; const sf = V.W.surface(Math.floor(P.x), Math.floor(P.z)); P.y = (WK.y - o.y > 1 && WK.y - o.y < 60) ? Math.max(WK.y - o.y, sf + 1.01) : sf + 1.01;
    if (V.pend) { P.x = V.pend.x; P.y = V.pend.y; P.z = V.pend.z; V.pend = null; let g = 0; while (g++ < 64 && (BLOCKS[V.W.get(Math.floor(P.x), Math.floor(P.y), Math.floor(P.z))].solid || BLOCKS[V.W.get(Math.floor(P.x), Math.floor(P.y + 1), Math.floor(P.z))].solid)) P.y += 1; } P.vx = P.vy = P.vz = 0; P.kx = P.kz = 0; P.onGround = false; peak = P.y; wasAir = false;
    V.fp = true; WK.walker.root.visible = false; ui.style.display = 'block'; document.body.classList.add('vox'); refreshAll(); netSend({ t: 'vf', on: 1 }); if (fresh) netSend({ t: 'mcl', w: 'craft' });
    let help = true; try { help = !localStorage.getItem('mnalsifr_mc_help3'); } catch {} $('#mcHelp').style.display = help ? 'block' : 'none'; toast('⛏️ دخلت عالم البناء — شخص أول! اضرب الشجرة وطلّع خشب');
  }
  function exitFP() {
    V.fp = false; hand.visible = false; V.mining = false; eatCancel(); closePanel(); ui.style.display = 'none'; document.body.classList.remove('vox'); WK.walker.root.visible = true; WK.mv = 0; netSend({ t: 'vf', on: 0 }); syncServer(); savePrefs();
    if (document.pointerLockElement) try { document.exitPointerLock(); } catch {}
    if (V.fov) { cam.fov = V.fov; cam.near = .5; cam.updateProjectionMatrix(); V.fov = null; }
    if (V.sky0) { S.background.copy(V.sky0.b); S.fog.color.copy(V.sky0.f); V.sky0 = null; }
  }
  // يتنادى من walkFrame بدل الحركة العادية
  V.move = (dt, ix, iz, run) => {
    const P = V.P, o = O(), yaw = WK.camYaw, sn = Math.sin(yaw), cs = Math.cos(yaw), spr = run && iz > .45 ? 1.65 : 1, mx = (-sn * iz + cs * ix) * spr, mz = (-cs * iz - sn * ix) * spr;   // ركض ×1.65
    V.sprint = spr > 1;
    if (V.ready) stepPlayer(V.W, P, mx, mz, V.jumpIn, dt); else { P.vx = P.vz = 0; }
    if (P.y < -4) {   // 🧱 شبكة أمان: طاح برّا حدود العالم → نرجّعه لأقرب أرض داخل (بدل ما يطيح للأبد)
      const x = Math.floor(Math.max(4, P.x)), z0 = Math.floor(Math.max(NORTH_BZ + 5, P.z)), z = x <= VIP_BX + 4 && z0 >= VIP_BZ - 4 ? VIP_BZ - 6 : z0;
      P.vx = P.vy = P.vz = 0; V.teleport(x, V.W.loaded(x, z) ? V.W.surface(x, z) + 1 : 45, z); toast('🧱 طحت برّا حدود العالم — رجعناك داخل');
    }
    survivalFrame(dt);
    WK.p.set(P.x + o.x, 0, P.z + o.z); WK.y = P.y + o.y - .13; WK.jy = 0; WK.yaw = yaw + Math.PI; WK.mv = Math.hypot(mx, mz) > .1 && P.onGround ? (run ? 2 : 1) : 0; WK.emote = 0;
  };
  V.camera = () => {
    const P = V.P, o = O(), yaw = WK.camYaw, pit = Math.max(-1.52, Math.min(1.52, -(WK.pitch - .635) * 2.45)), cp = Math.cos(pit);
    if (!V.fov) { V.fov = cam.fov; cam.fov = 74; cam.near = .1; cam.updateProjectionMatrix(); }
    const sk = V.shakeT > 0 ? (V.shakeT -= .016, (Math.random() - .5) * .08) : 0; cam.position.set(P.x + o.x + sk, P.y + o.y + EYE + sk * .6, P.z + o.z + sk); cam.lookAt(cam.position.x - Math.sin(yaw) * cp, cam.position.y + Math.sin(pit), cam.position.z - Math.cos(yaw) * cp);
  };
  // 🧱 لافتة السور: تطلع قدّامك لما تقرب من حد العالم
  const wsg = {};
  const wallSign = k => wsg[k] || (wsg[k] = (() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.textTex(k === 'n' ? '🏙️ ورا السور: المدينة — ارجع، والعالم يكمل من الجهة الثانية ➡️' : '🏰 ورا السور: مدينة المشتركين — العالم يكمل من الجهة الثانية ➡️', 1024, 190, '#3a2f25', '#ffd34d', 66), transparent: true, depthWrite: false })); sp.scale.set(15, 2.8, 1); sp.renderOrder = 6; sp.visible = false; S.add(sp); return sp; })());
  function wallSigns(P) {
    let best = null; const dN = P.z - NORTH_BZ; if (P.x >= 0 && dN < 30) best = { k: 'n', x: P.x, z: NORTH_BZ + 2.7, d: dN };
    if (P.x <= VIP_BX + 2 && P.z < VIP_BZ) { const d = VIP_BZ - 2 - P.z; if (d < 30 && (!best || d < best.d)) best = { k: 'v', x: P.x, z: VIP_BZ - 2.7, d }; }
    if (P.z >= VIP_BZ - 2 && P.x > VIP_BX + 2) { const d = P.x - (VIP_BX + 3); if (d < 30 && (!best || d < best.d)) best = { k: 'v', x: VIP_BX + 3.7, z: P.z, d }; }
    for (const k of ['n', 'v']) if (wsg[k]) wsg[k].visible = !!best && best.k === k && V.fp;
    if (!best || !V.fp) return; const o = O(), sp = wallSign(best.k); sp.visible = true; sp.position.set(best.x + o.x, Math.max(P.y + 3.4, 35) + o.y, best.z + o.z);
  }
  V.wallSigns = () => ({ n: !!(wsg.n && wsg.n.visible), v: !!(wsg.v && wsg.v.visible) });
  V.frame = (dt, t) => {
    if (!WK.on) { hand.visible = false; return; }   // اليد/المكعب المحمول يختفي لما نطلع من عالم البناء (كان يعلق على الشاشة)
    if (!V.fp && hand.visible) hand.visible = false; const p = pv(), indoors = !!((C.inside && C.inside()) || V.forceInside), near = !indoors && p.x > -(RD * CH + 24) && p.z > NORTH_BZ - RD * CH;
    if (near) { if (!V.zoneAt || t - V.zoneAt > 5) { V.zoneAt = t; netSend({ t: 'vz', on: 1 }); } if (!V.fp) { V.vpT2 = (V.vpT2 || 0) + dt; if (V.vpT2 > .25) { V.vpT2 = 0; netSend({ t: 'vy', x: +p.x.toFixed(1), y: 40, z: +p.z.toFixed(1) }); } } stream(V.fp ? 2 : 3, V.fp ? 2 : 2); flushSync(t); const o = O(), key = o.x + ',' + o.z; if (key !== oKey) { oKey = key; for (const m of meshes.values()) for (const x of [m.o, m.w]) if (x) x.position.set(o.x, o.y, o.z); } }
    else if (V.zoneAt) { V.zoneAt = 0; netSend({ t: 'vz', on: 0 }); if (meshes.size) { for (const k of [...meshes.keys()]) dropMesh(k); V.W.chunks.clear(); synced.clear(); needQ.clear(); sent.clear(); V.W.edits.clear(); crops.clear(); } }
    else if (meshes.size) { for (const k of [...meshes.keys()]) dropMesh(k); V.W.chunks.clear(); synced.clear(); needQ.clear(); sent.clear(); V.W.edits.clear(); }
    const free = ADMIN_FP() && !indoors; V.ready = !!(near && V.W.loaded(p.x, p.z) && meshes.has(Math.floor(p.x / CH) + ',' + Math.floor(p.z / CH)));
    if (!V.fp && free && p.x >= 4 && inDomain(p.x, p.z) && V.ready) enterFP();
    else if (V.fp && (!free || p.x < 1 || !inDomain(p.x, p.z))) { if (!free && C.blocked()) { /* ركب سيارة/لعبة: يطلع */ } exitFP(); if (WK.on) WK.y = Math.max(.3, WK.y); }
    if (!V.fp) { for (const k in wsg) wsg[k].visible = false; return; }
    const P = V.P; hitCd = Math.max(0, hitCd); wallSigns(P);
    const d = lookDir(), eye = [P.x, P.y + EYE, P.z]; target = V.ready && $('#mcPanel').style.display !== 'block' ? raycast(V.W, eye[0], eye[1], eye[2], d[0], d[1], d[2], REACH) : null;
    const pp = V.ready ? pickPlayer(4.6) : null; targetP = pp && (!target || pp.d < target.d + .2) ? pp : null;
    const hl = $('#mcCross'); hl.style.opacity = targetP ? 1 : .8;
    if (V.ready && $('#mcPanel').style.display !== 'block') { mineFrame(dt); eatFrame(dt); } else { V.mineT = 0; $('#mcBar').style.display = 'none'; }
    handFrame(dt, t); markersFrame(); partsFrame(dt); dropsFrame(dt, t); growFrame(dt); drainQ(t);
    if (hurtT > 0) { hurtT -= dt; if (hurtT <= 0) $('#mcHurt').style.opacity = 0; }
    const wet = !!P.underwater, lava = !!P.inLava; $('#mcWet').style.display = wet ? 'block' : 'none'; $('#mcLava').style.display = lava ? 'block' : 'none'; S.fog.near = lava ? .5 : wet ? 1 : RD * CH * .5; S.fog.far = lava ? 7 : wet ? 26 : RD * CH * .98;
    { const ms = (C.clock ? C.clock() : Date.now()), ph = ((ms / 1000) % 1200) / 1200, sun = Math.sin(ph * Math.PI * 2), dl = 1; dayU.value = .1 + .9 * dl; if (!V.sky0) V.sky0 = { b: S.background.clone(), f: S.fog.color.clone() }; skyC.setRGB(.02 + .53 * dl, .04 + .76 * dl, .11 + .89 * dl); S.background.copy(skyC); S.fog.color.copy(skyC); V.night = dl < .3; }
    $('#mcInfo').textContent = `X ${Math.floor(P.x)}  Y ${Math.floor(P.y)}  Z ${Math.floor(P.z)}`;
    vpT += dt; if (vpT > .2) { vpT = 0; netSend({ t: 'vy', x: +P.x.toFixed(1), y: +P.y.toFixed(1), z: +P.z.toFixed(1) }); }
    saveT += dt; syncT += dt; if (saveT > 5) { saveT = 0; savePrefs(); } if (syncT > 25) { syncT = 0; syncServer(); }
    if (panel.pending === false && panel.tab === 'furnace' && $('#mcPanel').style.display === 'block') { /* السيرفر يحدّث الفرن كل ثانية */ }
  };
  V.leave = () => { if (V.fp) exitFP(); };

  // ---------- تحكم الماوس/لوحة المفاتيح بوضع الشخص الأول ----------
  const cvs = R.domElement;
  cvs.addEventListener('pointerdown', e => {
    if (!V.fp || e.pointerType !== 'mouse') return; e.stopImmediatePropagation(); if (document.pointerLockElement !== cvs) { try { cvs.requestPointerLock(); } catch {} } if (e.button === 0) V.mining = true; else if (e.button === 2) useDown();
  }, true);
  cvs.addEventListener('pointerup', e => { if (!V.fp || e.pointerType !== 'mouse') return; e.stopImmediatePropagation(); if (e.button === 0) V.mining = false; else if (e.button === 2) useUp(); }, true);
  let tp = null;   // لمس وتثبيت على الشاشة = حفر متواصل للمكعب اللي بالمؤشر (مثل عالم البناء الجوال)
  cvs.addEventListener('pointerdown', e => { if (!V.fp || e.pointerType === 'mouse') return; if (tp) clearTimeout(tp.timer); tp = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, on: false }; tp.timer = setTimeout(() => { if (tp && !tp.moved) { tp.on = true; V.mining = true; } }, 260); }, true);
  cvs.addEventListener('pointermove', e => { if (tp && e.pointerId === tp.id && !tp.moved && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) > 14) { tp.moved = true; clearTimeout(tp.timer); if (tp.on) { V.mining = false; tp.on = false; } } }, true);
  const tpEnd = e => { if (tp && e.pointerId === tp.id) { clearTimeout(tp.timer); if (tp.on) V.mining = false; tp = null; } };
  cvs.addEventListener('pointerup', tpEnd, true); cvs.addEventListener('pointercancel', tpEnd, true);
  cvs.addEventListener('contextmenu', e => { if (V.fp) e.preventDefault(); });
  document.addEventListener('mousemove', e => { if (V.fp && document.pointerLockElement === cvs) { WK.camYaw -= e.movementX * .0028; WK.pitch = Math.max(.02, Math.min(1.25, WK.pitch + e.movementY * .0028 / 1.9 * 1.9)); } });
  cvs.addEventListener('wheel', e => { if (V.fp) { V.hot = (V.hot + (e.deltaY > 0 ? 1 : 8)) % 9; eatCancel(); refreshHot(); } }, { passive: true });
  const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch {} on(); }); const end = e => { e.stopPropagation(); off && off(); }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); };
  hold($('#mcMine'), () => { V.mining = true; }, () => { V.mining = false; }); hold($('#mcPlace'), () => useDown(), () => useUp());
  addEventListener('keydown', e => { if (!V.fp || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return; if (/^Digit[1-9]$/.test(e.code)) { V.hot = +e.code.slice(5) - 1; eatCancel(); refreshHot(); } else if (e.code === 'KeyE') $('#mcInvB').click(); else if (e.code === 'Escape') closePanel(); });
  addEventListener('blur', () => { V.mining = false; eatCancel(); });
  addEventListener('pagehide', () => { if (V.fp) { savePrefs(); syncServer(); } });
  V.state = () => ({ fp: V.fp, ready: V.ready, chunks: V.W.chunks.size, meshes: meshes.size, hp: V.hp, hot: V.hot, inv: V.inv, P: V.P, target: target && [target.x, target.y, target.z, target.id], synced: synced.size });
  V.debug = { die: () => die(), deaths: () => V.deaths || 0, sprint: () => !!V.sprint, prot: (x, z) => isProt(x, z), forceInside: on => { V.forceInside = !!on; }, hand: () => ({ vis: hand.visible, held: heldKey, sw: V.swingT || 0 }), flash: id => flashPeer(id), mining: () => V.mining, places: () => V.places, markerCount: () => markers.size, craftOut: id => { const i = RECIPES.findIndex(r => r.out === id); return i >= 0 && doCraft(V.inv, RECIPES[i], nearTable()); }, remote: (x, y, z, id) => V.onNet({ t: 'cwb', x, y, z, id, f: 'other' }), crack: () => crackM.visible, dropOff: (id, n, dx, dz) => { const p = V.P; spawnDrops([[id, n]], Math.floor(p.x + dx), Math.floor(V.W.surface(Math.floor(p.x + dx), Math.floor(p.z + dz))), Math.floor(p.z + dz)); }, drops: () => drops.length, crops: () => crops.size, dropAt: (id, n) => spawnDrops([[id, n]], Math.floor(V.P.x), Math.floor(V.P.y), Math.floor(V.P.z)), growNow: () => { for (const [k, c] of crops) if (isCrop(c[3]) && c[3] < B.WHEAT7) qEdit(c[0], c[1], c[2], c[3] + 1); }, day: () => dayU.value, setP: (x, z) => { V.P.x = x; V.P.z = z; }, use: useDown, set: (k, v) => { V[k] = v; }, give: (id, n) => { invAdd(V.inv, id, n); refreshAll(); }, damage, craftIdx: i => doCraft(V.inv, RECIPES[i], nearTable()), attack, W: V.W };
  return V;
}
