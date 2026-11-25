import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LinkIcon } from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const SITEMAP = [
  { title: 'Browse', links: [
    { label: 'Home', to: '/' },
    { label: 'Browse Jobs', to: '/jobs' },
    { label: 'Find Talent', to: '/freelancers' },
    { label: 'Browse Services', to: '/catalogs' },
  ]},
  { title: 'Platform', links: [
    { label: 'About Us', to: '/about' },
    { label: 'Contact Us', to: '/contact' },
    { label: 'Blog', to: '/blog' },
    { label: 'Careers', to: '/careers' },
  ]},
  { title: 'Support', links: [
    { label: 'Help Center', to: '/help' },
    { label: 'FAQ', to: '/faq' },
    { label: 'Trust & Safety', to: '/trust-safety' },
    { label: 'Contact Support', to: '/support' },
  ]},
  { title: 'Legal', links: [
    { label: 'Terms of Service', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Cookie Policy', to: '/cookies' },
  ]},
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen premium-dark-page">
      <PageHero
        icon={LinkIcon}
        eyebrow="Overview"
        title="Sitemap"
        description="A complete overview of all pages on SkillHub."
        centered
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {SITEMAP.map(section => (
            <motion.div key={section.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <h2 className="font-bold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{section.title}</h2>
              <ul className="space-y-2">
                {section.links.map(link => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
