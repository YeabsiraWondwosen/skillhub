import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const RULES = [
  { key: 'min', labelKey: 'auth.pwdMin', test: (v) => v.length >= 8 },
  { key: 'lower', labelKey: 'auth.pwdLower', test: (v) => /[a-z]/.test(v) },
  { key: 'upper', labelKey: 'auth.pwdUpper', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', labelKey: 'auth.pwdNumber', test: (v) => /\d/.test(v) },
  { key: 'special', labelKey: 'auth.pwdSpecial', test: (v) => /[@$!%*?&]/.test(v) },
];

export default function PasswordRequirements({ value = '' }) {
  const { t } = useTranslation();
  const show = value.length > 0;
  if (!show) return null;

  const met = RULES.filter((r) => r.test(value)).length;
  const pct = Math.round((met / RULES.length) * 100);
  const barClass =
    pct === 100
      ? 'bg-green-500'
      : pct >= 60
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-dark-800/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('auth.pwdStrength')}</p>
        <span className={clsx('text-xs font-semibold', pct === 100 ? 'text-green-600 dark:text-green-400' : pct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-300', barClass)} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {RULES.map((r) => {
          const ok = r.test(value);
          return (
            <div
              key={r.key}
              className={clsx(
                'flex items-center gap-1.5 text-xs transition-colors',
                ok ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {ok ? <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" /> : <XMarkIcon className="w-3.5 h-3.5 flex-shrink-0" />}
              <span>{t(r.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
