import { Catalog, Category, User, Review, Project, ServiceOrder, SkillTaxonomy, Profile } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { uploadMultipleFiles, deleteMultipleFiles } from '../services/cloudinary.service.js';
import { getFirstPackagePriceError } from '../config/pricing.js';

// ─── Category ↔ Subcategory pairing validation ───────────────────────────────
// Enforces the single canonical hierarchy: a catalog's subcategory must be a real
// subcategory that belongs to its selected main category.
const validateCategorySubcategory = async (categoryId, subcategoryId) => {
  const category = await Category.findById(categoryId).lean();
  if (!category) throw new ApiError(404, 'Category not found');

  if (!subcategoryId) return { category };

  const subcategory = await Category.findById(subcategoryId).lean();
  if (!subcategory) throw new ApiError(404, 'Subcategory not found');
  if (!subcategory.parent) throw new ApiError(400, 'Selected subcategory must be a subcategory, not a main category');
  if (subcategory.parent.toString() !== category._id.toString()) {
    throw new ApiError(400, 'Subcategory does not belong to the selected category');
  }
  return { category, subcategory };
};

// ─── Pricing package validation ──────────────────────────────────────────────
// Defense-in-depth for the shared pricing rules: even if a request reaches the
// controller without passing the Joi route schema, every pricing package must
// meet MIN_PACKAGE_PRICE and prices must strictly increase
// (Basic < Standard < Premium). Rejects empty, non-numeric, zero and negative.
const validatePackagePrices = (pricingTiers) => {
  if (pricingTiers === undefined || pricingTiers === null) return;
  const tiers = Array.isArray(pricingTiers) ? pricingTiers : [pricingTiers];
  const error = getFirstPackagePriceError(tiers);
  if (error) throw new ApiError(400, error);
};

// ─── Create Catalog ───────────────────────────────────────────────────────────
export const createCatalog = catchAsync(async (req, res) => {
  const images = req.files?.length
    ? await uploadMultipleFiles(req.files, 'catalogs')
    : [];

  const { category, subcategory } = await validateCategorySubcategory(
    req.body.category,
    req.body.subcategory || null
  );

  validatePackagePrices(req.body.pricingTiers);

  const catalog = await Catalog.create({
    ...req.body,
    freelancer: req.user._id,
    category: category._id,
    subcategory: subcategory ? subcategory._id : null,
    images,
  });

  await catalog.populate([
    { path: 'freelancer', select: 'firstName lastName avatar stats' },
    { path: 'category', select: 'name slug icon color' },
    { path: 'subcategory', select: 'name slug' },
  ]);
  sendResponse(res, 201, 'Catalog created', catalog);
});

