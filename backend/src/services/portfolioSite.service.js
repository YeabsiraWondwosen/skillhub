import { logger } from '../utils/logger.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

// ─── Template Config ─────────────────────────────────────────────────────────
const TEMPLATES = {
  modern: { label: 'Modern', accentDefault: '#2563eb', style: 'clean, card-based, rounded corners' },
  classic: { label: 'Classic', accentDefault: '#1a1a2e', style: 'traditional, serif headings, bordered sections' },
  minimal: { label: 'Minimal', accentDefault: '#374151', style: 'clean whitespace, thin typography, subtle dividers' },
  creative: { label: 'Creative', accentDefault: '#7c3aed', style: 'bold gradients, animated elements, asymmetric layouts' },
};

const FONT_FAMILIES = {
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  playfair: "'Playfair Display', serif",
  fira: "'Fira Code', monospace",
};

const FONT_IMPORTS = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  poppins: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  playfair: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  fira: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap',
};

// ─── AI Content Generation ──────────────────────────────────────────────────
export const generateAIContent = async (profileData, user, githubData) => {
  if (!AI_AVAILABLE) {
    return generateFallbackContent(profileData, user, githubData);
  }

  try {
    const githubStats = githubData?.stats;
    const githubLanguages = githubData?.languages?.byBytes?.slice(0, 8)?.map(l => `${l.name} (${l.percentage}%)`).join(', ') || 'none';

    const prompt = `You are a world-class portfolio copywriter. Generate compelling content for a freelancer's portfolio website.

FREELANCER DATA:
Name: ${user.firstName} ${user.lastName}
Level: ${user.freelancerLevel || 'freelancer'}
Tagline: ${profileData.tagline || ''}
Bio: ${profileData.bio || ''}
Skills: ${(profileData.skills || []).map(s => `${s.name} (${s.level}${s.yearsOfExperience ? `, ${s.yearsOfExperience}yr` : ''})`).join(', ')}
Experience: ${(profileData.experience || []).map(e => `${e.title} at ${e.company}${e.startDate ? ` (${new Date(e.startDate).getFullYear()}-${e.endDate ? new Date(e.endDate).getFullYear() : 'Present'})` : ''}`).join('; ')}
Portfolio Projects: ${(profileData.portfolio || []).map(p => `"${p.title}": ${p.description || 'no description'} [${(p.technologies || []).join(', ')}]`).join('; ')}
Languages: ${(profileData.languages || []).map(l => `${l.name} (${l.proficiency})`).join(', ')}
Completed Projects: ${user.stats?.completedProjects || 0}
Rating: ${user.stats?.averageRating || 0}/5
Success Rate: ${user.stats?.successRate || 0}%
${githubStats ? `GitHub: ${githubStats.totalStars} stars, ${githubStats.publicRepos} public repos, ${githubStats.contributionScore}/100 contribution score, ${githubStats.followers} followers` : ''}
GitHub Languages: ${githubLanguages}
Social: github=${user.socialLinks?.github || ''}, linkedin=${user.socialLinks?.linkedin || ''}, website=${user.socialLinks?.website || ''}, twitter=${user.socialLinks?.twitter || ''}

Return a JSON object with:
{
  "headline": "A powerful 5-10 word headline that captures the freelancer's essence",
  "subheadline": "A 15-25 word supporting tagline that elaborates on value proposition",
  "aboutText": "A compelling 3-5 sentence about paragraph. Start with their specialty, mention key achievements with numbers, and end with what they're looking for.",
  "skillHighlights": ["4-6 short skill highlights that combine skills into natural phrases like 'Full-Stack JavaScript' or 'Cloud-Native DevOps'"],
  "projectDescriptions": [{ "title": "project title from portfolio", "aiDescription": "A 1-2 sentence compelling description of this project, emphasizing impact and technologies" }],
  "ctaText": "A short call-to-action text (5-8 words)"
}

Be specific, use action verbs, quantify achievements. Only return valid JSON.`;

    const parsed = await chatJSON(
      'You are a world-class portfolio copywriter specializing in developer and freelancer portfolios. Return only valid JSON.',
      prompt,
      0.7,
      2000
    );

    return {
      headline: parsed.headline || `${user.firstName} ${user.lastName}`,
      subheadline: parsed.subheadline || profileData.tagline || '',
      aboutText: parsed.aboutText || profileData.bio || '',
      skillHighlights: parsed.skillHighlights || [],
      projectDescriptions: parsed.projectDescriptions || [],
      ctaText: parsed.ctaText || "Let's work together",
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`AI portfolio content generation failed: ${error.message}`);
    return generateFallbackContent(profileData, user, githubData);
  }
};

