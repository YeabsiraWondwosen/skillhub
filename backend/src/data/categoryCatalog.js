// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CATEGORY CATALOG — Single source of truth
// 5 main categories × 10 subcategories each = 50 active subcategories.
// Everything else in the app must derive from this file (via the API), never
// hardcode category lists.
// ─────────────────────────────────────────────────────────────────────────────

// Icons are stable lucide-react icon identifiers (not emoji). The frontend maps
// these identifiers to icon components in src/utils/categoryIcons.jsx. Keeping
// them as short ASCII identifiers avoids the UTF-8 mojibake that corrupted the
// database when emoji were stored directly (e.g. '≡ƒîÉ').

export const MAIN_CATEGORIES = [
  {
    name: 'Development & Technology',
    icon: 'code',
    color: '#3b82f6',
    description: 'Web, mobile, software, AI, data, security, cloud, and backend development',
    featured: true,
    order: 0,
  },
  {
    name: 'Design & Creative',
    icon: 'palette',
    color: '#ec4899',
    description: 'UI/UX, graphic, brand, product, illustration, 3D, motion, and presentation design',
    featured: true,
    order: 1,
  },
  {
    name: 'Marketing & Business',
    icon: 'trending-up',
    color: '#10b981',
    description: 'Digital marketing, SEO, social media, content, sales, consulting, research, and virtual assistance',
    featured: true,
    order: 2,
  },
  {
    name: 'Writing, Translation & Content',
    icon: 'pen-line',
    color: '#f59e0b',
    description: 'Content writing, copywriting, translation, editing, research, and academic writing',
    featured: true,
    order: 3,
  },
  {
    name: 'Video, Audio & Professional Services',
    icon: 'clapperboard',
    color: '#f43f5e',
    description: 'Video editing, production, animation, photography, audio, voice over, and media services',
    featured: true,
    order: 4,
  },
];

// Exactly 10 subcategories per main. Names are canonical and MUST match exactly.
export const SUBCATEGORIES = {
  'Development & Technology': [
    'Web Development',
    'Mobile App Development',
    'Software & Application Development',
    'Data Science & Analytics',
    'AI & Machine Learning',
    'DevOps & Cloud',
    'Cybersecurity',
    'Database Development',
    'QA & Testing',
    'Game Development',
  ],
  'Design & Creative': [
    'UI/UX Design',
    'Graphic Design',
    'Logo & Brand Identity',
    'Product Design',
    'Illustration',
    '3D Design & Modeling',
    'Architecture & Interior Design',
    'Presentation Design',
    'Motion Graphics',
    'Fashion & Creative Design',
  ],
  'Marketing & Business': [
    'Digital Marketing',
    'SEO',
    'Social Media Marketing',
    'Content Marketing',
    'Sales & Lead Generation',
    'Business Consulting',
    'Market Research',
    'E-commerce Management',
    'Project Management',
    'Virtual Assistance',
  ],
  'Writing, Translation & Content': [
    'Content Writing',
    'Copywriting',
    'Technical Writing',
    'Translation',
    'Editing & Proofreading',
    'Resume & CV Writing',
    'Research & Summaries',
    'Academic Writing',
    'Scriptwriting',
    'Creative Writing',
  ],
  'Video, Audio & Professional Services': [
    'Video Editing',
    'Video Production',
    'Animation',
    'Audio Editing',
    'Music Production',
    'Voice Over',
    'Podcast Production',
    'Photography',
    'Video & Audio Post-Production',
    'Professional Media Services',
  ],
};

