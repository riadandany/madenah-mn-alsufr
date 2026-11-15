import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { createRapierWorld } from '../../public/rapier-world.js';

const R = 0.55;
// صندوق = [minX,maxX,minZ,maxZ,minY,maxY]
const WALL = [5, 5.2, -50, 50, 0, 4];
const CURB = [3, 3.5, -50, 50, 0, 0.2]; // رصيف واطي: الشخصية تتخطاه (القديم يتجاهل اللي تحت y+.35)

test('قفزة كبيرة باتجاه سور رفيع تتوقف قدّامه (بدون اختراق)', async () => {
  const w = await createRapierWorld(RAPIER);
  w.setSolids([WALL]);
  const p = { x: 0, z: 0 };
  w.move(p, 0, 10, 0);
  assert.ok(p.x <= 5 - R + 0.05, 'x=' + p.x);
  assert.ok(p.x > 3.5, 'x=' + p.x);
});

test('الانزلاق على السور', async () => {
  const w = await createRapierWorld(RAPIER);
  w.setSolids([WALL]);
  const p = { x: 0, z: 0 };
  w.move(p, 0, 10, 10);
  assert.ok(p.x <= 5 - R + 0.05);
  assert.ok(p.z > 8, 'z=' + p.z);
});

test('الرصيف الواطي ما يوقف الشخصية', async () => {
  const w = await createRapierWorld(RAPIER);
  w.setSolids([CURB]);
  const p = { x: 0, z: 0 };
  w.move(p, 0, 6, 0);
  assert.ok(p.x > 5.5, 'x=' + p.x);
});

test('الارتفاع: لو الشخصية فوق سقف الصندوق ما يصدّها', async () => {
  const w = await createRapierWorld(RAPIER);
  w.setSolids([[2, 3, -5, 5, 0, 1.5]]);
  const p = { x: 0, z: 0 };
  w.move(p, 1.6, 6, 0); // قدماها فوق 1.5 (قفزة)
  assert.ok(p.x > 5.5, 'x=' + p.x);
});

test('setSolids ينظّف القديم', async () => {
  const w = await createRapierWorld(RAPIER);
  w.setSolids([WALL]);
  w.setSolids([]);
  const p = { x: 0, z: 0 };
  w.move(p, 0, 10, 0);
  assert.ok(p.x > 9.9, 'x=' + p.x);
});
