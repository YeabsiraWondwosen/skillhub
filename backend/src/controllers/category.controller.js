import mongoose from 'mongoose';
import { Category, SkillTaxonomy, Catalog, Job, Profile, Project, Application, User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination, buildSortObject } from '../utils/helpers.js';
import { cacheThrough, invalidateCache } from '../utils/cache.js';

// The category tree is reference data read by nearly every public page, but it
// changes only when an admin edits categories. Cache it and drop the entry on
// any write so admins still see their changes immediately.
const CATEGORY_TREE_NS = 'categories:tree';
const CATEGORY_TREE_TTL_MS = 10 * 60 * 1000;
const invalidateCategoryTree = () => invalidateCache(CATEGORY_TREE_NS);

// Jobs are "active/open" while they are still being worked on. Matches the
// canonical ACTIVE_JOB_STATUSES used across the app (client stats, admin dashboards).
const ACTIVE_JOB_STATUSES = [
  'open', 'proposals_received', 'freelancer_selected',
  'payment_pending', 'funded', 'in_progress', 'delivery_submitted', 'client_review',
];

// ─── Shared stat helpers ──────────────────────────────────────────────────────
// Compute real, DB-backed counts (active jobs, freelancers, skills) for a set
// of subcategory ids. Freelancer counts are de-duplicated across categories and
// subcategories, and include users with any real marketplace signal in the
// category (projects, applications, service listings, or profile selections).
async function computeCategoryStats(subIds) {
  const subIdStrs = subIds.map((id) => id.toString());
  const [jobMap, freelancerMap, skillAgg] = await Promise.all([
    getJobCountBySub(subIdStrs, { activeOnly: true }),
    buildFreelancerUsageMaps(subIdStrs),
    SkillTaxonomy.aggregate([
      { $match: { category: { $in: subIds }, isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  const skillMap = Object.fromEntries(skillAgg.map((s) => [s._id.toString(), s.count]));
  return { jobMap, freelancerMap, skillMap };
}

async function resolveSubIdsForCategory(category) {
  if (category.parent) return [category._id];
  const subs = await Category.find({ parent: category._id, isActive: true, isHidden: false })
    .select('_id')
    .lean();
  return [category._id, ...subs.map((s) => s._id)];
}

// Jobs store the leaf (sub)category id. Legacy records may hold it as a string,
// so counts are keyed by the string form of the category id.
async function getJobCountBySub(subIdStrs, { activeOnly = false } = {}) {
  const match = { category: { $ne: null } };
  if (activeOnly) match.status = { $in: ACTIVE_JOB_STATUSES };
  const rows = await Job.aggregate([
    { $match: match },
    { $project: { catStr: { $toString: '$category' } } },
    { $match: { catStr: { $in: subIdStrs } } },
    { $group: { _id: '$catStr', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]));
}

// Distinct freelancer users engaged in a set of subcategories. A freelancer is
// counted when there is ANY real marketplace signal tying them to the category:
//   - a project on a job posted under the category
//   - an application to a job posted under the category
//   - their own service listing (catalog) in the category
//   - an explicit categories/subcategories selection on their profile
// Users are de-duplicated across sources. Returns { catId: [userId, ...] } keyed
// by the string form of the category id.
async function buildFreelancerUsageMaps(subIdStrs) {
  const [projectRows, appRows, catalogRows, profileRows] = await Promise.all([
    Project.aggregate([
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'j' } },
      { $unwind: { path: '$j', preserveNullAndEmptyArrays: false } },
      { $project: { user: '$freelancer', catStr: { $toString: '$j.category' } } },
      { $match: { catStr: { $in: subIdStrs } } },
      { $group: { _id: '$catStr', users: { $addToSet: '$user' } } },
    ]),
    Application.aggregate([
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'j' } },
      { $unwind: { path: '$j', preserveNullAndEmptyArrays: false } },
      { $project: { user: '$freelancer', catStr: { $toString: '$j.category' } } },
      { $match: { catStr: { $in: subIdStrs } } },
      { $group: { _id: '$catStr', users: { $addToSet: '$user' } } },
    ]),
    Catalog.aggregate([
      { $match: { status: 'active', freelancer: { $ne: null } } },
      { $project: { user: '$freelancer', catIds: [{ $toString: '$category' }, { $toString: '$subcategory' }] } },
      { $unwind: '$catIds' },
      { $match: { catIds: { $in: subIdStrs } } },
      { $group: { _id: '$catIds', users: { $addToSet: '$user' } } },
    ]),
    User.aggregate([
      { $match: { role: 'freelancer' } },
      { $lookup: { from: 'profiles', localField: '_id', foreignField: 'user', as: 'p' } },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          user: '$_id',
          catIds: {
            $concatArrays: [
              { $ifNull: [{ $map: { input: { $ifNull: ['$p.categories', []] }, as: 'c', in: { $toString: '$$c' } } }, []] },
              { $ifNull: [{ $map: { input: { $ifNull: ['$p.subcategories', []] }, as: 'c', in: { $toString: '$$c' } } }, []] },
            ],
          },
        },
      },
      { $unwind: '$catIds' },
      { $match: { catIds: { $in: subIdStrs } } },
      { $group: { _id: '$catIds', users: { $addToSet: '$user' } } },
    ]),
  ]);

  const map = {};
  for (const rows of [projectRows, appRows, catalogRows, profileRows]) {
    for (const row of rows) {
      const key = row._id.toString();
      if (!map[key]) map[key] = new Set();
      for (const u of row.users) map[key].add(u.toString());
    }
  }
  return map;
}

// ─── Get All Active Categories (Public) ──────────────────────────────────────
export const getCategories = catchAsync(async (req, res) => {
  const categories = await Category.find({ isActive: true, isHidden: false })
    .sort({ order: 1, name: 1 })
    .lean();

  sendResponse(res, 200, 'Categories fetched', categories);
});

// ─── Get Single Category (Public) ────────────────────────────────────────────
export const getCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) throw new ApiError(404, 'Category not found');

  const isMain = !category.parent;
  const subIds = await resolveSubIdsForCategory(category);
  const { jobMap, freelancerMap, skillMap } = await computeCategoryStats(subIds);

  const activeJobs = subIds.reduce((acc, id) => acc + (jobMap[id.toString()] || 0), 0);
  const union = new Set();
  for (const id of subIds) {
    for (const uid of freelancerMap[id.toString()] || []) union.add(uid.toString());
  }
  const freelancerCount = union.size;
  const skillsCount = subIds.reduce((acc, id) => acc + (skillMap[id.toString()] || 0), 0);

  const parentCategory = category.parent
    ? await Category.findById(category.parent).select('name slug icon').lean()
    : null;

  const subcategories = isMain
    ? await Category.find({ parent: category._id, isActive: true, isHidden: false })
        .select('name slug icon color description order')
        .sort({ order: 1, name: 1 })
        .lean()
    : [];

  sendResponse(res, 200, 'Category fetched', {
    ...category,
    id: category._id.toString(),
    parentCategory,
    activeJobs,
    activeFreelancers: freelancerCount,
    skillCount: skillsCount,
    activeJobsCount: activeJobs,
    freelancerCount,
    skillsCount,
    subcategories,
  });
});