// ─── Get All Catalogs (public browse) ─────────────────────────────────────────
// Uses an aggregation so we can compute a live `startingPrice` (min across
// tiers) for price filtering/sorting, which works for pre-existing catalogs
// that predate the denormalized field.
export const getCatalogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    category,
    subcategory,
    skills,
    minPrice,
    maxPrice,
    rating,
    maxDeliveryTime,
    sortBy,
    status = 'active',
    availability,
    isVerified,
    sellerLevel,
  } = req.query;
  const search = req.query.q || req.query.search;

  const match = { status, isActive: true };

  if (search) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    const orClauses = [
      { title: searchRegex },
      { shortDescription: searchRegex },
      { description: searchRegex },
      { skills: searchRegex },
      { tags: searchRegex },
    ];
    const categoryMatches = await Category.find({ name: searchRegex }).select('_id').lean();
    if (categoryMatches.length > 0) {
      const ids = categoryMatches.map((c) => c._id);
      orClauses.push({ category: { $in: ids } });
      orClauses.push({ subcategory: { $in: ids } });
    }
    match.$or = orClauses;
  }
  if (category) match.category = category;
  if (subcategory) match.subcategory = subcategory;
  if (skills) {
    const skillList = Array.isArray(skills) ? skills : skills.split(',');
    match.skills = { $in: skillList.map((s) => new RegExp(s.trim(), 'i')) };
  }
  if (rating) match['stats.avgRating'] = { $gte: parseFloat(rating) };
  if (maxDeliveryTime) match.minDeliveryDays = { $lte: parseInt(maxDeliveryTime, 10) };
  if (minPrice || maxPrice) {
    match.startingPrice = {};
    if (minPrice) match.startingPrice.$gte = parseFloat(minPrice);
    if (maxPrice) match.startingPrice.$lte = parseFloat(maxPrice);
  }

  // Optional filters on the catalog's freelancer (availability, verified
  // badge, seller level). Resolve the matching freelancer ids up front so the
  // aggregation only constrains `freelancer` on the catalog documents.
  const userFilter = { role: 'freelancer', isActive: true, isBanned: false };
  const AVAILABILITY_VALUES = ['available', 'busy', 'vacation', 'offline'];
  if (availability && AVAILABILITY_VALUES.includes(availability)) {
    userFilter.availabilityStatus = availability;
  }
  if (isVerified === 'true') userFilter.isVerifiedFreelancer = true;
  const SELLER_LEVELS = ['newcomer', 'intermediate', 'experienced', 'expert', 'top_rated_plus'];
  if (sellerLevel && SELLER_LEVELS.includes(sellerLevel)) {
    userFilter.freelancerLevel = sellerLevel;
  }
  const hasUserFilter =
    Object.prototype.hasOwnProperty.call(userFilter, 'availabilityStatus') ||
    Object.prototype.hasOwnProperty.call(userFilter, 'isVerifiedFreelancer') ||
    Object.prototype.hasOwnProperty.call(userFilter, 'freelancerLevel');
  if (hasUserFilter) {
    const matching = await User.find(userFilter).select('_id').lean();
    match.freelancer = { $in: matching.map((u) => u._id) };
  }

  const sortMap = {
    'price-asc': { startingPrice: 1, createdAt: -1 },
    'price-desc': { startingPrice: -1, createdAt: -1 },
    popular: { 'stats.orders': -1, createdAt: -1 },
    'highest-rated': { 'stats.avgRating': -1, 'stats.totalReviews': -1, createdAt: -1 },
    oldest: { createdAt: 1 },
    newest: { createdAt: -1 },
  };
  const sort = sortMap[sortBy] || { createdAt: -1 };

  const [result] = await Catalog.aggregate([
    {
      $addFields: {
        startingPrice: { $min: '$pricingTiers.price' },
        // Fastest tier delivery time normalized to days so the delivery filter
        // works with the real DB values (weeks are converted to 7x days).
        minDeliveryDays: {
          $ifNull: [
            {
              $min: {
                $map: {
                  input: '$pricingTiers',
                  as: 't',
                  in: {
                    $multiply: [
                      '$$t.deliveryTime',
                      { $cond: [{ $eq: ['$$t.deliveryUnit', 'weeks'] }, 7, 1] },
                    ],
                  },
                },
              },
            },
            999999,
          ],
        },
      },
    },
    { $match: match },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'freelancer',
              foreignField: '_id',
              as: 'freelancer',
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'subcategory',
              foreignField: '_id',
              as: 'subcategory',
            },
          },
          {
            $addFields: {
              freelancer: { $arrayElemAt: ['$freelancer', 0] },
              category: { $arrayElemAt: ['$category', 0] },
              subcategory: { $arrayElemAt: ['$subcategory', 0] },
            },
          },
          {
            $project: {
              'freelancer.password': 0,
              'freelancer.refreshTokens': 0,
              'freelancer.email': 0,
              'freelancer.createdAt': 0,
              'freelancer.updatedAt': 0,
              'freelancer.__v': 0,
            },
          },
        ],
      },
    },
  ]);

  const total = result?.metadata?.[0]?.total || 0;
  const catalogs = result?.data || [];

  sendResponse(res, 200, 'Catalogs fetched', catalogs, paginationMeta(total, page, limit));
});

// ─── Get Single Catalog ───────────────────────────────────────────────────────
export const getCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findOne({ slug: req.params.slug, isActive: true })
    .populate('freelancer', 'firstName lastName avatar stats freelancerLevel badges country')
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug');

  if (!catalog) throw new ApiError(404, 'Catalog not found');

  // Visibility: only the owner (or an admin/moderator) may view draft/paused
  // catalogs; everyone else only sees published (active) ones.
  const isOwner = req.user && catalog.freelancer?._id?.toString() === req.user._id.toString();
  const isStaff = req.user && ['admin', 'moderator'].includes(req.user.role);
  if (catalog.status !== 'active' && !isOwner && !isStaff) {
    throw new ApiError(404, 'Catalog not found');
  }

  // Track view (skip when the owner views their own unpublished catalog)
  if (catalog.status === 'active' || isOwner) {
    await Catalog.findByIdAndUpdate(catalog._id, { $inc: { 'stats.views': 1 } });
  }

  sendResponse(res, 200, 'Catalog fetched', catalog);
});

// ─── Get My Catalogs ──────────────────────────────────────────────────────────
export const getMyCatalogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = { freelancer: req.user._id };
  if (status) filter.status = status;

  const total = await Catalog.countDocuments(filter);
  const catalogs = await Catalog.find(filter)
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'My catalogs fetched', catalogs, paginationMeta(total, page, limit));
});

