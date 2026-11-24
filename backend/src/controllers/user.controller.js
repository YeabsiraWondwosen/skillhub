import { User, Profile, Review, Job, Project, PortfolioSite, ReputationScore, Category } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, buildSortObject } from '../utils/helpers.js';
import { cacheThrough, stableKey, invalidateCache } from '../utils/cache.js';
import { uploadAvatar } from '../services/cloudinary.service.js';
import { deleteFile } from '../services/cloudinary.service.js';
import { uploadResume as uploadResumeToCloud } from '../services/cloudinary.service.js';
import { uploadPortfolioImage } from '../services/cloudinary.service.js';
import { deleteMultipleFiles } from '../services/cloudinary.service.js';
import { getEligibleContacts } from '../services/messagingRelationship.service.js';

// ─── Update User Profile ──────────────────────────────────────────────────────
export const updateMe = catchAsync(async (req, res) => {
  const { firstName, lastName, timezone, country, language, socialLinks, notificationPreferences, primaryCategory } = req.body;

  const updateData = { firstName, lastName, timezone, country, language, socialLinks, notificationPreferences };
  if (primaryCategory !== undefined) updateData.primaryCategory = primaryCategory || null;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  sendResponse(res, 200, 'Profile updated', user.toSafeObject());
});

// ─── Upload Avatar ────────────────────────────────────────────────────────────
export const uploadUserAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided');

  // Delete old avatar
  if (req.user.avatar?.publicId) {
    await deleteFile(req.user.avatar.publicId).catch(() => null);
  }

  const result = await uploadAvatar(req.file.buffer, req.user._id.toString());
  const user = await User.findByIdAndUpdate(req.user._id, { avatar: result }, { new: true });

  sendResponse(res, 200, 'Avatar updated', { avatar: user.avatar });
});

// ─── Get Freelancer Profile (public) ─────────────────────────────────────────
export const getFreelancerProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findOne({ _id: userId, role: 'freelancer', isActive: true })
    .select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

  if (!user) throw new ApiError(404, 'Freelancer not found');

  const profile = await Profile.findOne({ user: userId, isPublic: true })
    .populate('categories', 'name slug icon color parent')
    .populate('subcategories', 'name slug icon color parent');
  if (!profile) throw new ApiError(404, 'Profile not found or private');

  // Increment profile views
  await Profile.findByIdAndUpdate(profile._id, { $inc: { profileViews: 1 } });

  sendResponse(res, 200, 'Freelancer profile fetched', {
    user: user.toSafeObject(),
    profile,
  });
});

// ─── Get My Profile ───────────────────────────────────────────────────────────
export const getMyProfile = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'Profile not found');
  sendResponse(res, 200, 'Profile fetched', profile);
});

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = catchAsync(async (req, res) => {
  const updates = req.body;

  // Split selected categories into main categories and subcategories so the
  // profile always stores mains in `categories` and leaves in `subcategories`.
  if (Array.isArray(updates.categories) && updates.categories.length > 0) {
    const cats = await Category.find({ _id: { $in: updates.categories } }).select('parent').lean();
    updates.categories = cats.filter((c) => !c.parent).map((c) => c._id);
    updates.subcategories = cats.filter((c) => c.parent).map((c) => c._id);
  } else if (updates.categories && updates.categories.length === 0) {
    updates.subcategories = [];
  }

  // Use findOne + save so the pre-save hook recalculates completionScore
  let profile = await Profile.findOne({ user: req.user._id });
  if (!profile) {
    profile = await Profile.create({ user: req.user._id, ...updates });
  } else {
    Object.assign(profile, updates);
    await profile.save();
  }
  invalidateCache('freelancers:search');
  sendResponse(res, 200, 'Profile updated', profile);
});

