import { useQuery } from '@tanstack/react-query';
import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { developerVerificationService } from '@/services/developerVerification.service';
import { clsx } from 'clsx';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const VERIFICATION_META = {
  identity: { label: 'Identity', hint: 'Government-issued ID' },
  github: { label: 'GitHub', hint: 'Contribution activity' },
  portfolio: { label: 'Portfolio', hint: 'Sample projects' },
  skill: { label: 'Skills', hint: 'Skill assessments' },
};

const TRUST_COLOR = {
  unverified: { badge: 'bg-gray-100 text-gray-500', bar: 'bg-gray-400', label: 'Unverified' },
  basic: { badge: 'bg-sky-500/15 text-sky-400', bar: 'bg-sky-500', label: 'Basic' },
  verified: { badge: 'bg-green-100 text-green-600', bar: 'bg-green-500', label: 'Verified' },
  trusted: { badge: 'bg-emerald-500/15 text-emerald-400', bar: 'bg-emerald-500', label: 'Trusted' },
  elite: { badge: 'bg-primary-50 text-primary-600', bar: 'bg-gradient-to-r from-primary-500 to-secondary-500', label: 'Elite' },
};

export default function VerificationSection({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['verification-score', userId],
    queryFn: () => developerVerificationService.getScoreByUser(userId).then((r) => r.data),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.data;

  if (isLoading || !score) return null;

  if (!score.overallScore && score.verifiedCount === 0) {
    return (
      <SectionCard title="Verification">
        <EmptySection title="Not verified yet" hint="This freelancer hasn't completed identity or skill verification yet." />
      </SectionCard>
    );
  }

  const trust = TRUST_COLOR[score.trustLevel] || TRUST_COLOR.unverified;

  return (
    <SectionCard title="Verification">
      <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Trust score</p>
            <p className="text-xs text-gray-400">
              {score.verifiedCount} of {score.totalTypes} checks passed
            </p>
          </div>
          <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', trust.badge)}>{trust.label}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className={clsx('h-full rounded-full transition-all', trust.bar)} style={{ width: `${Math.min(100, score.overallScore)}%` }} />
        </div>
        <p className="mt-1.5 text-right text-xs font-semibold text-gray-500">{score.overallScore}/100</p>
      </div>

      <ul className="mt-4 space-y-3">
        {Object.entries(VERIFICATION_META).map(([key, meta]) => {
          const value = score.scores?.[key] ?? 0;
          const passed = value > 0;
          return (
            <li key={key} className="flex items-start gap-3">
              <span className={clsx('mt-0.5', passed ? 'text-green-500' : 'text-gray-500')}>
                <CheckCircleIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx('text-sm font-medium', passed ? 'text-gray-200' : 'text-gray-500')}>
                  {meta.label}
                </p>
                <p className="text-xs text-gray-500">{passed ? `${value} score` : meta.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