// ─── Get Skills by Category (Public) ─────────────────────────────────────────
export const getSkillsByCategory = catchAsync(async (req, res) => {
  const skills = await SkillTaxonomy.find({
    category: req.params.id,
    isActive: true,
  })
    .select('name slug demandLevel')
    .sort({ name: 1 })
    .lean();

  sendResponse(res, 200, 'Skills fetched', skills);
});

// ─── Get Subcategories by Main Category (Public) ─────────────────────────────
export const getSubcategoriesByCategory = catchAsync(async (req, res) => {
  const main = await Category.findById(req.params.id).lean();
  if (!main) throw new ApiError(404, 'Category not found');

  const subcategories = await Category.find({ parent: main._id, isActive: true, isHidden: false })
    .select('name slug icon color description order')
    .sort({ order: 1, name: 1 })
    .lean();

  const subIds = subcategories.map((s) => s._id);
  const { jobMap, freelancerMap, skillMap } = await computeCategoryStats(subIds);

  const enriched = subcategories.map((s) => {
    const sid = s._id.toString();
    return {
      ...s,
      activeJobs: jobMap[sid] || 0,
      freelancers: freelancerMap[sid]?.size ?? 0,
      skillsCount: skillMap[sid] || 0,
    };
  });

  sendResponse(res, 200, 'Subcategories fetched', enriched);
});