// ─── Upload Resume ────────────────────────────────────────────────────────────
export const uploadResume = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No resume file provided');

  const profile = await Profile.findOne({ user: req.user._id });

  // Delete old resume
  if (profile?.resume?.publicId) {
    await deleteFile(profile.resume.publicId, 'raw').catch(() => null);
  }

  const result = await uploadResumeToCloud(req.file.buffer, req.user._id.toString(), req.file.originalname);

  const updatedProfile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $set: { resume: { ...result, uploadedAt: new Date() } } },
    { new: true }
  );

  sendResponse(res, 200, 'Resume uploaded', { resume: updatedProfile.resume });
});

// ─── Add/Update Experience ────────────────────────────────────────────────────
export const addExperience = catchAsync(async (req, res) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { experience: req.body } },
    { new: true }
  );
  sendResponse(res, 201, 'Experience added', profile.experience);
});

export const updateExperience = catchAsync(async (req, res) => {
  const { expId } = req.params;
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id, 'experience._id': expId },
    { $set: { 'experience.$': { ...req.body, _id: expId } } },
    { new: true }
  );
  if (!profile) throw new ApiError(404, 'Experience not found');
  sendResponse(res, 200, 'Experience updated', profile.experience);
});

export const deleteExperience = catchAsync(async (req, res) => {
  const { expId } = req.params;
  const exists = await Profile.exists({ user: req.user._id, 'experience._id': expId });
  if (!exists) throw new ApiError(404, 'Experience entry not found');
  await Profile.updateOne({ user: req.user._id }, { $pull: { experience: { _id: expId } } });
  sendResponse(res, 200, 'Experience removed');
});

// ─── Add Education ────────────────────────────────────────────────────────────
export const addEducation = catchAsync(async (req, res) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { education: req.body } },
    { new: true }
  );
  sendResponse(res, 201, 'Education added', profile.education);
});

export const deleteEducation = catchAsync(async (req, res) => {
  const { eduId } = req.params;
  const exists = await Profile.exists({ user: req.user._id, 'education._id': eduId });
  if (!exists) throw new ApiError(404, 'Education entry not found');
  await Profile.updateOne({ user: req.user._id }, { $pull: { education: { _id: eduId } } });
  sendResponse(res, 200, 'Education removed');
});

export const updateEducation = catchAsync(async (req, res) => {
  const { eduId } = req.params;
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id, 'education._id': eduId },
    { $set: { 'education.$': { ...req.body, _id: eduId } } },
    { new: true }
  );
  if (!profile) throw new ApiError(404, 'Education not found');
  sendResponse(res, 200, 'Education updated', profile.education);
});

// ─── Add Certification ────────────────────────────────────────────────────────
export const addCertification = catchAsync(async (req, res) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { certifications: req.body } },
    { new: true }
  );
  sendResponse(res, 201, 'Certification added', profile.certifications);
});

export const deleteCertification = catchAsync(async (req, res) => {
  const { certId } = req.params;
  const exists = await Profile.exists({ user: req.user._id, 'certifications._id': certId });
  if (!exists) throw new ApiError(404, 'Certification not found');
  await Profile.updateOne({ user: req.user._id }, { $pull: { certifications: { _id: certId } } });
  sendResponse(res, 200, 'Certification removed');
});

export const updateCertification = catchAsync(async (req, res) => {
  const { certId } = req.params;
  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id, 'certifications._id': certId },
    { $set: { 'certifications.$': { ...req.body, _id: certId } } },
    { new: true }
  );
  if (!profile) throw new ApiError(404, 'Certification not found');
  sendResponse(res, 200, 'Certification updated', profile.certifications);
});

// ─── Portfolio ────────────────────────────────────────────────────────────────
export const addPortfolioItem = catchAsync(async (req, res) => {
  const imageUploads = req.files?.length
    ? await Promise.all(
        req.files.map((f, i) => uploadPortfolioImage(f.buffer, req.user._id.toString(), i))
      )
    : [];

  const portfolioItem = { ...req.body, images: imageUploads };

  const profile = await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $push: { portfolio: portfolioItem } },
    { new: true }
  );
  sendResponse(res, 201, 'Portfolio item added', profile.portfolio);
});

