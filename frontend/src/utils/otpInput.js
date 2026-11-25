export const OTP_LENGTH = 6;

export function sanitizeOtpInput(value, length = OTP_LENGTH) {
  const s = String(value || '');
  const digits = s.replace(/\D/g, '');
  return digits.slice(0, length);
}

export function isOtpComplete(value, length = OTP_LENGTH) {
  return sanitizeOtpInput(value, length).length === length;
}

export function otpDigits(value, length = OTP_LENGTH) {
  const s = sanitizeOtpInput(value, length);
  return Array.from({ length }, (_, i) => s[i] || '');
}

export function setOtpDigit(value, index, digit, length = OTP_LENGTH) {
  const d = String(digit || '').replace(/\D/g, '').slice(0, 1);
  const digitsArray = otpDigits(value, length);
  digitsArray[index] = d;
  return digitsArray.join('').slice(0, length);
}

export function formatResendCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
