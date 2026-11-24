import PDFDocument from 'pdfkit';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

// ─── Font Sizes by Template ───────────────────────────────────────────────────
const FONT_SIZES = {
  small: { name: 22, section: 12, body: 9, label: 8, spacing: 3 },
  medium: { name: 26, section: 13, body: 10, label: 9, spacing: 4 },
  large: { name: 30, section: 14, body: 11, label: 10, spacing: 5 },
};

const ACCENT_COLORS = {
  modern: '#2563eb',
  classic: '#1a1a2e',
  minimal: '#374151',
  creative: '#7c3aed',
};

// ─── AI Content Enhancement ───────────────────────────────────────────────────
export const generateAIContent = async (profileData, user) => {
  if (!AI_AVAILABLE) {
    return generateFallbackContent(profileData, user);
  }

  try {
    const prompt = `You are a professional resume writer. Generate enhanced resume content for a web developer freelancer.

FREELANCER DATA:
Name: ${user.firstName} ${user.lastName}
Level: ${user.freelancerLevel || 'freelancer'}
Tagline: ${profileData.tagline || ''}
Bio: ${profileData.bio || ''}
Skills: ${(profileData.skills || []).map(s => `${s.name} (${s.level}${s.yearsOfExperience ? `, ${s.yearsOfExperience}yr` : ''})`).join(', ')}
Experience: ${(profileData.experience || []).map(e => `${e.title} at ${e.company}${e.description ? `: ${e.description.substring(0, 200)}` : ''}`).join('; ')}
Education: ${(profileData.education || []).map(e => `${e.degree} in ${e.fieldOfStudy || 'N/A'} from ${e.institution}`).join('; ')}
Portfolio: ${(profileData.portfolio || []).map(p => `"${p.title}" (${(p.technologies || []).join(', ')})`).join('; ')}
Languages: ${(profileData.languages || []).map(l => `${l.name} (${l.proficiency})`).join(', ')}
Completed Projects: ${user.stats?.completedProjects || 0}
Rating: ${user.stats?.averageRating || 0}/5
Success Rate: ${user.stats?.successRate || 0}%

Return a JSON object with:
{
  "professionalSummary": "A compelling 3-4 sentence professional summary highlighting key strengths, expertise areas, and value proposition",
  "skillDescriptions": { "SkillName": "One-line description of expertise in this skill" },
  "experienceEnhancements": ["Enhanced bullet point for experience 1", "Enhanced bullet point for experience 2"],
  "projectHighlights": ["Highlight from portfolio 1", "Highlight from portfolio 2", "Highlight from portfolio 3"]
}

Be specific, use action verbs, and quantify achievements where possible. Only return valid JSON.`;

    const parsed = await chatJSON(
      'You are a professional resume writer specializing in tech careers. Return only valid JSON.',
      prompt,
      0.7,
      1500
    );

    return {
      professionalSummary: parsed.professionalSummary || profileData.bio || '',
      skillDescriptions: parsed.skillDescriptions || {},
      experienceEnhancements: parsed.experienceEnhancements || [],
      projectHighlights: parsed.projectHighlights || [],
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`AI resume content generation failed: ${error.message}`);
    return generateFallbackContent(profileData, user);
  }
};

const generateFallbackContent = (profileData, user) => ({
  professionalSummary: profileData.bio || `${user.firstName} ${user.lastName} is a ${user.freelancerLevel || 'skilled'} web developer with ${user.stats?.completedProjects || 0} completed projects and a ${user.stats?.averageRating || 0}/5 client rating.`,
  skillDescriptions: {},
  experienceEnhancements: [],
  projectHighlights: (profileData.portfolio || []).slice(0, 3).map(p => `${p.title}: Built using ${(p.technologies || []).join(', ')}`),
  generatedAt: new Date(),
});