// ─── Update Catalog ───────────────────────────────────────────────────────────
export const updateCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findOne({ _id: req.params.catalogId, freelancer: req.user._id });
  if (!catalog) throw new ApiError(404, 'Catalog not found or not authorized');

  // Validate category/subcategory pairing when either is provided
  const categoryId = req.body.category || catalog.category;
  const subcategoryId = req.body.subcategory !== undefined ? (req.body.subcategory || null) : catalog.subcategory;
  const { category, subcategory } = await validateCategorySubcategory(categoryId, subcategoryId);
  req.body.category = category._id;
  req.body.subcategory = subcategory ? subcategory._id : null;

  validatePackagePrices(req.body.pricingTiers);

  // Handle new images
  if (req.files?.length) {
    const newImages = await uploadMultipleFiles(req.files, 'catalogs');
    catalog.images = [...(catalog.images || []), ...newImages];
  }

  Object.assign(catalog, req.body);
  await catalog.save();

  await catalog.populate([
    { path: 'category', select: 'name slug icon color' },
    { path: 'subcategory', select: 'name slug' },
  ]);
  sendResponse(res, 200, 'Catalog updated', catalog);
});

// ─── Delete Catalog ───────────────────────────────────────────────────────────
export const deleteCatalog = catchAsync(async (req, res) => {
  const catalog = await Catalog.findOne({ _id: req.params.catalogId, freelancer: req.user._id });
  if (!catalog) throw new ApiError(404, 'Catalog not found or not authorized');
  if (catalog.stats.orders > 0) {
    throw new ApiError(400, 'Cannot delete catalog with existing orders');
  }

  // Clean up images
  if (catalog.images?.length) {
    await deleteMultipleFiles(catalog.images.map((i) => i.publicId)).catch(() => null);
  }

  await catalog.deleteOne();
  sendResponse(res, 200, 'Catalog deleted');
});

// ─── Toggle Catalog Status ────────────────────────────────────────────────────
export const toggleCatalogStatus = catchAsync(async (req, res) => {
  const catalog = await Catalog.findOne({ _id: req.params.catalogId, freelancer: req.user._id });
  if (!catalog) throw new ApiError(404, 'Catalog not found or not authorized');

  catalog.status = catalog.status === 'active' ? 'paused' : 'active';
  await catalog.save();

  sendResponse(res, 200, 'Catalog status updated', catalog);
});

// ─── Get Freelancer's Public Catalogs ─────────────────────────────────────────
export const getFreelancerCatalogs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { freelancer: req.params.userId, status: 'active' };
  const total = await Catalog.countDocuments(filter);
  const catalogs = await Catalog.find(filter)
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug')
    .sort({ 'stats.orders': -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, 200, 'Freelancer catalogs fetched', catalogs, paginationMeta(total, page, limit));
});

// ─── Get Service Reviews (client reviews from orders of this service) ────────
export const getCatalogReviews = catchAsync(async (req, res) => {
  const { catalogId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);

  const catalog = await Catalog.findById(catalogId);
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  const orderProjects = (
    await ServiceOrder.find({ service: catalog._id, project: { $ne: null } }).select('project').lean()
  ).map((o) => o.project);
  if (orderProjects.length === 0) {
    return sendResponse(res, 200, 'Service reviews fetched', [], {
      ...paginationMeta(0, page, limit),
      stats: { averageRating: 0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
    });
  }

  const match = { reviewerRole: 'client', isPublic: true, project: { $in: orderProjects } };
  const total = await Review.countDocuments(match);
  const reviews = await Review.find(match)
    .populate('reviewer', 'firstName lastName avatar role')
    .populate('project', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const dist = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating.overall' },
        totalReviews: { $sum: 1 },
        distribution: { $push: '$rating.overall' },
      },
    },
  ]);

  const stats = dist[0] || { averageRating: 0, totalReviews: 0, distribution: [] };
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  stats.distribution.forEach((r) => {
    const star = Math.round(r);
    if (star >= 1 && star <= 5) distribution[star] += 1;
  });

  sendResponse(res, 200, 'Service reviews fetched', reviews, {
    ...paginationMeta(total, page, limit),
    stats: {
      averageRating: Math.round(stats.averageRating * 10) / 10,
      totalReviews: stats.totalReviews,
      distribution,
    },
  });
});

