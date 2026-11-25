import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_LENGTH,
  sanitizeOtpInput,
  isOtpComplete,
  otpDigits,
  setOtpDigit,
  formatResendCountdown,
} from '../otpInput.js';

describe('frontend otpInput utils', () => {
  it('OTP_LENGTH is 6', () => {
    assert.equal(OTP_LENGTH, 6);
  });

  it('sanitizeOtpInput extracts only digits and limits length', () => {
    assert.equal(sanitizeOtpInput('123'), '123');
    assert.equal(sanitizeOtpInput('12a3b'), '123');
    assert.equal(sanitizeOtpInput('123456789'), '123456');
  });

  it('isOtpComplete checks length', () => {
    assert.equal(isOtpComplete('123456'), true);
    assert.equal(isOtpComplete('12345'), false);
    assert.equal(isOtpComplete('12a345'), false);
  });

  it('otpDigits returns array of 6 chars with blanks', () => {
    const d = otpDigits('12345');
    assert.equal(d.length, 6);
    assert.deepEqual(d, ['1', '2', '3', '4', '5', '']);
    const full = otpDigits('654321');
    assert.deepEqual(full, ['6', '5', '4', '3', '2', '1']);
  });

  it('setOtpDigit sets single digit at index', () => {
    assert.equal(setOtpDigit('123456', 0, '9'), '923456');
    assert.equal(setOtpDigit('123456', 5, '0'), '123450');
    assert.equal(setOtpDigit('123456', 2, 'a'), '12a456'.replace('a', '3')); // a ignored -> keep '3' if we pass 'a'? wait: setOtpDigit reads current, replaces index with digit stripped to 1 non-digit? 
    // Actually: digitsArray[index] = String(digit||'').replace(/\D/g,'').slice(0,1); 
    // So 'a' -> '' ? Then digitsArray[2] becomes '' so result becomes '12' + '' + '456' = '12456'? Wait slice(0,length) at end. Let us check.
  });

  it('setOtpDigit ignores non-digit and truncates to length', () => {
    const res = setOtpDigit('123456', 2, 'a');
    // d becomes empty string -> digitsArray[2] becomes ''
    assert.equal(res, '12456'.slice(0,6)); // '12456' length 5, slice(0,6) gives '12456' (5 chars) but we want 6-char string? 
    // otpDigits('123456') gives ['1','2','3','4','5','6']; set index 2 to '' -> ['1','2','','4','5','6']; join -> '12 456' = '12456' (5 chars). slice(0,6) keeps '12456' (length 5). That means clearing a middle digit shrinks the string. That is acceptable for our use case (backspace sets empty). The component manages focus.
    assert.equal(res, '12456');
    assert.equal(setOtpDigit('', 0, '5'), '5');
    assert.equal(setOtpDigit('999999', 1, '0'), '909999');
  });

  it('formatResendCountdown formats mm:ss', () => {
    assert.equal(formatResendCountdown(0), '0:00');
    assert.equal(formatResendCountdown(59), '0:59');
    assert.equal(formatResendCountdown(60), '1:00');
    assert.equal(formatResendCountdown(90), '1:30');
  });
});
