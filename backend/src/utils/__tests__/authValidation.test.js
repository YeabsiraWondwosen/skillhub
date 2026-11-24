import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteAccountSchema,
  changePasswordSchema,
} from '../../validations/auth.validation.js';

test('deleteAccountSchema requires the exact word DELETE', () => {
  const ok = deleteAccountSchema.validate({ password: 'secret-pass', confirmText: 'DELETE' });
  assert.equal(ok.error, undefined);

  const lowercase = deleteAccountSchema.validate({ password: 'secret-pass', confirmText: 'delete' });
  assert.ok(lowercase.error, 'lowercase delete must be rejected');

  const wrongWord = deleteAccountSchema.validate({ password: 'secret-pass', confirmText: 'DELETE ME' });
  assert.ok(wrongWord.error, 'a longer phrase must be rejected');
});

test('deleteAccountSchema requires a password', () => {
  const missing = deleteAccountSchema.validate({ confirmText: 'DELETE' });
  assert.ok(missing.error, 'a missing password must be rejected');
});

test('changePasswordSchema enforces confirmation match and strength', () => {
  const valid = changePasswordSchema.validate({
    currentPassword: 'old-pass',
    newPassword: 'Str0ng@Pass',
    confirmPassword: 'Str0ng@Pass',
  });
  assert.equal(valid.error, undefined);

  const mismatch = changePasswordSchema.validate({
    currentPassword: 'old-pass',
    newPassword: 'Str0ng@Pass',
    confirmPassword: 'Different@1',
  });
  assert.ok(mismatch.error, 'mismatched confirmation must be rejected');

  const weak = changePasswordSchema.validate({
    currentPassword: 'old-pass',
    newPassword: 'weakpassword',
    confirmPassword: 'weakpassword',
  });
  assert.ok(weak.error, 'weak password must be rejected');
});
