import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { CodeReview } from '../models/index.js';
import { analyzeCodeReview, detectLanguage } from '../services/codeReview.service.js';
import { logger } from '../utils/logger.js';

// ─── Submit Code for Review (file upload) ─────────────────────────────────────
export const submitFileReview = catchAsync(async (req, res) => {
  const { focusAreas, severity, projectId } = req.body;

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'At least one code file is required');
  }

  const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total
  let totalSize = 0;
  const files = [];

  for (const file of req.files) {
    totalSize += file.size;
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new ApiError(400, 'Total file size exceeds 500KB limit');
    }

    const content = file.buffer.toString('utf-8');
    const language = detectLanguage(file.originalname, file.mimetype);

    files.push({
      fileName: file.originalname,
      language,
      content,
      size: file.size,
    });
  }

  const review = await CodeReview.create({
    user: req.user._id,
    inputType: 'file_upload',
    sourceFiles: req.files.map((f, i) => ({
      fileName: f.originalname,
      language: files[i].language,
      mimeType: f.mimetype,
      size: f.size,
    })),
    detectedLanguage: files[0]?.language || 'unknown',
    options: {
      focusAreas: focusAreas ? (Array.isArray(focusAreas) ? focusAreas : [focusAreas]) : [],
      severity: severity || 'all',
    },
    status: 'analyzing',
    project: projectId || undefined,
  });

  // Analyze asynchronously
  analyzeCodeReview(
    files,
    review.options.focusAreas,
    review.options.severity,
  ).then(async (result) => {
    const allIssues = result.files?.flatMap(f => f.issues) || [];
    await CodeReview.findByIdAndUpdate(review._id, {
      status: 'completed',
      fileAnalyses: result.files || [],
      overallScore: result.overallScore || 0,
      categoryScores: result.categoryScores || {},
      totalIssues: allIssues.length,
      criticalCount: allIssues.filter(i => i.severity === 'critical').length,
      highCount: allIssues.filter(i => i.severity === 'high').length,
      mediumCount: allIssues.filter(i => i.severity === 'medium').length,
      lowCount: allIssues.filter(i => i.severity === 'low').length,
      infoCount: allIssues.filter(i => i.severity === 'info').length,
      summary: result.summary || '',
      recommendations: result.recommendations || [],
      strengths: result.strengths || [],
      analyzedAt: new Date(),
      analysisDuration: result.analysisDuration || 0,
      aiModel: result.aiModel || 'gemini-flash-latest',
    });
  }).catch(async (err) => {
    logger.error(`Code review analysis failed: ${err.message}`);
    await CodeReview.findByIdAndUpdate(review._id, {
      status: 'failed',
      errorMessage: err.message,
    });
  });

  sendResponse(res, 202, 'Code review submitted', {
    _id: review._id,
    status: 'analyzing',
    fileCount: files.length,
  });
});

// ─── Submit Code for Review (paste) ───────────────────────────────────────────
export const submitPasteReview = catchAsync(async (req, res) => {
  const { code, language, fileName, focusAreas, severity, projectId } = req.body;

  if (!code || code.trim().length === 0) {
    throw new ApiError(400, 'Code is required');
  }

  if (code.length > 100000) {
    throw new ApiError(400, 'Code exceeds 100KB limit');
  }

  const detectedLang = language || detectLanguage(fileName, null) || 'unknown';
  const name = fileName || `untitled.${detectedLang === 'javascript' ? 'js' : detectedLang === 'python' ? 'py' : 'txt'}`;

  const files = [{
    fileName: name,
    language: detectedLang,
    content: code,
    size: Buffer.byteLength(code, 'utf-8'),
  }];

  const review = await CodeReview.create({
    user: req.user._id,
    inputType: 'code_paste',
    sourceFiles: [{
      fileName: name,
      language: detectedLang,
      size: Buffer.byteLength(code, 'utf-8'),
    }],
    pastedCode: code,
    detectedLanguage: detectedLang,
    options: {
      focusAreas: focusAreas ? (Array.isArray(focusAreas) ? focusAreas : [focusAreas]) : [],
      severity: severity || 'all',
    },
    status: 'analyzing',
    project: projectId || undefined,
  });

  analyzeCodeReview(
    files,
    review.options.focusAreas,
    review.options.severity,
  ).then(async (result) => {
    const allIssues = result.files?.flatMap(f => f.issues) || [];
    await CodeReview.findByIdAndUpdate(review._id, {
      status: 'completed',
      fileAnalyses: result.files || [],
      overallScore: result.overallScore || 0,
      categoryScores: result.categoryScores || {},
      totalIssues: allIssues.length,
      criticalCount: allIssues.filter(i => i.severity === 'critical').length,
      highCount: allIssues.filter(i => i.severity === 'high').length,
      mediumCount: allIssues.filter(i => i.severity === 'medium').length,
      lowCount: allIssues.filter(i => i.severity === 'low').length,
      infoCount: allIssues.filter(i => i.severity === 'info').length,
      summary: result.summary || '',
      recommendations: result.recommendations || [],
      strengths: result.strengths || [],
      analyzedAt: new Date(),
      analysisDuration: result.analysisDuration || 0,
      aiModel: result.aiModel || 'gemini-flash-latest',
    });
  }).catch(async (err) => {
    logger.error(`Code review analysis failed: ${err.message}`);
    await CodeReview.findByIdAndUpdate(review._id, {
      status: 'failed',
      errorMessage: err.message,
    });
  });

  sendResponse(res, 202, 'Code review submitted', {
    _id: review._id,
    status: 'analyzing',
    fileCount: 1,
  });
});

