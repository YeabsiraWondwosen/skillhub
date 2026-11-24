import { logger } from '../utils/logger.js';
import { chatJSON, isAIAvailable } from './aiClient.js';

const AI_AVAILABLE = isAIAvailable();

// ─── Language Detection ───────────────────────────────────────────────────────
const EXTENSION_LANGUAGE_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.pyw': 'python',
  '.java': 'java',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.c': 'c', '.h': 'c',
  '.cs': 'csharp',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.rs': 'rust',
  '.r': 'r', '.R': 'r',
  '.scala': 'scala',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.sql': 'sql',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json',
  '.xml': 'xml',
  '.md': 'markdown',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

const MIME_LANGUAGE_MAP = {
  'text/javascript': 'javascript',
  'application/javascript': 'javascript',
  'text/typescript': 'typescript',
  'application/typescript': 'typescript',
  'text/x-python': 'python',
  'text/x-java-source': 'java',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/x-go': 'go',
  'text/x-ruby': 'ruby',
  'text/x-php': 'php',
  'text/html': 'html',
  'text/css': 'css',
  'text/x-scss': 'scss',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/x-sql': 'sql',
  'text/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'text/markdown': 'markdown',
  'text/x-shellscript': 'bash',
};

export const detectLanguage = (fileName, mimeType) => {
  if (mimeType && MIME_LANGUAGE_MAP[mimeType]) return MIME_LANGUAGE_MAP[mimeType];
  if (!fileName) return 'unknown';
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || 'unknown';
};