// ─── Create Skill under a Subcategory (Admin) ────────────────────────────────
export const createSkill = catchAsync(async (req, res) => {
  const { name, aliases, demandLevel } = req.body;
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');
  if (!category.parent) throw new ApiError(400, 'Skills can only be added to subcategories');

  const existing = await SkillTaxonomy.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    category: category._id,
  });
  if (existing) throw new ApiError(409, 'Skill already exists in this subcategory');

  const skill = await SkillTaxonomy.create({
    name: name.trim(),
    category: category._id,
    aliases: aliases || [],
    demandLevel: demandLevel || 'moderate',
    isActive: true,
  });

  sendResponse(res, 201, 'Skill created', skill);
});

// ─── Update Skill (Admin) ────────────────────────────────────────────────────
export const updateSkill = catchAsync(async (req, res) => {
  const skill = await SkillTaxonomy.findById(req.params.skillId);
  if (!skill) throw new ApiError(404, 'Skill not found');

  const { name, aliases, demandLevel, isActive } = req.body;

  if (name && name.trim() !== skill.name) {
    const existing = await SkillTaxonomy.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      category: skill.category,
      _id: { $ne: skill._id },
    });
    if (existing) throw new ApiError(409, 'Skill already exists in this subcategory');
    skill.name = name.trim();
  }
  if (aliases !== undefined) skill.aliases = aliases;
  if (demandLevel !== undefined) skill.demandLevel = demandLevel;
  if (isActive !== undefined) skill.isActive = isActive;

  await skill.save();
  sendResponse(res, 200, 'Skill updated', skill);
});

// ─── Toggle Skill Active (Admin) ─────────────────────────────────────────────
export const toggleSkillActive = catchAsync(async (req, res) => {
  const skill = await SkillTaxonomy.findById(req.params.skillId);
  if (!skill) throw new ApiError(404, 'Skill not found');

  skill.isActive = !skill.isActive;
  await skill.save();
  sendResponse(res, 200, `Skill ${skill.isActive ? 'activated' : 'deactivated'}`, skill);
});

// ─── Delete Skill (Admin) ────────────────────────────────────────────────────
export const deleteSkill = catchAsync(async (req, res) => {
  const skill = await SkillTaxonomy.findById(req.params.skillId);
  if (!skill) throw new ApiError(404, 'Skill not found');

  await skill.deleteOne();
  sendResponse(res, 200, 'Skill deleted');
});

// ─── Create Category (Admin) ─────────────────────────────────────────────────
export const createCategory = catchAsync(async (req, res) => {
  const { name, description, icon, parent, color, bannerImage, featured, skills, order } = req.body;

  const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
  if (existing) throw new ApiError(409, 'Category already exists');

  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) throw new ApiError(404, 'Parent category not found');
    if (parentCategory.parent) throw new ApiError(400, 'Subcategories cannot contain nested subcategories');
  }

  const maxOrder = await Category.findOne().sort({ order: -1 }).select('order').lean();
  const category = await Category.create({
    name,
    description,
    icon,
    parent: parent || null,
    color: color || '#6366f1',
    bannerImage: bannerImage || '',
    featured: featured || false,
    skills: skills || [],
    order: order ?? (maxOrder ? maxOrder.order + 1 : 0),
  });

  invalidateCategoryTree();
  sendResponse(res, 201, 'Category created', category);
});

