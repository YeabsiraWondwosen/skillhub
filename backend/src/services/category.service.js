import mongoose from 'mongoose';
import { Category, SkillTaxonomy, Job, Profile, Catalog, User } from '../models/index.js';
import { logger } from '../utils/logger.js';
import {
  MAIN_CATEGORIES,
  SUBCATEGORIES,
  SUBCATEGORY_META,
  getSubcategoryMeta,
  SKILLS_BY_SUBCATEGORY,
  resolveLegacyName,
  STRING_JOB_CATEGORY_MAP,
} from '../data/categoryCatalog.js';

const ALL_SUB_NAMES = Object.values(SUBCATEGORIES).flat();

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// Detect corrupted UTF-8 mojibake icons such as '≡ƒîÉ' (emoji bytes read as a
// legacy single-byte charset). Every corrupt value seen in the database starts
// with '≡ƒ', so matching those characters is a reliable signature. Never trust
// a stored icon that looks like mojibake.
function isCorruptedIcon(value) {
  if (typeof value !== 'string' || !value) return false;
  if (value.includes('\u2261') || value.includes('\u0192')) return true; // '≡' or 'ƒ'
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The Category model has a global unique `name` index. Before creating a
// canonical category, rename any OTHER category that currently holds the same
// name (e.g. a legacy main named like a canonical subcategory) so the
// canonical record can be created. The renamed record is archived and later
// removed by archiveAndRemoveObsolete() after references are migrated.
let nameCounter = 0;
async function freeLegacyName(name, exceptId) {
  const collisions = await Category.find({
    name,
    _id: { $ne: exceptId },
  }).select('_id name');
  const stamp = Date.now();
  for (const c of collisions) {
    nameCounter += 1;
    const archivedName = `_archived_${c.name}_${stamp}_${nameCounter}`.slice(0, 100);
    await Category.updateOne(
      { _id: c._id },
      {
        $set: { name: archivedName, isActive: false, isHidden: true },
        $unset: { slug: '' },
      }
    );
  }
}

async function buildCanonicalTree() {
  const mainMap = {};
  const subMap = {};
  const created = { mains: 0, subs: 0 };
  const updated = { mains: 0, subs: 0 };

  for (const cat of MAIN_CATEGORIES) {
    let existing = await Category.findOne({ slug: slugify(cat.name) });
    if (!existing) existing = await Category.findOne({ name: cat.name });
    if (!existing) {
      await freeLegacyName(cat.name, null);
      existing = await Category.create({
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        featured: cat.featured,
        order: cat.order,
        isActive: true,
        isHidden: false,
        parent: null,
      });
      created.mains++;
    } else {
      Object.assign(existing, {
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        featured: cat.featured,
        order: cat.order,
        isActive: true,
        isHidden: false,
        parent: null,
      });
      await existing.save();
      updated.mains++;
    }
    mainMap[cat.name] = existing._id;
  }

  for (const [mainName, subs] of Object.entries(SUBCATEGORIES)) {
    const parentId = mainMap[mainName];
    subMap[mainName] = {};
    for (let i = 0; i < subs.length; i++) {
      const subName = subs[i];
      const meta = getSubcategoryMeta(subName);
      let existing = await Category.findOne({ parent: parentId, slug: slugify(subName) });
      if (!existing) existing = await Category.findOne({ parent: parentId, name: subName });
      if (!existing) {
        await freeLegacyName(subName, null);
        existing = await Category.create({
          name: subName,
          parent: parentId,
          icon: meta.icon || '',
          description: meta.description || `${subName} services within ${mainName}`,
          color: '#6366f1',
          order: i,
          isActive: true,
          isHidden: false,
        });
        created.subs++;
      } else {
        existing.parent = parentId;
        existing.order = i;
        existing.isActive = true;
        existing.isHidden = false;
        existing.icon = meta.icon || '';
        existing.description = meta.description || `${subName} services within ${mainName}`;
        await existing.save();
        updated.subs++;
      }
      subMap[mainName][subName] = existing._id;
    }
  }

  return { mainMap, subMap, created, updated };
}

async function upsertSkillTaxonomyBatch(items) {
  if (!items.length) return 0;

  const operations = items.map((item) => ({
    updateOne: {
      filter: { name: item.name, category: item.category },
      update: {
        $set: {
          name: item.name,
          category: item.category,
          aliases: item.aliases || [],
          demandLevel: item.demandLevel || 'moderate',
          isActive: item.isActive !== false,
        },
        $setOnInsert: {
          slug: (item.name || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-'),
        },
      },
      upsert: true,
    },
  }));

  await SkillTaxonomy.bulkWrite(operations, { ordered: false });
  return items.length;
}

async function rebuildSkillTaxonomies(subMap) {
  const oldTaxos = await SkillTaxonomy.find({}).lean();

  let created = 0;
  const canonical = [];
  const knownNames = new Set();
  for (const [mainName, subs] of Object.entries(SUBCATEGORIES)) {
    for (const subName of subs) {
      const subId = subMap[mainName]?.[subName];
      if (!subId) continue;
      const skills = SKILLS_BY_SUBCATEGORY[subName] || [];
      skills.forEach((name, i) => {
        const key = `${subId.toString()}:${name.toLowerCase()}`;
        if (knownNames.has(key)) return;
        knownNames.add(key);
        canonical.push({ name, category: subId, demandLevel: 'high', aliases: [], order: i, isActive: true });
      });
    }
  }

  created = await upsertSkillTaxonomyBatch(canonical);

  // Preserve any pre-existing taxonomy whose skill isn't in the canonical set
  // (e.g. custom admin-added skills), repointed to the correct canonical sub.
  const categoryById = {};
  const cats = await Category.find({}).select('_id name').lean();
  for (const c of cats) categoryById[c._id.toString()] = c.name;

  let preserved = 0;
  const seen = new Set(knownNames);
  const extras = [];
  for (const old of oldTaxos) {
    const catName = categoryById[old.category?.toString()];
    if (!catName) continue;
    const resolved = resolveLegacyName(catName);
    if (!resolved) continue;
    const newSubId = subMap[resolved[0]]?.[resolved[1]];
    if (!newSubId) continue;
    const key = `${newSubId.toString()}:${(old.name || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({
      name: old.name,
      aliases: old.aliases || [],
      category: newSubId,
      demandLevel: old.demandLevel || 'moderate',
      isActive: old.isActive !== false,
    });
  }

  preserved = await upsertSkillTaxonomyBatch(extras);

  return { created, preserved };
}

async function resolveNewSubId(categoryRef, catNameById, subMap) {
  if (categoryRef == null || categoryRef === '') return null;
  const refStr = String(categoryRef);
  if (!mongoose.isObjectIdOrHexString(refStr)) {
    const mapped = STRING_JOB_CATEGORY_MAP[refStr];
    return mapped ? subMap[mapped[0]]?.[mapped[1]] : null;
  }
  const catName = catNameById[refStr];
  if (!catName) return null;
  const resolved = resolveLegacyName(catName);
  if (!resolved) return null;
  return subMap[resolved[0]]?.[resolved[1]] || null;
}

async function migrateReferences(subMap, nameSnapshot) {
  const catNameById = {};
  for (const c of nameSnapshot) catNameById[c._id.toString()] = c.name;

  // Jobs: category can be an ObjectId or a legacy string.
  const jobs = await Job.find({}).select('_id category').lean();
  let jobsUpdated = 0;
  for (const job of jobs) {
    if (!job.category) continue;
    const newSub = await resolveNewSubId(job.category, catNameById, subMap);
    if (newSub) {
      await Job.updateOne({ _id: job._id }, { $set: { category: newSub } });
      jobsUpdated++;
    }
  }

  // Profiles: remap each element of categories[].
  const profiles = await Profile.find({ categories: { $ne: [] } }).select('_id categories').lean();
  let profilesUpdated = 0;
  for (const profile of profiles) {
    const newCats = [];
    let changed = false;
    for (const cat of profile.categories || []) {
      const catName = catNameById[cat?.toString()];
      const resolved = catName ? resolveLegacyName(catName) : null;
      if (resolved && subMap[resolved[0]]?.[resolved[1]]) {
        newCats.push(subMap[resolved[0]][resolved[1]]);
        changed = true;
      } else {
        newCats.push(cat);
      }
    }
    if (changed) {
      await Profile.updateOne({ _id: profile._id }, { $set: { categories: newCats } });
      profilesUpdated++;
    }
  }

  // Catalogs / Users primaryCategory.
  for (const [Model, field, query] of [
    [Catalog, 'category', { category: { $ne: null } }],
    [User, 'primaryCategory', { primaryCategory: { $ne: null } }],
  ]) {
    const docs = await Model.find(query).select(`_id ${field}`).lean();
    for (const doc of docs) {
      const newSub = await resolveNewSubId(doc[field], catNameById, subMap);
      if (newSub && newSub.toString() !== doc[field]?.toString()) {
        await Model.updateOne({ _id: doc._id }, { $set: { [field]: newSub } });
      }
    }
  }

  return { jobsUpdated, profilesUpdated };
}

async function archiveAndRemoveObsolete(mainMap, subMap) {
  const canonicalIds = new Set([
    ...Object.values(mainMap).map(String),
    ...Object.values(subMap).flatMap((byName) => Object.values(byName).map(String)),
  ]);
  const obsolete = await Category.find({}).lean();
  const toRemove = obsolete.filter((c) => !canonicalIds.has(c._id.toString()));

  logger.info(`[Category] Archiving ${toRemove.length} obsolete categories`);

  const stamp = Date.now();
  for (let i = 0; i < toRemove.length; i++) {
    const c = toRemove[i];
    const archivedName = `_archived_${c.name}_${stamp}_${i}`.slice(0, 100);
    await Category.updateOne(
      { _id: c._id },
      {
        $set: { name: archivedName, isActive: false, isHidden: true },
        $unset: { slug: '' },
      }
    );
  }

  // Safety check: only physically delete obsolete records with zero references.
  const ids = toRemove.map((c) => c._id);
  const deleted = await Category.deleteMany({
    _id: { $in: ids },
    $and: [
      { _id: { $nin: await findReferencedCategoryIds(ids) } },
    ],
  });

  return { archived: toRemove.length, removed: deleted.deletedCount || 0 };
}

async function findReferencedCategoryIds(ids) {
  const referenced = new Set();
  const pushIds = async (query) => {
    const docs = await query.select('_id').lean();
    return docs;
  };

  const [jobs, profiles, catalogs, users, taxos, children] = await Promise.all([
    pushIds(Job.find({ category: { $in: ids } })),
    pushIds(Profile.find({ categories: { $in: ids } })),
    pushIds(Catalog.find({ category: { $in: ids } })),
    pushIds(User.find({ primaryCategory: { $in: ids } })),
    pushIds(SkillTaxonomy.find({ category: { $in: ids } })),
    pushIds(Category.find({ parent: { $in: ids } })),
  ]);
  const catIdByName = {};

  for (const job of jobs) {
    const ref = job.category;
    if (ids.some((id) => id.toString() === String(ref))) referenced.add(String(ref));
  }
  for (const p of profiles) {
    for (const cat of p.categories || []) {
      if (ids.some((id) => id.toString() === String(cat))) referenced.add(String(cat));
    }
  }
  for (const c of catalogs) {
    if (ids.some((id) => id.toString() === String(c.category))) referenced.add(String(c.category));
  }
  for (const u of users) {
    if (ids.some((id) => id.toString() === String(u.primaryCategory))) referenced.add(String(u.primaryCategory));
  }
  for (const t of taxos) {
    if (ids.some((id) => id.toString() === String(t.category))) referenced.add(String(t.category));
  }
  for (const ch of children) {
    if (ids.some((id) => id.toString() === String(ch.parent))) referenced.add(String(ch.parent));
  }

  return [...referenced];
}

// ─── Main seed entrypoint ─────────────────────────────────────────────────────
let seededOnce = false;

// Safety net: repair/clear any remaining corrupted icon values so no mojibake
// (e.g. '≡ƒîÉ') ever reaches the API. Canonical categories already got their
// icons set by buildCanonicalTree; this catches stragglers.
async function sanitizeCorruptedIcons() {
  const cats = await Category.find({}).select('_id name icon').lean();
  let fixed = 0;
  for (const c of cats) {
    if (!isCorruptedIcon(c.icon)) continue;
    const meta = getSubcategoryMeta(c.name);
    const cleanIcon = meta?.icon || '';
    await Category.updateOne({ _id: c._id }, { $set: { icon: cleanIcon } });
    fixed++;
  }
  if (fixed) logger.info(`[Category] Sanitized ${fixed} corrupted icon value(s)`);
  return fixed;
}

export async function seedDefaultCategories(force = false) {
  if (seededOnce && !force) {
    logger.info('[Category] Already seeded this session — skipping');
    return { skipped: true };
  }
  try {
    // Snapshot existing category names BEFORE any legacy renames so reference
    // migration can resolve original names to their canonical targets.
    const nameSnapshot = await Category.find({}).select('_id name').lean();
    const { mainMap, subMap, created, updated } = await buildCanonicalTree();
    const skillResult = await rebuildSkillTaxonomies(subMap);
    const migration = await migrateReferences(subMap, nameSnapshot);
    const archive = await archiveAndRemoveObsolete(mainMap, subMap);
    const iconsFixed = await sanitizeCorruptedIcons();

    const result = {
      created,
      updated,
      skills: skillResult,
      migration,
      archive,
      iconsFixed,
      mainCount: MAIN_CATEGORIES.length,
      subCount: ALL_SUB_NAMES.length,
    };
    logger.info(`[Category] Seed complete: ${JSON.stringify(result)}`);
    seededOnce = true;
    return result;
  } catch (error) {
    logger.error(`Category seed failed: ${error.message}`);
    throw error;
  }
}

export const getCanonicalStructure = () => ({ MAIN_CATEGORIES, SUBCATEGORIES });
