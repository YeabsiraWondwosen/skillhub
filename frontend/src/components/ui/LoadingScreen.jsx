import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-900" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <img src="/images/skillhub-logo-dark.png" alt="SkillHub" className="w-9 h-9 object-contain dark:hidden" />
            <img src="/images/skillhub-logo-light.png" alt="SkillHub" className="w-9 h-9 object-contain hidden dark:block" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading SkillHub…</p>
      </motion.div>
    </div>
  );
}
