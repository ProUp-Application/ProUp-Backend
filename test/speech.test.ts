import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyHallucination } from '../src/lib/speech';

test('detecta lo que Whisper inventa ante el silencio (caso real del emulador)', () => {
  assert.equal(isLikelyHallucination(' Gracias. Gracias. Gracias.'), true);
  assert.equal(isLikelyHallucination('Subtítulos realizados por la comunidad de Amara.org'), true);
  assert.equal(isLikelyHallucination('¡Suscríbete!'), true);
});

test('no descarta respuestas reales, aunque incluyan "gracias"', () => {
  assert.equal(isLikelyHallucination('Hola, soy Elías. Gracias por la oportunidad.'), false);
  assert.equal(isLikelyHallucination('Reduje en 30% el tiempo de despliegue.'), false);
});