// ─── Update Category (Admin) ─────────────────────────────────────────────────
export const updateCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  const { name, description, icon, parent, isActive, isHidden, featured, color, bannerImage, skills, order } = req.body;

  if (name && name !== category.name) {
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: category._id },
    });
    if (existing) throw new ApiError(409, 'Category name already exists');
  }

  if (parent && parent.toString() === category._id.toString()) {
    throw new ApiError(400, 'Category cannot be its own parent');
  }

  if (parent && parent.toString() !== String(category.parent || '')) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) throw new ApiError(404, 'Parent category not found');
    if (parentCategory.parent) throw new ApiError(400, 'Subcategories cannot contain nested subcategories');
    const hasChildren = await Category.countDocuments({ parent: category._id });
    if (hasChildren) throw new ApiError(400, 'A main category with subcategories cannot become a subcategory');
  }

  Object.assign(category, {
    name,
    description,
    icon,
    parent,
    isActive,
    isHidden,
    featured,
    color,
    bannerImage,
    skills,
    order,
  });
  await category.save();

  invalidateCategoryTree();
  sendResponse(res, 200, 'Category updated', category);
});

// ─── Delete Category (Admin) ─────────────────────────────────────────────────
export const deleteCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  const hasChildren = await Category.countDocuments({ parent: category._id });
  if (hasChildren) throw new ApiError(400, 'Cannot delete category with subcategories');

  const hasSkills = await SkillTaxonomy.countDocuments({ category: category._id });
  if (hasSkills) throw new ApiError(400, 'Cannot delete category with associated skills');

  await category.deleteOne();
  invalidateCategoryTree();
  sendResponse(res, 200, 'Category deleted');
});

// ─── Get Category by Slug (Public) ───────────────────────────────────────────
export const getCategoryBySlug = catchAsync(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!category) throw new ApiError(404, 'Category not found');

  const isMain = !category.parent;
  const subDocs = isMain
    ? await Category.find({ parent: category._id, isActive: true, isHidden: false })
        .select('name slug icon color description order')
        .sort({ order: 1, name: 1 })
        .lean()
    : [];
  const subIds = isMain ? subDocs.map((s) => s._id) : [category._id];

  const { jobMap, freelancerMap, skillMap } = await computeCategoryStats(subIds);

  const activeJobs = subIds.reduce((acc, id) => acc + (jobMap[id.toString()] || 0), 0);
  const union = new Set();
  for (const id of subIds) {
    for (const uid of freelancerMap[id.toString()] || []) union.add(uid.toString());
  }
  const freelancerCount = union.size;
  const skillsCount = subIds.reduce((acc, id) => acc + (skillMap[id.toString()] || 0), 0);

  const parentCategory = category.parent
    ? await Category.findById(category.parent).select('name slug icon').lean()
    : null;

  const subcategories = subDocs.map((s) => {
    const sid = s._id.toString();
    return {
      ...s,
      activeJobs: jobMap[sid] || 0,
      freelancers: freelancerMap[sid]?.size ?? 0,
      skillsCount: skillMap[sid] || 0,
    };
  });

  sendResponse(res, 200, 'Category fetched', {
    ...category,
    id: category._id.toString(),
    parentCategory,
    activeJobs,
    activeFreelancers: freelancerCount,
    skillCount: skillsCount,
    activeJobsCount: activeJobs,
    freelancerCount,
    skillsCount,
    subcategories,
  });
});

// ─── Get Category Tree (Public) ─────────────────────────────────────────────
export const getCategoryTree = catchAsync(async (req, res) => {
  const tree = await cacheThrough(CATEGORY_TREE_NS, 'public', CATEGORY_TREE_TTL_MS, async () => {
    const [parents, allSubs] = await Promise.all([
      Category.find({ parent: null, isActive: true, isHidden: false })
        .sort({ order: 1, name: 1 })
        .lean(),
      Category.find({ parent: { $ne: null }, isActive: true, isHidden: false })
        .populate('parent', 'name slug')
        .sort({ order: 1, name: 1 })
        .lean(),
    ]);

    const subMap = {};
    for (const sub of allSubs) {
      const parentId = sub.parent?._id?.toString() || sub.parent?.toString();
      if (!subMap[parentId]) subMap[parentId] = [];
      subMap[parentId].push(sub);
    }

    return parents.map((p) => ({
      ...p,
      subcategories: subMap[p._id.toString()] || [],
    }));
  });

  sendResponse(res, 200, 'Category tree fetched', tree);
});

