import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyIssueCaps, computeOverall, evaluatedCategories } from '../src/modules/analysis/scoring';

test('con todas las categorías, el global es el promedio ponderado', () => {
  // default: face .30, clothing .30, posture .25, context .15
  assert.equal(computeOverall({ face: 80, clothing: 60, posture: 70, context: 90 }), 73);
});

test('en un primer plano, postura y vestimenta no se evalúan ni bajan el global', () => {
  const scores = { face: 80, clothing: null, posture: null, context: 90 };
  assert.deepEqual(evaluatedCategories(scores), ['face', 'context']);
  // (80*.30 + 90*.15) / .45 = 83.3 → 83 (no se rellena con un valor supuesto)
  assert.equal(computeOverall(scores), 83);
  // con pesos de tecnología (rostro .30, entorno .20): (80*.30 + 90*.20) / .50 = 84
  assert.equal(computeOverall(scores, 'tecnologia'), 84);
});

test('medio cuerpo sin postura evaluable renormaliza con vestimenta', () => {
  // (70*.30 + 50*.30 + 60*.15) / .75 = 60
  assert.equal(computeOverall({ face: 70, clothing: 50, posture: null, context: 60 }), 60);
});

test('los topes por lentes de sol y gorra se mantienen', () => {
  assert.equal(applyIssueCaps(80, { sunglasses: true }), 45);
  assert.equal(applyIssueCaps(80, { hat: true }), 65);
  assert.equal(applyIssueCaps(80, { handGesture: true }), 74);
  assert.equal(applyIssueCaps(80, {}), 80);
});
