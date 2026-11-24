import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GITHUB_API = 'https://api.github.com';

const fetchGitHub = async (url, token) => {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'SkillHub-Verification',
  };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  return res.json();
};

export const verifyGitHubProfile = async (username) => {
  const token = process.env.GITHUB_TOKEN;

  try {
    const [profile, repos, events] = await Promise.all([
      fetchGitHub(`${GITHUB_API}/users/${username}`, token),
      fetchGitHub(`${GITHUB_API}/users/${username}/repos?sort=stars&per_page=100`, token),
      fetchGitHub(`${GITHUB_API}/users/${username}/events/public?per_page=30`, token),
    ]);

    const publicRepos = profile.public_repos || 0;
    const followers = profile.followers || 0;
    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const languageMap = {};
    repos.forEach(r => {
      if (r.language) {
        languageMap[r.language] = (languageMap[r.language] || 0) + 1;
      }
    });
    const topLanguages = Object.entries(languageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    const pinnedRepos = repos
      .filter(r => !r.fork)
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 6)
      .map(r => ({
        name: r.name,
        url: r.html_url,
        description: r.description || '',
        stars: r.stargazers_count || 0,
        language: r.language || '',
      }));

    const contributionScore = Math.min(100, Math.round(
      (publicRepos * 2) +
      (totalStars * 1.5) +
      (followers * 0.5) +
      (topLanguages.length * 5)
    ));

    return {
      username: profile.login,
      profileUrl: profile.html_url,
      publicRepos,
      totalStars,
      followers,
      contributionScore,
      topLanguages,
      pinnedRepos,
      verifiedAt: new Date(),
    };
  } catch (err) {
    logger.error(`GitHub verification failed for ${username}: ${err.message}`);
    throw err;
  }
};

export const getVerificationScore = (verifications) => {
  const scores = {
    identity: 0,
    github: 0,
    portfolio: 0,
    skill: 0,
  };

  verifications.forEach(v => {
    if (v.status !== 'approved') return;

    switch (v.type) {
      case 'identity':
        scores.identity = 100;
        break;
      case 'github':
        scores.github = Math.min(100, v.github?.contributionScore || 50);
        break;
      case 'portfolio':
        scores.portfolio = 70 + (v.portfolio?.projectScreenshots?.length || 0) * 5;
        break;
      case 'skill':
        scores.skill = v.skill?.score || 0;
        break;
    }
  });

  const verifiedCount = Object.values(scores).filter(s => s > 0).length;
  const overallScore = Math.round(
    (scores.identity * 0.25) +
    (scores.github * 0.3) +
    (scores.portfolio * 0.25) +
    (scores.skill * 0.2)
  );

  return {
    scores,
    overallScore,
    verifiedCount,
    totalTypes: 4,
    trustLevel: verifiedCount >= 4 ? 'elite' :
                verifiedCount >= 3 ? 'trusted' :
                verifiedCount >= 2 ? 'verified' :
                verifiedCount >= 1 ? 'basic' : 'unverified',
  };
};

export const getVerificationBadgeType = (type) => {
  const badgeMap = {
    identity: 'identity_verified',
    github: 'github_verified',
    portfolio: 'portfolio_verified',
    skill: 'skill_verified',
  };
  return badgeMap[type] || null;
};