export const updatePortfolioItem = catchAsync(async (req, res) => {
  const { itemId } = req.params;
  const profile = await Profile.findOne({ user: req.user._id });
  const item = profile?.portfolio?.id(itemId);

  if (!item) throw new ApiError(404, 'Portfolio item not found');

  const updates = { ...req.body };

  // Only replace images when new files were uploaded; otherwise keep the
  // existing ones so editing text fields never silently drops screenshots.
  if (req.files?.length) {
    const imageUploads = await Promise.all(
      req.files.map((f, i) => uploadPortfolioImage(f.buffer, req.user._id.toString(), i))
    );
    const oldPublicIds = item.images.map((img) => img.publicId).filter(Boolean);
    await deleteMultipleFiles(oldPublicIds).catch(() => null);
    updates.images = imageUploads;
  }

  Object.assign(item, updates);
  await profile.save();
  sendResponse(res, 200, 'Portfolio item updated', profile.portfolio);
});

export const deletePortfolioItem = catchAsync(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  const item = profile?.portfolio?.id(req.params.itemId);

  if (!item) throw new ApiError(404, 'Portfolio item not found');

  // Clean up Cloudinary images
  const publicIds = item.images.map((img) => img.publicId).filter(Boolean);
  await deleteMultipleFiles(publicIds).catch(() => null);

  await Profile.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { portfolio: { _id: req.params.itemId } } }
  );
  sendResponse(res, 200, 'Portfolio item removed');
});

// ─── Save / Unsave Job ────────────────────────────────────────────────────────
export const toggleSaveJob = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const user = await User.findById(req.user._id);
  const isSaved = user.savedJobs.some((id) => id.toString() === jobId);

  if (isSaved) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { savedJobs: jobId } });
    return sendResponse(res, 200, 'Job removed from saved list');
  }

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { savedJobs: jobId } });
  sendResponse(res, 200, 'Job saved successfully');
});

// ─── Get Saved Jobs ───────────────────────────────────────────────────────────
export const getSavedJobs = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'savedJobs',
    match: { status: 'open' },
    populate: { path: 'client', select: 'firstName lastName avatar' },
  });
  sendResponse(res, 200, 'Saved jobs fetched', user.savedJobs);
});

// ─── Save / Unsave Service (Catalog) ──────────────────────────────────────────
export const toggleSaveCatalog = catchAsync(async (req, res) => {
  const { catalogId } = req.params;
  const user = await User.findById(req.user._id);
  const isSaved = user.savedCatalogs.some((id) => id.toString() === catalogId);

  if (isSaved) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { savedCatalogs: catalogId } });
    return sendResponse(res, 200, 'Service removed from saved list');
  }

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { savedCatalogs: catalogId } });
  sendResponse(res, 200, 'Service saved successfully');
});

// ─── Get Saved Services (Catalogs) ────────────────────────────────────────────
export const getSavedCatalogs = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'savedCatalogs',
    match: { status: 'active', isActive: true },
    populate: [
      { path: 'freelancer', select: 'firstName lastName avatar freelancerLevel' },
      { path: 'category', select: 'name slug icon color' },
    ],
  });
  sendResponse(res, 200, 'Saved services fetched', user.savedCatalogs);
});

// ─── Search Freelancers ───────────────────────────────────────────────────────
// The public directory runs 2–6 Mongo queries per request (plus an aggregation
// for relevance/rating sorts) and is re-requested on every page navigation, so
// identical query combinations are served from a short-lived cache.
const FREELANCER_SEARCH_NS = 'freelancers:search';
const FREELANCER_SEARCH_TTL_MS = 60 * 1000;

