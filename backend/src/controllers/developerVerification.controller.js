import DeveloperVerification from '../models/DeveloperVerification.model.js';
import { User } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { verifyGitHubProfile, getVerificationScore, getVerificationBadgeType } from '../services/developerVerification.service.js';
import { uploadFile, deleteFile } from '../services/cloudinary.service.js';
import { createNotification, notifyAdminsVerificationSubmitted } from '../services/notification.service.js';

// Notify the admin team that a real verification submission is waiting for
// review. Non-critical: a failure here must never block the submission itself.
const notifyAdminsOfVerification = (verification, user) => {
  notifyAdminsVerificationSubmitted({ verification, user }).catch(() => {});
};

// ─── Get my verifications ────────────────────────────────────────────────────
export const getMyVerifications = catchAsync(async (req, res) => {
  const verifications = await DeveloperVerification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  const scoreData = getVerificationScore(verifications);

  sendResponse(res, 200, 'Verifications fetched', {
    verifications,
    ...scoreData,
  });
});

// ─── Get single verification ─────────────────────────────────────────────────
export const getVerification = catchAsync(async (req, res) => {
  const verification = await DeveloperVerification.findById(req.params.id)
    .populate('review.reviewedBy', 'firstName lastName')
    .lean();

  if (!verification) throw new ApiError(404, 'Verification not found');
  if (verification.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this verification');
  }

  sendResponse(res, 200, 'Verification fetched', verification);
});

