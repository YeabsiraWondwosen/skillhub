import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RocketLaunchIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ComingSoonPage({ title = 'Coming Soon', description = 'This feature is under development and will be available soon.' }) {
  return (
    <div className="min-h-screen premium-dark-page flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-lg"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary-500/25">
          <RocketLaunchIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white mb-4">{title}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/" className="btn-primary font-bold">
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Home
          </Link>
          <Link to="/contact" className="btn-secondary font-bold">Contact Us</Link>
        </div>
      </motion.div>
    </div>
  );
}
