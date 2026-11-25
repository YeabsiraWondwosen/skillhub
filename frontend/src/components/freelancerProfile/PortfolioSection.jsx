import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { ArrowTopRightOnSquareIcon, CodeBracketIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
function ExternalLink({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
        label === 'Live'
          ? 'border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100'
          : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
      )}
    >
      {children}
      {label}
    </a>
  );
}

export default function PortfolioSection({ items = [] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Portfolio">
        <EmptySection title="No portfolio projects yet" hint="This freelancer hasn't shared any projects yet." />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`Portfolio (${items.length})`}>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <article key={item._id} className="group overflow-hidden rounded-xl border border-gray-100 bg-white/[0.04] transition-shadow hover:shadow-lg">
            {item.images?.[0]?.url ? (
              <img
                src={item.images[0].url}
                alt={item.title}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gray-50 text-gray-500">
                <PhotoIcon className="h-10 w-10" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-200">{item.title}</h3>
                {item.isFeatured && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                    Featured
                  </span>
                )}
              </div>
              {item.description && <p className="mt-1 text-sm leading-relaxed text-gray-500 line-clamp-2">{item.description}</p>}
              {item.technologies?.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.technologies.slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {(item.projectUrl || item.repositoryUrl) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {item.projectUrl && (
                    <ExternalLink href={item.projectUrl} label="Live">
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    </ExternalLink>
                  )}
                  {item.repositoryUrl && (
                    <ExternalLink href={item.repositoryUrl} label="Code">
                      <CodeBracketIcon className="h-3.5 w-3.5" />
                    </ExternalLink>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
