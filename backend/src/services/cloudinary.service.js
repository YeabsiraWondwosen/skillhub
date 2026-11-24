import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiResponse.js';

// ─── Configure Cloudinary ─────────────────────────────────────────────────────
const hasCloudinaryConfig = config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
} else {
  logger.warn('Cloudinary not configured — file uploads will be disabled. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
}

const FOLDERS = {
  avatars: 'skillhub/avatars',
  resumes: 'skillhub/resumes',
  portfolio: 'skillhub/portfolio',
  jobs: 'skillhub/jobs',
  projects: 'skillhub/projects',
  messages: 'skillhub/messages',
  deliveries: 'skillhub/deliveries',
  reports: 'skillhub/reports',
  branding: 'skillhub/branding',
};

/**
 * Upload a buffer to Cloudinary
 */
const requireCloudinary = () => {
  if (!hasCloudinaryConfig) {
    throw new ApiError(503, 'File upload is not configured. Cloudinary credentials are missing.');
  }
};

const uploadBuffer = (buffer, options = {}) => {
  requireCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(new ApiError(500, `Cloudinary upload failed: ${error.message}`));
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Upload an avatar image
 */
export const uploadAvatar = async (buffer, userId) => {
  try {
    const result = await uploadBuffer(buffer, {
      folder: FOLDERS.avatars,
      public_id: `avatar_${userId}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error(`Avatar upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Upload a resume document
 */
export const uploadResume = async (buffer, userId, originalName) => {
  try {
    const result = await uploadBuffer(buffer, {
      folder: FOLDERS.resumes,
      public_id: `resume_${userId}_${Date.now()}`,
      resource_type: 'raw',
      format: 'pdf',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      originalName,
    };
  } catch (error) {
    logger.error(`Resume upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Upload a portfolio image
 */
export const uploadPortfolioImage = async (buffer, userId, index) => {
  try {
    const result = await uploadBuffer(buffer, {
      folder: FOLDERS.portfolio,
      public_id: `portfolio_${userId}_${Date.now()}_${index}`,
      transformation: [
        { width: 1200, height: 800, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error(`Portfolio image upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Upload a general file (document, image, archive)
 */
export const uploadFile = async (buffer, folder, options = {}) => {
  try {
    const targetFolder = FOLDERS[folder] || `skillhub/${folder}`;
    const result = await uploadBuffer(buffer, {
      folder: targetFolder,
      public_id: options.publicId || `file_${Date.now()}`,
      resource_type: 'auto',
      ...options,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
    };
  } catch (error) {
    logger.error(`File upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Upload multiple files
 */
export const uploadMultipleFiles = async (files, folder) => {
  const uploads = files.map((file, index) =>
    uploadFile(file.buffer, folder, {
      publicId: `file_${Date.now()}_${index}`,
      originalName: file.originalname,
    })
  );

  const results = await Promise.allSettled(uploads);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        ...result.value,
        originalName: files[index].originalname,
        fileType: files[index].mimetype,
        fileSize: files[index].size,
      };
    }
    logger.error(`Failed to upload file ${files[index].originalname}: ${result.reason}`);
    return null;
  }).filter(Boolean);
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return;
    requireCloudinary();
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    logger.info(`Cloudinary file deleted: ${publicId}`);
    return result;
  } catch (error) {
    logger.error(`Cloudinary delete error: ${error.message}`);
    // Don't throw — deletion failures shouldn't block operations
  }
};

/**
 * Delete multiple files
 */
export const deleteMultipleFiles = async (publicIds, resourceType = 'image') => {
  if (!publicIds?.length) return;
  const deletePromises = publicIds.map((id) => deleteFile(id, resourceType));
  await Promise.allSettled(deletePromises);
};

/**
 * Generate a signed URL for private files
 */
export const getSignedUrl = (publicId, options = {}) => {
  requireCloudinary();
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    ...options,
  });
};
