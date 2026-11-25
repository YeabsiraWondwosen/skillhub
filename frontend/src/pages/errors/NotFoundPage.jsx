import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="min-h-screen premium-dark-page flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="text-9xl font-black text-gradient mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('error.notFound')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          {t('error.notFoundDesc')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-4 h-4" /> {t('common.goBack')}
          </button>
          <Link to="/" className="btn-primary flex items-center gap-2">
            <HomeIcon className="w-4 h-4" /> {t('common.home')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
