import PlatformSetting from '../models/PlatformSetting.model.js';
import { config } from '../config/env.js';
import {
  buildInfrastructureStatus,
  toCommissionPercent,
} from '../utils/settings.validation.js';

/**
 * Platform settings service.
 *
 * A single PlatformSetting document (key: 'platform') is the source of truth
 * for platform branding and the commission rate. Environment values are only
 * used as fallbacks so an unconfigured installation keeps working exactly as
 * before.
 */

export const PLATFORM_SETTING_KEY = 'platform';

const envCommissionRate = Number.isFinite(config.platform?.commissionRate)
  ? config.platform.commissionRate
  : 0.10;

// In-memory cache of the persisted commission rate so hot payment paths can
// read it synchronously. It is refreshed at boot and whenever the rate is
// updated through the admin API.
let commissionRateCache = envCommissionRate;

export const getCommissionRate = () => commissionRateCache;

export const getCommissionRatePercent = () => toCommissionPercent(commissionRateCache);

export const loadCommissionRate = async () => {
  try {
    const doc = await PlatformSetting.findOne({ key: PLATFORM_SETTING_KEY })
      .select('commissionRate')
      .lean();
    if (doc && Number.isFinite(doc.commissionRate)) {
      commissionRateCache = doc.commissionRate;
    }
  } catch {
    // Keep the environment fallback if the settings document cannot be read.
  }
  return commissionRateCache;
};

export const getPlatformSettings = async () => (
  PlatformSetting.findOne({ key: PLATFORM_SETTING_KEY })
    .populate('focus', 'name slug')
    .lean()
);

/**
 * Persist a patch to the platform settings document. The patch is expected to
 * already be validated/normalised by the caller.
 */
export const savePlatformSettings = async (patch, { userId } = {}) => {
  const update = { ...patch };
  if (userId) update.updatedBy = userId;

  const settings = await PlatformSetting.findOneAndUpdate(
    { key: PLATFORM_SETTING_KEY },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('focus', 'name slug')
    .lean();

  if (update.commissionRate !== undefined) {
    commissionRateCache = update.commissionRate;
  }

  return settings;
};

export const persistCommissionRate = async (fraction, { userId } = {}) => {
  const settings = await PlatformSetting.findOneAndUpdate(
    { key: PLATFORM_SETTING_KEY },
    { $set: { commissionRate: fraction, ...(userId ? { updatedBy: userId } : {}) } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  commissionRateCache = settings.commissionRate;
  return settings;
};

export const getInfrastructureStatus = () => buildInfrastructureStatus(config);