// ─── Catalog Analytics (owner only, real DB values) ──────────────────────────
// Returns performance metrics computed live from the database. Only the owner
// may access these — clients, other freelancers and guests never see them.
export const getCatalogAnalytics = catchAsync(async (req, res) => {
  const catalog = await Catalog.findOne({ _id: req.params.catalogId }).select(
    'title slug freelancer stats'
  );
  if (!catalog) throw new ApiError(404, 'Catalog not found');
  if (!req.user || catalog.freelancer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to view analytics for this service');
  }

  const [orders, favorites, revenueResult, orderProjects] = await Promise.all([
    ServiceOrder.countDocuments({ service: catalog._id }),
    User.countDocuments({ savedCatalogs: catalog._id }),
    ServiceOrder.aggregate([
      { $match: { service: catalog._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$budget.amount' } } },
    ]),
    ServiceOrder.find({ service: catalog._id, project: { $ne: null } }).select('project').lean(),
  ]);

  const views = catalog.stats.views || 0;
  const revenue = revenueResult[0]?.total || 0;
  const conversionRate = views > 0 ? Math.round((orders / views) * 1000) / 10 : 0;

  let rating = 0;
  let totalReviews = 0;
  const projectIds = orderProjects.map((o) => o.project);
  if (projectIds.length > 0) {
    const dist = await Review.aggregate([
      { $match: { reviewerRole: 'client', isPublic: true, project: { $in: projectIds } } },
      { $group: { _id: null, averageRating: { $avg: '$rating.overall' }, totalReviews: { $sum: 1 } } },
    ]);
    rating = dist[0] ? Math.round(dist[0].averageRating * 10) / 10 : 0;
    totalReviews = dist[0]?.totalReviews || 0;
  }

  sendResponse(res, 200, 'Catalog analytics fetched', {
    views,
    orders,
    favorites,
    revenue,
    conversionRate,
    rating,
    totalReviews,
  });
});

// ─── Similar Services (same category/subcategory, top rated) ─────────────────
export const getSimilarCatalogs = catchAsync(async (req, res) => {
  const { catalogId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 6, 12);

  const catalog = await Catalog.findById(catalogId).select('category subcategory _id');
  if (!catalog) throw new ApiError(404, 'Catalog not found');

  const match = { status: 'active', isActive: true, _id: { $ne: catalog._id } };
  match.$or = [{ category: catalog.category }];
  if (catalog.subcategory) match.$or.push({ subcategory: catalog.subcategory });

  const similar = await Catalog.aggregate([
    { $match: match },
    { $addFields: { startingPrice: { $min: '$pricingTiers.price' } } },
    { $sort: { 'stats.avgRating': -1, 'stats.orders': -1, createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: 'freelancer', foreignField: '_id', as: 'freelancer' } },
    { $addFields: { freelancer: { $arrayElemAt: ['$freelancer', 0] } } },
    { $project: { 'freelancer.password': 0, 'freelancer.email': 0, 'freelancer.__v': 0 } },
  ]);

  sendResponse(res, 200, 'Similar catalogs fetched', similar);
});

// ─── Duplicate Catalog (owner) ────────────────────────────────────────────────
export const duplicateCatalog = catchAsync(async (req, res) => {
  const source = await Catalog.findOne({ _id: req.params.catalogId, freelancer: req.user._id });
  if (!source) throw new ApiError(404, 'Catalog not found or not authorized');

  const { _id, ...fields } = source.toObject();
  const copy = await Catalog.create({
    ...fields,
    title: `${source.title} (Copy)`,
    images: source.images || [],
    stats: { views: 0, orders: 0, avgRating: 0, totalReviews: 0 },
    status: 'draft',
    lastOrderAt: null,
  });

  await copy.populate([
    { path: 'category', select: 'name slug icon color' },
    { path: 'subcategory', select: 'name slug' },
  ]);
  sendResponse(res, 201, 'Catalog duplicated', copy);
});

// ─── Recommended Freelancers (public, real data only) ────────────────────────
// Scores active freelancers against the browse context — the selected service
// category/subcategory from their public profile, skill overlap with the
// category's real taxonomy skills, availability and rating. Returns the top
// matches, or an empty array when none qualify. Never fabricates freelancers.
export const getRecommendedFreelancers = catchAsync(async (req, res) => {
  const { category, subcategory } = req.query;
  const rawSkills = req.query.skills;
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 8);

  // Only active freelancers with public profiles are ever eligible.
  const eligibleUserIds = (
    await User.find({ role: 'freelancer', isActive: true, isBanned: false }).select('_id').lean()
  ).map((u) => u._id);
  if (eligibleUserIds.length === 0) {
    return sendResponse(res, 200, 'Recommended freelancers fetched', []);
  }

  // Resolve the browse context to concrete category ids + real skill terms.
  let categoryId = null;
  let subcategoryId = null;
  const skillTerms = rawSkills
    ? String(rawSkills).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (subcategory) {
    const found = await Category.findOne({ _id: subcategory }).lean();
    if (found) {
      subcategoryId = found._id;
      if (found.parent) categoryId = found.parent;
    }
  } else if (category) {
    const found = await Category.findOne({ _id: category }).lean();
    if (found) categoryId = found._id;
  }

  if (categoryId || subcategoryId) {
    const scope = [subcategoryId, categoryId].filter(Boolean);
    const taxonomy = await SkillTaxonomy.find({ category: { $in: scope }, isActive: true })
      .select('name aliases')
      .lean();
    taxonomy.forEach((s) => skillTerms.push(s.name, ...(s.aliases || [])));
    const catDocs = await Category.find({ _id: { $in: scope } })
      .select('skills')
      .populate('skills', 'name')
      .lean();
    catDocs.forEach((c) => (c.skills || []).forEach((sk) => skillTerms.push(sk?.name)));
  }
  const terms = [...new Set(skillTerms.map((s) => s.trim().toLowerCase()).filter(Boolean))];

  const scoreExpr = { $add: [0] };

  if (subcategoryId) {
    scoreExpr.$add.push(
      { $cond: [{ $in: [subcategoryId, { $ifNull: ['$subcategories', []] }] }, 5, 0] },
      { $cond: [{ $in: [subcategoryId, { $ifNull: ['$categories', []] }] }, 2, 0] }
    );
  }
  if (categoryId) {
    scoreExpr.$add.push(
      { $cond: [{ $in: [categoryId, { $ifNull: ['$categories', []] }] }, 3, 0] },
      { $cond: [{ $in: [categoryId, { $ifNull: ['$subcategories', []] }] }, 1, 0] }
    );
  }
  if (terms.length) {
    scoreExpr.$add.push({
      $multiply: [
        {
          $size: {
            $setIntersection: [
              { $map: { input: { $ifNull: ['$skills', []] }, as: 's', in: { $toLower: '$$s.name' } } },
              terms,
            ],
          },
        },
        1.5,
      ],
    });
  }

  const availabilityExpr = { $ifNull: [{ $arrayElemAt: ['$userDoc.availabilityStatus', 0] }, ''] };
  scoreExpr.$add.push(
    { $cond: [{ $eq: [availabilityExpr, 'available'] }, 2, 0] },
    { $cond: [{ $eq: [availabilityExpr, 'busy'] }, 0.5, 0] },
    // rating contributes up to +1 so consistently well-rated freelancers rank higher
    { $divide: [{ $ifNull: [{ $arrayElemAt: ['$userDoc.stats.averageRating', 0] }, 0] }, 5] }
  );

  const candidates = await Profile.aggregate([
    { $match: { isPublic: true, user: { $in: eligibleUserIds } } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
    {
      $addFields: {
        score: scoreExpr,
        sortRating: { $ifNull: [{ $arrayElemAt: ['$userDoc.stats.averageRating', 0] }, 0] },
      },
    },
    { $sort: { score: -1, sortRating: -1, createdAt: -1 } },
    { $limit: limit },
    { $project: { score: 0, sortRating: 0, userDoc: 0 } },
  ]);

  await Profile.populate(candidates, [
    {
      path: 'user',
      select: 'firstName lastName avatar isVerifiedFreelancer freelancerLevel stats availabilityStatus',
    },
    { path: 'categories', select: 'name slug icon' },
    { path: 'subcategories', select: 'name slug icon' },
  ]);

  const freelancers = candidates.map((p) => {
    const u = p.user || {};
    return {
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar,
      isVerifiedFreelancer: u.isVerifiedFreelancer,
      freelancerLevel: u.freelancerLevel,
      availabilityStatus: u.availabilityStatus,
      stats: u.stats || {},
      skills: (p.skills || []).slice(0, 3).map((s) => s.name),
      categories: p.categories || [],
      subcategories: p.subcategories || [],
    };
  });

  sendResponse(res, 200, 'Recommended freelancers fetched', freelancers);
});

// ─── Recently Added Services (public, real data only) ─────────────────────────
// The most recently published service packages, newest first. Returns an empty
// array when there are none yet.
export const getRecentCatalogs = catchAsync(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 10);

  const catalogs = await Catalog.find({ status: 'active', isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title slug images pricingTiers startingPrice stats category subcategory freelancer createdAt')
    .populate('freelancer', 'firstName lastName avatar isVerifiedFreelancer freelancerLevel stats')
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug')
    .lean();

  sendResponse(res, 200, 'Recent catalogs fetched', catalogs);
});
