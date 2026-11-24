import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { User, Profile, Resume } from '../models/index.js';
import {
  generateAIContent,
  generateResumePDF,
  buildResumeContent,
} from '../services/resume.service.js';
import { uploadResume, deleteFile } from '../services/cloudinary.service.js';
import { logger } from '../utils/logger.js';

// ─── Generate Resume ──────────────────────────────────────────────────────────
export const generateResume = catchAsync(async (req, res) => {
  const startTime = Date.now();
  const { template, accentColor, fontSize, includePhoto, includeGitHub, includePortfolio, includeCertifications, sectionOrder } = req.body;

  const user = await User.findById(req.user._id);
  if (!user || user.role !== 'freelancer') {
    throw new ApiError(400, 'Only freelancers can generate resumes');
  }

  const profile = await Profile.findOne({ user: req.user._id });
  if (!profile) {
    throw new ApiError(404, 'Please complete your profile before generating a resume');
  }

  // Build content from profile
  const content = await buildResumeContent(user, profile);

  // Generate AI-enhanced content
  const aiContent = await generateAIContent(profile, user);

  const customization = {
    template: template || 'modern',
    accentColor,
    fontSize: fontSize || 'medium',
    includePhoto: includePhoto !== false,
    includeGitHub: includeGitHub !== false,
    includePortfolio: includePortfolio !== false,
    includeCertifications: includeCertifications !== false,
    sectionOrder: sectionOrder || ['summary', 'skills', 'experience', 'education', 'portfolio', 'certifications', 'languages', 'github'],
  };

  // Create resume document
  const resume = await Resume.create({
    user: req.user._id,
    content,
    aiContent,
    customization,
    status: 'generating',
  });

  try {
    // Generate PDF
    const pdfBuffer = await generateResumePDF({ content, aiContent, customization }, customization);

    // Upload to Cloudinary
    let pdfUrl = '';
    let pdfPublicId = '';
    try {
      const uploadResult = await uploadResume(pdfBuffer, req.user._id, `Resume_${user.firstName}_${user.lastName}.pdf`);
      pdfUrl = uploadResult.url;
      pdfPublicId = uploadResult.publicId;
    } catch (uploadErr) {
      logger.warn(`Cloudinary upload failed, serving PDF directly: ${uploadErr.message}`);
    }

    const duration = Date.now() - startTime;

    // Update resume
    resume.status = 'completed';
    resume.pdfUrl = pdfUrl;
    resume.pdfPublicId = pdfPublicId;
    resume.generatedAt = new Date();
    resume.generationDuration = duration;
    await resume.save();

    sendResponse(res, 200, 'Resume generated successfully', {
      _id: resume._id,
      status: 'completed',
      pdfUrl,
      content: resume.content,
      aiContent: resume.aiContent,
      customization: resume.customization,
      generatedAt: resume.generatedAt,
      generationDuration: duration,
    });
  } catch (genError) {
    resume.status = 'failed';
    resume.errorMessage = genError.message;
    await resume.save();
    throw new ApiError(500, `Resume generation failed: ${genError.message}`);
  }
});

// ─── Download Resume PDF ──────────────────────────────────────────────────────
export const downloadResume = catchAsync(async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.params.resumeId,
    user: req.user._id,
    status: 'completed',
  });

  if (!resume) throw new ApiError(404, 'Resume not found');

  // Regenerate PDF on the fly for fresh downloads
  const pdfBuffer = await generateResumePDF(
    { content: resume.content, aiContent: resume.aiContent, customization: resume.customization },
    resume.customization,
  );

  // Update download count
  resume.downloadCount += 1;
  resume.lastDownloadedAt = new Date();
  await resume.save();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Resume_${resume.content.fullName?.replace(/\s+/g, '_') || 'Resume'}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

// ─── Preview Resume PDF (inline) ──────────────────────────────────────────────
export const previewResume = catchAsync(async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.params.resumeId,
    user: req.user._id,
    status: 'completed',
  });

  if (!resume) throw new ApiError(404, 'Resume not found');

  const pdfBuffer = await generateResumePDF(
    { content: resume.content, aiContent: resume.aiContent, customization: resume.customization },
    resume.customization,
  );

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="Resume_${resume.content.fullName?.replace(/\s+/g, '_') || 'Resume'}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

// ─── Get My Resumes ───────────────────────────────────────────────────────────
export const getMyResumes = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const total = await Resume.countDocuments({ user: req.user._id });
  const resumes = await Resume.find({ user: req.user._id })
    .select('-content -aiContent')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  sendResponse(res, 200, 'Resumes fetched', resumes, paginationMeta(total, page, limit));
});

// ─── Get Resume Detail ────────────────────────────────────────────────────────
export const getResume = catchAsync(async (req, res) => {
  const resume = await Resume.findOne({
    _id: req.params.resumeId,
    user: req.user._id,
  }).lean();

  if (!resume) throw new ApiError(404, 'Resume not found');

  sendResponse(res, 200, 'Resume fetched', resume);
});

// ─── Delete Resume ────────────────────────────────────────────────────────────
export const deleteResume = catchAsync(async (req, res) => {
  const resume = await Resume.findOneAndDelete({
    _id: req.params.resumeId,
    user: req.user._id,
  });

  if (!resume) throw new ApiError(404, 'Resume not found');

  // Delete PDF from Cloudinary
  if (resume.pdfPublicId) {
    await deleteFile(resume.pdfPublicId, 'raw');
  }

  sendResponse(res, 200, 'Resume deleted');
});

// ─── Get Resume Templates ─────────────────────────────────────────────────────
export const getTemplates = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Templates fetched', [
    {
      id: 'modern',
      name: 'Modern',
      description: 'Clean, professional layout with blue accents',
      preview: 'modern',
      accentColor: '#2563eb',
    },
    {
      id: 'classic',
      name: 'Classic',
      description: 'Traditional resume format with dark headers',
      preview: 'classic',
      accentColor: '#1a1a2e',
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Simple, elegant design focused on content',
      preview: 'minimal',
      accentColor: '#374151',
    },
    {
      id: 'creative',
      name: 'Creative',
      description: 'Bold purple accent for creative professionals',
      preview: 'creative',
      accentColor: '#7c3aed',
    },
  ]);
});

// ─── Get Resume Stats ─────────────────────────────────────────────────────────
export const getResumeStats = catchAsync(async (req, res) => {
  const stats = await Resume.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalResumes: { $sum: 1 },
        completedResumes: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalDownloads: { $sum: '$downloadCount' },
        lastGenerated: { $max: '$generatedAt' },
      },
    },
  ]);

  sendResponse(res, 200, 'Resume stats', stats[0] || {
    totalResumes: 0,
    completedResumes: 0,
    totalDownloads: 0,
    lastGenerated: null,
  });
});
