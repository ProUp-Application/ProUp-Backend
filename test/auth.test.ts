import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../src/modules/auth/auth.schemas';

const valid = { email: 'demo@correo.com', firstName: 'Ana', lastName: 'Ríos', acceptedTerms: true as const };

const passwordErrors = (password: string) => {
  const r = registerSchema.safeParse({ ...valid, password });
  return r.success ? [] : r.error.flatten().fieldErrors.password ?? [];
};

test('acepta una contraseña que cumple la política', () => {
  assert.equal(registerSchema.safeParse({ ...valid, password: 'Segura2026' }).success, true);
});

const cases: [string, RegExp][] = [
  ['Ab1', /al menos 8 caracteres/],
  ['segura2026', /mayúscula/],
  ['SEGURA2026', /minúscula/],
  ['SeguraSinNumero', /número/],
];

for (const [pwd, msg] of cases) {
  test(`rechaza "${pwd}" con un mensaje específico`, () => {
    const errors = passwordErrors(pwd);
    assert.ok(errors.some((e) => msg.test(e)), `esperaba ${msg}, obtuve: ${errors.join(' | ')}`);
  });
}

test('el correo inválido tiene un mensaje claro', () => {
  const r = registerSchema.safeParse({ ...valid, email: 'correo-sin-arroba', password: 'Segura2026' });
  assert.equal(r.success, false);
  const msg = r.success ? '' : r.error.flatten().fieldErrors.email?.[0] ?? '';
  assert.match(msg, /correo válido/);
});
