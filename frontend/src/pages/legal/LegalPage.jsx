import { motion } from 'framer-motion';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import PageHero from '@/components/ui/PageHero';

export default function LegalPage({ title, subtitle, lastUpdated, children }) {
  return (
    <div className="min-h-screen premium-dark-page">
      <PageHero
        backTo="/"
        icon={DocumentTextIcon}
        title={title}
        subtitle={subtitle}
      >
        {lastUpdated && (
          <p className="mt-3 text-sm text-white/45">Last updated: {lastUpdated}</p>
        )}
      </PageHero>

      <motion.div
        initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16"
      >
        <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed prose-li:text-gray-600 dark:prose-li:text-gray-400 prose-strong:text-gray-900 dark:prose-strong:text-white">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