// ─── Get Category Tree for Admin (includes inactive + skills) ───────────────
export const getAdminCategoryTree = catchAsync(async (req, res) => {
  const [parents, allSubs, allSkills] = await Promise.all([
    Category.find({ parent: null })
      .sort({ order: 1, name: 1 })
      .lean(),
    Category.find({ parent: { $ne: null } })
      .sort({ order: 1, name: 1 })
      .lean(),
    SkillTaxonomy.find({})
      .select('name slug demandLevel isActive category')
      .sort({ name: 1 })
      .lean(),
  ]);

  const subMap = {};
  for (const sub of allSubs) {
    const parentId = sub.parent?.toString();
    if (!subMap[parentId]) subMap[parentId] = [];
    subMap[parentId].push(sub);
  }

  const skillMap = {};
  for (const skill of allSkills) {
    const catId = skill.category?.toString();
    if (!skillMap[catId]) skillMap[catId] = [];
    skillMap[catId].push(skill);
  }

  const tree = parents.map((p) => ({
    ...p,
    subcategories: (subMap[p._id.toString()] || []).map((sub) => ({
      ...sub,
      skills: skillMap[sub._id.toString()] || [],
    })),
  }));

  sendResponse(res, 200, 'Category tree fetched', tree);
});

// ─── Seed Default Categories (Admin) ─────────────────────────────────────────
export const seedCategories = catchAsync(async (req, res) => {
  const { seedDefaultCategories } = await import('../services/category.service.js');
  const { created, updated, mainCount } = await seedDefaultCategories();
  invalidateCategoryTree();
  sendResponse(res, 200, `Seeded ${created} new categories, ${mainCount - created + updated} total categories`);
});

