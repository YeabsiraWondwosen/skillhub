import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { githubService } from '@/services/github.service';
import {
  StarIcon,
  CodeBracketIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  FireIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Scala: '#c22d40', R: '#198CE7', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883', Svelte: '#ff3e00',
  SCSS: '#c6538c', Dockerfile: '#384d54', Makefile: '#427819',
};

function LanguageBar({ languages }) {
  if (!languages?.byBytes?.length) return null;
  const displayed = languages.byBytes.slice(0, 8);
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 w-full">
        {displayed.map((lang, i) => (
          <div
            key={lang.name}
            className="h-full transition-all"
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: LANGUAGE_COLORS[lang.name] || '#6b7280',
            }}
            title={`${lang.name}: ${lang.percentage}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {displayed.map(lang => (
          <span key={lang.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: LANGUAGE_COLORS[lang.name] || '#6b7280' }} />
            {lang.name} <span className="text-gray-400 dark:text-gray-500">{lang.percentage}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ContributionGraph({ weeklyActivity }) {
  if (!weeklyActivity?.length) return null;

  const maxTotal = Math.max(...weeklyActivity.map(w => w.total), 1);

  return (
    <div className="flex items-end gap-1 h-20">
      {weeklyActivity.map((week, i) => {
        const height = Math.max((week.total / maxTotal) * 100, 4);
        return (
          <div
            key={i}
            className="flex-1 rounded-t transition-all group relative"
            style={{
              height: `${height}%`,
              backgroundColor: week.total === 0
                ? 'rgb(229 231 235)'
                : week.total > maxTotal * 0.7
                  ? 'rgb(34 197 94)'
                  : week.total > maxTotal * 0.3
                    ? 'rgb(74 222 128)'
                    : 'rgb(187 247 208)',
            }}
            title={`${week.total} contributions`}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              {week.total} contributions
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RepoCard({ repo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm text-primary-600 dark:text-primary-400 group-hover:underline truncate">
          {repo.name}
        </h4>
        <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
      </div>
      {repo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{repo.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || '#6b7280' }} />
            {repo.language}
          </span>
        )}
        {repo.stars > 0 && (
          <span className="flex items-center gap-1">
            <StarIcon className="w-3.5 h-3.5" /> {repo.stars}
          </span>
        )}
        {repo.forks > 0 && (
          <span className="flex items-center gap-1">
            <CodeBracketIcon className="w-3.5 h-3.5" /> {repo.forks}
          </span>
        )}
        {repo.updatedAt && (
          <span className="ml-auto text-gray-300 dark:text-gray-600">
            {formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}
          </span>
        )}
      </div>
      {repo.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {repo.topics.slice(0, 5).map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
              {t}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

function CommitActivitySection({ commitActivity }) {
  if (!commitActivity?.repoActivity?.length) return null;

  return (
    <div className="space-y-3">
      {commitActivity.repoActivity.map(repo => (
        <div key={repo.repo} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{repo.repo}</h5>
            <span className="text-[10px] text-gray-400">{repo.totalRecentCommits} recent commits</span>
          </div>
          <div className="space-y-1.5">
            {repo.recentCommits.slice(0, 3).map((commit, i) => (
              <a
                key={i}
                href={commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 group"
              >
                <CheckCircleIcon className="w-3 h-3 text-green-400 flex-shrink-0" />
                <span className="truncate">{commit.message}</span>
                {commit.date && (
                  <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 group-hover:text-primary-500">
                    {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityBadge({ level }) {
  const styles = {
    very_active: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    active: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    moderate: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
    low: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    inactive: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  };

  const labels = {
    very_active: 'Very Active', active: 'Active', moderate: 'Moderate',
    low: 'Low Activity', inactive: 'Inactive',
  };

  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', styles[level] || styles.inactive)}>
      <FireIcon className="w-3 h-3" />
      {labels[level] || level}
    </span>
  );
}

export default function GitHubProfile({ userId, isOwnProfile = false }) {
  const [showAllRepos, setShowAllRepos] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['github', userId],
    queryFn: () => githubService.getUserData(userId).then(r => r.data),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="card p-6 space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="card p-6 text-center">
        <CodeBracketIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No GitHub data available</p>
        {isOwnProfile && (
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Link your GitHub in profile settings to display your work</p>
        )}
      </div>
    );
  }

  const gh = data.data;
  const displayedRepos = showAllRepos ? gh.repos : gh.repos?.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* GitHub Profile Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-center gap-4 mb-4">
          {gh.profile?.avatarUrl && (
            <img src={gh.profile.avatarUrl} alt={gh.profile.displayName} className="w-14 h-14 rounded-full ring-2 ring-gray-100 dark:ring-gray-700" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white truncate">{gh.profile?.displayName || gh.profile?.username}</h3>
              {gh.contributions?.activityLevel && <ActivityBadge level={gh.contributions.activityLevel} />}
            </div>
            <a
              href={gh.profile?.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              @{gh.profile?.username} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
            {gh.profile?.bio && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{gh.profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Repos', value: gh.stats?.publicRepos ?? 0, icon: CodeBracketIcon },
            { label: 'Stars', value: gh.stats?.totalStars ?? 0, icon: StarIcon },
            { label: 'Followers', value: gh.stats?.followers ?? 0, icon: FireIcon },
            { label: 'Score', value: `${gh.stats?.contributionScore ?? 0}/100`, icon: CheckCircleIcon },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 text-center">
              <s.icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Languages */}
      {gh.languages?.byBytes?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">L</span>
            Top Languages
          </h3>
          <LanguageBar languages={gh.languages} />
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span>{gh.languages.totalLanguages} languages used across repos</span>
          </div>
        </motion.div>
      )}

      {/* Contribution Activity */}
      {gh.contributions && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">C</span>
            Contribution Activity
          </h3>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{gh.contributions.totalContributions}</p>
              <p className="text-[10px] text-gray-400 uppercase">Total Events</p>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{gh.contributions.commitEvents}</p>
              <p className="text-[10px] text-gray-400 uppercase">Commits</p>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{gh.contributions.prEvents + gh.contributions.issueEvents}</p>
              <p className="text-[10px] text-gray-400 uppercase">PRs & Issues</p>
            </div>
          </div>

          {/* Weekly Activity Bar Chart */}
          {gh.commitActivity?.weeklyActivity?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Weekly commit activity (last 12 weeks)</p>
              <ContributionGraph weeklyActivity={gh.commitActivity.weeklyActivity} />
            </div>
          )}

          {/* Top Repos by Activity */}
          {gh.contributions.topRepos?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Most active repositories</p>
              <div className="space-y-1.5">
                {gh.contributions.topRepos.slice(0, 5).map(repo => (
                  <div key={repo.name} className="flex items-center gap-2 text-xs">
                    <div className="flex-1 bg-gray-100 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-400 h-full rounded-full"
                        style={{ width: `${(repo.count / gh.contributions.topRepos[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 w-16 truncate">{repo.name.split('/').pop()}</span>
                    <span className="text-gray-400 w-6 text-right">{repo.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Repositories */}
      {gh.repos?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold">R</span>
            Repositories
            <span className="text-xs font-normal text-gray-400 ml-auto">{gh.repos.length} public</span>
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {displayedRepos.map(repo => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
          {gh.repos.length > 6 && (
            <button
              onClick={() => setShowAllRepos(!showAllRepos)}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mx-auto"
            >
              {showAllRepos ? (
                <>Show less <ChevronUpIcon className="w-3.5 h-3.5" /></>
              ) : (
                <>View all {gh.repos.length} repos <ChevronDownIcon className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </motion.div>
      )}

      {/* Recent Commits */}
      {gh.commitActivity?.repoActivity?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">M</span>
            Recent Commits
          </h3>
          <CommitActivitySection commitActivity={gh.commitActivity} />
        </motion.div>
      )}

      {/* Pinned Repositories */}
      {gh.pinnedRepos?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-yellow-500 flex items-center justify-center text-[10px] text-white font-bold">P</span>
            Pinned Projects
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {gh.pinnedRepos.map(repo => (
              <RepoCard key={repo.id || repo.name} repo={repo} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-300 dark:text-gray-600">
        <CalendarDaysIcon className="w-3.5 h-3.5" />
        {gh.fetchedAt && <span>Last synced {formatDistanceToNow(new Date(gh.fetchedAt), { addSuffix: true })}</span>}
      </div>
    </div>
  );
}
