import { forwardRef } from 'react';
import { clsx } from 'clsx';

const Select = forwardRef(function Select({ label, error, children, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select
        ref={ref}
        className={clsx('input', error && 'input-error', className)}
        {...props}
      >
        {children}
      </select>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
});

export default Select;