// ─── PDF Generation ───────────────────────────────────────────────────────────
export const generateResumePDF = (resumeData, customization = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const template = customization.template || 'modern';
      const fontSizeKey = customization.fontSize || 'medium';
      const sizes = FONT_SIZES[fontSizeKey];
      const accentColor = customization.accentColor || ACCENT_COLORS[template] || '#2563eb';

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Resume - ${resumeData.content.fullName}`,
          Author: resumeData.content.fullName,
          Subject: 'Professional Resume',
          Creator: 'SkillHub Resume Builder',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const content = resumeData.content;
      const ai = resumeData.aiContent || {};
      const pageWidth = doc.page.width - 100;

      const sectionOrder = customization.sectionOrder || ['summary', 'skills', 'experience', 'education', 'portfolio', 'certifications', 'languages'];

      // ─── Header ───────────────────────────────────────────────────────
      drawHeader(doc, content, accentColor, sizes, pageWidth);

      // ─── Sections ─────────────────────────────────────────────────────
      for (const section of sectionOrder) {
        switch (section) {
          case 'summary':
            if (ai.professionalSummary || content.summary) {
              drawSectionTitle(doc, 'PROFESSIONAL SUMMARY', accentColor, sizes);
              drawParagraph(doc, ai.professionalSummary || content.summary, sizes, pageWidth);
              doc.moveDown(0.3);
            }
            break;

          case 'skills':
            if (content.skills?.length > 0) {
              drawSectionTitle(doc, 'TECHNICAL SKILLS', accentColor, sizes);
              drawSkills(doc, content.skills, ai.skillDescriptions || {}, sizes, pageWidth, accentColor);
              doc.moveDown(0.3);
            }
            break;

          case 'experience':
            if (content.experience?.length > 0) {
              drawSectionTitle(doc, 'WORK EXPERIENCE', accentColor, sizes);
              for (const exp of content.experience) {
                drawExperience(doc, exp, sizes, pageWidth, accentColor);
              }
              doc.moveDown(0.3);
            }
            break;

          case 'education':
            if (content.education?.length > 0) {
              drawSectionTitle(doc, 'EDUCATION', accentColor, sizes);
              for (const edu of content.education) {
                drawEducation(doc, edu, sizes, pageWidth, accentColor);
              }
              doc.moveDown(0.3);
            }
            break;

          case 'portfolio':
            if (customization.includePortfolio !== false && content.portfolio?.length > 0) {
              drawSectionTitle(doc, 'PORTFOLIO & PROJECTS', accentColor, sizes);
              drawPortfolio(doc, content.portfolio, ai.projectHighlights || [], sizes, pageWidth, accentColor);
              doc.moveDown(0.3);
            }
            break;

          case 'certifications':
            if (customization.includeCertifications !== false && content.certifications?.length > 0) {
              drawSectionTitle(doc, 'CERTIFICATIONS', accentColor, sizes);
              for (const cert of content.certifications) {
                drawCertification(doc, cert, sizes, pageWidth, accentColor);
              }
              doc.moveDown(0.3);
            }
            break;

          case 'languages':
            if (content.languages?.length > 0) {
              drawSectionTitle(doc, 'LANGUAGES', accentColor, sizes);
              drawLanguages(doc, content.languages, sizes, pageWidth, accentColor);
              doc.moveDown(0.3);
            }
            break;

          case 'github':
            if (customization.includeGitHub !== false && content.github?.username) {
              drawSectionTitle(doc, 'GITHUB PROFILE', accentColor, sizes);
              drawGitHub(doc, content.github, sizes, pageWidth, accentColor);
              doc.moveDown(0.3);
            }
            break;
        }
      }

      // ─── Footer ───────────────────────────────────────────────────────
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#999999')
          .text(
            `${content.fullName} • Generated by SkillHub`,
            50,
            doc.page.height - 30,
            { align: 'center', width: pageWidth }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ─── Drawing Helpers ──────────────────────────────────────────────────────────
function drawHeader(doc, content, accentColor, sizes, pageWidth) {
  // Name
  doc.fontSize(sizes.name).fillColor(accentColor)
    .text(content.fullName || 'Your Name', 50, 40, { width: pageWidth });

  // Tagline
  if (content.tagline) {
    doc.fontSize(sizes.body + 1).fillColor('#555555')
      .text(content.tagline, 50, doc.y + 2, { width: pageWidth });
  }

  // Contact line
  doc.moveDown(0.2);
  const contactParts = [];
  if (content.email) contactParts.push(content.email);
  if (content.location) contactParts.push(content.location);
  if (content.website) contactParts.push(content.website);
  if (content.linkedin) contactParts.push(content.linkedin);
  if (content.github) contactParts.push(`github.com/${content.github}`);

  if (contactParts.length > 0) {
    doc.fontSize(sizes.label).fillColor('#777777')
      .text(contactParts.join('  |  '), 50, doc.y, { width: pageWidth });
  }

  // Stats line
  if (content.stats) {
    doc.moveDown(0.15);
    const statsParts = [];
    if (content.stats.completedProjects > 0) statsParts.push(`${content.stats.completedProjects} Projects Completed`);
    if (content.stats.averageRating > 0) statsParts.push(`${content.stats.averageRating}/5 Rating`);
    if (content.stats.successRate > 0) statsParts.push(`${content.stats.successRate}% Success Rate`);
    if (content.stats.freelancerLevel && content.stats.freelancerLevel !== 'newcomer') {
      statsParts.push(content.stats.freelancerLevel.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }

    if (statsParts.length > 0) {
      doc.fontSize(sizes.label).fillColor(accentColor)
        .text(statsParts.join('  •  '), 50, doc.y, { width: pageWidth });
    }
  }

  // Divider
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y)
    .strokeColor(accentColor).lineWidth(1.5).stroke();
  doc.moveDown(0.4);
}

function drawSectionTitle(doc, title, accentColor, sizes) {
  checkPageBreak(doc, 60);
  doc.fontSize(sizes.section).fillColor(accentColor)
    .text(title, 50, doc.y, { width: doc.page.width - 100 });
  doc.moveDown(0.1);
  doc.moveTo(50, doc.y).lineTo(200, doc.y)
    .strokeColor(accentColor).lineWidth(0.5).stroke();
  doc.moveDown(0.3);
}

function drawParagraph(doc, text, sizes, pageWidth) {
  if (!text) return;
  doc.fontSize(sizes.body).fillColor('#333333')
    .text(text, 50, doc.y, { width: pageWidth, lineGap: 2 });
}

function drawSkills(doc, skills, descriptions, sizes, pageWidth, accentColor) {
  const cols = 2;
  const colWidth = pageWidth / cols;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const col = i % cols;
    const x = 50 + col * colWidth;
    const y = doc.y;

    if (col === 0 && i > 0) doc.moveDown(0.3);

    doc.fontSize(sizes.label + 1).fillColor('#333333')
      .text(skill.name || '', x, y, { width: colWidth - 10, continued: false });

    const levelLabel = skill.level ? skill.level.charAt(0).toUpperCase() + skill.level.slice(1) : '';
    const yearsLabel = skill.yearsOfExperience ? `${skill.yearsOfExperience}yr` : '';
    const detail = [levelLabel, yearsLabel].filter(Boolean).join(', ');

    if (detail) {
      doc.fontSize(sizes.label - 1).fillColor(accentColor)
        .text(detail, x, doc.y, { width: colWidth - 10 });
    }
  }

  // Move to next line after the last row
  if (skills.length % cols !== 0) doc.moveDown(0.3);
}

function drawExperience(doc, exp, sizes, pageWidth, accentColor) {
  checkPageBreak(doc, 60);

  // Title + Company
  doc.fontSize(sizes.label + 1).fillColor('#333333')
    .text(exp.title || '', 50, doc.y, { continued: true });
  doc.fontSize(sizes.label).fillColor(accentColor)
    .text(`  at ${exp.company || ''}`);
  doc.fontSize(sizes.label - 1).fillColor('#888888')
    .text(
      `${formatDate(exp.startDate)} - ${exp.isCurrent ? 'Present' : formatDate(exp.endDate)}${exp.location ? ` • ${exp.location}` : ''}`,
      50, doc.y, { width: pageWidth }
    );

  if (exp.description) {
    doc.moveDown(0.15);
    doc.fontSize(sizes.body).fillColor('#444444')
      .text(exp.description, 50, doc.y, { width: pageWidth, lineGap: 2 });
  }

  doc.moveDown(0.5);
}

function drawEducation(doc, edu, sizes, pageWidth, accentColor) {
  checkPageBreak(doc, 50);

  doc.fontSize(sizes.label + 1).fillColor('#333333')
    .text(edu.degree || '', 50, doc.y, { continued: edu.fieldOfStudy ? true : false });
  if (edu.fieldOfStudy) {
    doc.fontSize(sizes.label).fillColor('#555555')
      .text(` in ${edu.fieldOfStudy}`);
  }
  doc.fontSize(sizes.label).fillColor(accentColor)
    .text(edu.institution || '', 50, doc.y);
  doc.fontSize(sizes.label - 1).fillColor('#888888')
    .text(
      `${formatDate(edu.startDate)} - ${edu.isCurrent ? 'Present' : formatDate(edu.endDate)}`,
      50, doc.y, { width: pageWidth }
    );

  if (edu.description) {
    doc.moveDown(0.15);
    doc.fontSize(sizes.body).fillColor('#444444')
      .text(edu.description, 50, doc.y, { width: pageWidth, lineGap: 2 });
  }

  doc.moveDown(0.5);
}

function drawPortfolio(doc, portfolio, highlights, sizes, pageWidth, accentColor) {
  for (let i = 0; i < portfolio.length; i++) {
    const project = portfolio[i];
    checkPageBreak(doc, 40);

    doc.fontSize(sizes.label + 1).fillColor('#333333')
      .text(project.title || '', 50, doc.y);

    if (project.technologies?.length > 0) {
      doc.fontSize(sizes.label - 1).fillColor(accentColor)
        .text(project.technologies.join(' • '), 50, doc.y, { width: pageWidth });
    }

    if (project.description) {
      doc.fontSize(sizes.body).fillColor('#444444')
        .text(project.description, 50, doc.y, { width: pageWidth, lineGap: 1 });
    }

    if (highlights[i]) {
      doc.fontSize(sizes.body - 1).fillColor('#666666')
        .text(`▸ ${highlights[i]}`, 60, doc.y, { width: pageWidth - 10 });
    }

    if (project.projectUrl) {
      doc.fontSize(sizes.label - 1).fillColor(accentColor)
        .text(project.projectUrl, 50, doc.y, { width: pageWidth, link: project.projectUrl });
    }

    doc.moveDown(0.4);
  }
}

function drawCertification(doc, cert, sizes, pageWidth, accentColor) {
  checkPageBreak(doc, 30);

  doc.fontSize(sizes.label).fillColor('#333333')
    .text(cert.name || '', 50, doc.y, { continued: true });
  doc.fontSize(sizes.label - 1).fillColor('#888888')
    .text(` — ${cert.issuingOrganization || ''}`);

  if (cert.issueDate) {
    doc.fontSize(sizes.label - 1).fillColor('#aaaaaa')
      .text(formatDate(cert.issueDate), 50, doc.y);
  }

  if (cert.credentialUrl) {
    doc.fontSize(sizes.label - 1).fillColor(accentColor)
      .text(cert.credentialUrl, 50, doc.y, { width: pageWidth, link: cert.credentialUrl });
  }

  doc.moveDown(0.3);
}

function drawLanguages(doc, languages, sizes, pageWidth, accentColor) {
  const proficiencyOrder = { native: 5, professional: 4, conversational: 3, basic: 2 };
  const parts = languages.map(l => {
    const prof = l.proficiency ? l.proficiency.charAt(0).toUpperCase() + l.proficiency.slice(1) : '';
    return prof ? `${l.name} (${prof})` : l.name;
  });

  doc.fontSize(sizes.body).fillColor('#333333')
    .text(parts.join('  •  '), 50, doc.y, { width: pageWidth });
  doc.moveDown(0.3);
}

function drawGitHub(doc, github, sizes, pageWidth, accentColor) {
  checkPageBreak(doc, 50);

  doc.fontSize(sizes.label).fillColor(accentColor)
    .text(`github.com/${github.username}`, 50, doc.y, {
      width: pageWidth,
      link: `https://github.com/${github.username}`,
    });

  const statsParts = [];
  if (github.totalStars > 0) statsParts.push(`${github.totalStars} Stars`);
  if (github.totalForks > 0) statsParts.push(`${github.totalForks} Forks`);
  if (github.contributionScore > 0) statsParts.push(`Score: ${github.contributionScore}/100`);
  if (github.topLanguages?.length > 0) statsParts.push(github.topLanguages.slice(0, 5).join(', '));

  if (statsParts.length > 0) {
    doc.fontSize(sizes.label - 1).fillColor('#666666')
      .text(statsParts.join('  •  '), 50, doc.y, { width: pageWidth });
  }

  if (github.pinnedRepos?.length > 0) {
    doc.moveDown(0.2);
    for (const repo of github.pinnedRepos.slice(0, 3)) {
      const stars = repo.stars > 0 ? ` ★${repo.stars}` : '';
      doc.fontSize(sizes.label - 1).fillColor('#333333')
        .text(`▸ ${repo.name}${stars}${repo.language ? ` (${repo.language})` : ''}`, 60, doc.y, { width: pageWidth - 10 });
      if (repo.description) {
        doc.fontSize(sizes.label - 2).fillColor('#888888')
          .text(repo.description, 70, doc.y, { width: pageWidth - 20 });
      }
    }
  }

  doc.moveDown(0.3);
}

