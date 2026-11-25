import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookmarkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSavedCatalogs, useToggleSaveCatalog } from '@/hooks/useCatalogs';
import CatalogCard from '@/components/catalogs/CatalogCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function SavedServicesPage() {
  const { data, isLoading } = useSavedCatalogs();
  const saved = data?.data ?? [];
  const { mutate: toggleSave } = useToggleSaveCatalog();

  const handleRemove = (catalogId, title) => {
    toggleSave(catalogId, {
      onSuccess: () => toast.success(`Removed "${title}" from saved services`),
    });
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={BookmarkIcon}
        title="Saved Services"
        subtitle="Services you have bookmarked for later"
        actions={<Link to="/catalogs" className="btn-secondary">Browse Services</Link>}
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : saved.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={BookmarkIcon} title="No saved services"
            description="Bookmark services you like to find them quickly later."
            action={<Link to="/catalogs" className="btn-primary btn-sm">Browse Services</Link>} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {saved.map((catalog, i) => (
            <motion.div key={catalog._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }} className="relative">
              <button
                onClick={() => handleRemove(catalog._id, catalog.title)}
                title="Remove from saved"
                className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-dark-800/90 shadow-sm text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
              <CatalogCard catalog={catalog} index={i} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