// Per-subcategory icon (lucide identifier) + short description. Used by the
// seed to keep the database in sync and by the category page for rich cards.
export const SUBCATEGORY_META = {
  // Development & Technology
  'Web Development': {
    icon: 'globe',
    description: 'Websites, frontend, backend and full-stack development',
  },
  'Mobile App Development': {
    icon: 'smartphone',
    description: 'iOS, Android and cross-platform mobile app development',
  },
  'Software & Application Development': {
    icon: 'monitor-cog',
    description: 'Desktop apps, custom software and application engineering',
  },
  'Data Science & Analytics': {
    icon: 'bar-chart-3',
    description: 'Data analysis, visualization and business intelligence',
  },
  'AI & Machine Learning': {
    icon: 'brain',
    description: 'Machine learning, deep learning and AI-powered solutions',
  },
  'DevOps & Cloud': {
    icon: 'cloud',
    description: 'Infrastructure, CI/CD, cloud migration and deployment',
  },
  Cybersecurity: {
    icon: 'shield-check',
    description: 'Security audits, penetration testing and compliance',
  },
  'Database Development': {
    icon: 'database',
    description: 'Database design, migration, and performance optimization',
  },
  'QA & Testing': {
    icon: 'test-tube',
    description: 'Manual and automated testing, quality assurance',
  },
  'Game Development': {
    icon: 'gamepad-2',
    description: '2D/3D games, game design and game programming',
  },
  // Design & Creative
  'UI/UX Design': {
    icon: 'layout-grid',
    description: 'User interfaces, prototypes, wireframes and design systems',
  },
  'Graphic Design': {
    icon: 'palette',
    description: 'Logos, posters, social media and print graphics',
  },
  'Logo & Brand Identity': {
    icon: 'award',
    description: 'Logos, brand guidelines and visual identity',
  },
  'Product Design': {
    icon: 'package',
    description: 'Product strategy, UX research and MVP design',
  },
  Illustration: {
    icon: 'pen-tool',
    description: 'Digital, vector and hand-drawn illustrations',
  },
  '3D Design & Modeling': {
    icon: 'box',
    description: '3D models, rendering and product visualization',
  },
  'Architecture & Interior Design': {
    icon: 'drafting-compass',
    description: 'Building design, space planning and visualizations',
  },
  'Presentation Design': {
    icon: 'presentation',
    description: 'Slide decks, pitch decks and data-rich presentations',
  },
  'Motion Graphics': {
    icon: 'clapperboard',
    description: 'Animated graphics, kinetic typography and explainers',
  },
  'Fashion & Creative Design': {
    icon: 'scissors',
    description: 'Fashion, apparel, textiles and accessory design',
  },
  // Marketing & Business
  'Digital Marketing': {
    icon: 'megaphone',
    description: 'Online campaigns, ads and growth strategy',
  },
  SEO: {
    icon: 'search',
    description: 'Search optimization, keyword research and link building',
  },
  'Social Media Marketing': {
    icon: 'share-2',
    description: 'Social content, community and paid social',
  },
  'Content Marketing': {
    icon: 'file-text',
    description: 'Content strategy, blogs and distribution',
  },
  'Sales & Lead Generation': {
    icon: 'target',
    description: 'Outbound sales, lead lists and pipeline',
  },
  'Business Consulting': {
    icon: 'briefcase',
    description: 'Strategy, operations and business planning',
  },
  'Market Research': {
    icon: 'chart-bar',
    description: 'Market analysis, surveys and competitor insights',
  },
  'E-commerce Management': {
    icon: 'shopping-cart',
    description: 'Store setup, listings and marketplace growth',
  },
  'Project Management': {
    icon: 'clipboard-list',
    description: 'Planning, agile delivery and team coordination',
  },
  'Virtual Assistance': {
    icon: 'user',
    description: 'Admin, scheduling and personal assistant support',
  },
  // Writing, Translation & Content
  'Content Writing': {
    icon: 'pen-line',
    description: 'Blogs, articles, website and SEO content',
  },
  Copywriting: {
    icon: 'type',
    description: 'Sales copy, ads and conversion-focused writing',
  },
  'Technical Writing': {
    icon: 'file-code',
    description: 'Documentation, manuals and API documentation',
  },
  Translation: {
    icon: 'globe-2',
    description: 'Professional translation across languages',
  },
  'Editing & Proofreading': {
    icon: 'edit-3',
    description: 'Grammar, style and consistency editing',
  },
  'Resume & CV Writing': {
    icon: 'file-check',
    description: 'Resumes, CVs and cover letters',
  },
  'Research & Summaries': {
    icon: 'book-open',
    description: 'Research, summaries and document synthesis',
  },
  'Academic Writing': {
    icon: 'graduation-cap',
    description: 'Essays, theses and academic papers',
  },
  Scriptwriting: {
    icon: 'drama',
    description: 'Video, film and advertising scripts',
  },
  'Creative Writing': {
    icon: 'lightbulb',
    description: 'Stories, poetry and creative content',
  },
  // Video, Audio & Professional Services
  'Video Editing': {
    icon: 'video',
    description: 'Cuts, transitions, effects and video finishing',
  },
  'Video Production': {
    icon: 'camera',
    description: 'Filming, cinematography and production',
  },
  Animation: {
    icon: 'film',
    description: '2D/3D animation and explainer videos',
  },
  'Audio Editing': {
    icon: 'headphones',
    description: 'Cleanup, mixing and podcast editing',
  },
  'Music Production': {
    icon: 'music',
    description: 'Beats, mixing, mastering and composition',
  },
  'Voice Over': {
    icon: 'mic',
    description: 'Narration, commercials and character voice',
  },
  'Podcast Production': {
    icon: 'radio',
    description: 'Podcast editing, launch and show notes',
  },
  Photography: {
    icon: 'image',
    description: 'Portraits, product and event photography',
  },
  'Video & Audio Post-Production': {
    icon: 'sliders-horizontal',
    description: 'Color grading, VFX and sound design',
  },
  'Professional Media Services': {
    icon: 'settings',
    description: 'Streaming, events and full media production',
  },
};

export const getSubcategoryMeta = (name) => SUBCATEGORY_META[name] || { icon: '', description: '' };

