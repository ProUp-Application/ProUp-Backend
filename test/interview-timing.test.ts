import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineOverall, timeLimitFor, timeNote } from '../src/modules/interview/interview.timing';

test('el Elevator Pitch tiene una referencia de 60 segundos', () => {
  assert.equal(timeLimitFor('PITCH'), 60);
  assert.equal(timeLimitFor('BEHAVIORAL'), 120);
});

test('un pitch de 80 s recibe un comentario sobre el tiempo; uno de 55 s no', () => {
  assert.match(timeNote('PITCH', 80) ?? '', /80 s .* 60 s/);
  assert.equal(timeNote('PITCH', 55), null);
  assert.match(timeNote('PITCH', 15) ?? '', /solo 15 s/);
});

test('sin duración registrada no se comenta el tiempo', () => {
  assert.equal(timeNote('BEHAVIORAL', undefined), null);
});

test('el puntaje global se basa en el contenido; la cámara aporta 30% solo si se midió', () => {
  assert.equal(combineOverall(70), 70);
  assert.equal(combineOverall(70, 90), 76);
});