// ─── Submit identity verification ────────────────────────────────────────────
export const submitIdentity = catchAsync(async (req, res) => {
  const { fullName, dateOfBirth, documentType, country } = req.body;

  // Reuse an existing identity request (active or rejected) so retries and
  // resubmissions succeed instead of being blocked by a stale record.
  let verification = await DeveloperVerification.findOne({
    user: req.user._id,
    type: 'identity',
    status: { $in: ['pending', 'submitted', 'under_review', 'rejected'] },
  }).sort({ createdAt: -1 });

  if (verification) {
    verification.identity.fullName = fullName;
    verification.identity.dateOfBirth = dateOfBirth;
    verification.identity.documentType = documentType;
    verification.identity.country = country;
    verification.status = 'submitted';
    verification.rejectionReason = undefined;
    verification.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    verification.attempts.push({
      method: 'document_upload',
      result: 'pending',
      details: 'Identity documents submitted',
    });
    verification.attemptsCount += 1;
    await verification.save();
    notifyAdminsOfVerification(verification, req.user);

    return sendResponse(res, 200, 'Identity verification updated successfully', verification);
  }

  verification = await DeveloperVerification.create({
    user: req.user._id,
    type: 'identity',
    status: 'submitted',
    identity: {
      fullName,
      dateOfBirth,
      documentType,
      country,
    },
    attempts: [{ method: 'document_upload', result: 'pending', details: 'Identity documents submitted' }],
    attemptsCount: 1,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  notifyAdminsOfVerification(verification, req.user);

  sendResponse(res, 201, 'Identity verification submitted successfully', verification);
});

// ─── Upload identity documents ───────────────────────────────────────────────
export const uploadIdentityDocuments = catchAsync(async (req, res) => {
  const verification = await DeveloperVerification.findOne({
    user: req.user._id,
    type: 'identity',
    status: { $in: ['submitted', 'under_review', 'rejected'] },
  }).sort({ createdAt: -1 });

  if (!verification) throw new ApiError(404, 'No active identity verification found');

  const files = req.files;
  if (!files) throw new ApiError(400, 'Please upload at least one document');

  // Delete old images when replacing
  const deletions = [];
  if (files.documentFront?.length && verification.identity.documentFrontPublicId) {
    deletions.push(deleteFile(verification.identity.documentFrontPublicId));
  }
  if (files.documentBack?.length && verification.identity.documentBackPublicId) {
    deletions.push(deleteFile(verification.identity.documentBackPublicId));
  }
  if (files.selfie?.length && verification.identity.selfiePublicId) {
    deletions.push(deleteFile(verification.identity.selfiePublicId));
  }
  if (deletions.length) await Promise.allSettled(deletions);

  // Upload new files by field name
  const fieldMap = {
    documentFront: { urlKey: 'documentFrontUrl', pubKey: 'documentFrontPublicId' },
    documentBack: { urlKey: 'documentBackUrl', pubKey: 'documentBackPublicId' },
    selfie: { urlKey: 'selfieUrl', pubKey: 'selfiePublicId' },
  };

  let uploadedCount = 0;
  for (const [fieldname, mapping] of Object.entries(fieldMap)) {
    const fileArr = files[fieldname];
    if (!fileArr?.length) continue;

    const result = await uploadFile(fileArr[0].buffer, 'verification/identity', {
      publicId: `identity_${req.user._id}_${fieldname}_${Date.now()}`,
    });

    verification.identity[mapping.urlKey] = result.url;
    verification.identity[mapping.pubKey] = result.publicId;
    uploadedCount++;
  }

  if (uploadedCount === 0) throw new ApiError(400, 'No valid files were uploaded');

  verification.status = 'under_review';
  verification.attempts.push({
    method: 'document_upload',
    result: 'success',
    details: `${uploadedCount} document(s) uploaded successfully`,
  });
  await verification.save();
  notifyAdminsOfVerification(verification, req.user);

  sendResponse(res, 200, 'Documents uploaded successfully', verification);
});

// ─── Submit GitHub verification ──────────────────────────────────────────────
export const submitGithub = catchAsync(async (req, res) => {
  const { username } = req.body;

  // Check for existing active GitHub verification
  const existing = await DeveloperVerification.findOne({
    user: req.user._id,
    type: 'github',
    status: { $in: ['pending', 'submitted', 'under_review'] },
  });

  if (existing) {
    throw new ApiError(400, 'You already have an active GitHub verification request.');
  }

  // Verify via GitHub API
  const githubData = await verifyGitHubProfile(username);

  const verification = await DeveloperVerification.create({
    user: req.user._id,
    type: 'github',
    status: 'approved',
    github: githubData,
    badgeAwarded: true,
    badgeType: 'skill_verified',
    attempts: [{ method: 'github_api', result: 'success', details: `Verified GitHub profile: ${username}` }],
    attemptsCount: 1,
  });

  // Update user badges
  const user = await User.findById(req.user._id);
  const alreadyHasBadge = user.badges.some(b => b.type === 'skill_verified');
  if (!alreadyHasBadge) {
    user.badges.push({ type: 'skill_verified', skill: 'GitHub', earnedAt: new Date() });
  }
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, 'GitHub verification successful', verification);
});

// ─── Submit portfolio verification ───────────────────────────────────────────
export const submitPortfolio = catchAsync(async (req, res) => {
  const { websiteUrl, projectDescription, technologiesUsed, liveProjectUrl, sourceCodeUrl, clientTestimonial, clientName } = req.body;

  // Parse technologiesUsed if it's a JSON string (from FormData)
  const techs = Array.isArray(technologiesUsed)
    ? technologiesUsed
    : typeof technologiesUsed === 'string'
    ? JSON.parse(technologiesUsed)
    : [];

  // Check for existing active portfolio verification
  const existing = await DeveloperVerification.findOne({
    user: req.user._id,
    type: 'portfolio',
    status: { $in: ['pending', 'submitted', 'under_review'] },
  });

  if (existing) {
    throw new ApiError(400, 'You already have an active portfolio verification request.');
  }

  // Handle screenshot uploads
  const screenshots = [];
  if (req.files?.length) {
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const result = await uploadFile(file.buffer, 'verification/portfolio', {
        publicId: `portfolio_${req.user._id}_${Date.now()}_${i}`,
      });
      screenshots.push({
        url: result.url,
        publicId: result.publicId,
        caption: file.originalname,
      });
    }
  }

  const verification = await DeveloperVerification.create({
    user: req.user._id,
    type: 'portfolio',
    status: 'under_review',
    portfolio: {
      websiteUrl,
      projectScreenshots: screenshots,
      projectDescription,
      technologiesUsed: techs,
      liveProjectUrl: liveProjectUrl || '',
      sourceCodeUrl: sourceCodeUrl || '',
      clientTestimonial: clientTestimonial || '',
      clientName: clientName || '',
    },
    attempts: [{ method: 'portfolio_submission', result: 'pending', details: 'Portfolio submitted for review' }],
    attemptsCount: 1,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  notifyAdminsOfVerification(verification, req.user);

  sendResponse(res, 201, 'Portfolio verification submitted for review', verification);
});

// ─── Get verification score (public for profile) ─────────────────────────────
export const getVerificationScoreByUser = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;

  const verifications = await DeveloperVerification.find({
    user: userId,
    status: 'approved',
  }).lean();

  const scoreData = getVerificationScore(verifications);

  sendResponse(res, 200, 'Verification score fetched', scoreData);
});

