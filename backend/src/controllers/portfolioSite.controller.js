import { PortfolioSite, Profile, User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { generateAIContent, generatePortfolioHTML, getTemplates } from '../services/portfolioSite.service.js';
import { fetchFullGitHubData } from '../services/github.service.js';

// ─── Get Available Templates ─────────────────────────────────────────────────
export const getTemplatesList = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Templates fetched', getTemplates());
});

// ─── Generate Portfolio Site ─────────────────────────────────────────────────
export const generatePortfolio = catchAsync(async (req, res) => {
  const { title, customization } = req.body;

  const [profile, userDoc] = await Promise.all([
    Profile.findOne({ user: req.user._id }).populate('user', 'firstName lastName email avatar role freelancerLevel stats socialLinks'),
    User.findById(req.user._id).select('firstName lastName email avatar role freelancerLevel stats socialLinks'),
  ]);

  if (!profile) throw new ApiError(404, 'Profile not found. Complete your profile first.');

  let githubData = null;
  if (profile.githubData?.username) {
    try {
      githubData = await fetchFullGitHubData(profile.githubData.username);
    } catch {
      // Use cached data from profile
      githubData = profile.githubData;
    }
  }

  const aiContent = await generateAIContent(profile, userDoc, githubData);
  const generatedHtml = generatePortfolioHTML(aiContent, profile, userDoc, githubData, customization);

  const site = await PortfolioSite.create({
    user: req.user._id,
    title: title || `${userDoc.firstName} ${userDoc.lastName} - Portfolio`,
    customization: customization || {},
    aiContent,
    generatedHtml,
  });

  sendResponse(res, 201, 'Portfolio generated', site);
});

// ─── Get My Portfolio Sites ──────────────────────────────────────────────────
export const getMySites = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { user: req.user._id };
  const total = await PortfolioSite.countDocuments(filter);
  const sites = await PortfolioSite.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-generatedHtml');

  sendResponse(res, 200, 'Portfolio sites fetched', sites, paginationMeta(total, page, limit));
});

// ─── Get Portfolio Site Detail ───────────────────────────────────────────────
export const getSite = catchAsync(async (req, res) => {
  const site = await PortfolioSite.findOne({ slug: req.params.slug, user: req.user._id });
  if (!site) throw new ApiError(404, 'Portfolio site not found');
  sendResponse(res, 200, 'Portfolio site fetched', site);
});

// ─── Get Portfolio HTML ──────────────────────────────────────────────────────
export const getSiteHtml = catchAsync(async (req, res) => {
  const site = await PortfolioSite.findOne({ slug: req.params.slug, user: req.user._id });
  if (!site) throw new ApiError(404, 'Portfolio site not found');
  sendResponse(res, 200, 'HTML fetched', { html: site.generatedHtml, slug: site.slug });
});

// ─── View Public Portfolio ───────────────────────────────────────────────────
export const viewPublicSite = catchAsync(async (req, res) => {
  const site = await PortfolioSite.findOne({ slug: req.params.slug });
  if (!site) throw new ApiError(404, 'Portfolio not found');

  await PortfolioSite.findByIdAndUpdate(site._id, { $inc: { 'stats.views': 1 } });

  sendResponse(res, 200, 'Portfolio HTML fetched', { html: site.generatedHtml });
});

// ─── Update Portfolio Site ───────────────────────────────────────────────────
export const updateSite = catchAsync(async (req, res) => {
  const site = await PortfolioSite.findOne({ slug: req.params.slug, user: req.user._id });
  if (!site) throw new ApiError(404, 'Portfolio site not found');

  const { title, customization } = req.body;

  if (title) site.title = title;
  if (customization) {
    site.customization = { ...site.customization, ...customization };

    // Regenerate HTML with new customization
    const [profile, userDoc] = await Promise.all([
      Profile.findOne({ user: req.user._id }).populate('user', 'firstName lastName email avatar role freelancerLevel stats socialLinks'),
      User.findById(req.user._id).select('firstName lastName email avatar role freelancerLevel stats socialLinks'),
    ]);

    if (profile && userDoc) {
      let githubData = profile.githubData;
      if (profile.githubData?.username) {
        try {
          githubData = await fetchFullGitHubData(profile.githubData.username);
        } catch {
          // Use cached
        }
      }

      site.generatedHtml = generatePortfolioHTML(site.aiContent, profile, userDoc, githubData, site.customization);
    }
  }

  await site.save();
  sendResponse(res, 200, 'Portfolio site updated', site);
});

// ─── Delete Portfolio Site ───────────────────────────────────────────────────
export const deleteSite = catchAsync(async (req, res) => {
  const site = await PortfolioSite.findOneAndDelete({ slug: req.params.slug, user: req.user._id });
  if (!site) throw new ApiError(404, 'Portfolio site not found');
  sendResponse(res, 200, 'Portfolio site deleted');
});

// ─── Set Default Portfolio ───────────────────────────────────────────────────
export const setDefault = catchAsync(async (req, res) => {
  const { slug } = req.params;

  await PortfolioSite.updateMany(
    { user: req.user._id },
    { $set: { isDefault: false } }
  );

  const site = await PortfolioSite.findOneAndUpdate(
    { slug, user: req.user._id },
    { $set: { isDefault: true } },
    { new: true }
  );

  if (!site) throw new ApiError(404, 'Portfolio site not found');
  sendResponse(res, 200, 'Default portfolio set', site);
});

// ─── Get Portfolio Stats ─────────────────────────────────────────────────────
export const getStats = catchAsync(async (req, res) => {
  const sites = await PortfolioSite.find({ user: req.user._id }).select('stats createdAt isDefault');

  const totalSites = sites.length;
  const totalViews = sites.reduce((sum, s) => sum + (s.stats?.views || 0), 0);
  const totalDownloads = sites.reduce((sum, s) => sum + (s.stats?.downloads || 0), 0);
  const defaultSite = sites.find(s => s.isDefault);
  const lastGenerated = sites.length ? new Date(Math.max(...sites.map(s => new Date(s.createdAt)))) : null;

  sendResponse(res, 200, 'Stats fetched', {
    totalSites,
    totalViews,
    totalDownloads,
    defaultSiteSlug: defaultSite?.slug || null,
    lastGenerated,
  });
});
