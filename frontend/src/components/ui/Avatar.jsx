import { clsx } from 'clsx';

const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl', '2xl': 'w-24 h-24 text-3xl' };

export default function Avatar({ src, alt = '', size = 'md', online, className }) {
  const initials = alt.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className={clsx('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={clsx(sizes[size], 'rounded-full object-cover ring-2 ring-white dark:ring-dark-800')}
        />
      ) : (
        <div className={clsx(sizes[size], 'rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold ring-2 ring-white dark:ring-dark-800')}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={clsx('absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-dark-800', online ? 'bg-green-500' : 'bg-gray-400', size === 'xs' || size === 'sm' ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5')} />
      )}
    </div>
  );
}
