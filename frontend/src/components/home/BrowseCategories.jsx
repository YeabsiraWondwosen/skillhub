import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { useCategoryTree } from '@/hooks/useCategories';
import CategoryIcon from '@/utils/categoryIcons';
import Skeleton from '@/components/ui/Skeleton';

const CATEGORY_IMAGES = {
  'development-technology':
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1400&auto=format&fit=crop',
  'design-creative':
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop',
  'marketing-business':
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
  'writing-translation-content':
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop',
  'video-audio-professional-services':
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200&auto=format&fit=crop',
};

const LAYOUTS = [
  { variant: 'featured', className: 'sm:col-span-2 lg:col-span-3 lg:row-span-2' },
  { variant: 'tile', className: 'lg:col-span-3' },
  { variant: 'tile', className: 'lg:col-span-3' },
  { variant: 'row', className: 'lg:col-span-3' },
  { variant: 'row', className: 'lg:col-span-3' },
];

function categorySlug(category) {
  return (
    category.slug ||
    category.name?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') ||
    category._id
  );
}

function Media({ category, image }) {
  const accent = category.color || '#6366f1';
  return (
    <>
      {image && (
        <img
          src={image}
          alt={category.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${accent}33 0%, transparent 55%)`,
        }}
      />
    </>
  );
}

function FeaturedCard({ category, index }) {
  const { t } = useTranslation();
  const slug = categorySlug(category);
  const image = CATEGORY_IMAGES[slug] || category.bannerImage || '';

  return (
    <Link
      to={`/categories/${slug}`}
      className="group relative flex h-full min-h-[300px] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-dark-900 shadow-card ring-1 ring-white/10 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-glow lg:min-h-0"
    >
      <div aria-hidden className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover:scale-110">
        <Media category={category} image={image} />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-dark-950/95 via-dark-900/55 to-dark-900/10" />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <CategoryIcon icon={category.icon} size={24} className="text-white/90" />
          </span>
          <span className="font-mono text-sm tracking-[0.3em] text-white/40">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <div className="space-y-3.5">
          <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {category.name}
          </h3>
          {category.description && (
            <p className="max-w-lg text-sm leading-relaxed text-white/70 line-clamp-2">
              {category.description}
            </p>
          )}
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-dark-900 shadow-lg transition-all duration-300 group-hover:gap-3 group-hover:bg-primary-500 group-hover:text-white">
            {t('browseCategories.explore')}
            <ArrowRightIcon className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function TileCard({ category, index }) {
  const { t } = useTranslation();
  const slug = categorySlug(category);
  const image = CATEGORY_IMAGES[slug] || category.bannerImage || '';

  return (
    <Link
      to={`/categories/${slug}`}
      className="group relative flex h-full min-h-[220px] flex-col justify-end overflow-hidden rounded-3xl bg-dark-900 shadow-card ring-1 ring-white/10 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-glow"
    >
      <div aria-hidden className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
        <Media category={category} image={image} />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-dark-950/95 via-dark-900/60 to-dark-900/15" />
      <div className="relative z-10 space-y-2.5 p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <CategoryIcon icon={category.icon} size={18} className="text-white/90" />
          </span>
          <span className="font-mono text-xs tracking-[0.3em] text-white/40">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-white">{category.name}</h3>
          {category.description && (
            <p className="mt-1 text-sm leading-relaxed text-white/65 line-clamp-2">
              {category.description}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white transition-colors duration-300 group-hover:text-primary-300">
          {t('browseCategories.explore')}
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function RowCard({ category, index }) {
  const { t } = useTranslation();
  const slug = categorySlug(category);
  const image = CATEGORY_IMAGES[slug] || category.bannerImage || '';

  return (
    <Link
      to={`/categories/${slug}`}
      className="group relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-gray-200 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-card-hover dark:bg-dark-800 dark:ring-white/10 lg:min-h-0 lg:flex-row"
    >
      <div className="relative z-10 flex flex-1 flex-col justify-between p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100 dark:bg-primary-500/10 dark:ring-primary-500/20">
            <CategoryIcon icon={category.icon} size={20} className="text-primary-600 dark:text-primary-400" />
          </span>
          <span className="font-mono text-xs tracking-[0.3em] text-gray-300 dark:text-white/30">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-gray-900 sm:text-lg dark:text-white">
            {category.name}
          </h3>
          {category.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500 line-clamp-2 dark:text-gray-400">
              {category.description}
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 dark:text-primary-400">
            {t('browseCategories.explore')}
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
      <div className="relative h-36 w-full overflow-hidden lg:h-auto lg:w-2/5">
        <div aria-hidden className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
          <Media category={category} image={image} />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-primary-900/25 to-transparent lg:bg-gradient-to-l" />
      </div>
    </Link>
  );
}

function CategoryCard({ category, index }) {
  const layout = LAYOUTS[index] || { variant: 'tile', className: 'lg:col-span-2' };
  const Card = layout.variant === 'featured' ? FeaturedCard : layout.variant === 'row' ? RowCard : TileCard;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: index * 0.07 } } }}
      className={layout.className}
    >
      <Card category={category} index={index} />
    </motion.div>
  );
}

function CardSkeleton({ layout }) {
  return (
    <div className={`${layout.className}`}>
      <div className="h-full min-h-[200px] rounded-3xl bg-white shadow-card dark:bg-dark-800">
        <Skeleton className="!rounded-none h-full w-full" />
      </div>
    </div>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

export default function BrowseCategories() {
  const { t } = useTranslation();
  const { data: tree, isLoading } = useCategoryTree();
  const parents = tree?.data ?? [];

  return (
    <section className="py-20 sm:py-24 bg-gray-50 dark:bg-dark-900/50" aria-labelledby="browse-categories-title">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 text-sm font-semibold mb-5"
          >
            <Squares2X2Icon className="w-4 h-4" />
            {t('browseCategories.badge')}
          </motion.div>
          <motion.h2
            id="browse-categories-title"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight"
          >
            {t('browseCategories.title')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            {t('browseCategories.subtitle')}
          </motion.p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[205px] gap-4 sm:gap-5">
            {LAYOUTS.map((layout, i) => (
              <CardSkeleton key={i} layout={layout} />
            ))}
          </div>
        ) : parents.length === 0 ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-gray-500 dark:text-gray-400 py-20"
          >
            {t('browseCategories.noResults')}
          </motion.p>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[205px] gap-4 sm:gap-5"
          >
            {parents.map((cat, i) => (
              <CategoryCard key={cat._id} category={cat} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