// ─── Get All Categories (Admin - includes inactive) ──────────────────────────
export const getAllCategoriesAdmin = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, sortBy, isActive, isHidden, featured, parent } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isHidden !== undefined) filter.isHidden = isHidden === 'true';
  if (featured !== undefined) filter.featured = featured === 'true';
  if (parent !== undefined) {
    filter.parent = parent === 'null' || parent === '' ? null : parent;
  }

  const sort = sortBy ? buildSortObject(sortBy) : { order: 1, name: 1 };

  const total = await Category.countDocuments(filter);
  const categories = await Category.find(filter)
    .populate('parent', 'name')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const categoryIds = categories.map((c) => c._id);

  const [skillCounts, catalogCounts, jobCounts] = await Promise.all([
    SkillTaxonomy.aggregate([
      { $match: { category: { $in: categoryIds }, isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Catalog.aggregate([
      { $match: { category: { $in: categoryIds }, status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { category: { $in: categoryIds }, status: { $in: ACTIVE_JOB_STATUSES } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  const skillMap = Object.fromEntries(skillCounts.map((s) => [s._id.toString(), s.count]));
  const catalogMap = Object.fromEntries(catalogCounts.map((c) => [c._id.toString(), c.count]));
  const jobMap = Object.fromEntries(jobCounts.map((j) => [j._id.toString(), j.count]));

  const enriched = categories.map((cat) => ({
    ...cat,
    stats: {
      skills: skillMap[cat._id.toString()] || 0,
      services: catalogMap[cat._id.toString()] || 0,
      jobs: jobMap[cat._id.toString()] || 0,
    },
  }));

  sendResponse(res, 200, 'Categories fetched', enriched, paginationMeta(total, page, limit));
});

// ─── Get Categories Dashboard Stats ──────────────────────────────────────────
export const getCategoriesStats = catchAsync(async (req, res) => {
  const [
    total,
    mainCount,
    subCount,
    active,
    activeSubs,
    hidden,
    featuredCount,
    totalSkills,
    totalServices,
    totalJobs,
  ] = await Promise.all([
    Category.countDocuments(),
    Category.countDocuments({ parent: null }),
    Category.countDocuments({ parent: { $ne: null } }),
    Category.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true, parent: { $ne: null } }),
    Category.countDocuments({ isHidden: true }),
    Category.countDocuments({ featured: true }),
    SkillTaxonomy.countDocuments({ isActive: true }),
    Catalog.countDocuments({ status: 'active' }),
    Job.countDocuments({ status: { $in: ACTIVE_JOB_STATUSES } }),
  ]);

  sendResponse(res, 200, 'Stats fetched', {
    total,
    mainCategories: mainCount,
    subcategories: subCount,
    active,
    activeSubcategories: activeSubs,
    inactive: total - active,
    hidden,
    featured: featuredCount,
    totalSkills,
    totalServices,
    totalJobs,
  });
});

// ─── Admin Category Usage (read-only) ─────────────────────────────────────────
// Categories are shared across the marketplace: Job.category and
// Profile.categories/subcategories reference subcategory ids. These endpoints
// only AGGREGATE existing data — they never modify or delete anything.

async function resolveCategorySubIds(id) {
  const category = await Category.findById(id).lean();
  if (!category) return null;
  const subIds = category.parent
    ? [category._id]
    : (await Category.find({ parent: category._id }).select('_id').lean()).map((s) => s._id);
  return { category, subIds };
}

async function getCategoryUsageMaps(subIds) {
  const subIdStrs = subIds.map((id) => id.toString());
  const [jobAgg, freelancerMap] = await Promise.all([
    Job.aggregate([
      { $match: { category: { $ne: null }, status: { $in: ACTIVE_JOB_STATUSES } } },
      { $project: { catStr: { $toString: '$category' } } },
      { $match: { catStr: { $in: subIdStrs } } },
      { $group: { _id: '$catStr', count: { $sum: 1 } } },
    ]),
    buildFreelancerUsageMaps(subIdStrs),
  ]);

  const jobMap = Object.fromEntries(jobAgg.map((j) => [j._id.toString(), j.count]));
  return { jobMap, freelancerMap };
}

// ─── Get Admin Category Overview (per main category) ─────────────────────────
export const getAdminCategoryOverview = catchAsync(async (req, res) => {
  const [mains, allSubs] = await Promise.all([
    Category.find({ parent: null }).sort({ order: 1, name: 1 }).lean(),
    Category.find({ parent: { $ne: null } }).select('_id parent name icon color description isActive isHidden featured order').lean(),
  ]);

  const subIdStrs = allSubs.map((s) => s._id.toString());
  const [jobMap, freelancerMap] = await Promise.all([
    Job.aggregate([
      { $match: { category: { $ne: null }, status: { $in: ACTIVE_JOB_STATUSES } } },
      { $project: { catStr: { $toString: '$category' } } },
      { $group: { _id: '$catStr', count: { $sum: 1 } } },
    ]).then((rows) => Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]))),
    buildFreelancerUsageMaps(subIdStrs),
  ]);

  const subByParent = {};
  for (const s of allSubs) {
    const pid = s.parent?.toString();
    if (!subByParent[pid]) subByParent[pid] = [];
    subByParent[pid].push(s);
  }

  const overview = mains.map((m) => {
    const subs = subByParent[m._id.toString()] || [];
    const union = new Set();
    let jobs = 0;
    for (const s of subs) {
      const sid = s._id.toString();
      jobs += jobMap[sid] || 0;
      const users = freelancerMap[sid];
      if (users) for (const uid of users) union.add(uid);
    }
    return {
      _id: m._id,
      name: m.name,
      icon: m.icon,
      color: m.color,
      description: m.description,
      isActive: m.isActive,
      isHidden: m.isHidden,
      featured: m.featured,
      order: m.order,
      stats: {
        subcategories: subs.length,
        freelancers: union.size,
        jobs,
      },
    };
  });

  sendResponse(res, 200, 'Category overview fetched', overview);
});

// ─── Get Admin Category Detail (main or subcategory) ─────────────────────────
export const getAdminCategoryDetail = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) throw new ApiError(404, 'Category not found');

  const isMain = !category.parent;
  const subDocs = isMain
    ? await Category.find({ parent: category._id })
        .select('name icon color description isActive isHidden order')
        .sort({ order: 1, name: 1 })
        .lean()
    : [];
  const subIds = isMain ? subDocs.map((s) => s._id) : [category._id];

  const { jobMap, freelancerMap } = await getCategoryUsageMaps(subIds);

  // "Total Jobs" reflects every job posted under the category (any status),
  // matching the Jobs tab which lists them all.
  const subIdStrs = subIds.map((id) => id.toString());
  const allJobCounts = await getJobCountBySub(subIdStrs, { activeOnly: false });

  const activeJobs = subIds.reduce((acc, id) => acc + (jobMap[id.toString()] || 0), 0);
  const totalJobs = subIds.reduce((acc, id) => acc + (allJobCounts[id.toString()] || 0), 0);
  const union = new Set();
  for (const id of subIds) {
    const users = freelancerMap[id.toString()];
    if (users) for (const uid of users) union.add(uid);
  }

  const subcategories = isMain
    ? subDocs.map((s) => {
        const sid = s._id.toString();
        return {
          ...s,
          stats: {
            freelancers: freelancerMap[sid]?.size ?? 0,
            jobs: allJobCounts[sid] || 0,
            activeJobs: jobMap[sid] || 0,
          },
        };
      })
    : [];

  sendResponse(res, 200, 'Category detail fetched', {
    category,
    isMain,
    stats: {
      subcategories: isMain ? subDocs.length : 0,
      freelancers: union.size,
      jobs: totalJobs,
      activeJobs,
      active: category.isActive,
      hidden: category.isHidden,
    },
    subcategories,
  });
});

// ─── Get Admin Category Freelancers (main aggregates over its subs) ──────────
export const getAdminCategoryFreelancers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const resolved = await resolveCategorySubIds(req.params.id);
  if (!resolved) throw new ApiError(404, 'Category not found');

  const subIdStrs = resolved.subIds.map((id) => id.toString());
  const freelancerMap = await buildFreelancerUsageMaps(subIdStrs);

  const userIds = new Set();
  for (const id of subIdStrs) {
    const users = freelancerMap[id];
    if (users) for (const uid of users) userIds.add(uid);
  }
  const idList = [...userIds].map((id) => new mongoose.Types.ObjectId(id));

  if (idList.length === 0) {
    return sendResponse(res, 200, 'Category freelancers fetched', [], paginationMeta(0, page, limit));
  }

  const base = [
    { $match: { user: { $in: idList } } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
    { $unwind: { path: '$u', preserveNullAndEmptyArrays: false } },
    { $match: { 'u.role': 'freelancer' } },
  ];

  const total = (await Profile.aggregate([...base, { $count: 'n' }]))[0]?.n || 0;

  const profiles = await Profile.aggregate([
    ...base,
    { $sort: { 'u.createdAt': -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        skills: 1,
        isPublic: 1,
        completionScore: 1,
        hourlyRate: 1,
        user: {
          _id: '$u._id',
          firstName: '$u.firstName',
          lastName: '$u.lastName',
          email: '$u.email',
          avatar: '$u.avatar',
          isVerifiedFreelancer: '$u.isVerifiedFreelancer',
          isActive: '$u.isActive',
          isBanned: '$u.isBanned',
          createdAt: '$u.createdAt',
        },
      },
    },
  ]);

  sendResponse(res, 200, 'Category freelancers fetched', profiles, paginationMeta(total, page, limit));
});

