import { useRef, forwardRef, useImperativeHandle } from 'react';
import { otpDigits } from '../../utils/otpInput.js';

const OtpInput = forwardRef(
  (
    {
      value = '',
      onChange,
      length = 6,
      disabled = false,
      error = false,
      autoFocus = false,
      onComplete,
      className = '',
    },
    ref
  ) => {
    const inputsRef = useRef([]);

    useImperativeHandle(ref, () => ({
      focus: () => inputsRef.current[0]?.focus(),
      blur: () => inputsRef.current.forEach((i) => i?.blur()),
    }));

    const digits = otpDigits(value, length);

    const handleChange = (e, index) => {
      const v = e.target.value;
      const char = v.replace(/\D/g, '').slice(-1); // last digit if pasted
      const newDigits = [...digits];
      newDigits[index] = char;
      const next = newDigits.join('').slice(0, length);
      onChange?.(next);
      if (char && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      if (next.length === length && onComplete) onComplete(next);
    };

    const handleKeyDown = (e, index) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange?.(newDigits.join('').slice(0, length));
        inputsRef.current[index - 1]?.focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputsRef.current[index - 1]?.focus();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
        e.preventDefault();
      }
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const d = text.replace(/\D/g, '').slice(0, length);
      if (!d) return;
      onChange?.(d);
      const idx = Math.min(d.length, length - 1);
      inputsRef.current[idx]?.focus();
      if (d.length === length && onComplete) onComplete(d);
    };

    return (
      <div className={`flex gap-2 justify-center ${className}`} onPaste={handlePaste}>
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i] || ''}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            disabled={disabled}
            autoFocus={i === 0 && autoFocus}
            className={`w-12 h-12 text-center text-xl font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>
    );
  }
);

OtpInput.displayName = 'OtpInput';
export default OtpInput;
