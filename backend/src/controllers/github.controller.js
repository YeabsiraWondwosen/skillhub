import { User, Profile } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse } from '../utils/apiResponse.js';
import {
  extractGitHubUsername,
  fetchFullGitHubData,
  fetchGitHubProfile,
  fetchGitHubRepos,
  fetchGitHubLanguages,
  fetchGitHubContributions,
  fetchGitHubCommitActivity,
} from '../services/github.service.js';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const isCacheValid = (cachedAt) => {
  if (!cachedAt) return false;
  return Date.now() - new Date(cachedAt).getTime() < CACHE_TTL;
};

// ─── Link GitHub Account (save username to user) ─────────────────────────────
export const linkGitHub = catchAsync(async (req, res) => {
  const { githubUrl } = req.body;
  const username = extractGitHubUsername(githubUrl);

  if (!username) throw new ApiError(400, 'Invalid GitHub URL or username');

  // Verify the user exists on GitHub
  const profile = await fetchGitHubProfile(username);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { 'socialLinks.github': profile.profileUrl } },
    { new: true }
  );

  sendResponse(res, 200, 'GitHub account linked', {
    username: profile.username,
    profileUrl: profile.profileUrl,
    socialLinks: user.socialLinks,
  });
});

// ─── Unlink GitHub Account ────────────────────────────────────────────────────
export const unlinkGitHub = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { 'socialLinks.github': '' } },
    { new: true }
  );

  // Clear cached GitHub data from profile
  await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $unset: { githubData: 1 } }
  );

  sendResponse(res, 200, 'GitHub account unlinked', { socialLinks: user.socialLinks });
});

// ─── Get GitHub Data for Own Profile (with caching) ──────────────────────────
export const getMyGitHubData = catchAsync(async (req, res) => {
  const username = extractGitHubUsername(req.user.socialLinks?.github);
  if (!username) throw new ApiError(400, 'No GitHub account linked. Please link your GitHub first.');

  const profile = await Profile.findOne({ user: req.user._id });
  if (profile?.githubData?.username === username && isCacheValid(profile.githubData?.fetchedAt)) {
    return sendResponse(res, 200, 'GitHub data fetched (cached)', profile.githubData);
  }

  const githubData = await fetchFullGitHubData(username);

  await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $set: { githubData } },
    { new: true }
  );

  sendResponse(res, 200, 'GitHub data fetched', githubData);
});

// ─── Get GitHub Data for Any User (public, with caching) ─────────────────────
export const getUserGitHubData = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('socialLinks');
  if (!user) throw new ApiError(404, 'User not found');

  const username = extractGitHubUsername(user.socialLinks?.github);
  if (!username) throw new ApiError(404, 'No GitHub account linked for this user');

  const profile = await Profile.findOne({ user: userId });
  if (profile?.githubData?.username === username && isCacheValid(profile.githubData?.fetchedAt)) {
    return sendResponse(res, 200, 'GitHub data fetched (cached)', profile.githubData);
  }

  const githubData = await fetchFullGitHubData(username);

  await Profile.findOneAndUpdate(
    { user: userId },
    { $set: { githubData } },
    { new: true }
  );

  sendResponse(res, 200, 'GitHub data fetched', githubData);
});

// ─── Refresh GitHub Data (force refresh) ─────────────────────────────────────
export const refreshGitHubData = catchAsync(async (req, res) => {
  const username = extractGitHubUsername(req.user.socialLinks?.github);
  if (!username) throw new ApiError(400, 'No GitHub account linked');

  const githubData = await fetchFullGitHubData(username);

  await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $set: { githubData } },
    { new: true }
  );

  sendResponse(res, 200, 'GitHub data refreshed', githubData);
});

// ─── Get GitHub Repos Only ───────────────────────────────────────────────────
export const getGitHubRepos = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { sort = 'updated', perPage = 30, page = 1 } = req.query;

  const user = await User.findById(userId).select('socialLinks');
  if (!user) throw new ApiError(404, 'User not found');

  const username = extractGitHubUsername(user.socialLinks?.github);
  if (!username) throw new ApiError(404, 'No GitHub account linked');

  const repos = await fetchGitHubRepos(username, { sort, perPage: Number(perPage), page: Number(page) });
  sendResponse(res, 200, 'Repos fetched', repos);
});

// ─── Get GitHub Languages Only ───────────────────────────────────────────────
export const getGitHubLanguages = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('socialLinks');
  if (!user) throw new ApiError(404, 'User not found');

  const username = extractGitHubUsername(user.socialLinks?.github);
  if (!username) throw new ApiError(404, 'No GitHub account linked');

  const languages = await fetchGitHubLanguages(username);
  sendResponse(res, 200, 'Languages fetched', languages);
});

// ─── Get GitHub Contributions Only ───────────────────────────────────────────
export const getGitHubContributions = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('socialLinks');
  if (!user) throw new ApiError(404, 'User not found');

  const username = extractGitHubUsername(user.socialLinks?.github);
  if (!username) throw new ApiError(404, 'No GitHub account linked');

  const contributions = await fetchGitHubContributions(username);
  sendResponse(res, 200, 'Contributions fetched', contributions);
});

// ─── Get GitHub Commit Activity Only ─────────────────────────────────────────
export const getGitHubCommitActivity = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('socialLinks');
  if (!user) throw new ApiError(404, 'User not found');

  const username = extractGitHubUsername(user.socialLinks?.github);
  if (!username) throw new ApiError(404, 'No GitHub account linked');

  const activity = await fetchGitHubCommitActivity(username);
  sendResponse(res, 200, 'Commit activity fetched', activity);
});