// ─── Get Admin Category Jobs (main aggregates over its subs) ─────────────────
export const getAdminCategoryJobs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const resolved = await resolveCategorySubIds(req.params.id);
  if (!resolved) throw new ApiError(404, 'Category not found');

  const filter = { category: { $in: resolved.subIds } };
  if (status) filter.status = status;

  const total = await Job.countDocuments(filter);
  const jobs = await Job.find(filter)
    .populate('client', 'firstName lastName email avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const mapped = jobs.map((j) => ({
    _id: j._id,
    title: j.title,
    status: j.status,
    budget: j.budget,
    createdAt: j.createdAt,
    client: j.client
      ? { _id: j.client._id, firstName: j.client.firstName, lastName: j.client.lastName, avatar: j.client.avatar }
      : null,
  }));

  sendResponse(res, 200, 'Category jobs fetched', mapped, paginationMeta(total, page, limit));
});

// ─── Get Admin Category Services (main aggregates over its subs) ─────────────
export const getAdminCategoryServices = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const resolved = await resolveCategorySubIds(req.params.id);
  if (!resolved) throw new ApiError(404, 'Category not found');

  const filter = {
    $or: [
      { category: resolved.category._id },
      { subcategory: { $in: resolved.subIds } },
    ],
  };

  const total = await Catalog.countDocuments(filter);
  const catalogs = await Catalog.find(filter)
    .populate('freelancer', 'firstName lastName email avatar isVerifiedFreelancer isActive')
    .populate('category', 'name slug icon color')
    .populate('subcategory', 'name slug')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const mapped = catalogs.map((c) => ({
    _id: c._id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    isActive: c.isActive,
    isFeatured: c.isFeatured,
    startingPrice: c.startingPrice,
    currency: c.pricingTiers?.[0]?.currency || 'ETB',
    createdAt: c.createdAt,
    stats: c.stats,
    freelancer: c.freelancer
      ? {
          _id: c.freelancer._id,
          firstName: c.freelancer.firstName,
          lastName: c.freelancer.lastName,
          email: c.freelancer.email,
          avatar: c.freelancer.avatar,
        }
      : null,
    category: c.category
      ? { _id: c.category._id, name: c.category.name, slug: c.category.slug, icon: c.category.icon, color: c.category.color }
      : null,
    subcategory: c.subcategory
      ? { _id: c.subcategory._id, name: c.subcategory.name, slug: c.subcategory.slug }
      : null,
  }));

  sendResponse(res, 200, 'Category services fetched', mapped, paginationMeta(total, page, limit));
});