// ─── Admin: Get all verifications ────────────────────────────────────────────
export const adminGetAllVerifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, type, status, from, to, sort } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = { $in: status.split(',').map((s) => s.trim()) };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const total = await DeveloperVerification.countDocuments(filter);

  let verifications;
  if (sort === 'pending_first') {
    verifications = await DeveloperVerification.aggregate([
      { $match: filter },
      {
        $addFields: {
          _statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'submitted'] }, then: 0 },
                { case: { $eq: ['$status', 'under_review'] }, then: 1 },
              ],
              default: 2,
            },
          },
        },
      },
      { $sort: { _statusOrder: 1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, avatar: 1, role: 1 } }],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'review.reviewedBy',
          foreignField: '_id',
          as: '_reviewedBy',
          pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
        },
      },
      { $unwind: { path: '$_reviewedBy', preserveNullAndEmptyArrays: true } },
      {
        $set: {
          'review.reviewedBy': { $ifNull: ['$_reviewedBy', '$review.reviewedBy'] },
        },
      },
      { $project: { _statusOrder: 0, _reviewedBy: 0 } },
    ]);
  } else {
    verifications = await DeveloperVerification.find(filter)
      .populate('user', 'firstName lastName email avatar role')
      .populate('review.reviewedBy', 'firstName lastName')
      .sort(sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
  }

  sendResponse(res, 200, 'Verifications fetched', verifications, paginationMeta(total, parseInt(page), parseInt(limit)));
});

// ─── Admin: Get pending verifications ────────────────────────────────────────
export const adminGetPendingVerifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, type, from, to, sort } = req.query;

  const filter = { status: { $in: ['submitted', 'under_review'] } };
  if (type) filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const total = await DeveloperVerification.countDocuments(filter);
  const verifications = await DeveloperVerification.find(filter)
    .populate('user', 'firstName lastName email avatar role')
    .populate('review.reviewedBy', 'firstName lastName')
    .sort(sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  sendResponse(res, 200, 'Pending verifications fetched', verifications, paginationMeta(total, parseInt(page), parseInt(limit)));
});

