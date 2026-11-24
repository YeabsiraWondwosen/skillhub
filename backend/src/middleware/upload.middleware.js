import multer from 'multer';
import { ApiError } from '../utils/apiResponse.js';

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];
const ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
];
const CODE_MIMES = ['text/javascript', 'text/html', 'text/css', 'application/json'];
const CODE_FILE_MIMES = [
  'text/javascript', 'text/html', 'text/css', 'application/json',
  'text/typescript', 'application/typescript',
  'text/x-python', 'text/x-java-source', 'text/x-c', 'text/x-c++',
  'text/x-go', 'text/x-ruby', 'text/x-php',
  'text/x-sql', 'text/x-yaml', 'text/yaml',
  'text/markdown', 'text/x-shellscript',
  'text/plain', 'text/x-typescript', 'text/x-jsx', 'text/x-tsx',
  'application/x-javascript', 'application/x-typescript',
];

const ALL_ALLOWED_MIMES = [...IMAGE_MIMES, ...DOCUMENT_MIMES, ...ARCHIVE_MIMES, ...CODE_MIMES];

// ─── Storage: memory (files sent to Cloudinary directly) ─────────────────────
const memoryStorage = multer.memoryStorage();

// ─── File filter factory ──────────────────────────────────────────────────────
const createFileFilter = (allowedMimes) => (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `File type not allowed: ${file.mimetype}. Allowed types: ${allowedMimes.join(', ')}`
      ),
      false
    );
  }
};

// ─── Multer instances ─────────────────────────────────────────────────────────

/**
 * Avatar upload — single image, max 5MB
 */
export const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: createFileFilter(IMAGE_MIMES),
}).single('avatar');

/**
 * Platform branding logo — single image, max 5MB
 */
export const uploadBrandingLogo = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: createFileFilter(IMAGE_MIMES),
}).single('logo');

/**
 * Resume upload — single document, max 10MB
 */
export const uploadResume = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createFileFilter(DOCUMENT_MIMES),
}).single('resume');

/**
 * Portfolio images — up to 5 images, max 8MB each
 */
export const uploadPortfolioImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: createFileFilter(IMAGE_MIMES),
}).array('images', 5);

/**
 * Job attachments — up to 5 files (any type), max 20MB each
 */
export const uploadJobAttachments = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  fileFilter: createFileFilter(ALL_ALLOWED_MIMES),
}).array('attachments', 5);

/**
 * Message file — up to 3 files, max 20MB each
 */
export const uploadMessageFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
  fileFilter: createFileFilter(ALL_ALLOWED_MIMES),
}).array('files', 3);

/**
 * Delivery files — up to 10 files, max 50MB each
 */
export const uploadDeliveryFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: createFileFilter(ALL_ALLOWED_MIMES),
}).array('files', 10);

/**
 * Project files — up to 10 files, max 50MB each
 */
export const uploadProjectFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: createFileFilter(ALL_ALLOWED_MIMES),
}).array('files', 10);

/**
 * Delivery attachments — `files` (any allowed type, up to 10) +
 * `screenshots` (images only, up to 6), max 50MB each
 */
export const uploadDeliveryAttachments = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 16 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'screenshots') {
      if (!IMAGE_MIMES.includes(file.mimetype)) {
        return cb(new ApiError(400, `Screenshot type not allowed: ${file.mimetype}. Images only.`), false);
      }
      return cb(null, true);
    }
    return createFileFilter(ALL_ALLOWED_MIMES)(req, file, cb);
  },
}).fields([
  { name: 'files', maxCount: 10 },
  { name: 'screenshots', maxCount: 6 },
]);

/**
 * Identity verification documents — 3 images, max 5MB each
 */
export const uploadIdentityDocs = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: createFileFilter(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
}).fields([
  { name: 'documentFront', maxCount: 1 },
  { name: 'documentBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

/**
 * Generic multi-type upload
 */
export const uploadGeneral = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  fileFilter: createFileFilter(ALL_ALLOWED_MIMES),
}).array('files', 5);

/**
 * Code file upload — up to 10 files, max 50KB each for code review
 */
export const uploadCodeFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024, files: 10 }, // 100KB per file, max 10 files
  fileFilter: createFileFilter([...CODE_FILE_MIMES, 'text/plain']),
}).array('files', 10);

/**
 * Multer error wrapper middleware
 */
export const handleMulterError = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(400, 'File size exceeds the allowed limit.'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new ApiError(400, 'Too many files uploaded.'));
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      if (err) return next(err);
      next();
    });
  };
};