// ─── Line Counting ────────────────────────────────────────────────────────────
const countLines = (code) => {
  const lines = code.split('\n');
  const total = lines.length;
  const blank = lines.filter(l => l.trim() === '').length;
  const commentPatterns = [
    /^\s*\/\//, /^\s*#/, /^\s*\/\*/, /^\s*\*/, /^\s*--/,
    /^\s*<!--/, /^\s*<%/, /^\s*{-/,
  ];
  const comment = lines.filter(l => commentPatterns.some(p => p.test(l))).length;
  const functions = (code.match(/\b(function|def|func|fn|method|procedure|const\s+\w+\s*=\s*(?:async\s*)?\(|let\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{)/g) || []).length;
  const classes = (code.match(/\b(class\s+\w+|interface\s+\w+|type\s+\w+|struct\s+\w+)/g) || []).length;

  return { linesOfCode: total, blankLines: blank, commentLines: comment, functions, classes };
};

// ─── Severity Sort Order ──────────────────────────────────────────────────────
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ─── AI Code Review Prompt ────────────────────────────────────────────────────
const buildReviewPrompt = (files, focusAreas, severity) => {
  const focusDescription = focusAreas.length > 0
    ? `Focus especially on: ${focusAreas.join(', ')}.`
    : 'Analyze all aspects: bugs, security vulnerabilities, performance issues, and coding best practices.';

  const severityDesc = severity !== 'all'
    ? `Only report issues with severity "${severity}" or higher.`
    : 'Report all severity levels.';

  const fileContents = files.map(f =>
    `\`\`\`${f.language || 'text'}\n// File: ${f.fileName}\n${f.content}\n\`\`\``
  ).join('\n\n');

  return `You are an expert code reviewer. Analyze the following source code and provide a comprehensive review.

${focusDescription}
${severityDesc}

For each file, identify issues in these categories:
- **bug**: Logic errors, null references, off-by-one errors, race conditions, type errors
- **security**: SQL injection, XSS, CSRF, hardcoded secrets, insecure defaults, path traversal
- **performance**: N+1 queries, unnecessary re-renders, memory leaks, O(n^2) algorithms, missing indexes
- **best_practice**: SOLID violations, DRY violations, poor naming, god classes/functions, missing error handling
- **maintainability**: Complex functions, deep nesting, tight coupling, missing documentation
- **style**: Inconsistent formatting, missing semicolons, unused imports

Return a JSON object with exactly this structure:
{
  "files": [
    {
      "fileName": "exact file name",
      "language": "detected language",
      "lineCount": 123,
      "issues": [
        {
          "category": "bug|security|performance|best_practice|maintainability|style",
          "severity": "critical|high|medium|low|info",
          "line": 42,
          "endLine": 45,
          "column": 5,
          "rule": "descriptive rule name like 'no-null-assignment'",
          "message": "Clear description of the issue",
          "suggestion": "How to fix this issue",
          "codeSnippet": "the problematic code snippet",
          "fixSnippet": "the suggested fixed code"
        }
      ],
      "metrics": {
        "linesOfCode": 123,
        "blankLines": 10,
        "commentLines": 5,
        "functions": 8,
        "classes": 2,
        "complexity": 15
      }
    }
  ],
  "overallScore": 75,
  "categoryScores": {
    "bugs": 80,
    "security": 70,
    "performance": 85,
    "bestPractice": 72,
    "maintainability": 68,
    "style": 90
  },
  "summary": "Overall assessment paragraph",
  "recommendations": ["Top priority recommendation 1", "Recommendation 2", "Recommendation 3"],
  "strengths": ["Strength 1", "Strength 2"]
}

Scoring guide:
- 90-100: Excellent, production-ready code
- 70-89: Good, minor improvements needed
- 50-69: Average, several issues to address
- 30-49: Below average, significant problems
- 0-29: Poor, major rewrite recommended

IMPORTANT: Only return valid JSON. No markdown, no explanation outside JSON.`;
};

// ─── Main Review Function ─────────────────────────────────────────────────────
export const analyzeCodeReview = async (files, focusAreas = [], severity = 'all') => {
  if (!AI_AVAILABLE) {
    return generateFallbackAnalysis(files);
  }

  const startTime = Date.now();

  try {
    const prompt = buildReviewPrompt(files, focusAreas, severity);

    const result = await chatJSON(
      'You are a senior software engineer and security expert performing code reviews. You are thorough, constructive, and precise. Always return valid JSON only.',
      prompt,
      0.3,
      4000
    );

    if (!result) throw new Error('Empty AI response');

    const duration = Date.now() - startTime;

    return {
      ...result,
      analysisDuration: duration,
      aiModel: 'gemini-flash-latest',
    };
  } catch (error) {
    logger.error(`AI code review failed: ${error.message}`);
    return generateFallbackAnalysis(files, error.message);
  }
};

// ─── Fallback Analysis ────────────────────────────────────────────────────────
const generateFallbackAnalysis = (files, errorMessage = '') => {
  const fileAnalyses = files.map(f => {
    const lines = countLines(f.content || '');
    const issues = detectBasicIssues(f.content || '', f.language || 'unknown');
    return {
      fileName: f.fileName,
      language: f.language || 'unknown',
      lineCount: lines.linesOfCode,
      issues,
      metrics: lines,
    };
  });

  const allIssues = fileAnalyses.flatMap(fa => fa.issues);
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const highCount = allIssues.filter(i => i.severity === 'high').length;
  const mediumCount = allIssues.filter(i => i.severity === 'medium').length;
  const lowCount = allIssues.filter(i => i.severity === 'low').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  const penalty = criticalCount * 15 + highCount * 10 + mediumCount * 5 + lowCount * 2 + infoCount * 1;
  const overallScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    files: fileAnalyses,
    overallScore,
    categoryScores: calculateCategoryScores(fileAnalyses),
    totalIssues: allIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    summary: errorMessage
      ? `AI analysis unavailable. Basic static analysis performed. ${errorMessage}`
      : 'Basic static analysis performed. AI-powered deep analysis was unavailable.',
    recommendations: generateBasicRecommendations(allIssues),
    strengths: [],
    analysisDuration: 0,
    aiModel: 'fallback',
  };
};

// ─── Basic Static Analysis ────────────────────────────────────────────────────
const detectBasicIssues = (code, language) => {
  const issues = [];
  const lines = code.split('\n');

  const patterns = [
    // Security
    { regex: /eval\s*\(/g, category: 'security', severity: 'high', rule: 'no-eval', message: 'Use of eval() is a security risk' },
    { regex: /innerHTML\s*=/g, category: 'security', severity: 'high', rule: 'no-innerhtml', message: 'Direct innerHTML assignment can lead to XSS' },
    { regex: /document\.write\s*\(/g, category: 'security', severity: 'medium', rule: 'no-document-write', message: 'document.write() is deprecated and can be exploited' },
    { regex: /password\s*[:=]\s*['"][^'"]+['"]/gi, category: 'security', severity: 'critical', rule: 'no-hardcoded-password', message: 'Hardcoded password detected' },
    { regex: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, category: 'security', severity: 'critical', rule: 'no-hardcoded-api-key', message: 'Hardcoded API key detected' },
    { regex: /secret\s*[:=]\s*['"][^'"]+['"]/gi, category: 'security', severity: 'critical', rule: 'no-hardcoded-secret', message: 'Hardcoded secret detected' },
    { regex: /exec\s*\(\s*['"`]/g, category: 'security', severity: 'high', rule: 'no-shell-exec', message: 'Shell command execution with string interpolation' },
    { regex: /\bsql\s*\+\s*/gi, category: 'security', severity: 'high', rule: 'no-sql-concatenation', message: 'SQL string concatenation may lead to injection' },
    { regex: /new\s+Function\s*\(/g, category: 'security', severity: 'high', rule: 'no-function-constructor', message: 'Function constructor is equivalent to eval' },

    // Bugs
    { regex: /==(?!=)/g, category: 'best_practice', severity: 'medium', rule: 'no-loose-equality', message: 'Use strict equality (===) instead of loose equality (==)' },
    { regex: /\bvar\s+/g, category: 'best_practice', severity: 'low', rule: 'no-var', message: 'Use let or const instead of var' },
    { regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g, category: 'best_practice', severity: 'medium', rule: 'no-empty-catch', message: 'Empty catch block silently swallows errors' },
    { regex: /console\.(log|debug|info)\s*\(/g, category: 'best_practice', severity: 'low', rule: 'no-console', message: 'Remove console statements in production code' },

    // Performance
    { regex: /\.forEach\s*\(\s*async/g, category: 'performance', severity: 'high', rule: 'no-async-foreach', message: 'async forEach does not await. Use Promise.all with map instead' },
    { regex: /SELECT\s+\*\s+FROM/gi, category: 'performance', severity: 'medium', rule: 'no-select-star', message: 'SELECT * fetches all columns; specify only needed columns' },

    // Style
    { regex: /TODO|FIXME|HACK|XXX/g, category: 'style', severity: 'info', rule: 'no-todo', message: 'Unresolved TODO/FIXME comment found' },
  ];

  lines.forEach((line, idx) => {
    patterns.forEach(({ regex, category, severity, rule, message }) => {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        issues.push({
          category,
          severity,
          line: idx + 1,
          column: 1,
          rule,
          message,
          suggestion: '',
          codeSnippet: line.trim().substring(0, 200),
          fixSnippet: '',
        });
      }
    });
  });

  return issues;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateCategoryScores = (fileAnalyses) => {
  const categories = ['bugs', 'security', 'performance', 'bestPractice', 'maintainability', 'style'];
  const categoryMap = { bugs: 'bug', security: 'security', performance: 'performance', bestPractice: 'best_practice', maintainability: 'maintainability', style: 'style' };

  const scores = {};
  for (const cat of categories) {
    const dbKey = categoryMap[cat];
    const issues = fileAnalyses.flatMap(fa => fa.issues.filter(i => i.category === dbKey));
    const penalty = issues.reduce((sum, i) => {
      if (i.severity === 'critical') return sum + 20;
      if (i.severity === 'high') return sum + 12;
      if (i.severity === 'medium') return sum + 6;
      if (i.severity === 'low') return sum + 2;
      return sum + 1;
    }, 0);
    scores[cat] = Math.max(0, Math.min(100, 100 - penalty));
  }
  return scores;
};

const generateBasicRecommendations = (issues) => {
  const recs = [];
  const byCategory = {};
  issues.forEach(i => {
    if (!byCategory[i.category]) byCategory[i.category] = [];
    byCategory[i.category].push(i);
  });

  if (byCategory.security?.length) recs.push(`Address ${byCategory.security.length} security issue(s) immediately`);
  if (byCategory.bug?.length) recs.push(`Fix ${byCategory.bug.length} potential bug(s)`);
  if (byCategory.performance?.length) recs.push(`Optimize ${byCategory.performance.length} performance issue(s)`);
  if (byCategory.best_practice?.length) recs.push(`Improve ${byCategory.best_practice.length} best practice(s)`);

  return recs.slice(0, 5);
};
