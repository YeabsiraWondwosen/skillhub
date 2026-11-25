import { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const Input = forwardRef(function Input({ label, error, hint, className, icon: Icon, type = 'text', ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          className={clsx('input', Icon && 'pl-9', isPassword && 'pr-10', error && 'input-error', className)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="error-msg">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
});

export default Input;
