import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCount, moveSwept, pushOutOfBox, MAX_STEP } from '../../public/physics.js';

const R = 0.55;
const WALL = [5, 5.2, -50, 50]; // سور رفيع عند x=5..5.2

test('stepCount: حركة صغيرة خطوة وحدة، والكبيرة تتقسّم، وله سقف', () => {
  assert.equal(stepCount(0, 0), 1);
  assert.equal(stepCount(MAX_STEP, 0), 1);
  assert.equal(stepCount(1, 0), 4);
  assert.equal(stepCount(100, 0), 64);
});

test('بدون تقسيم: قفزة كبيرة تعدّي السور (يوثّق العيب القديم)', () => {
  const p = { x: 0, z: 0 };
  p.x += 10; pushOutOfBox(p, WALL, R);
  assert.equal(p.x, 10);
});

test('مع التقسيم: نفس القفزة توقف قدّام السور', () => {
  const p = { x: 0, z: 0 };
  moveSwept(p, 10, 0, q => pushOutOfBox(q, WALL, R));
  assert.ok(p.x <= 5 - R + 1e-9, 'x=' + p.x);
  assert.ok(p.x > 4, 'x=' + p.x);
});

test('الانزلاق: حركة مائلة على السور تكمل بمحاذاته', () => {
  const p = { x: 0, z: 0 };
  moveSwept(p, 10, 10, q => pushOutOfBox(q, WALL, R));
  assert.ok(p.x <= 5 - R + 1e-9);
  assert.ok(Math.abs(p.z - 10) < 1e-6, 'z=' + p.z);
});

test('لو المركز داخل الصندوق: يُدفع لأقرب جهة', () => {
  const p = { x: 5.05, z: 0 };
  assert.equal(pushOutOfBox(p, WALL, R), true);
  assert.ok(Math.abs(p.x - (5 - R)) < 1e-9);
});

test('بعيد عن الصندوق: ما يتحرك ويرجع false', () => {
  const p = { x: 0, z: 0 };
  assert.equal(pushOutOfBox(p, WALL, R), false);
  assert.deepEqual(p, { x: 0, z: 0 });
});