const generateFallbackContent = (profileData, user, githubData) => ({
  headline: `${user.firstName} ${user.lastName}`,
  subheadline: profileData.tagline || `${user.freelancerLevel || 'Skilled'} ${user.role === 'freelancer' ? 'Freelancer' : 'Developer'}`,
  aboutText: profileData.bio || `${user.firstName} ${user.lastName} is a ${user.freelancerLevel || 'skilled'} developer with ${user.stats?.completedProjects || 0} completed projects and a ${user.stats?.averageRating || 0}/5 client rating.`,
  skillHighlights: (profileData.skills || []).slice(0, 6).map(s => s.name),
  projectDescriptions: (profileData.portfolio || []).map(p => ({
    title: p.title,
    aiDescription: `${p.description || `Built using ${(p.technologies || []).join(', ')}`}`,
  })),
  ctaText: "Let's work together",
  generatedAt: new Date(),
});

// ─── HTML/CSS Generation ────────────────────────────────────────────────────
export const generatePortfolioHTML = (aiContent, profileData, user, githubData, customization = {}) => {
  const {
    template = 'modern',
    accentColor = TEMPLATES[template]?.accentDefault || '#2563eb',
    fontFamily = 'inter',
    showGitHub = true,
    showProjects = true,
    showSkills = true,
    showExperience = true,
    showEducation = true,
    showLanguages = true,
    showContact = true,
    sectionOrder = ['about', 'skills', 'projects', 'experience', 'github', 'education', 'languages', 'contact'],
  } = customization;

  const fontImport = FONT_IMPORTS[fontFamily] || FONT_IMPORTS.inter;
  const fontFamilyCSS = FONT_FAMILIES[fontFamily] || FONT_FAMILIES.inter;

  const avatarUrl = user.avatar || '';
  const location = profileData.location?.city || profileData.location?.country || '';
  const socialLinks = user.socialLinks || {};
  const githubStats = githubData?.stats;
  const pinnedRepos = githubData?.pinnedRepos || githubData?.repos?.filter(r => !r.isFork && !r.isPrivate).sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 6) || [];
  const languages = githubData?.languages?.byBytes?.slice(0, 8) || [];

  const sections = sectionOrder.map(key => buildSection(key, {
    aiContent, profileData, user, githubData,
    showGitHub, showProjects, showSkills, showExperience,
    showEducation, showLanguages, showContact,
    pinnedRepos, languages, githubStats, avatarUrl, location, socialLinks,
    accentColor, fontFamilyCSS,
  })).filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${user.firstName} ${user.lastName} - Portfolio</title>
  <meta name="description" content="${aiContent.subheadline}">
  <meta name="author" content="${user.firstName} ${user.lastName}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontImport}" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: ${accentColor}; --accent-light: ${accentColor}15; --accent-dark: ${accentColor}dd; --font: ${fontFamilyCSS}; --bg: #ffffff; --bg-alt: #f8fafc; --text: #0f172a; --text-secondary: #64748b; --border: #e2e8f0; --card-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); --radius: 12px; }
    @media (prefers-color-scheme: dark) { :root { --bg: #0f172a; --bg-alt: #1e293b; --text: #f1f5f9; --text-secondary: #94a3b8; --border: #334155; --card-shadow: 0 1px 3px rgba(0,0,0,0.3); } }
    body { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: var(--accent); text-decoration: none; transition: opacity 0.2s; }
    a:hover { opacity: 0.8; }
    .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

    /* Hero */
    .hero { padding: 80px 0 60px; text-align: center; }
    .hero-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid var(--accent); margin-bottom: 24px; box-shadow: 0 0 0 4px var(--accent-light); }
    .hero-name { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
    .hero-location { font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 16px; }
    .hero-location::before { content: "\\1F4CD "; }
    .hero-headline { font-size: 1.15rem; color: var(--accent); font-weight: 600; margin-bottom: 8px; }
    .hero-sub { font-size: 1.05rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto 32px; }

    /* Social */
    .social-links { display: flex; justify-content: center; gap: 12px; margin-bottom: 40px; flex-wrap: wrap; }
    .social-links a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; background: var(--accent-light); color: var(--accent); font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
    .social-links a:hover { background: var(--accent); color: #fff; opacity: 1; }
    .social-links svg { width: 16px; height: 16px; }

    /* Sections */
    .section { margin-bottom: 56px; }
    .section-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid var(--accent); display: inline-block; }

    /* About */
    .about-text { font-size: 1.05rem; color: var(--text-secondary); line-height: 1.8; max-width: 700px; }

    /* Skills */
    .skills-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .skill-tag { padding: 8px 18px; border-radius: 20px; background: var(--accent-light); color: var(--accent); font-size: 0.9rem; font-weight: 500; border: 1px solid var(--accent); }

    /* Projects */
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .project-card { background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; transition: transform 0.2s, box-shadow 0.2s; }
    .project-card:hover { transform: translateY(-2px); box-shadow: var(--card-shadow); }
    .project-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    .project-desc { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6; }
    .project-tech { display: flex; flex-wrap: wrap; gap: 6px; }
    .project-tech span { font-size: 0.75rem; padding: 3px 10px; border-radius: 12px; background: var(--accent-light); color: var(--accent); }
    .project-links { margin-top: 12px; display: flex; gap: 12px; font-size: 0.85rem; }

    /* Experience */
    .experience-item { padding: 20px 0; border-bottom: 1px solid var(--border); }
    .experience-item:last-child { border-bottom: none; }
    .exp-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
    .exp-title { font-weight: 600; font-size: 1.05rem; }
    .exp-date { font-size: 0.85rem; color: var(--text-secondary); }
    .exp-company { font-size: 0.95rem; color: var(--accent); margin-bottom: 8px; }
    .exp-desc { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }

    /* GitHub */
    .gh-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .gh-stat { text-align: center; padding: 20px 12px; background: var(--bg-alt); border-radius: var(--radius); border: 1px solid var(--border); }
    .gh-stat-value { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
    .gh-stat-label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
    .lang-bars { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
    .lang-bar { display: flex; align-items: center; gap: 12px; }
    .lang-name { font-size: 0.85rem; width: 80px; text-align: right; color: var(--text-secondary); }
    .lang-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .lang-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.6s ease; }
    .lang-pct { font-size: 0.8rem; color: var(--text-secondary); width: 40px; }

    /* Education */
    .edu-item { padding: 16px 0; border-bottom: 1px solid var(--border); }
    .edu-item:last-child { border-bottom: none; }
    .edu-degree { font-weight: 600; }
    .edu-school { color: var(--accent); font-size: 0.95rem; }
    .edu-date { font-size: 0.85rem; color: var(--text-secondary); }

    /* Languages */
    .lang-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .lang-item { padding: 8px 16px; background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; }
    .lang-prof { color: var(--text-secondary); font-size: 0.8rem; margin-left: 4px; }

    /* CTA / Contact */
    .cta { text-align: center; padding: 60px 0; }
    .cta-text { font-size: 1.5rem; font-weight: 700; margin-bottom: 20px; }
    .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: var(--accent); color: #fff; border-radius: 10px; font-weight: 600; font-size: 1rem; transition: transform 0.2s, box-shadow 0.2s; }
    .cta-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px ${accentColor}40; color: #fff; opacity: 1; }

    /* Footer */
    .footer { text-align: center; padding: 32px 0; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-secondary); }

    @media (max-width: 640px) {
      .hero { padding: 48px 0 36px; }
      .hero-name { font-size: 1.8rem; }
      .projects-grid { grid-template-columns: 1fr; }
      .gh-stats { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Hero -->
    <section class="hero">
      ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.firstName} ${user.lastName}" class="hero-avatar">` : ''}
      <h1 class="hero-name">${user.firstName} ${user.lastName}</h1>
      ${location ? `<p class="hero-location">${location}</p>` : ''}
      <p class="hero-headline">${aiContent.headline}</p>
      <p class="hero-sub">${aiContent.subheadline}</p>
      <div class="social-links">
        ${socialLinks.github ? `<a href="${socialLinks.github}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>GitHub</a>` : ''}
        ${socialLinks.linkedin ? `<a href="${socialLinks.linkedin}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>LinkedIn</a>` : ''}
        ${socialLinks.website ? `<a href="${socialLinks.website}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Website</a>` : ''}
        ${socialLinks.twitter ? `<a href="${socialLinks.twitter}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Twitter</a>` : ''}
      </div>
    </section>

${sections}

    <!-- CTA -->
    ${showContact ? `<section class="cta">
      <p class="cta-text">${aiContent.ctaText}</p>
      <a href="mailto:${user.email}" class="cta-btn">Get in Touch</a>
    </section>` : ''}

    <footer class="footer">
      Built with SkillHub Portfolio Builder
    </footer>
  </div>
</body>
</html>`;
};

function buildSection(key, data) {
  const { aiContent, profileData, user, githubData, accentColor, fontFamilyCSS,
    showGitHub, showProjects, showSkills, showExperience,
    showEducation, showLanguages, showContact,
    pinnedRepos, languages, githubStats, location, socialLinks } = data;

  switch (key) {
    case 'about':
      return `    <section class="section">
      <h2 class="section-title">About Me</h2>
      <p class="about-text">${aiContent.aboutText}</p>
    </section>`;

    case 'skills':
      if (!data.showSkills || !profileData.skills?.length) return null;
      return `    <section class="section">
      <h2 class="section-title">Skills</h2>
      <div class="skills-grid">
        ${profileData.skills.map(s => `<span class="skill-tag">${s.name}</span>`).join('\n        ')}
      </div>
    </section>`;

    case 'projects':
      if (!showProjects || !profileData.portfolio?.length) return null;
      return `    <section class="section">
      <h2 class="section-title">Projects</h2>
      <div class="projects-grid">
        ${profileData.portfolio.map(p => {
          const aiDesc = aiContent.projectDescriptions?.find(d => d.title === p.title)?.aiDescription || p.description || '';
          return `<div class="project-card">
          <h3 class="project-title">${p.title}</h3>
          <p class="project-desc">${aiDesc}</p>
          ${p.technologies?.length ? `<div class="project-tech">${p.technologies.map(t => `<span>${t}</span>`).join(' ')}</div>` : ''}
          <div class="project-links">
            ${p.projectUrl ? `<a href="${p.projectUrl}" target="_blank" rel="noopener">Live Demo</a>` : ''}
            ${p.repositoryUrl ? `<a href="${p.repositoryUrl}" target="_blank" rel="noopener">Source Code</a>` : ''}
          </div>
        </div>`;
        }).join('\n        ')}
      </div>
    </section>`;

    case 'experience':
      if (!showExperience || !profileData.experience?.length) return null;
      return `    <section class="section">
      <h2 class="section-title">Experience</h2>
      ${profileData.experience.map(e => `<div class="experience-item">
        <div class="exp-header">
          <span class="exp-title">${e.title}</span>
          <span class="exp-date">${e.startDate ? new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''} - ${e.current ? 'Present' : e.endDate ? new Date(e.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</span>
        </div>
        <p class="exp-company">${e.company}${e.location ? ` - ${e.location}` : ''}</p>
        ${e.description ? `<p class="exp-desc">${e.description}</p>` : ''}
      </div>`).join('\n      ')}
    </section>`;

    case 'github':
      if (!showGitHub || !githubData) return null;
      return `    <section class="section">
      <h2 class="section-title">GitHub</h2>
      ${githubStats ? `<div class="gh-stats">
        <div class="gh-stat"><div class="gh-stat-value">${githubStats.totalStars}</div><div class="gh-stat-label">Stars</div></div>
        <div class="gh-stat"><div class="gh-stat-value">${githubStats.publicRepos}</div><div class="gh-stat-label">Repos</div></div>
        <div class="gh-stat"><div class="gh-stat-value">${githubStats.followers}</div><div class="gh-stat-label">Followers</div></div>
        <div class="gh-stat"><div class="gh-stat-value">${githubStats.contributionScore}</div><div class="gh-stat-label">Score</div></div>
      </div>` : ''}
      ${pinnedRepos.length ? `<div class="projects-grid">
        ${pinnedRepos.map(r => `<div class="project-card">
          <h3 class="project-title"><a href="${r.url}" target="_blank" rel="noopener">${r.name}</a></h3>
          <p class="project-desc">${r.description || 'No description'}</p>
          <div class="project-tech">
            ${r.language ? `<span>${r.language}</span>` : ''}
            ${r.stars ? `<span>\u2605 ${r.stars}</span>` : ''}
            ${r.forks ? `<span>Fork ${r.forks}</span>` : ''}
          </div>
        </div>`).join('\n        ')}
      </div>` : ''}
      ${languages.length ? `<div class="lang-bars">
        ${languages.map(l => `<div class="lang-bar">
          <span class="lang-name">${l.name}</span>
          <div class="lang-track"><div class="lang-fill" style="width:${l.percentage}%"></div></div>
          <span class="lang-pct">${l.percentage}%</span>
        </div>`).join('\n        ')}
      </div>` : ''}
    </section>`;

    case 'education':
      if (!showEducation || !profileData.education?.length) return null;
      return `    <section class="section">
      <h2 class="section-title">Education</h2>
      ${profileData.education.map(e => `<div class="edu-item">
        <div class="edu-degree">${e.degree}${e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ''}</div>
        <div class="edu-school">${e.institution}</div>
        ${e.startDate ? `<div class="edu-date">${new Date(e.startDate).getFullYear()}${e.endDate ? ` - ${new Date(e.endDate).getFullYear()}` : ''}</div>` : ''}
      </div>`).join('\n      ')}
    </section>`;

    case 'languages':
      if (!showLanguages || !profileData.languages?.length) return null;
      return `    <section class="section">
      <h2 class="section-title">Languages</h2>
      <div class="lang-list">
        ${profileData.languages.map(l => `<div class="lang-item">${l.name}<span class="lang-prof">${l.proficiency}</span></div>`).join('\n        ')}
      </div>
    </section>`;

    default:
      return null;
  }
}

export const getTemplates = () =>
  Object.entries(TEMPLATES).map(([key, val]) => ({
    id: key,
    name: val.label,
    description: val.style,
    defaultColor: val.accentDefault,
  }));