export const searchFreelancers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    search, skills, minRate, maxRate, availability, minRating,
    country, language, category, subcategory, isVerified, sortBy,
    experienceLevel,
  } = req.query;

  const cacheKey = stableKey({ search, skills, minRate, maxRate, availability, minRating, country, language, category, subcategory, isVerified, sortBy, experienceLevel, page, limit });
  const { profiles, total } = await cacheThrough(
    FREELANCER_SEARCH_NS,
    cacheKey,
    FREELANCER_SEARCH_TTL_MS,
    () => runFreelancerSearch(req.query, { page, limit, skip }),
  );

  sendResponse(res, 200, 'Freelancers fetched', profiles, paginationMeta(total, page, limit));
});

const runFreelancerSearch = async (query, { limit, skip }) => {
  const {
    search, skills, minRate, maxRate, availability, minRating,
    country, language, category, subcategory, isVerified, sortBy,
    experienceLevel,
  } = query;

  // ── 1. Eligible users (role, activity, verification, rating) ───────────────
  const userFilter = { role: 'freelancer', isActive: true, isBanned: false };
  if (isVerified === 'true') userFilter.isVerifiedFreelancer = true;
  if (minRating) userFilter['stats.averageRating'] = { $gte: parseFloat(minRating) };
  // Freelancer experience level maps to the user's freelancer level tier.
  if (experienceLevel) {
    const levelMap = {
      entry: ['newcomer'],
      intermediate: ['intermediate'],
      expert: ['experienced', 'expert', 'top_rated_plus'],
    };
    const levels = levelMap[experienceLevel];
    if (levels) userFilter.freelancerLevel = { $in: levels };
  }

  const eligibleUserIds = (await User.find(userFilter).select('_id').lean()).map((u) => u._id);

  // ── 2. Free-text search: name OR title (tagline) OR skill OR bio OR
  //      category/subcategory name ────────────────────────────────────────────
  let allowedUserIds = eligibleUserIds;
  let matchedCategoryIds = [];
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'i');

    const nameUserIds = (await User.find({
      _id: { $in: eligibleUserIds },
      $or: [{ firstName: re }, { lastName: re }],
    }).select('_id').lean()).map((u) => u._id);

    const contentUserIds = (await Profile.find({
      user: { $in: eligibleUserIds },
      $or: [{ tagline: re }, { 'skills.name': re }, { bio: re }],
    }).select('user').lean()).map((p) => p.user);

    // Categories/subcategories whose name or slug matches the search term
    matchedCategoryIds = (await Category.find({ isActive: true, $or: [{ name: re }, { slug: re }] })
      .select('_id')
      .lean()).map((c) => c._id);

    const categoryUserIds = matchedCategoryIds.length
      ? (await Profile.find({
          user: { $in: eligibleUserIds },
          $or: [
            { categories: { $in: matchedCategoryIds } },
            { subcategories: { $in: matchedCategoryIds } },
          ],
        }).select('user').lean()).map((p) => p.user)
      : [];

    allowedUserIds = [...new Set([...nameUserIds, ...contentUserIds, ...categoryUserIds])];
  }

  // ── 3. Profile filters ─────────────────────────────────────────────────────
  const profileFilter = { isPublic: true, user: { $in: allowedUserIds } };
  const andClauses = [];

  if (skills) {
    const skillList = Array.isArray(skills) ? skills : skills.split(',');
    andClauses.push({ 'skills.name': { $in: skillList.map((s) => new RegExp(s, 'i')) } });
  }

  // Category + subcategory → resolve to concrete ids.
  // - subcategory wins when both are provided (the sub is the precise filter).
  // - a main category expands to itself + all of its active subcategories.
  // - an id that no longer exists resolves to zero ids → empty result set
  //   (never silently fall back to "show everyone").
  const rawCats = subcategory
    ? (Array.isArray(subcategory) ? subcategory : String(subcategory).split(','))
    : category
      ? (Array.isArray(category) ? category : String(category).split(','))
      : [];

  let resolvedCategoryIds = [];
  let subcategoryObjectId = null;
  let mainCategoryObjectId = null;

  if (rawCats.length) {
    const found = await Category.find({ _id: { $in: rawCats } }).lean();
    if (found.length !== rawCats.length) {
      andClauses.push({ _id: { $in: [] } });
    } else {
      const expanded = new Set(found.map((c) => c._id.toString()));
      for (const c of found) {
        if (!c.parent) {
          const subs = await Category.find({ parent: c._id, isActive: true }).select('_id').lean();
          subs.forEach((s) => expanded.add(s._id.toString()));
        }
      }
      resolvedCategoryIds = [...expanded];
      andClauses.push({
        $or: [
          { categories: { $in: resolvedCategoryIds } },
          { subcategories: { $in: resolvedCategoryIds } },
        ],
      });

      if (subcategory) {
        subcategoryObjectId = found.find((c) => c.parent)?._id ?? null;
      } else if (category) {
        mainCategoryObjectId = found.find((c) => !c.parent)?._id ?? null;
      }
    }
  }

  if (minRate || maxRate) {
    const rate = {};
    if (minRate) rate.$gte = parseFloat(minRate);
    if (maxRate) rate.$lte = parseFloat(maxRate);
    andClauses.push({ hourlyRate: rate });
  }
  if (availability) andClauses.push({ availability });
  if (country) andClauses.push({ 'location.country': new RegExp(country, 'i') });
  if (language) andClauses.push({ 'languages.name': new RegExp(language, 'i') });

  if (andClauses.length) profileFilter.$and = andClauses;

  const total = await Profile.countDocuments(profileFilter);

  const populateOptions = [
    {
      path: 'user',
      select: 'firstName lastName avatar stats isOnline lastSeen isVerifiedFreelancer freelancerLevel',
    },
    { path: 'categories', select: 'name slug icon' },
    { path: 'subcategories', select: 'name slug icon' },
  ];

  // ── 4. Sort ────────────────────────────────────────────────────────────────
  // Cross-collection sorts: rating/jobs live on the User, experience is an
  // array length, and relevance combines several sources — none of these are
  // plain Profile fields the generic sorter can handle.
  let profiles;
  if (sortBy === 'most_relevant') {
    const scoreExpr = { $add: [0] };
    if (search) {
      const reOpts = { regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' };
      scoreExpr.$add.push(
        { $cond: [{ $regexMatch: { input: { $ifNull: [{ $arrayElemAt: ['$userDoc.firstName', 0] }, ''] }, ...reOpts } }, 3, 0] },
        { $cond: [{ $regexMatch: { input: { $ifNull: [{ $arrayElemAt: ['$userDoc.lastName', 0] }, ''] }, ...reOpts } }, 3, 0] },
        { $cond: [{ $regexMatch: { input: { $ifNull: ['$tagline', ''] }, ...reOpts } }, 2, 0] },
        { $cond: [{ $regexMatch: { input: { $ifNull: ['$bio', ''] }, ...reOpts } }, 1, 0] },
        {
          $cond: [{
            $regexMatch: {
              input: { $reduce: { input: { $ifNull: ['$skills', []] }, initialValue: '', in: { $concat: ['$$value', ' ', { $ifNull: ['$$this.name', ''] }] } } },
              ...reOpts,
            },
          }, 2, 0],
        },
      );
      if (matchedCategoryIds.length) {
        scoreExpr.$add.push(
          { $cond: [{ $gt: [{ $size: { $setIntersection: [matchedCategoryIds, { $ifNull: ['$categories', []] }] } }, 0] }, 1, 0] },
          { $cond: [{ $gt: [{ $size: { $setIntersection: [matchedCategoryIds, { $ifNull: ['$subcategories', []] }] } }, 0] }, 1, 0] },
        );
      }
    }
    if (subcategoryObjectId) {
      scoreExpr.$add.push(
        { $cond: [{ $in: [subcategoryObjectId, { $ifNull: ['$subcategories', []] }] }, 4, 0] },
        { $cond: [{ $in: [subcategoryObjectId, { $ifNull: ['$categories', []] }] }, 2, 0] },
      );
    } else if (mainCategoryObjectId) {
      scoreExpr.$add.push(
        { $cond: [{ $in: [mainCategoryObjectId, { $ifNull: ['$categories', []] }] }, 2, 0] },
        { $cond: [{ $in: [mainCategoryObjectId, { $ifNull: ['$subcategories', []] }] }, 1, 0] },
      );
    }

    const agg = await Profile.aggregate([
      { $match: profileFilter },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $addFields: { score: scoreExpr } },
      { $sort: { score: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { score: 0, userDoc: 0 } },
    ]);
    profiles = await Profile.populate(agg, populateOptions);
  } else if (
    sortBy === 'stats.averageRating:desc' ||
    sortBy === 'stats.completedProjects:desc' ||
    sortBy === 'experience:desc'
  ) {
    const sortValue =
      sortBy === 'stats.averageRating:desc'
        ? { $ifNull: [{ $arrayElemAt: ['$userDoc.stats.averageRating', 0] }, 0] }
        : sortBy === 'stats.completedProjects:desc'
          ? { $ifNull: [{ $arrayElemAt: ['$userDoc.stats.completedProjects', 0] }, 0] }
          : { $size: { $ifNull: ['$experience', []] } };

    const agg = await Profile.aggregate([
      { $match: profileFilter },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $addFields: { sortValue } },
      { $sort: { sortValue: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { sortValue: 0, userDoc: 0 } },
    ]);
    profiles = await Profile.populate(agg, populateOptions);
  } else {
    const sort = buildSortObject(sortBy);
    profiles = await Profile.find(profileFilter)
      .populate(populateOptions)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  // Store plain JSON so the cached entry can be re-serialized safely.
  return { profiles: JSON.parse(JSON.stringify(profiles)), total };
};

// ─── Get User Public Stats ────────────────────────────────────────────────────
export const getUserStats = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select('stats firstName lastName avatar role');
  if (!user) throw new ApiError(404, 'User not found');
  sendResponse(res, 200, 'User stats fetched', user);
});