// ─── Get Review Status/Result ─────────────────────────────────────────────────
export const getReview = catchAsync(async (req, res) => {
  const review = await CodeReview.findOne({
    _id: req.params.reviewId,
    user: req.user._id,
  }).lean();

  if (!review) throw new ApiError(404, 'Review not found');

  sendResponse(res, 200, 'Review fetched', review);
});

// ─── Get My Reviews ───────────────────────────────────────────────────────────
export const getMyReviews = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const total = await CodeReview.countDocuments(filter);
  const reviews = await CodeReview.find(filter)
    .select('-pastedCode -sourceFiles -fileAnalyses.issues')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  sendResponse(res, 200, 'Reviews fetched', reviews, paginationMeta(total, page, limit));
});

// ─── Delete Review ────────────────────────────────────────────────────────────
export const deleteReview = catchAsync(async (req, res) => {
  const review = await CodeReview.findOneAndDelete({
    _id: req.params.reviewId,
    user: req.user._id,
  });

  if (!review) throw new ApiError(404, 'Review not found');

  sendResponse(res, 200, 'Review deleted');
});

// ─── Get Review Stats ─────────────────────────────────────────────────────────
export const getMyReviewStats = catchAsync(async (req, res) => {
  const stats = await CodeReview.aggregate([
    { $match: { user: req.user._id, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgScore: { $avg: '$overallScore' },
        avgIssues: { $avg: '$totalIssues' },
        totalIssues: { $sum: '$totalIssues' },
        totalCritical: { $sum: '$criticalCount' },
        totalHigh: { $sum: '$highCount' },
      },
    },
  ]);

  const recentTrend = await CodeReview.aggregate([
    { $match: { user: req.user._id, status: 'completed' } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    { $project: { overallScore: 1, totalIssues: 1, createdAt: 1 } },
  ]);

  sendResponse(res, 200, 'Review stats', {
    summary: stats[0] || {
      totalReviews: 0,
      avgScore: 0,
      avgIssues: 0,
      totalIssues: 0,
      totalCritical: 0,
      totalHigh: 0,
    },
    recentTrend: recentTrend.reverse(),
  });
});

// ─── Get Public Review (shared) ───────────────────────────────────────────────
// A review is only reachable via the public route when its OWNER explicitly
// marked it public (isPublic=true). Source code and fix snippets are stripped
// server-side so even a public review never leaks the original source files,
// pasted code, or suggested fix code.
export const getPublicReview = catchAsync(async (req, res) => {
  const review = await CodeReview.findOne({
    _id: req.params.reviewId,
    status: 'completed',
  })
    .populate('user', 'firstName lastName avatar')
    .lean();

  if (!review) throw new ApiError(404, 'Review not found');

  const isOwner = req.user && String(review.user?._id || review.user) === String(req.user._id);
  const isAdmin = req.user?.role === 'admin';

  // Fail closed: anonymous non-public reviews are treated as "not found" so an
  // attacker cannot enumerate or probe review IDs. Owners/admins can still open
  // their own reviews directly.
  if (!review.isPublic && !isOwner && !isAdmin) {
    throw new ApiError(404, 'Review not found');
  }

  // Strip source code entirely — expose only issue categories, counts and
  // sanitized metadata. Source files, pasted code, snippets and fix code are
  // NEVER sent to the client through the public route.
  delete review.pastedCode;
  delete review.sourceFiles;
  delete review.githubUrl;

  if (Array.isArray(review.fileAnalyses)) {
    review.fileAnalyses = review.fileAnalyses.map((fa) => ({
      fileName: fa.fileName,
      language: fa.language,
      lineCount: fa.lineCount,
      issueCount: fa.issues?.length || 0,
      issues: (fa.issues || []).map(({ line, column, rule, severity, message, category }) => ({
        line, column, rule, severity, message, category,
      })),
    }));
  }

  sendResponse(res, 200, 'Public review', review);
});

// ─── Set Review Public Visibility (owner only) ────────────────────────────────
export const setReviewPublic = catchAsync(async (req, res) => {
  const review = await CodeReview.findOne({
    _id: req.params.reviewId,
    user: req.user._id,
  });
  if (!review) throw new ApiError(404, 'Review not found');
  if (review.status !== 'completed') {
    throw new ApiError(400, 'Only completed reviews can be shared publicly');
  }

  review.isPublic = req.body.isPublic === true;
  await review.save();

  sendResponse(res, 200, `Review ${review.isPublic ? 'is now public' : 'is now private'}`, {
    _id: review._id,
    isPublic: review.isPublic,
  });
});
