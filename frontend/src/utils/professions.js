/**
 * Display helper: render a category subcategory as a person/profession label.
 *
 * Only the display label changes — filtering, routing and the category database
 * still use the canonical subcategory name/id. Falls back to the raw name when
 * a subcategory isn't in the known list.
 */

const PROFESSION_LABELS = {
  // Development & Technology
  'Web Development': 'Web Developer',
  'Mobile App Development': 'Mobile App Developer',
  'Software & Application Development': 'Software Developer',
  'Data Science & Analytics': 'Data Scientist',
  'AI & Machine Learning': 'AI & ML Engineer',
  'DevOps & Cloud': 'DevOps Engineer',
  Cybersecurity: 'Cybersecurity Specialist',
  'Database Development': 'Database Developer',
  'QA & Testing': 'QA & Testing Specialist',
  'Game Development': 'Game Developer',

  // Design & Creative
  'UI/UX Design': 'UI/UX Designer',
  'Graphic Design': 'Graphic Designer',
  'Logo & Brand Identity': 'Brand Identity Designer',
  'Product Design': 'Product Designer',
  Illustration: 'Illustrator',
  '3D Design & Modeling': '3D Designer',
  'Architecture & Interior Design': 'Architect & Interior Designer',
  'Presentation Design': 'Presentation Designer',
  'Motion Graphics': 'Motion Graphics Designer',
  'Fashion & Creative Design': 'Fashion Designer',

  // Marketing & Business
  'Digital Marketing': 'Digital Marketer',
  SEO: 'SEO Specialist',
  'Social Media Marketing': 'Social Media Marketer',
  'Content Marketing': 'Content Marketer',
  'Sales & Lead Generation': 'Sales & Lead Gen Specialist',
  'Business Consulting': 'Business Consultant',
  'Market Research': 'Market Researcher',
  'E-commerce Management': 'E-commerce Manager',
  'Project Management': 'Project Manager',
  'Virtual Assistance': 'Virtual Assistant',

  // Writing, Translation & Content
  'Content Writing': 'Content Writer',
  Copywriting: 'Copywriter',
  'Technical Writing': 'Technical Writer',
  Translation: 'Translator',
  'Editing & Proofreading': 'Editor & Proofreader',
  'Resume & CV Writing': 'Resume & CV Writer',
  'Research & Summaries': 'Research Specialist',
  'Academic Writing': 'Academic Writer',
  Scriptwriting: 'Scriptwriter',
  'Creative Writing': 'Creative Writer',

  // Video, Audio & Professional Services
  'Video Editing': 'Video Editor',
  'Video Production': 'Video Producer',
  Animation: 'Animator',
  'Audio Editing': 'Audio Editor',
  'Music Production': 'Music Producer',
  'Voice Over': 'Voice Over Artist',
  'Podcast Production': 'Podcast Producer',
  Photography: 'Photographer',
  'Video & Audio Post-Production': 'Post-Production Specialist',
  'Professional Media Services': 'Media Professional',
};

export const subcategoryToProfession = (name) => PROFESSION_LABELS[name] || name;