// ─── Search Users for Messaging ──────────────────────────────────────────────
// Only returns users the current user has a legitimate SkillHub relationship
// with (existing conversation, accepted proposal, active contract, active
// project). Unrelated registered users are never returned, even without a query.
export const searchUsers = catchAsync(async (req, res) => {
  const { q } = req.query;

  const eligible = await getEligibleContacts(req.user._id);
  const eligibleIds = eligible.map((c) => c.user._id.toString());

  if (eligibleIds.length === 0) {
    return sendResponse(res, 200, 'Users found', []);
  }

  let users = eligible.map((c) => c.user);

  if (q && q.trim()) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    users = users.filter(
      (u) => regex.test(u.firstName || '') || regex.test(u.lastName || '')
    );
  }

  const result = users.map((u) => ({
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    avatar: u.avatar,
    role: u.role,
    isOnline: u.isOnline,
    relationshipType: eligible.find((c) => c.user._id.toString() === u._id.toString())?.relationshipType,
  }));

  sendResponse(res, 200, 'Users found', result);
});

// ─── Profile Card (for modal popups) ────────────────────────────────────────
export const getProfileCard = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('firstName lastName avatar role isOnline lastSeen isVerifiedFreelancer stats country language socialLinks badges freelancerLevel createdAt')
    .lean();

  if (!user) throw new ApiError(404, 'User not found');

  const profile = await Profile.findOne({ user: userId }).lean();

  const [reviewAgg, reputation, portfolioSite] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: user._id, isPublic: true } },
      { $group: {
        _id: null,
        avgOverall: { $avg: '$rating.overall' },
        avgCommunication: { $avg: '$rating.communication' },
        avgQuality: { $avg: '$rating.quality' },
        avgExpertise: { $avg: '$rating.expertise' },
        avgProfessionalism: { $avg: '$rating.professionalism' },
        avgDeadline: { $avg: '$rating.deadlineAdherence' },
        totalReviews: { $sum: 1 },
      }},
    ]),
    ReputationScore.findOne({ user: userId }).lean(),
    PortfolioSite.findOne({ user: userId, isDefault: true }).lean(),
  ]);

  const stats = reviewAgg[0] || {};
  const reviews = await Review.find({ reviewee: userId, isPublic: true })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('reviewer', 'firstName lastName avatar role')
    .populate('project', 'title')
    .lean();

  sendResponse(res, 200, 'Profile card fetched', {
    user,
    profile,
    reviews: {
      average: {
        overall: stats.avgOverall ? Math.round(stats.avgOverall * 10) / 10 : user.stats?.averageRating || 0,
        communication: stats.avgCommunication ? Math.round(stats.avgCommunication * 10) / 10 : null,
        quality: stats.avgQuality ? Math.round(stats.avgQuality * 10) / 10 : null,
        expertise: stats.avgExpertise ? Math.round(stats.avgExpertise * 10) / 10 : null,
        professionalism: stats.avgProfessionalism ? Math.round(stats.avgProfessionalism * 10) / 10 : null,
        deadlineAdherence: stats.avgDeadline ? Math.round(stats.avgDeadline * 10) / 10 : null,
      },
      total: stats.totalReviews || user.stats?.totalReviews || 0,
      recent: reviews,
    },
    reputation: reputation ? {
      trustScore: reputation.trustScore,
      trustTier: reputation.trustTier,
      completionRate: reputation.rawMetrics?.onTimeRate || 0,
      responseTime: user.stats?.responseTime || null,
    } : null,
    portfolioSite: portfolioSite ? { slug: portfolioSite.slug, title: portfolioSite.title } : null,
  });
});