// ─── Admin: Review verification ──────────────────────────────────────────────
export const adminReviewVerification = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { action, notes, rejectionReason } = req.body;

  const verification = await DeveloperVerification.findById(id).populate('user', 'firstName lastName email');
  if (!verification) throw new ApiError(404, 'Verification not found');
  if (!['submitted', 'under_review'].includes(verification.status)) {
    throw new ApiError(400, 'This verification is not in a reviewable state');
  }

  verification.review.reviewedBy = req.user._id;
  verification.review.reviewedAt = new Date();
  verification.review.notes = notes || '';

  if (action === 'approve') {
    verification.status = 'approved';
    verification.badgeAwarded = true;
    verification.badgeType = getVerificationBadgeType(verification.type);

    // Award badge to user
    const user = await User.findById(verification.user._id);
    if (user) {
      const badgeType = verification.type === 'identity' ? 'expert_vetted' :
        verification.type === 'github' ? 'skill_verified' :
        verification.type === 'portfolio' ? 'rising_talent' : 'skill_verified';

      const alreadyHasBadge = user.badges.some(b => b.type === badgeType);
      if (!alreadyHasBadge) {
        user.badges.push({ type: badgeType, earnedAt: new Date() });
      }

      // Check if user should be verified freelancer
      const allVerifications = await DeveloperVerification.find({
        user: user._id,
        status: 'approved',
      });
      const verifiedTypes = [...new Set(allVerifications.map(v => v.type))];
      if (verifiedTypes.length >= 2) {
        user.isVerifiedFreelancer = true;
      }

      await user.save({ validateBeforeSave: false });
    }
  } else if (action === 'request_more_info') {
    verification.status = 'under_review';
    verification.review.requestedMoreInfoAt = new Date();
  } else {
    verification.status = 'rejected';
    verification.rejectionReason = rejectionReason;
  }

  await verification.save();

  const notificationMeta = {
    approve: {
      title: 'Verification Approved',
      message: `Your ${verification.type} verification has been approved. Your profile now reflects your verified status.`,
    },
    reject: {
      title: 'Verification Rejected',
      message: `Your ${verification.type} verification was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    },
    request_more_info: {
      title: 'More Information Needed',
      message: `Our team needs more information for your ${verification.type} verification.${notes ? ` ${notes}` : ''} Please update your submission.`,
    },
  };

  await createNotification({
    recipient: verification.user._id,
    sender: req.user._id,
    type: 'verification',
    title: notificationMeta[action]?.title,
    message: notificationMeta[action]?.message,
    actionUrl: '/verification',
    resourceType: null,
    resourceId: verification._id,
    category: 'system',
    data: { verificationId: verification._id, type: verification.type, status: verification.status, action },
    uniqueKey: `verification_review_${verification._id}_${action}`,
  });

  const successMessage =
    action === 'request_more_info' ? 'More information requested from the developer' :
    action === 'approve' ? 'Verification approved' : 'Verification rejected';

  sendResponse(res, 200, successMessage, verification);
});

// ─── Admin: Get verification stats ───────────────────────────────────────────
export const adminGetVerificationStats = catchAsync(async (req, res) => {
  const stats = await DeveloperVerification.aggregate([
    {
      $group: {
        _id: { type: '$type', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalPending = await DeveloperVerification.countDocuments({
    status: { $in: ['submitted', 'under_review'] },
  });

  const totalApproved = await DeveloperVerification.countDocuments({ status: 'approved' });
  const totalRejected = await DeveloperVerification.countDocuments({ status: 'rejected' });

  sendResponse(res, 200, 'Verification stats fetched', {
    byTypeAndStatus: stats,
    totalPending,
    totalApproved,
    totalRejected,
  });
});

// ─── Resubmit rejected verification ──────────────────────────────────────────
export const resubmitVerification = catchAsync(async (req, res) => {
  const { id } = req.params;

  const verification = await DeveloperVerification.findById(id);
  if (!verification) throw new ApiError(404, 'Verification not found');
  if (verification.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }
  if (verification.status !== 'rejected') {
    throw new ApiError(400, 'Only rejected verifications can be resubmitted');
  }

  verification.status = 'submitted';
  verification.rejectionReason = undefined;
  verification.attempts.push({
    method: 'resubmission',
    result: 'pending',
    details: `Resubmission attempt ${verification.attemptsCount + 1}`,
  });
  verification.attemptsCount += 1;
  verification.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await verification.save();
  notifyAdminsOfVerification(verification, req.user);

  sendResponse(res, 200, 'Verification resubmitted successfully', verification);
});
