import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CommandLineIcon, ClockIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Avatar from '@/components/ui/Avatar';
import { formatCurrency } from '@/utils/currency';
import CategoryIcon from '@/utils/categoryIcons';

const deliveryLabel = (catalog) => {
  const tiers = catalog.pricingTiers || [];
  if (!tiers.length) return null;
  const fastest = tiers.reduce((a, b) => (a.deliveryTime <= b.deliveryTime ? a : b));
  const unit = fastest.deliveryUnit === 'weeks' ? 'week' : 'day';
  return `${fastest.deliveryTime} ${unit}${fastest.deliveryTime > 1 ? 's' : ''}`;
};

export default function CatalogCard({ catalog, index = 0 }) {
  const prices = (catalog.pricingTiers || [])
    .map((t) => t.price)
    .filter((v) => typeof v === 'number' && v > 0);
  const firstPricedTier = (catalog.pricingTiers || []).find((t) => typeof t.price === 'number' && t.price > 0);
  const currency = firstPricedTier?.currency || 'ETB';
  const startPrice = prices.length ? Math.min(...prices) : null;

  const freelancer = catalog.freelancer || {};
  const freelancerName = [freelancer.firstName, freelancer.lastName].filter(Boolean).join(' ') || 'Freelancer';
  const hasRating = typeof catalog.stats?.avgRating === 'number' && catalog.stats.avgRating > 0;
  const reviewCount = catalog.stats?.totalReviews || 0;
  const delivery = deliveryLabel(catalog);

  const category = typeof catalog.category === 'object' && catalog.category ? catalog.category : null;
  const subcategory = typeof catalog.subcategory === 'object' && catalog.subcategory ? catalog.subcategory : null;
  const skills = catalog.skills?.slice(0, 3) || [];
  const extraSkills = (catalog.skills?.length || 0) - 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        to={`/catalogs/${catalog.slug}`}
        className="card card-hover overflow-hidden block h-full flex flex-col"
      >
        {/* Cover */}
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary-500/10 to-secondary-500/10">
          {catalog.images?.length > 0 ? (
            <img src={catalog.images[0].url} alt={catalog.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CommandLineIcon className="w-12 h-12 text-primary-300 dark:text-primary-700" />
            </div>
          )}
          {category?.color && (
            <span
              className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm"
              style={{ backgroundColor: `${category.color}22`, color: category.color }}
            >
              {category.icon && <CategoryIcon icon={category.icon} size={14} className="inline-flex" />}
              <span className="bg-white/70 dark:bg-dark-900/70 px-1 rounded">{category.name}</span>
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1">
          {/* Subcategory + freelancer */}
          <div className="flex items-center gap-1.5 text-xs mb-2 flex-wrap">
            {subcategory && (
              <span className="font-medium text-primary-600 dark:text-primary-400">{subcategory.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Avatar src={freelancer.avatar?.url} alt={freelancerName} size="sm" />
            <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{freelancerName}</span>
            {freelancer.isVerifiedFreelancer && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                <CheckBadgeIcon className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-1 mb-1">
            {catalog.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{catalog.shortDescription}</p>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="text-[10px] bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
                >
                  {skill}
                </span>
              ))}
              {extraSkills > 0 && <span className="text-[10px] text-gray-400">+{extraSkills}</span>}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto flex items-end justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <div className="space-y-1">
              {hasRating ? (
                <span className="flex items-center gap-1 text-sm">
                  <StarSolid className="w-4 h-4 text-yellow-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{catalog.stats.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({reviewCount})</span>
                </span>
              ) : (
                <span className="text-xs text-gray-400">No reviews yet</span>
              )}
              {delivery && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {delivery}
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Starting at</p>
              <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                {startPrice !== null ? formatCurrency(startPrice, currency) : '—'}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
