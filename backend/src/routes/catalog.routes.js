import { Router } from 'express';
import Joi from 'joi';
import * as catalogController from '../controllers/catalog.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js'; 
import { uploadPortfolioImages } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { MIN_PACKAGE_PRICE, minPackagePriceMessage, getFirstPackagePriceError } from '../config/pricing.js';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': 'Invalid ID format' });

// Multipart forms arrive as strings; accept either a real array or a JSON-encoded
// string, and always re-validate the resolved value against `itemSchema`.
const jsonArray = (itemSchema) =>
  Joi.any().custom((value, helpers) => {
    let arr = value;
    if (typeof value === 'string') {
      try {
        arr = JSON.parse(value);
      } catch {
        return helpers.message('Invalid JSON value');
      }
    }
    if (!Array.isArray(arr)) return helpers.message('Expected an array');
    const { error, value: validated } = itemSchema.validate(arr, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message.replace(/['"]/g, ''));
      return helpers.message(`Invalid item: ${messages.join(', ')}`);
    }
    return validated;
  }, 'parse-json-array');

// Accepts a real array, a JSON-encoded array string, or a single plain string
// (treated as a one-element array). Missing fields default to []. Used for
// skills/tags which the wizard submits as repeated multipart fields.
const flexibleStringArray = (itemSchema) =>
  Joi.any().custom((value, helpers) => {
    let arr = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          arr = JSON.parse(value);
        } catch {
          return helpers.message('Invalid JSON array');
        }
      } else if (trimmed) {
        arr = [value];
      } else {
        arr = [];
      }
    }
    if (arr === undefined || arr === null) arr = [];
    if (!Array.isArray(arr)) return helpers.message('Expected an array');
    const { error, value: validated } = Joi.array().items(itemSchema).validate(arr, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message.replace(/['"]/g, ''));
      return helpers.message(`Invalid item: ${messages.join(', ')}`);
    }
    return validated;
  }, 'flexible-string-array');

const pricingTierSchema = Joi.object({
  name: Joi.string().valid('basic', 'standard', 'premium').required(),
  title: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().min(1).max(500).required(),
  price: Joi.number()
    .min(MIN_PACKAGE_PRICE)
    .required()
    .messages({
      'number.base': minPackagePriceMessage(),
      'number.min': minPackagePriceMessage(),
      'any.required': minPackagePriceMessage(),
    }),
  currency: Joi.string().max(3).uppercase(),
  deliveryTime: Joi.number().integer().min(1).required(),
  deliveryUnit: Joi.string().valid('days', 'weeks').default('days'),
  revisions: Joi.number().integer().min(0).default(1),
  features: Joi.array().items(Joi.string().trim()).default([]),
});

const pricingTiersField = jsonArray(
  Joi.array()
    .items(pricingTierSchema)
    .min(1)
    .max(3)
    .custom((tiers, helpers) => {
      const error = getFirstPackagePriceError(tiers);
      return error ? helpers.message(error) : tiers;
    }, 'package-price-rules')
);

const createCatalogSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  shortDescription: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  category: objectId.required(),
  subcategory: objectId.allow('', null),
  skills: flexibleStringArray(Joi.string().trim().max(60)),
  tags: flexibleStringArray(Joi.string().trim().max(40)),
  pricingTiers: pricingTiersField,
});

const updateCatalogSchema = createCatalogSchema.fork(
  ['title', 'shortDescription', 'description', 'category', 'skills', 'tags'],
  (schema) => schema.optional()
).min(1);

// ─── Public routes ────────────────────────────────────────────────────────────
router.get('/', catalogController.getCatalogs);
router.get('/freelancer/:userId', catalogController.getFreelancerCatalogs);
// Fixed-path public routes MUST come before /:slug so they are not swallowed
// by the slug lookup (a catalog slug is a single path segment).
router.get('/recent', catalogController.getRecentCatalogs);
router.get('/recommended/freelancers', catalogController.getRecommendedFreelancers);
router.get('/:slug', optionalAuth, catalogController.getCatalog);
router.get('/:catalogId/reviews', catalogController.getCatalogReviews);
router.get('/:catalogId/similar', catalogController.getSimilarCatalogs);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);
router.get('/my/catalogs', catalogController.getMyCatalogs);
router.get('/:catalogId/analytics', catalogController.getCatalogAnalytics);
router.post('/:catalogId/duplicate', catalogController.duplicateCatalog);

router.post('/', uploadPortfolioImages, validate(createCatalogSchema), catalogController.createCatalog);

router.put('/:catalogId', uploadPortfolioImages, validate(updateCatalogSchema), catalogController.updateCatalog);

router.delete('/:catalogId', catalogController.deleteCatalog);
router.patch('/:catalogId/toggle-status', catalogController.toggleCatalogStatus);

export default router;