// ─── Full Profile Page ──────────────────────────────────────────────────────
export const getFullProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('firstName lastName avatar role isOnline lastSeen isVerifiedFreelancer stats country language socialLinks badges freelancerLevel levelProgress createdAt')
    .lean();

  if (!user) throw new ApiError(404, 'User not found');

  const profile = await Profile.findOne({ user: userId }).lean();

  const [reviewAgg, reviews, reputation, portfolioSite] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: user._id, isPublic: true } },
      { $group: {
        _id: null,
        avgOverall: { $avg: '$rating.overall' },
        avgCommunication: { $avg: '$rating.communication' },
        avgQuality: { $avg: '$rating.quality' },
        avgExpertise: { $avg: '$rating.expertise' },
        avgProfessionalism: { $avg: '$rating.professionalism' },
        avgDeadline: { $avg: '$rating.deadlineAdherence' },
        totalReviews: { $sum: 1 },
        fiveStar: { $sum: { $cond: [{ $eq: ['$rating.overall', 5] }, 1, 0] } },
        fourStar: { $sum: { $cond: [{ $eq: ['$rating.overall', 4] }, 1, 0] } },
        threeStar: { $sum: { $cond: [{ $eq: ['$rating.overall', 3] }, 1, 0] } },
        twoStar: { $sum: { $cond: [{ $eq: ['$rating.overall', 2] }, 1, 0] } },
        oneStar: { $sum: { $cond: [{ $eq: ['$rating.overall', 1] }, 1, 0] } },
      }},
    ]),
    Review.find({ reviewee: userId, isPublic: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('reviewer', 'firstName lastName avatar role')
      .populate('project', 'title')
      .lean(),
    ReputationScore.findOne({ user: userId }).lean(),
    PortfolioSite.findOne({ user: userId, isDefault: true }).lean(),
  ]);

  const stats = reviewAgg[0] || {};

  sendResponse(res, 200, 'Full profile fetched', {
    user,
    profile,
    reviews: {
      average: {
        overall: stats.avgOverall ? Math.round(stats.avgOverall * 10) / 10 : user.stats?.averageRating || 0,
        communication: stats.avgCommunication ? Math.round(stats.avgCommunication * 10) / 10 : null,
        quality: stats.avgQuality ? Math.round(stats.avgQuality * 10) / 10 : null,
        expertise: stats.avgExpertise ? Math.round(stats.avgExpertise * 10) / 10 : null,
        professionalism: stats.avgProfessionalism ? Math.round(stats.avgProfessionalism * 10) / 10 : null,
        deadlineAdherence: stats.avgDeadline ? Math.round(stats.avgDeadline * 10) / 10 : null,
      },
      total: stats.totalReviews || user.stats?.totalReviews || 0,
      breakdown: {
        5: stats.fiveStar || 0,
        4: stats.fourStar || 0,
        3: stats.threeStar || 0,
        2: stats.twoStar || 0,
        1: stats.oneStar || 0,
      },
      recent: reviews,
    },
    reputation: reputation ? {
      trustScore: reputation.trustScore,
      trustTier: reputation.trustTier,
      completionRate: reputation.rawMetrics?.onTimeRate || 0,
      responseTime: user.stats?.responseTime || null,
      totalProjects: reputation.rawMetrics?.totalProjects || 0,
      completedProjects: reputation.rawMetrics?.completedProjects || 0,
    } : {
      trustScore: 0,
      trustTier: 'unrated',
      completionRate: 0,
      responseTime: null,
      totalProjects: 0,
      completedProjects: 0,
    },
    portfolioSite: portfolioSite ? { slug: portfolioSite.slug, title: portfolioSite.title } : null,
  });
});

