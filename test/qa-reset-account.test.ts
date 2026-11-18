import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeTestEmail } from '../scripts/qa-reset-account';

// H02 (CP001): el script de limpieza solo borra sin --force cuentas que parecen de prueba.
test('reconoce las cuentas de prueba de la matriz de QA', () => {
  for (const e of ['prueba.cp@correo.com', 'noexiste@correo.com', 'qa1@gmail.com', 'demo@proup.pe', 'ana@example.com']) {
    assert.equal(looksLikeTestEmail(e), true, e);
  }
});

test('no acepta sin --force un correo que parece real', () => {
  for (const e of ['juan.perez@gmail.com', 'maria@upc.edu.pe']) {
    assert.equal(looksLikeTestEmail(e), false, e);
  }
});