// Skill suggestions per canonical subcategory (used to seed SkillTaxonomy).
export const SKILLS_BY_SUBCATEGORY = {
  'Web Development': [
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte',
    'Tailwind CSS', 'Bootstrap', 'SASS', 'Webpack', 'Vite', 'Node.js', 'Express', 'MongoDB', 'REST API',
    'WordPress', 'Shopify', 'Landing Page Design', 'Website Maintenance', 'Responsive Design', 'Web Design',
  ],
  'Mobile App Development': [
    'iOS', 'Swift', 'SwiftUI', 'Android', 'Kotlin', 'React Native', 'Expo', 'Flutter', 'Dart',
    'Xamarin', 'Ionic', 'Capacitor', 'Mobile UI', 'Push Notifications', 'Firebase', 'Cross-Platform Development',
  ],
  'Software & Application Development': [
    'C#', '.NET', 'Java', 'Spring Boot', 'Python', 'Go', 'Rust', 'C++', 'Software Architecture',
    'Design Patterns', 'SOLID Principles', 'Microservices', 'REST API', 'GraphQL', 'gRPC', 'Git & GitHub',
    'React', 'Next.js', 'Node.js', 'Express', 'TypeScript', 'Prisma', 'MERN', 'JAMstack', 'Full Stack',
  ],
  'Data Science & Analytics': [
    'Data Science', 'Data Analysis', 'Python', 'R', 'SQL', 'Statistical Analysis', 'A/B Testing',
    'Data Visualization', 'Tableau', 'Power BI', 'Looker', 'Matplotlib', 'Seaborn', 'Pandas', 'NumPy',
  ],
  'AI & Machine Learning': [
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'NLP', 'Computer Vision',
    'Generative AI', 'LLM', 'GPT', 'LangChain', 'RAG', 'AI Agents', 'Prompt Engineering', 'Hugging Face', 'OpenAI API',
  ],
  'DevOps & Cloud': [
    'AWS', 'Azure', 'Google Cloud', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins',
    'GitLab CI', 'GitHub Actions', 'CI/CD', 'Prometheus', 'Grafana', 'Helm', 'Serverless', 'Cloud Migration', 'Cloud Computing',
  ],
  'Cybersecurity': [
    'Penetration Testing', 'Vulnerability Assessment', 'Security Audit', 'Incident Response', 'Network Security',
    'Firewall', 'SIEM', 'Ethical Hacking', 'ISO 27001', 'SOC 2', 'Risk Assessment', 'Cloud Security', 'Application Security', 'Cryptography',
  ],
  'Database Development': [
    'PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis', 'Elasticsearch', 'SQL', 'NoSQL',
    'Query Optimization', 'Database Design', 'Data Modeling', 'Database Migration',
  ],
  'QA & Testing': [
    'Manual Testing', 'Test Automation', 'Selenium', 'Cypress', 'Playwright', 'API Testing',
    'Performance Testing', 'JMeter', 'Load Testing', 'Regression Testing', 'Integration Testing', 'E2E Testing', 'Test Plans',
  ],
  'Game Development': [
    'Unity', 'Unreal Engine', 'Godot', 'Game Design', 'Level Design', 'Game Programming', 'C#', 'C++',
    '2D Game Art', '3D Game Art', 'Mobile Games', 'Multiplayer', 'Game Physics', 'Game Testing',
  ],
  'UI/UX Design': [
    'Figma', 'Adobe XD', 'Sketch', 'User Research', 'Wireframing', 'Prototyping', 'User Flows',
    'Interaction Design', 'Information Architecture', 'Usability Testing', 'Design Systems', 'Component Libraries', 'UI/UX Design',
  ],
  'Graphic Design': [
    'Photoshop', 'Illustrator', 'InDesign', 'Print Design', 'Typography', 'Color Theory', 'Layout Design',
    'Poster Design', 'Banner Design', 'Social Media Graphics', 'Infographics', 'Vector Art', 'Packaging Design', 'Graphic Design',
  ],
  'Logo & Brand Identity': [
    'Logo Design', 'Brand Identity', 'Visual Identity', 'Brand Guidelines', 'Business Cards',
    'Stationery Design', 'Brand Strategy', 'Rebranding', 'Mascot Design', 'Brand Assets',
  ],
  'Product Design': [
    'Product Strategy', 'UX Strategy', 'Design Thinking', 'Product Roadmap', 'MVP Design', 'SaaS Design',
    'Mobile App Design', 'User Research', 'A/B Testing', 'Conversion Design', 'Design Sprints',
  ],
  'Illustration': [
    'Digital Illustration', 'Vector Illustration', 'Character Design', 'Children Illustration',
    'Technical Illustration', 'Medical Illustration', 'Isometric Illustration', 'Line Art', 'Flat Illustration', 'Watercolor', 'Procreate',
  ],
  '3D Design & Modeling': [
    'Blender', '3ds Max', 'Cinema 4D', 'Maya', 'ZBrush', '3D Modeling', '3D Rendering', 'Texturing',
    'Lighting', 'Product Visualization', 'Architectural Visualization', 'V-Ray', 'Substance Painter',
  ],
  'Architecture & Interior Design': [
    'Architecture Design', 'Interior Design', 'Space Planning', 'Architectural Visualization', 'AutoCAD',
    'Revit', 'Building Design', 'Landscape Design', 'Color Scheme', 'Furniture Design', 'Architecture',
  ],
  'Presentation Design': [
    'PowerPoint', 'Keynote', 'Google Slides', 'Presentation Templates', 'Pitch Decks', 'Investor Decks',
    'Business Presentations', 'Data Visualization', 'Slide Design', 'Infographic Decks',
  ],
  'Motion Graphics': [
    'After Effects', 'Motion Design', 'Kinetic Typography', '2D Animation', '3D Animation', 'Character Animation',
    'Motion Capture', 'Stop Motion', 'Whiteboard Animation', 'Animated Illustration', 'Lottie',
  ],
  'Fashion & Creative Design': [
    'Fashion Design', 'Pattern Making', 'Apparel Design', 'Textile Design', 'Costume Design',
    'Fashion Illustration', 'Technical Drawing', 'Sewing Patterns', 'Jewelry Design', 'Accessory Design',
  ],
  'Digital Marketing': [
    'Digital Strategy', 'Online Marketing', 'Growth Hacking', 'Conversion Optimization', 'A/B Testing',
    'Marketing Automation', 'HubSpot', 'Google Analytics', 'Google Tag Manager', 'Marketing Analytics',
    'Influencer Marketing', 'Affiliate Marketing', 'Digital Marketing', 'Email Marketing', 'Google Ads',
  ],
  'SEO': [
    'SEO Strategy', 'On-Page SEO', 'Off-Page SEO', 'Technical SEO', 'Keyword Research', 'Link Building',
    'Content SEO', 'Local SEO', 'E-commerce SEO', 'SEO Audit', 'Google Search Console', 'Ahrefs', 'SEMrush',
  ],
  'Social Media Marketing': [
    'Facebook Marketing', 'Instagram Marketing', 'LinkedIn Marketing', 'TikTok Marketing', 'Twitter Marketing',
    'Social Media Strategy', 'Community Management', 'Social Media Advertising', 'Content Calendar',
    'Influencer Marketing', 'Social Media Analytics',
  ],
  'Content Marketing': [
    'Content Strategy', 'Blog Content', 'Content Calendar', 'Content Distribution', 'Content Optimization',
    'Content Audit', 'Thought Leadership', 'Brand Storytelling', 'Content Funnel', 'Content ROI',
  ],
  'Sales & Lead Generation': [
    'Sales Strategy', 'B2B Sales', 'B2C Sales', 'Account Management', 'Sales Funnel', 'Negotiation', 'Closing',
    'Sales Pipeline', 'CRM', 'Salesforce', 'Sales Forecasting', 'Lead Generation', 'Cold Email', 'Sales',
  ],
  'Business Consulting': [
    'Business Strategy', 'Growth Strategy', 'Operations Consulting', 'Organizational Design', 'Digital Transformation',
    'Business Analysis', 'Business Plans', 'Lean Consulting', 'Agile Consulting', 'Business Process Reengineering',
    'Accounting', 'Finance', 'Market Analysis',
  ],
  'Market Research': [
    'Market Analysis', 'Industry Research', 'Competitor Analysis', 'Customer Research', 'Survey Design',
    'Market Sizing', 'Trend Analysis', 'Feasibility Study', 'Focus Groups', 'Data Collection',
  ],
  'E-commerce Management': [
    'Shopify', 'WooCommerce', 'Shopify Dropshipping', 'Amazon FBA', 'Etsy', 'Product Listings',
    'E-commerce Strategy', 'Payment Gateways', 'Inventory Management', 'E-commerce Store Setup',
    'Dropshipping', 'Amazon PPC', 'E-commerce SEO', 'Marketplace Management', 'Sales Analytics',
  ],
  'Project Management': [
    'Project Planning', 'Agile', 'Scrum', 'Kanban', 'JIRA', 'Asana', 'MS Project', 'Risk Management',
    'Stakeholder Management', 'Resource Planning', 'Project Scheduling', 'PMO', 'PMP', 'Project Management',
  ],
  'Virtual Assistance': [
    'Admin Support', 'Calendar Management', 'Email Management', 'Data Entry', 'Travel Planning',
    'Personal Assistant', 'Virtual Assistant', 'Customer Service', 'Appointment Setting',
    'Report Writing', 'Executive Assistant', 'Internet Research', 'Invoicing', 'Bookkeeping',
  ],
  'Content Writing': [
    'Blog Writing', 'Website Content', 'Article Writing', 'SEO Content', 'Long-form Content', 'Content Creation',
    'Product Descriptions', 'Newsletter Content', 'Social Media Content', 'How-to Guides', 'Business Writing', 'Content Writing',
  ],
  'Copywriting': [
    'Sales Copy', 'Ad Copy', 'Landing Page Copy', 'Email Copy', 'Marketing Copy', 'Product Copy',
    'Brand Copy', 'Persuasive Writing', 'Call to Action', 'Direct Response', 'Copy Editing', 'Ghostwriting', 'Copywriting',
  ],
  'Technical Writing': [
    'API Documentation', 'Software Documentation', 'Technical Guides', 'User Manuals', 'White Papers',
    'Technical Reports', 'Release Notes', 'Standard Operating Procedures', 'Knowledge Base', 'Medical Writing',
  ],
  'Translation': [
    'English Translation', 'Amharic Translation', 'Afaan Oromo Translation', 'Tigrinya Translation',
    'Somali Translation', 'Arabic Translation', 'French Translation', 'Document Translation',
    'Website Translation', 'Technical Translation', 'Legal Translation', 'Translation',
  ],
  'Editing & Proofreading': [
    'Proofreading', 'Copy Editing', 'Line Editing', 'Developmental Editing', 'Content Editing',
    'Grammar Checking', 'Style Guide', 'APA Format', 'Chicago Style', 'MLA Format', 'Substantive Editing',
  ],
  'Resume & CV Writing': [
    'Resume Writing', 'CV Writing', 'Cover Letter', 'ATS-friendly Resume', 'Executive Resume',
    'Professional Bio', 'LinkedIn Profile', 'Career Documents', 'Resume Editing',
  ],
  'Research & Summaries': [
    'Research Papers', 'Proposals', 'Thesis Writing', 'Grant Writing', 'Research Reports',
    'Case Studies', 'Literature Reviews', 'Dissertation Writing', 'Research Assistance', 'Document Summaries',
  ],
  'Academic Writing': [
    'Academic Writing', 'Essay Writing', 'Research Papers', 'Thesis Writing', 'Dissertation Writing',
    'Literature Reviews', 'Academic Editing', 'APA Format', 'MLA Format', 'Chicago Style',
    'Citation Management', 'Case Studies', 'Academic Reports',
  ],
  'Scriptwriting': [
    'Screenwriting', 'Script Coverage', 'Video Scripts', 'Ad Scripts', 'Storyboarding', 'Dialogue Writing',
    'Playwriting', 'Short Film Scripts', 'YouTube Scripts', 'Documentary Scripts', 'TV Scripts',
  ],
  'Creative Writing': [
    'Creative Writing', 'Short Stories', 'Fiction Writing', 'Poetry', 'Novel Writing', 'Storytelling',
    'Flash Fiction', 'Creative Nonfiction', 'World Building', 'Blog Storytelling',
  ],
  'Video Editing': [
    'Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'CapCut', 'Video Cuts', 'Multi-camera Editing',
    'Video Transitions', 'Social Media Videos', 'YouTube Videos', 'Reels & TikTok Editing',
    'Explainer Videos', 'Subtitles', 'Video Effects', 'Audio Sync',
  ],
  'Video Production': [
    'Cinematography', 'Videography', 'Filming', 'Video Production', 'Camera Operation', 'Lighting Setup',
    'Drone Footage', 'Event Coverage', 'Interviews', 'B-roll', 'Scripting for Video', 'Production Planning',
  ],
  'Animation': [
    '2D Animation', '3D Animation', 'After Effects', 'Motion Design', 'Character Animation', 'Stop Motion',
    'Whiteboard Animation', 'Lottie', 'Rigging', 'Blender Animation', 'Maya Animation', 'Cinema 4D Animation', 'Animatics',
  ],
  'Audio Editing': [
    'Audio Editing', 'Noise Reduction', 'Audio Restoration', 'Podcast Editing', 'Dialogue Editing', 'Audio Syncing',
    'EQ', 'Compression', 'Mixing', 'Mastering', 'Voice Processing',
  ],
  'Music Production': [
    'Music Production', 'Beat Making', 'Mixing', 'Mastering', 'Songwriting', 'Composing', 'Orchestration',
    'Arrangement', 'Music Recording', 'Sound Design', 'Jingle Creation', 'Audio Restoration',
  ],
  'Voice Over': [
    'Voice Acting', 'Narration', 'Commercial VO', 'Audiobook Narration', 'Character Voice', 'IVR Voice',
    'Animation Voice', 'Dubbing', 'Voice Recording', 'Accent Work', 'Multilingual VO',
  ],
  'Podcast Production': [
    'Podcast Editing', 'Podcast Launch', 'Episode Editing', 'Show Notes', 'Audio Mastering', 'Podcast Recording',
    'Intro & Outro Design', 'RSS Distribution', 'Interview Recording', 'Podcast Production',
  ],
  'Photography': [
    'Portrait Photography', 'Product Photography', 'Event Photography', 'Food Photography', 'Real Estate Photography',
    'Wedding Photography', 'Drone Photography', 'Fashion Photography', 'Nature Photography',
    'Photo Editing', 'Lightroom Editing', 'Photo Retouching',
  ],
  'Video & Audio Post-Production': [
    'Post-production', 'Color Grading', 'Sound Design', 'Mixing', 'Mastering', 'Audio Sync',
    'Noise Reduction', 'VFX', 'Visual Effects', 'Motion Tracking', 'Compositing', 'Subtitles', 'Closed Captions',
  ],
  'Professional Media Services': [
    'Live Streaming', 'Event Coverage', 'A/V Equipment', 'Drone Services', 'Media Production', 'Content Strategy',
    'Brand Films', 'Corporate Video', 'Social Media Content', 'Media Consulting', 'Photography', 'Videography',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY NAME MAP — every non-canonical category name that may exist in the
// database (legacy mains and subs) → canonical (main, sub). Used to migrate
// jobs, profiles, catalogs, users and skill taxonomies.
// ─────────────────────────────────────────────────────────────────────────────
export const LEGACY_NAME_MAP = {
  // Development & Technology
  'Web Development': ['Development & Technology', 'Web Development'],
  'Software & Application Development': ['Development & Technology', 'Software & Application Development'],
  'Mobile Development': ['Development & Technology', 'Mobile App Development'],
  'Mobile App Development': ['Development & Technology', 'Mobile App Development'],
  'Software Development': ['Development & Technology', 'Software & Application Development'],
  'Full Stack Development': ['Development & Technology', 'Software & Application Development'],
  'Database & API Development': ['Development & Technology', 'Database Development'],
  'Database Development': ['Development & Technology', 'Database Development'],
  'QA & Software Testing': ['Development & Technology', 'QA & Testing'],
  'Software Testing & QA': ['Development & Technology', 'QA & Testing'],
  'Data Science & AI': ['Development & Technology', 'Data Science & Analytics'],
  'Data Science & Analytics': ['Development & Technology', 'Data Science & Analytics'],
  'Data & Analytics': ['Development & Technology', 'Data Science & Analytics'],
  'AI & Automation': ['Development & Technology', 'AI & Machine Learning'],
  'AI & Machine Learning': ['Development & Technology', 'AI & Machine Learning'],
  'Cloud & DevOps': ['Development & Technology', 'DevOps & Cloud'],
  'DevOps': ['Development & Technology', 'DevOps & Cloud'],
  'DevOps & Cloud': ['Development & Technology', 'DevOps & Cloud'],
  'Cybersecurity': ['Development & Technology', 'Cybersecurity'],
  'Game Development': ['Development & Technology', 'Game Development'],
  'Blockchain & Web3': ['Development & Technology', 'Software & Application Development'],
  'Technology & Programming': ['Development & Technology', 'Software & Application Development'],
  'Development & IT': ['Development & Technology', 'Software & Application Development'],
  'Technology': ['Development & Technology', 'Software & Application Development'],
  'API Development': ['Development & Technology', 'Web Development'],
  'Backend Development': ['Development & Technology', 'Software & Application Development'],
  'Frontend Development': ['Development & Technology', 'Web Development'],
  'Programming & Coding': ['Development & Technology', 'Software & Application Development'],
  'Microservices': ['Development & Technology', 'Software & Application Development'],
  'Software Architecture': ['Development & Technology', 'Software & Application Development'],
  'Code Review': ['Development & Technology', 'Software & Application Development'],
  'iOS Development': ['Development & Technology', 'Mobile App Development'],
  'Android Development': ['Development & Technology', 'Mobile App Development'],
  'React Native': ['Development & Technology', 'Mobile App Development'],
  'Flutter': ['Development & Technology', 'Mobile App Development'],
  'Cross-Platform Development': ['Development & Technology', 'Mobile App Development'],
  'Mobile UI Design': ['Development & Technology', 'Mobile App Development'],
  'App Store Optimization': ['Development & Technology', 'Mobile App Development'],
  'Mobile Game Development': ['Development & Technology', 'Mobile App Development'],
  'Wearable App Development': ['Development & Technology', 'Mobile App Development'],
  'Mobile Backend': ['Development & Technology', 'Mobile App Development'],
  'WordPress Development': ['Development & Technology', 'Web Development'],
  'Shopify Development': ['Development & Technology', 'Web Development'],
  'E-commerce Development': ['Development & Technology', 'Web Development'],
  'CMS Development': ['Development & Technology', 'Web Development'],
  'Landing Page Design': ['Development & Technology', 'Web Development'],
  'Website Maintenance': ['Development & Technology', 'Web Development'],
  'Web Application Development': ['Development & Technology', 'Web Development'],
  'React Development': ['Development & Technology', 'Web Development'],
  'Vue.js Development': ['Development & Technology', 'Web Development'],
  'Desktop Application Development': ['Development & Technology', 'Software & Application Development'],
  'Enterprise Software': ['Development & Technology', 'Software & Application Development'],
  'API Integration': ['Development & Technology', 'Web Development'],
  'Scripting': ['Development & Technology', 'Software & Application Development'],
  'Embedded Systems': ['Development & Technology', 'Software & Application Development'],
  'ERP Development': ['Development & Technology', 'Software & Application Development'],
  'CRM Development': ['Development & Technology', 'Software & Application Development'],
  'Browser Extension Development': ['Development & Technology', 'Software & Application Development'],
  // Design & Creative
  'UI/UX & Graphic Design': ['Design & Creative', 'UI/UX Design'],
  'UI/UX Design': ['Design & Creative', 'UI/UX Design'],
  'UI Design': ['Design & Creative', 'UI/UX Design'],
  'UX Design': ['Design & Creative', 'UI/UX Design'],
  'Web & App Design': ['Design & Creative', 'UI/UX Design'],
  'Web Design': ['Design & Creative', 'UI/UX Design'],
  'Graphic Design': ['Design & Creative', 'Graphic Design'],
  'Logo & Brand Identity': ['Design & Creative', 'Logo & Brand Identity'],
  'Logo Design': ['Design & Creative', 'Logo & Brand Identity'],
  'Brand Identity': ['Design & Creative', 'Logo & Brand Identity'],
  'Product Design': ['Design & Creative', 'Product Design'],
  'Illustration': ['Design & Creative', 'Illustration'],
  '3D Design & Modeling': ['Design & Creative', '3D Design & Modeling'],
  'Motion & Animation': ['Design & Creative', 'Motion Graphics'],
  'Motion Graphics': ['Design & Creative', 'Motion Graphics'],
  'Architecture & Interior Design': ['Design & Creative', 'Architecture & Interior Design'],
  'Engineering & Architecture': ['Design & Creative', 'Architecture & Interior Design'],
  'Presentation Design': ['Design & Creative', 'Presentation Design'],
  'Fashion & Creative Design': ['Design & Creative', 'Fashion & Creative Design'],
  'Packaging Design': ['Design & Creative', 'Graphic Design'],
  'Print Design': ['Design & Creative', 'Graphic Design'],
  'Typography': ['Design & Creative', 'Graphic Design'],
  'Icon Design': ['Design & Creative', 'Graphic Design'],
  // Marketing & Business
  'Marketing & Sales': ['Marketing & Business', 'Digital Marketing'],
  'Digital Marketing': ['Marketing & Business', 'Digital Marketing'],
  'Marketing Strategy': ['Marketing & Business', 'Digital Marketing'],
  'Influencer Marketing': ['Marketing & Business', 'Digital Marketing'],
  'Affiliate Marketing': ['Marketing & Business', 'Digital Marketing'],
  'Conversion Optimization': ['Marketing & Business', 'Digital Marketing'],
  'Marketing Analytics': ['Marketing & Business', 'Digital Marketing'],
  'Advertising & PPC': ['Marketing & Business', 'Digital Marketing'],
  'Google Ads': ['Marketing & Business', 'Digital Marketing'],
  'PPC Advertising': ['Marketing & Business', 'Digital Marketing'],
  'Email Marketing': ['Marketing & Business', 'Digital Marketing'],
  'SEO': ['Marketing & Business', 'SEO'],
  'Social Media Marketing': ['Marketing & Business', 'Social Media Marketing'],
  'Content Marketing': ['Marketing & Business', 'Content Marketing'],
  'Sales & Business Development': ['Marketing & Business', 'Sales & Lead Generation'],
  'Sales & Lead Generation': ['Marketing & Business', 'Sales & Lead Generation'],
  'Sales & Business': ['Marketing & Business', 'Sales & Lead Generation'],
  'Sales & Customer Support': ['Marketing & Business', 'Sales & Lead Generation'],
  'Business Consulting': ['Marketing & Business', 'Business Consulting'],
  'Business & Consulting': ['Marketing & Business', 'Business Consulting'],
  'Business Plans': ['Marketing & Business', 'Business Consulting'],
  'Market Research': ['Marketing & Business', 'Market Research'],
  'E-commerce Management': ['Marketing & Business', 'E-commerce Management'],
  'Project Management': ['Marketing & Business', 'Project Management'],
  'Virtual Assistance': ['Marketing & Business', 'Virtual Assistance'],
  'Accounting & Finance': ['Marketing & Business', 'Business Consulting'],
  'Finance & Accounting': ['Marketing & Business', 'Business Consulting'],
  'Accounting': ['Marketing & Business', 'Business Consulting'],
  'Legal Services': ['Marketing & Business', 'Business Consulting'],
  'Legal': ['Marketing & Business', 'Business Consulting'],
  'HR & Recruitment': ['Marketing & Business', 'Business Consulting'],
  'Human Resources & Recruitment': ['Marketing & Business', 'Business Consulting'],
  'Human Resources': ['Marketing & Business', 'Business Consulting'],
  'Consulting': ['Marketing & Business', 'Business Consulting'],
  // Writing, Translation & Content
  'Writing & Content': ['Writing, Translation & Content', 'Content Writing'],
  'Writing & Translation': ['Writing, Translation & Content', 'Translation'],
  'Content Writing': ['Writing, Translation & Content', 'Content Writing'],
  'Copywriting': ['Writing, Translation & Content', 'Copywriting'],
  'Technical Writing': ['Writing, Translation & Content', 'Technical Writing'],
  'Blog & Article Writing': ['Writing, Translation & Content', 'Content Writing'],
  'Translation': ['Writing, Translation & Content', 'Translation'],
  'Localization': ['Writing, Translation & Content', 'Translation'],
  'Proofreading & Editing': ['Writing, Translation & Content', 'Editing & Proofreading'],
  'Proofreading': ['Writing, Translation & Content', 'Editing & Proofreading'],
  'Editing': ['Writing, Translation & Content', 'Editing & Proofreading'],
  'Resume & CV Writing': ['Writing, Translation & Content', 'Resume & CV Writing'],
  'Resume Writing': ['Writing, Translation & Content', 'Resume & CV Writing'],
  'Research & Academic Writing': ['Writing, Translation & Content', 'Research & Summaries'],
  'Research & Summaries': ['Writing, Translation & Content', 'Research & Summaries'],
  'Academic Writing': ['Writing, Translation & Content', 'Academic Writing'],
  'Grant Writing': ['Writing, Translation & Content', 'Research & Summaries'],
  'AI Content & Prompt Writing': ['Writing, Translation & Content', 'Content Writing'],
  'Scriptwriting': ['Writing, Translation & Content', 'Scriptwriting'],
  'Script Writing': ['Writing, Translation & Content', 'Scriptwriting'],
  'Creative Writing': ['Writing, Translation & Content', 'Creative Writing'],
  'Ghostwriting': ['Writing, Translation & Content', 'Copywriting'],
  'Business Writing': ['Writing, Translation & Content', 'Content Writing'],
  'Medical Writing': ['Writing, Translation & Content', 'Technical Writing'],
  // Video, Audio & Professional Services
  'Video & Animation': ['Video, Audio & Professional Services', 'Video Production'],
  'Video & Audio': ['Video, Audio & Professional Services', 'Video Production'],
  'Video Editing': ['Video, Audio & Professional Services', 'Video Editing'],
  'Video Production': ['Video, Audio & Professional Services', 'Video Production'],
  'Explainer Videos': ['Video, Audio & Professional Services', 'Video Editing'],
  'Social Media Videos': ['Video, Audio & Professional Services', 'Video Editing'],
  'Lyric Videos': ['Video, Audio & Professional Services', 'Video Editing'],
  'Animation & Motion Graphics': ['Video, Audio & Professional Services', 'Animation'],
  '3D Animation': ['Video, Audio & Professional Services', 'Animation'],
  '2D Animation': ['Video, Audio & Professional Services', 'Animation'],
  'Whiteboard Animation': ['Video, Audio & Professional Services', 'Animation'],
  'Animatics': ['Video, Audio & Professional Services', 'Animation'],
  'Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Portrait Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Product Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Event Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Food Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Real Estate Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Wedding Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Drone Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Fashion Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Nature Photography': ['Video, Audio & Professional Services', 'Photography'],
  'Photo Editing': ['Video, Audio & Professional Services', 'Photography'],
  'Photo Retouching': ['Video, Audio & Professional Services', 'Photography'],
  'Music & Audio Production': ['Video, Audio & Professional Services', 'Music Production'],
  'Music & Audio': ['Video, Audio & Professional Services', 'Music Production'],
  'Audio & Music': ['Video, Audio & Professional Services', 'Music Production'],
  'Music Production': ['Video, Audio & Professional Services', 'Music Production'],
  'Mixing & Mastering': ['Video, Audio & Professional Services', 'Music Production'],
  'Beat Making': ['Video, Audio & Professional Services', 'Music Production'],
  'Songwriting': ['Video, Audio & Professional Services', 'Music Production'],
  'Composing': ['Video, Audio & Professional Services', 'Music Production'],
  'Jingle Creation': ['Video, Audio & Professional Services', 'Music Production'],
  'Sound Design': ['Video, Audio & Professional Services', 'Music Production'],
  'Audio Editing': ['Video, Audio & Professional Services', 'Audio Editing'],
  'Audio Restoration': ['Video, Audio & Professional Services', 'Audio Editing'],
  'Podcast Production': ['Video, Audio & Professional Services', 'Podcast Production'],
  'Voice Over': ['Video, Audio & Professional Services', 'Voice Over'],
  'Voiceover': ['Video, Audio & Professional Services', 'Voice Over'],
  'Audiobook Narration': ['Video, Audio & Professional Services', 'Voice Over'],
  'Customer Support': ['Marketing & Business', 'Virtual Assistance'],
  'Admin & Customer Support': ['Marketing & Business', 'Virtual Assistance'],
  'Virtual Assistance & Administrative Support': ['Marketing & Business', 'Virtual Assistance'],
  'Data Entry': ['Marketing & Business', 'Virtual Assistance'],
  'Education & Training': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Professional Media Services': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Other Professional Services': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Lifestyle & Professional Services': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Healthcare & Wellness': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Healthcare': ['Video, Audio & Professional Services', 'Professional Media Services'],
  'Engineering & Manufacturing': ['Video, Audio & Professional Services', 'Professional Media Services'],
};

// String values stored directly on jobs.category (invalid ObjectIds) → canonical sub.
export const STRING_JOB_CATEGORY_MAP = {
  'Design': ['Design & Creative', 'UI/UX Design'],
  'Web Development': ['Development & Technology', 'Web Development'],
  'fullstack_development': ['Development & Technology', 'Software & Application Development'],
  'frontend_development': ['Development & Technology', 'Web Development'],
  'backend_development': ['Development & Technology', 'Software & Application Development'],
  'mobile_development': ['Development & Technology', 'Mobile App Development'],
  'data_science': ['Development & Technology', 'Data Science & Analytics'],
  'api_development': ['Development & Technology', 'Web Development'],
  'database': ['Development & Technology', 'Database Development'],
  'devops': ['Development & Technology', 'DevOps & Cloud'],
  'engineering': ['Development & Technology', 'Software & Application Development'],
  'general': ['Development & Technology', 'Software & Application Development'],
};

export const ALL_SUBCATEGORY_NAMES = Object.values(SUBCATEGORIES).flat();

export const getSubcategoriesForMain = (mainName) => SUBCATEGORIES[mainName] || [];

// Resolve a legacy (or canonical) category name to [mainName, subName].
export const resolveLegacyName = (name) => {
  if (!name) return null;
  const mapped = LEGACY_NAME_MAP[name];
  if (mapped) return mapped;
  // Canonical subcategory names resolve to themselves.
  for (const [mainName, subs] of Object.entries(SUBCATEGORIES)) {
    if (subs.includes(name)) return [mainName, name];
  }
  return null;
};
