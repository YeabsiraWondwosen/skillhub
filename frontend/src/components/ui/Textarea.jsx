import { forwardRef } from 'react';
import { clsx } from 'clsx';

const Textarea = forwardRef(function Textarea({ label, error, hint, rows = 4, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx('input resize-none', error && 'input-error', className)}
        {...props}
      />
      {error && <p className="error-msg">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
});

export default Textarea;