// ─── Toggle Featured ─────────────────────────────────────────────────────────
export const toggleFeatured = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  category.featured = !category.featured;
  await category.save();

  invalidateCategoryTree();
  sendResponse(res, 200, `Category ${category.featured ? 'featured' : 'unfeatured'}`, category);
});

// ─── Toggle Hidden ───────────────────────────────────────────────────────────
export const toggleHidden = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  category.isHidden = !category.isHidden;
  await category.save();

  invalidateCategoryTree();
  sendResponse(res, 200, `Category ${category.isHidden ? 'hidden' : 'shown'}`, category);
});

// ─── Reorder Categories ──────────────────────────────────────────────────────
export const reorderCategories = catchAsync(async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new ApiError(400, 'orderedIds array is required');
  }

  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { order: index },
    },
  }));

  await Category.bulkWrite(bulkOps);

  invalidateCategoryTree();
  sendResponse(res, 200, 'Categories reordered');
});

// ─── Bulk Categories Action ──────────────────────────────────────────────────
export const bulkCategoriesAction = catchAsync(async (req, res) => {
  const { ids, action } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'ids array is required');
  }

  const validActions = ['activate', 'deactivate', 'feature', 'unfeature', 'hide', 'show', 'delete'];
  if (!validActions.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
  }

  let result;
  switch (action) {
    case 'activate':
      result = await Category.updateMany({ _id: { $in: ids } }, { isActive: true });
      break;
    case 'deactivate':
      result = await Category.updateMany({ _id: { $in: ids } }, { isActive: false });
      break;
    case 'feature':
      result = await Category.updateMany({ _id: { $in: ids } }, { featured: true });
      break;
    case 'unfeature':
      result = await Category.updateMany({ _id: { $in: ids } }, { featured: false });
      break;
    case 'hide':
      result = await Category.updateMany({ _id: { $in: ids } }, { isHidden: true });
      break;
    case 'show':
      result = await Category.updateMany({ _id: { $in: ids } }, { isHidden: false });
      break;
    case 'delete': {
      const categories = await Category.find({ _id: { $in: ids } });
      let deletedCount = 0;
      for (const cat of categories) {
        const hasChildren = await Category.countDocuments({ parent: cat._id });
        if (hasChildren) continue;
        const hasSkills = await SkillTaxonomy.countDocuments({ category: cat._id });
        if (hasSkills) continue;
        await cat.deleteOne();
        deletedCount++;
      }
      result = { deletedCount };
      break;
    }
  }

  invalidateCategoryTree();
  sendResponse(res, 200, `Bulk ${action} completed`, result);
});
