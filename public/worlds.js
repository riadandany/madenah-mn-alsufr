// ================= مدخل عالم البناء (مكان البحيرة السابقة) =================
// شرق الساحة الرئيسية يبدأ عالم المكعبات (voxworld.js) عند x=144. هنا بس الديكور: ممر وبوابة حجرية وعلامات حدود ولوحات.
import * as THREE from '/vendor/three.module.min.js';

export const WX0 = 144;
const STONE = '#8c9399', DARK = '#6b7075', WOOD = '#8a5a2b';

export function createWorlds(C) {
  const { S, textTex, plaza } = C, W = {};
  const root = new THREE.Group(); S.add(root); let sg = null;
  W.parts = (P, F) => {
    const { x: ox, z: oz } = plaza(), y = .3;
    F.push([ox + 124, y, oz, 40, .07, 14, 0, '#cdb98e']);   // ممر من الساحة لحدّ العالم
    // بوابة حجرية على الحدّ (فتحة 18م)
    for (const s of [-10, 10]) { P.box.push([ox + WX0 - 3, y, oz + s, 2.6, 11, 2.6, 0, STONE]); P.box.push([ox + WX0 - 3, y + 11, oz + s, 3.4, 1.2, 3.4, 0, DARK]); }
    P.box.push([ox + WX0 - 3, y + 11.2, oz, 2.2, 2, 24, 0, STONE]); P.box.push([ox + WX0 - 3, y + 13.2, oz, 2.6, 1, 26, 0, DARK]);
    // علامات حدود (أعمدة خشب قصيرة) على طول حدّ العالم
    for (let z = -200; z <= 200; z += 20) { if (Math.abs(z) < 12) continue; P.box.push([ox + WX0 - 2, y, oz + z, .6, 1.6, .6, 0, WOOD]); P.box.push([ox + WX0 - 2, y + 1.6, oz + z, .9, .3, .9, 0, '#e9a23b']); }
  };
  W.signs = () => {
    if (!sg) {
      const mk = (txt, bg, fg, w, h, sw, sh) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(txt, w, h, bg, fg, h * .62), transparent: true, depthWrite: false })); s.scale.set(sw, sh, 1); s.renderOrder = 6; root.add(s); return s; };
      sg = { big: mk('⛏️ عالم البناء  ➜', '#1d2b36', '#9be37a', 1024, 190, 24, 4.4), warn: mk('⚔️ قتال بين اللاعبين • اللي تبنيه يشوفه الكل', '#8a2a1f', '#fff', 1280, 150, 22, 2.6), dir: mk('عالم البناء  ➜  شرقاً', '#1d2b36', '#fff', 1024, 150, 18, 2.6) };
    }
    const p = plaza(); root.position.set(p.x, .3, p.z); sg.big.position.set(WX0 - 3, 17, 0); sg.warn.position.set(WX0 - 3, 20.4, 0); sg.dir.position.set(100, 9, -14);
  };
  W.spot = () => { const p = plaza(); return { x: p.x + WX0 - 14, z: p.z }; };   // قدّام البوابة (جهة المدينة)
  W.frame = () => { const p = plaza(); root.position.set(p.x, .3, p.z); };
  return W;
}