// ─── Client Profile Page (public) ───────────────────────────────────────────
// Client profiles are intentionally different from freelancer profiles: they
// surface real hiring activity (jobs, contracts, reviews) instead of skills,
// portfolio and earnings, which do not apply to clients.
export const getClientProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('firstName lastName avatar role isOnline lastSeen stats country language socialLinks badges createdAt')
    .lean();

  if (!user) throw new ApiError(404, 'Client not found');
  if (user.role !== 'client') throw new ApiError(404, 'Client not found');

  const profile = await Profile.findOne({ user: userId, isPublic: true }).lean();
  if (!profile) throw new ApiError(404, 'Client not found or profile is private');

  const [clientStats, recentJobs] = await Promise.all([
    computeClientStats(userId),
    Job.find({ client: userId, visibility: 'public', isApproved: true, status: { $ne: 'draft' } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('title budget status createdAt slug')
      .lean(),
  ]);

  sendResponse(res, 200, 'Client profile fetched', { user, profile, clientStats, recentJobs });
});

const ACTIVE_JOB_STATUSES = [
  'open', 'proposals_received', 'freelancer_selected',
  'payment_pending', 'funded', 'in_progress', 'delivery_submitted', 'client_review',
];
const ACTIVE_CONTRACT_STATUSES = [
  'pending_payment', 'active', 'on_hold', 'pending_delivery', 'in_revision', 'disputed',
];

// Real hiring statistics computed from the client's actual activity. Every
// value comes from a real database count/aggregation — nothing is faked.
async function computeClientStats(userId) {
  const [jobsPosted, activeJobs, freelancersHired, openContracts, completedContracts, ratingGivenAgg] =
    await Promise.all([
      Job.countDocuments({ client: userId, status: { $ne: 'draft' } }),
      Job.countDocuments({ client: userId, status: { $in: ACTIVE_JOB_STATUSES } }),
      Project.distinct('freelancer', { client: userId }),
      Project.countDocuments({ client: userId, status: { $in: ACTIVE_CONTRACT_STATUSES } }),
      Project.countDocuments({ client: userId, status: 'completed' }),
      Review.aggregate([
        { $match: { reviewer: userId, reviewerRole: 'client', 'rating.overall': { $exists: true, $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$rating.overall' } } },
      ]),
    ]);

  return {
    jobsPosted,
    activeJobs,
    freelancersHired: (freelancersHired || []).filter(Boolean).length,
    openContracts,
    completedContracts,
    averageRatingGiven: ratingGivenAgg[0] ? Math.round(ratingGivenAgg[0].avg * 10) / 10 : null,
  };
}