function checkPageBreak(doc, needed) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Build Resume Content from Profile ────────────────────────────────────────
export const buildResumeContent = async (user, profile) => {
  const locationParts = [];
  if (profile.location?.city) locationParts.push(profile.location.city);
  if (profile.location?.country) locationParts.push(profile.location.country);

  return {
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phone: '',
    location: locationParts.join(', '),
    tagline: profile.tagline || '',
    summary: profile.bio || '',
    website: user.socialLinks?.website || '',
    linkedin: user.socialLinks?.linkedin || '',
    github: user.socialLinks?.github || profile.githubData?.username || '',
    avatar: user.avatar?.url || '',

    skills: (profile.skills || []).map(s => ({
      name: s.name,
      level: s.level,
      yearsOfExperience: s.yearsOfExperience,
    })),

    experience: (profile.experience || []).map(e => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
    })),

    education: (profile.education || []).map(e => ({
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
    })),

    certifications: (profile.certifications || []).map(c => ({
      name: c.name,
      issuingOrganization: c.issuingOrganization,
      issueDate: c.issueDate,
      credentialUrl: c.credentialUrl,
    })),

    portfolio: (profile.portfolio || []).map(p => ({
      title: p.title,
      description: p.description,
      technologies: p.technologies,
      projectUrl: p.projectUrl,
    })),

    languages: (profile.languages || []).map(l => ({
      name: l.name,
      proficiency: l.proficiency,
    })),

    github: profile.githubData?.username ? {
      username: profile.githubData.username,
      totalStars: profile.githubData.stats?.totalStars || 0,
      totalForks: profile.githubData.stats?.totalForks || 0,
      contributionScore: profile.githubData.stats?.contributionScore || 0,
      topLanguages: profile.githubData.languages?.topByRepos?.map(l => l.language) || [],
      pinnedRepos: (profile.githubData.pinnedRepos || []).slice(0, 3).map(r => ({
        name: r.name,
        description: r.description,
        stars: r.stars,
        language: r.language,
      })),
    } : undefined,

    stats: {
      completedProjects: user.stats?.completedProjects || 0,
      averageRating: user.stats?.averageRating || 0,
      totalReviews: user.stats?.totalReviews || 0,
      successRate: user.stats?.successRate || 0,
      reputationScore: user.stats?.reputationScore || 0,
      trustTier: user.stats?.trustTier || 'unrated',
      freelancerLevel: user.freelancerLevel || 'newcomer',
    },
  };
};
