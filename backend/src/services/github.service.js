import { logger } from '../utils/logger.js';

const GITHUB_API = 'https://api.github.com';

const fetchGitHub = async (url, token) => {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'SkillHub-Integration',
  };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  return res.json();
};

export const extractGitHubUsername = (urlOrUsername) => {
  if (!urlOrUsername) return null;
  const cleaned = urlOrUsername.trim();
  const match = cleaned.match(/github\.com\/([a-zA-Z0-9-]+)\/?$/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-]+$/.test(cleaned)) return cleaned;
  return null;
};

export const fetchGitHubProfile = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const profile = await fetchGitHub(`${GITHUB_API}/users/${username}`, token);
    return {
      username: profile.login,
      displayName: profile.name || profile.login,
      bio: profile.bio || '',
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      publicRepos: profile.public_repos || 0,
      followers: profile.followers || 0,
      following: profile.following || 0,
      company: profile.company || '',
      location: profile.location || '',
      blog: profile.blog || '',
      createdAt: profile.created_at,
    };
  } catch (err) {
    logger.error(`GitHub profile fetch failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const fetchGitHubRepos = async (username, { sort = 'updated', perPage = 30, page = 1 } = {}) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const repos = await fetchGitHub(
      `${GITHUB_API}/users/${username}/repos?sort=${sort}&per_page=${perPage}&page=${page}`,
      token
    );

    return repos.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description || '',
      language: r.language || null,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      watchers: r.watchers_count || 0,
      openIssues: r.open_issues_count || 0,
      topics: r.topics || [],
      isFork: r.fork,
      isPrivate: r.private,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
      defaultBranch: r.default_branch,
      license: r.license?.spdx_id || null,
    }));
  } catch (err) {
    logger.error(`GitHub repos fetch failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const fetchGitHubLanguages = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const repos = await fetchGitHub(
      `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=100`,
      token
    );

    const languageMap = {};
    const languageBytesMap = {};

    for (const repo of repos) {
      if (repo.fork || !repo.language) continue;

      languageMap[repo.language] = (languageMap[repo.language] || 0) + 1;

      try {
        const langs = await fetchGitHub(
          `${GITHUB_API}/repos/${username}/${repo.name}/languages`,
          token
        );
        for (const [lang, bytes] of Object.entries(langs)) {
          languageBytesMap[lang] = (languageBytesMap[lang] || 0) + bytes;
        }
      } catch {
        // Skip failed individual repo language fetches
      }
    }

    const totalBytes = Object.values(languageBytesMap).reduce((a, b) => a + b, 0) || 1;

    const languages = Object.entries(languageBytesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({
        name,
        bytes,
        percentage: Math.round((bytes / totalBytes) * 100),
      }));

    return {
      topByRepos: Object.entries(languageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      byBytes: languages.slice(0, 15),
      totalLanguages: languages.length,
    };
  } catch (err) {
    logger.error(`GitHub languages fetch failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const fetchGitHubContributions = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const events = await fetchGitHub(
      `${GITHUB_API}/users/${username}/events/public?per_page=100`,
      token
    );

    const contributionsByType = {};
    const contributionsByRepo = {};
    const recentActivity = [];

    for (const event of events) {
      const type = event.type;
      const repoName = event.repo?.name || 'unknown';

      contributionsByType[type] = (contributionsByType[type] || 0) + 1;
      contributionsByRepo[repoName] = (contributionsByRepo[repoName] || 0) + 1;

      if (recentActivity.length < 15) {
        recentActivity.push({
          type: event.type,
          repo: repoName,
          createdAt: event.created_at,
          payload: {
            action: event.payload?.action || '',
            size: event.payload?.size || 0,
          },
        });
      }
    }

    const totalContributions = events.length;
    const commitEvents = contributionsByType['PushEvent'] || 0;
    const prEvents = (contributionsByType['PullRequestEvent'] || 0) + (contributionsByType['PullRequestReviewEvent'] || 0);
    const issueEvents = (contributionsByType['IssuesEvent'] || 0) + (contributionsByType['IssueCommentEvent'] || 0);

    const activityLevel = totalContributions > 100 ? 'very_active' :
      totalContributions > 50 ? 'active' :
      totalContributions > 20 ? 'moderate' :
      totalContributions > 5 ? 'low' : 'inactive';

    return {
      totalContributions,
      commitEvents,
      prEvents,
      issueEvents,
      activityLevel,
      contributionsByType,
      topRepos: Object.entries(contributionsByRepo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      recentActivity,
    };
  } catch (err) {
    logger.error(`GitHub contributions fetch failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const fetchGitHubCommitActivity = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const repos = await fetchGitHub(
      `${GITHUB_API}/users/${username}/repos?sort=pushed&per_page=10`,
      token
    );

    const weeklyActivity = [];
    const repoActivity = [];

    for (const repo of repos.slice(0, 5)) {
      if (repo.fork) continue;

      try {
        const [commits, weeklyStats] = await Promise.all([
          fetchGitHub(
            `${GITHUB_API}/repos/${username}/${repo.name}/commits?per_page=10`,
            token
          ).catch(() => []),
          fetchGitHub(
            `${GITHUB_API}/repos/${username}/${repo.name}/stats/commit_activity`,
            token
          ).catch(() => []),
        ]);

        repoActivity.push({
          repo: repo.name,
          recentCommits: commits.slice(0, 5).map(c => ({
            message: c.commit?.message?.split('\n')[0] || '',
            date: c.commit?.author?.date || c.commit?.committer?.date,
            url: c.html_url,
          })),
          totalRecentCommits: commits.length,
        });

        if (Array.isArray(weeklyStats)) {
          for (const week of weeklyStats.slice(-12)) {
            const existing = weeklyActivity.find(w => w.week === week.week);
            if (existing) {
              existing.total += week.total;
            } else {
              weeklyActivity.push({
                week: week.week,
                total: week.total,
                days: week.days,
              });
            }
          }
        }
      } catch {
        // Skip failed repo
      }
    }

    weeklyActivity.sort((a, b) => a.week - b.week);

    const totalRecentCommits = repoActivity.reduce((sum, r) => sum + r.totalRecentCommits, 0);

    return {
      weeklyActivity: weeklyActivity.slice(-12),
      repoActivity,
      totalRecentCommits,
    };
  } catch (err) {
    logger.error(`GitHub commit activity fetch failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const fetchFullGitHubData = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  const [profile, repos, languages, contributions, commitActivity] = await Promise.all([
    fetchGitHubProfile(username),
    fetchGitHubRepos(username, { perPage: 100 }),
    fetchGitHubLanguages(username),
    fetchGitHubContributions(username),
    fetchGitHubCommitActivity(username),
  ]);

  const pinnedRepos = repos
    .filter(r => !r.isFork && !r.isPrivate)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 6);

  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forks, 0);

  const contributionScore = Math.min(100, Math.round(
    (profile.publicRepos * 2) +
    (totalStars * 1.5) +
    (profile.followers * 0.5) +
    (contributions.commitEvents * 0.3) +
    (contributions.prEvents * 0.5) +
    (languages.totalLanguages * 2)
  ));

  return {
    profile,
    repos: repos.filter(r => !r.isPrivate),
    pinnedRepos,
    languages,
    contributions,
    commitActivity,
    stats: {
      totalStars,
      totalForks,
      publicRepos: profile.publicRepos,
      followers: profile.followers,
      contributionScore,
    },
    fetchedAt: new Date().toISOString(),
  };
};
